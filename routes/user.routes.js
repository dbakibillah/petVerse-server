const express = require("express");
const router = express.Router();
const { ObjectId } = require("mongodb");
const { client } = require("../config/db");
//! user database
const userCollection = client.db("petVerse").collection("users");

// Get all users
router.get("/users", async (req, res) => {
    const cursor = userCollection.find();
    const result = await cursor.toArray();
    res.send(result);
});

// Check if user exists
router.get("/user", async (req, res) => {
    const { email } = req.query;
    const user = await userCollection.findOne({ email });
    res.json({ exists: !!user });
});

// Get single user by email
router.get("/singleuser", async (req, res) => {
    const { email } = req.query;
    try {
        const user = await userCollection.findOne({ email });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }
        return res.status(200).json({
            success: true,
            data: user,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message,
        });
    }
});

// Create new user
router.post("/users", async (req, res) => {
    try {
        const user = req.body;
        // Check if user already exists
        const existingUser = await userCollection.findOne({
            email: user.email,
        });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: "User already exists",
            });
        }

        // Add default pet array if not provided
        if (!user.pets) {
            user.pets = [];
        }

        const result = await userCollection.insertOne(user);
        return res.status(201).json({
            success: true,
            data: result,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to create user",
            error: error.message,
        });
    }
});

// Update user profile
router.patch("/updateuser", async (req, res) => {
    try {
        const { email, ...updateData } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email is required for updating user",
            });
        }

        const result = await userCollection.updateOne(
            { email },
            { $set: updateData }
        );

        if (result.modifiedCount === 0) {
            return res.status(404).json({
                success: false,
                message: "User not found or no changes made",
            });
        }

        return res.status(200).json({
            success: true,
            message: "User updated successfully",
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to update user",
            error: error.message,
        });
    }
});
module.exports = router;
