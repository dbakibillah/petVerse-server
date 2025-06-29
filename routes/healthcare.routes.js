const express = require("express");
const router = express.Router();
const { ObjectId } = require("mongodb");
const { client } = require("../config/db");

// Database collection
const healthcareCollection = client.db("petVerse").collection("healthcare");

// Status validation middleware
const validateStatus = (req, res, next) => {
    const validStatuses = ["pending", "confirmed", "completed", "cancelled"];
    if (
        req.body.status &&
        !validStatuses.includes(req.body.status.toLowerCase())
    ) {
        return res.status(400).json({
            error: "Invalid status value",
            validStatuses,
            received: req.body.status,
        });
    }
    next();
};

// ObjectId validation middleware
const validateObjectId = (req, res, next) => {
    if (!ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ error: "Invalid appointment ID" });
    }
    next();
};

router.post("/healthcare", validateStatus, async (req, res) => {
    try {
        const appointment = req.body;

        // Required field validation
        const requiredFields = [
            "petName",
            "ownerName",
            "phone",
            "address",
            "petType",
            "breed", // Fixed typo (was "breed")
        ];
        const missingFields = requiredFields.filter(
            (field) => !appointment[field]
        );

        if (missingFields.length > 0) {
            return res.status(400).json({
                error: "Missing required fields",
                missingFields,
            });
        }

        // Set default values
        appointment.status = appointment.status || "pending";
        appointment.createdAt = new Date();
        appointment.updatedAt = new Date();

        const result = await healthcareCollection.insertOne(appointment);
        res.status(201).json({
            _id: result.insertedId,
            ...appointment,
        });
    } catch (error) {
        console.error("Error creating appointment:", error);
        res.status(500).json({ error: "Failed to create appointment" });
    }
});

// Create a new healthcare appointment (POST /healthcare)
router.post("/healthcare/appointment", async (req, res) => {
    try {
        console.log("Received healthcare appointment data:", req.body);
        const healthCareData = req.body;

        // Updated validation to match frontend fields
        const requiredFields = [
            "petName",
            "petType",
            "phone",
            "address",
            "friendly",
            "trained",
            "vaccinated",
            "pickupTime",
            "deliveryTime", // Note: This matches the frontend's spelling
        ];

        const missingFields = requiredFields.filter((field) => {
            // Check if field is missing or empty string
            return (
                healthCareData[field] === undefined ||
                healthCareData[field] === ""
            );
        });

        if (missingFields.length > 0) {
            return res.status(400).json({
                error: "Missing required fields",
                missingFields,
                message: `Please provide: ${missingFields.join(", ")}`,
            });
        }

        // Set default status if not provided
        healthCareData.status = healthCareData.status || "pending";

        // Add owner information from the frontend
        healthCareData.ownerName = healthCareData.ownerName || "Anonymous";
        healthCareData.ownerEmail = healthCareData.ownerEmail || "Anonymous";

        // Add timestamps
        healthCareData.createdAt = new Date();
        healthCareData.updatedAt = new Date();

        // Insert the new appointment
        const result = await healthcareCollection.insertOne(healthCareData);

        if (result.insertedId) {
            res.status(201).json({
                message: "Appointment created successfully",
                insertedId: result.insertedId,
                appointment: healthCareData,
            });
        } else {
            res.status(500).json({
                error: "Failed to create appointment",
                details: "Database operation failed",
            });
        }
    } catch (error) {
        console.error("Error creating appointment:", error);
        res.status(500).json({
            error: "Internal server error",
            details: error.message,
        });
    }
});

// Get all healthcare appointments (GET /healthcare)
router.get("/healthcare", async (req, res) => {
    try {
        const appointments = await healthcareCollection
            .find()
            .sort({ createdAt: -1 })
            .toArray();
        res.status(200).json(appointments);
    } catch (error) {
        console.error("Error fetching appointments:", error);
        res.status(500).json({ error: "Failed to fetch appointments" });
    }
});

// Update appointment status (PATCH /healthcare/:id)
router.patch(
    "/healthcare/:id",
    validateObjectId,
    validateStatus,
    async (req, res) => {
        try {
            const { status } = req.body;
            const updateDoc = {
                $set: {
                    status,
                    updatedAt: new Date(),
                },
            };

            const result = await healthcareCollection.updateOne(
                { _id: new ObjectId(req.params.id) },
                updateDoc
            );

            if (result.matchedCount === 0) {
                return res.status(404).json({ error: "Appointment not found" });
            }

            res.status(200).json({
                message: "Status updated successfully",
                modifiedCount: result.modifiedCount,
            });
        } catch (error) {
            console.error("Error updating status:", error);
            res.status(500).json({ error: "Failed to update status" });
        }
    }
);

// Update entire appointment (PUT /healthcare/:id)
router.put(
    "/healthcare/:id",
    validateObjectId,
    validateStatus,
    async (req, res) => {
        console.log("Updating appointment with ID:", req.params.id);
        try {
            const updatedAppointment = req.body;

            // Remove _id from the update payload if it exists
            if (updatedAppointment._id) {
                delete updatedAppointment._id;
            }

            // Required field validation
            const requiredFields = [
                "petName",
                "ownerName",
                "phone",
                "address",
                "petType",
                "breed",
            ];
            const missingFields = requiredFields.filter(
                (field) => !updatedAppointment[field]
            );

            if (missingFields.length > 0) {
                return res.status(400).json({
                    error: "Missing required fields",
                    missingFields,
                });
            }

            const updateDoc = {
                $set: {
                    ...updatedAppointment,
                    updatedAt: new Date(),
                },
            };

            const result = await healthcareCollection.updateOne(
                { _id: new ObjectId(req.params.id) },
                updateDoc
            );

            if (result.matchedCount === 0) {
                return res.status(404).json({ error: "Appointment not found" });
            }

            res.status(200).json({
                message: "Appointment updated successfully",
                modifiedCount: result.modifiedCount,
            });
        } catch (error) {
            console.error("Error updating appointment:", error);
            res.status(500).json({ error: "Failed to update appointment" });
        }
    }
);

// Delete appointment (DELETE /healthcare/:id)
router.delete("/healthcare/:id", validateObjectId, async (req, res) => {
    try {
        const result = await healthcareCollection.deleteOne({
            _id: new ObjectId(req.params.id),
        });

        if (result.deletedCount === 0) {
            return res.status(404).json({ error: "Appointment not found" });
        }

        res.status(200).json({
            message: "Appointment deleted successfully",
            deletedCount: result.deletedCount,
        });
    } catch (error) {
        console.error("Error deleting appointment:", error);
        res.status(500).json({ error: "Failed to delete appointment" });
    }
});

module.exports = router;
