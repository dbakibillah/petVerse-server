const express = require("express");
const router = express.Router();
const { ObjectId } = require("mongodb");
const { client } = require("../config/db");

//! Grooming database
const groomingCollection = client.db("petVerse").collection("grooming");

// Get all grooming services
router.get("/grooming", async (req, res) => {
    const result = await groomingCollection.find().toArray();
    res.send(result);
});

// Post a new grooming appointment
router.post("/grooming/appointment", async (req, res) => {
    const groomingService = req.body;
    const result = await groomingCollection.insertOne(groomingService);
    res.send(result);
});

module.exports = router;
