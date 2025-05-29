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

    //! cart database
    const cartCollection = client.db("petVerse").collection("carts");

    // 1️⃣ CREATE CART
    app.post("/carts", async (req, res) => {
        const { cartData } = req.body;
        const result = await cartCollection.insertOne(cartData);
        res.send(result);
    });

    // 2️⃣ GET CART of a user
    app.get("/carts", async (req, res) => {
        try {
            const email = req.query.email;
            if (!email) {
                return res.status(400).json({ message: "Email is required" });
            }

            const cart = await cartCollection.findOne({ email });

            if (!cart) {
                return res.status(200).json(null);
            }

            res.status(200).json(cart);
        } catch (error) {
            console.error("Error fetching cart:", error);
            res.status(500).json({ message: "Failed to fetch cart" });
        }
    });

    // 3️⃣ Update Cart
    app.patch("/carts", async (req, res) => {
        try {
            const { email, newItem } = req.body;

            const userCart = await cartCollection.findOne({ email });

            if (!userCart) {
                return res.status(404).json({ message: "Cart not found" });
            }

            // Push new item with updated timestamp
            userCart.cartItems.push({
                ...newItem,
                addedAt: new Date().toISOString(),
            });

            // Recalculate total items and total price
            userCart.totalItems = userCart.cartItems.reduce(
                (sum, item) => sum + item.quantity,
                0
            );

            userCart.totalPrice = userCart.cartItems.reduce(
                (sum, item) => sum + item.price * item.quantity,
                0
            );

            userCart.updatedAt = new Date();

            // Save the updated cart document
            const updatedCart = await cartCollection.findOneAndUpdate(
                { email },
                { $set: userCart },
                { new: true } // return the updated document
            );

            res.json(updatedCart);
        } catch (error) {
            console.error("Failed to update cart:", error);
            res.status(500).json({ message: "Internal server error" });
        }
    });

    // 4️⃣ Increase Quantity
    app.patch("/carts/increase", async (req, res) => {
        const { email, productId } = req.body;

        try {
            // Find the user's cart
            const userCart = await cartCollection.findOne({ email });

            if (!userCart) {
                return res.status(404).json({ message: "Cart not found" });
            }

            // Find the item in the cart
            const itemIndex = userCart.cartItems.findIndex(
                (item) => item.productId === productId
            );

            if (itemIndex === -1) {
                return res
                    .status(404)
                    .json({ message: "Product not found in cart" });
            }

            // Get the existing item
            const item = userCart.cartItems[itemIndex];

            // Calculate the original unit price (before any discounts)
            const originalUnitPrice =
                item.price / (1 - (item.discount ?? 0) / 100) / item.quantity;

            // Apply discount to get the discounted unit price
            const discountedUnitPrice =
                originalUnitPrice * (1 - (item.discount ?? 0) / 100);

            // Update quantity and price
            item.quantity += 1;
            item.price = parseFloat(
                (discountedUnitPrice * item.quantity).toFixed(2)
            );
            item.addedAt = new Date().toISOString();

            // Update cart totals
            userCart.totalItems = userCart.cartItems.reduce(
                (sum, i) => sum + i.quantity,
                0
            );
            userCart.totalPrice = parseFloat(
                userCart.cartItems
                    .reduce((sum, i) => sum + i.price, 0)
                    .toFixed(2)
            );
            userCart.updatedAt = new Date();

            // Save the updated cart
            const result = await cartCollection.updateOne(
                { email },
                { $set: userCart }
            );

            res.json({ message: "Quantity increased", result });
        } catch (error) {
            console.error("Error increasing quantity:", error);
            res.status(500).json({ message: "Server error" });
        }
    });

    // 5️⃣ Decrease Quantity
    app.patch("/carts/decrease", async (req, res) => {
        const { email, productId } = req.body;

        try {
            // Find the user's cart
            const userCart = await cartCollection.findOne({ email });

            if (!userCart) {
                return res.status(404).json({ message: "Cart not found" });
            }

            // Find the item in the cart
            const itemIndex = userCart.cartItems.findIndex(
                (item) => item.productId === productId
            );

            if (itemIndex === -1) {
                return res
                    .status(404)
                    .json({ message: "Product not found in cart" });
            }

            // Get the existing item
            const item = userCart.cartItems[itemIndex];

            // Prevent quantity from going below 1
            if (item.quantity <= 1) {
                return res
                    .status(400)
                    .json({ message: "Quantity cannot be less than 1" });
            }

            // Calculate the original unit price (before any discounts)
            const originalUnitPrice =
                item.price / (1 - (item.discount ?? 0) / 100) / item.quantity;

            // Apply discount to get the discounted unit price
            const discountedUnitPrice =
                originalUnitPrice * (1 - (item.discount ?? 0) / 100);

            // Update quantity and price
            item.quantity -= 1;
            item.price = parseFloat(
                (discountedUnitPrice * item.quantity).toFixed(2)
            );
            item.addedAt = new Date().toISOString();

            // Update cart totals
            userCart.totalItems = userCart.cartItems.reduce(
                (sum, i) => sum + i.quantity,
                0
            );
            userCart.totalPrice = parseFloat(
                userCart.cartItems
                    .reduce((sum, i) => sum + i.price, 0)
                    .toFixed(2)
            );
            userCart.updatedAt = new Date();

            // Save the updated cart
            const result = await cartCollection.updateOne(
                { email },
                { $set: userCart }
            );

            res.json({ message: "Quantity decreased", result });
        } catch (error) {
            console.error("Error decreasing quantity:", error);
            res.status(500).json({ message: "Server error" });
        }
    });

    // 6️⃣ Remove product from cart
    app.delete("/carts/item", async (req, res) => {
        const { email, productId } = req.body;

        try {
            // Find the user's cart
            const cart = await cartCollection.findOne({ email });
            if (!cart) {
                return res.status(404).json({ message: "Cart not found" });
            }

            // Filter out the item to be removed
            const updatedItems = cart.cartItems.filter(
                (item) => item.productId !== productId
            );

            // Recalculate totals
            const totalItems = updatedItems.reduce(
                (sum, item) => sum + item.quantity,
                0
            );
            const totalPrice = parseFloat(
                updatedItems
                    .reduce((sum, item) => sum + item.price, 0)
                    .toFixed(2)
            );

            // Update the cart
            const result = await cartCollection.updateOne(
                { email },
                {
                    $set: {
                        cartItems: updatedItems,
                        totalItems,
                        totalPrice,
                        updatedAt: new Date(),
                    },
                }
            );

            res.json({ message: "Item deleted from cart", result });
        } catch (error) {
            console.error("Delete error:", error);
            res.status(500).json({ message: "Server error" });
        }
    });

    // 7️⃣ Clear cart
    app.delete("/carts/clear", async (req, res) => {
        const { email } = req.body;

        try {
            const result = await cartCollection.updateOne(
                { email },
                {
                    $set: {
                        cartItems: [],
                        totalItems: 0,
                        totalPrice: 0,
                        updatedAt: new Date(),
                    },
                }
            );

            res.send({ message: "Cart cleared", result });
        } catch (error) {
            console.error("Error clearing cart:", error);
            res.status(500).send({ message: "Internal server error" });
        }
    });

    //! Threads database
    const threadsCollection = client.db("petVerse").collection("threads");

    // 1️⃣ Get all forum posts ✅
    app.get("/threads", async (req, res) => {
        try {
            const result = await threadsCollection.find({}).toArray();
            res.json(result);
        } catch (error) {
            console.error("Error fetching forum posts:", error);
            res.status(500).json({ message: "Server error" });
        }
    });

    // 2️⃣ Get a specific forum post by ID
    app.get("/threads/:id", async (req, res) => {
        const { id } = req.params;
        try {
            const result = await threadsCollection.findOne({
                _id: new ObjectId(id),
            });
            if (result) {
                res.json(result);
            } else {
                res.status(404).json({ message: "Forum post not found" });
            }
        } catch (error) {
            console.error("Error fetching forum post:", error);
            res.status(500).json({ message: "Server error" });
        }
    });

    // 3️⃣ Create a new forum post ✅
    app.post("/threads", async (req, res) => {
        try {
            const newThread = req.body;

            // Optional: Basic validation
            if (
                !newThread.postTitle ||
                !newThread.postDescription ||
                !newThread.authorEmail
            ) {
                return res
                    .status(400)
                    .json({ message: "Missing required fields" });
            }

            newThread.createdAt = new Date();
            const result = await threadsCollection.insertOne(newThread);

            res.status(201).json({
                success: true,
                message: "Thread created successfully",
                insertedId: result.insertedId,
            });
        } catch (error) {
            console.error("Error inserting thread:", error);
            res.status(500).json({ message: "Server error" });
        }
    });

    // 4️⃣ Update Liked count ✅
    app.patch("/threads/:id", async (req, res) => {
        const threadId = req.params.id;
        const { userEmail } = req.body;

        try {
            // First verify the thread exists
            const thread = await threadsCollection.findOne({
                _id: new ObjectId(threadId),
            });
            if (!thread) {
                return res.status(404).json({ message: "Thread not found" });
            }

            // Ensure likedBy array exists
            const likedBy = thread.likedBy || [];
            const hasLiked = likedBy.includes(userEmail);

            let updateQuery = {};
            if (hasLiked) {
                updateQuery = {
                    $pull: { likedBy: userEmail },
                    $inc: { likesCount: -1 },
                };
            } else {
                updateQuery = {
                    $addToSet: { likedBy: userEmail },
                    $inc: { likesCount: 1 },
                };
            }

            // Update the document
            const result = await threadsCollection.updateOne(
                { _id: new ObjectId(threadId) },
                updateQuery
            );

            if (result.modifiedCount === 0) {
                return res.status(400).json({ message: "Update failed" });
            }

            // Get the updated document
            const updatedThread = await threadsCollection.findOne({
                _id: new ObjectId(threadId),
            });

            res.json({
                success: true,
                liked: !hasLiked,
                likesCount: updatedThread.likesCount,
            });
        } catch (error) {
            console.error("Error toggling like:", error);
            res.status(500).json({ message: "Server error" });
        }
    });

    //!  Comment database
    app.patch("/threads/comment/:id", async (req, res) => {
        const { id } = req.params;
        const { newComment } = req.body;

        const result = await threadsCollection.updateOne(
            { _id: new ObjectId(id) },
            { $push: { comments: newComment } }
        );

        if (result.modifiedCount > 0) {
            res.send({ success: true });
        } else {
            res.send({ success: false });
        }
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
