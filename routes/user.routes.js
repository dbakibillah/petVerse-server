const express = require("express");
const router = express.Router();
const { ObjectId } = require("mongodb");
const { client } = require("../config/db");
//! user database
const userCollection = client.db("petVerse").collection("users");

router.get("/users", async (req, res) => {
    const cursor = userCollection.find();
    const result = await cursor.toArray();
    res.send(result);
});

router.get("/user", async (req, res) => {
    const { email } = req.query;
    const user = await userCollection.findOne({ email });
    res.json({ exists: !!user });
});

router.get("/singleuser", async (req, res) => {
    const { email } = req.query;
    const user = await userCollection.findOne({ email });
    return res.status(200).json({
        success: true,
        data: user,
    });
});

router.post("/users", async (req, res) => {
    const user = req.body;
    const result = await userCollection.insertOne(user);
    res.send(result);
});

module.exports = router;
