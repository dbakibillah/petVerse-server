const express = require("express");
const router = express.Router();
const { ObjectId } = require("mongodb");
const { client } = require("../config/db");

//! Database collection
const groomingCollection = client.db("petVerse").collection("grooming");

// Status validation middleware
const validateStatus = (req, res, next) => {
    const validStatuses = ["pending", "Confirmed", "Completed", "Cancelled"];
    if (req.body.status && !validStatuses.includes(req.body.status)) {
        return res.status(400).json({ error: "Invalid status value" });
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

// Create a new grooming appointment (POST /grooming)
router.post("/grooming", validateStatus, async (req, res) => {
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

        const result = await groomingCollection.insertOne(appointment);
        res.status(201).json({
            _id: result.insertedId,
            ...appointment,
        });
    } catch (error) {
        console.error("Error creating appointment:", error);
        res.status(500).json({ error: "Failed to create appointment" });
    }
});

//! Create new grooming appointment (POST /grooming/appointment)
router.post("/grooming/appointment", async (req, res) => {
    try {
        const groomingData = req.body;

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
            "deliveryTime",
        ];

        const missingFields = requiredFields.filter((field) => {
            // Check if field is missing or empty string
            return (
                groomingData[field] === undefined || groomingData[field] === ""
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
        groomingData.status = groomingData.status || "pending";

        // Add timestamps
        groomingData.createdAt = new Date();
        groomingData.updatedAt = new Date();

        // Insert the new appointment
        const result = await groomingCollection.insertOne(groomingData);

        if (result.insertedId) {
            res.status(201).json({
                message: "Appointment created successfully",
                insertedId: result.insertedId,
                appointment: groomingData,
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

// Get all grooming appointments (GET /grooming)
router.get("/grooming", async (req, res) => {
    try {
        const appointments = await groomingCollection
            .find()
            .sort({ createdAt: -1 })
            .toArray();
        res.status(200).json(appointments);
    } catch (error) {
        console.error("Error fetching appointments:", error);
        res.status(500).json({ error: "Failed to fetch appointments" });
    }
});

// Update appointment status (PATCH /grooming/:id)
router.patch(
    "/grooming/:id",
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

            const result = await groomingCollection.updateOne(
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

// Update entire appointment (PUT /grooming/:id)
router.put(
    "/grooming/:id",
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

            const result = await groomingCollection.updateOne(
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

// Delete appointment (DELETE /grooming/:id)
router.delete("/grooming/:id", validateObjectId, async (req, res) => {
    try {
        const result = await groomingCollection.deleteOne({
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
