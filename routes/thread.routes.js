const express = require("express");
const router = express.Router();
const { ObjectId } = require("mongodb");
const { client } = require("../config/db");

//! Threads database
const threadsCollection = client.db("petVerse").collection("threads");

// 1️⃣ Get all forum posts ✅
router.get("/threads", async (req, res) => {
    try {
        const result = await threadsCollection.find({}).toArray();
        res.json(result);
    } catch (error) {
        console.error("Error fetching forum posts:", error);
        res.status(500).json({ message: "Server error" });
    }
});

// 2️⃣ Get a specific forum post by ID
router.get("/threads/:id", async (req, res) => {
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
router.post("/threads", async (req, res) => {
    try {
        const newThread = req.body;

        // Optional: Basic validation
        if (
            !newThread.postTitle ||
            !newThread.postDescription ||
            !newThread.authorEmail
        ) {
            return res.status(400).json({ message: "Missing required fields" });
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
router.patch("/threads/:id", async (req, res) => {
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

//  Comment database
router.patch("/threads/comment/:id", async (req, res) => {
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

module.exports = router;
