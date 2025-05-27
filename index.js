const express = require("express");
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 5000;

//! task: Database Create kora lagbe
//? Database Create kora lagbe
//TODO: Database Create kora lagbe

// middleware
app.use(
    cors({
        origin: ["http://localhost:5173", "https://medicamp-76a03.web.app"],
        credentials: true,
    })
);
app.use(express.json());
app.use(cookieParser());

app.get("/", (req, res) => {
    res.send("petVerse server is running...");
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

// JWT middleware
const verifyToken = (req, res, next) => {
    if (!req.headers.authorization) {
        return res.status(401).send({ message: "unauthorized access" });
    }
    const token = req.headers.authorization.split(" ")[1];
    jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
        if (err) {
            console.log(err);
            return res.status(401).send({ message: "unauthorized access" });
        }
        req.decoded = decoded;
        next();
    });
};

// MongoDB connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.a8qb8.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
});

async function run() {
    // jwt authentication
    app.post("/jwt", (req, res) => {
        const { email, name, picture } = req.body;
        const token = jwt.sign(
            { email, name, picture },
            process.env.ACCESS_TOKEN,
            {
                expiresIn: "24h",
            }
        );

        res.cookie("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        }).send({ success: true, token });
    });

    app.post("/logout", (req, res) => {
        res.clearCookie("token", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        }).send({ success: true });
    });

    //! user database
    const userCollection = client.db("petVerse").collection("users");
    // use verify admin
    const verifyAdmin = async (req, res, next) => {
        const email = req.decoded.email;
        const query = { email: email };
        const user = await userCollection.findOne(query);
        const isAdmin = user?.type === "admin";
        if (!isAdmin) {
            return res.status(403).send({ message: "forbidden access" });
        }
        next();
    };

    app.get("/users", async (req, res) => {
        const cursor = userCollection.find();
        const result = await cursor.toArray();
        res.send(result);
    });

    app.get("/user", async (req, res) => {
        const { email } = req.query;
        const user = await userCollection.findOne({ email });
        res.json({ exists: !!user });
    });

    app.post("/users", async (req, res) => {
        const user = req.body;
        const result = await userCollection.insertOne(user);
        res.send(result);
    });

    //! products database
    const productCollection = client.db("petVerse").collection("products");
    // ✅ Get all products
    app.get("/products", async (req, res) => {
        const cursor = productCollection.find();
        const result = await cursor.toArray();
        res.send(result);
    });

    // ✅ Get product by ID
    app.get("/product/:id", async (req, res) => {
        const { id } = req.params;
        const query = { _id: new ObjectId(id) };
        const product = await productCollection.findOne(query);

        if (!product) {
            return res.status(404).send({ error: "Product not found" });
        }

        res.send(product);
    });

    // Payment request
    const paymentCollection = client.db("mediCamp").collection("payments");
    app.get("/payment/:id", verifyToken, async (req, res) => {
        const { id } = req.params;
        const result = await participantCollection.findOne({
            _id: new ObjectId(id),
        });
        if (result) {
            res.status(200).send(result);
        } else {
            res.status(404).send({
                success: false,
                message: "Participant not found",
            });
        }
    });

    // Stripe Payment Intent
    app.post("/create-payment-intent", verifyToken, async (req, res) => {
        const { amount } = req.body;

        if (!amount || isNaN(amount)) {
            return res
                .status(400)
                .send({ success: false, message: "Invalid amount" });
        }

        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount * 100), // Amount in cents
            currency: "usd",
            payment_method_types: ["card"],
        });

        res.send({
            success: true,
            clientSecret: paymentIntent.client_secret,
        });
    });

    // Handle payment and store payment history
    app.post("/make-payment", verifyToken, async (req, res) => {
        const { email, campId, campName, amount, transactionId } = req.body;

        if (!email || !campId || !amount || !transactionId) {
            return res
                .status(400)
                .send({ success: false, message: "Missing required fields" });
        }

        const paymentRecord = {
            participantEmail: email,
            joinedCampId: new ObjectId(campId),
            campName,
            amount,
            transactionId,
            date: new Date(),
        };

        const paymentResult = await paymentCollection.insertOne(paymentRecord);

        if (paymentResult.insertedId) {
            res.status(201).send({
                success: true,
                message: "Payment successful",
            });
        } else {
            res.status(500).send({ success: false, message: "Payment failed" });
        }
    });

    // Update payment status (participant)
    app.put("/update-payment-status/:id", verifyToken, async (req, res) => {
        const { id } = req.params;
        const { paymentStatus } = req.body;

        const result = await participantCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: { paymentStatus } }
        );

        if (result.modifiedCount === 1) {
            res.status(200).send({ success: true, message: "Status updated" });
        } else {
            res.status(404).send({
                success: false,
                message: "Registration not found",
            });
        }
    });

    // Update confirmation status (organizer)
    app.put("/update-confirmation/:id", async (req, res) => {
        const { id } = req.params;

        try {
            const result = await participantCollection.updateOne(
                { _id: new ObjectId(id) },
                { $set: { confirmationStatus: "Confirmed" } }
            );

            if (result.modifiedCount === 1) {
                res.status(200).send({
                    success: true,
                    message: "Status updated",
                });
            } else {
                res.status(404).send({
                    success: false,
                    message: "Registration not found",
                });
            }
        } catch (error) {
            console.error(error);
            res.status(500).send({
                success: false,
                message: "Internal Server Error",
            });
        }
    });

    // Fetch payment history by participant email
    app.get("/payment-history/:email", verifyToken, async (req, res) => {
        const { email } = req.params;
        const payments = await paymentCollection
            .find({ participantEmail: email })
            .toArray();

        if (payments.length > 0) {
            res.status(200).send({ success: true, data: payments });
        } else {
            res.status(404).send({
                success: false,
                message: "No payments found",
            });
        }
    });

    // Function ends here *****************************************************************************
}

run().catch(console.dir);
