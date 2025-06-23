const express = require("express");
const router = express.Router();
const { ObjectId } = require("mongodb");
const { client } = require("../config/db");

//! Payment request
const paymentCollection = client.db("mediCamp").collection("payments");
router.get("/payment/:id", verifyToken, async (req, res) => {
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
router.post("/create-payment-intent", verifyToken, async (req, res) => {
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
router.post("/make-payment", verifyToken, async (req, res) => {
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
router.put("/update-payment-status/:id", verifyToken, async (req, res) => {
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
router.put("/update-confirmation/:id", async (req, res) => {
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
router.get("/payment-history/:email", verifyToken, async (req, res) => {
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

module.exports = router;
