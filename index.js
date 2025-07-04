const express = require("express");
const cors = require("cors");
require("dotenv").config();
const cookieParser = require("cookie-parser");
const app = express();
const port = process.env.PORT || 5000;

//! Import routes
const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");
const productRoutes = require("./routes/product.routes");
const cartRoutes = require("./routes/cart.routes");
const threadRoutes = require("./routes/thread.routes");
const groomingRoutes = require("./routes/grooming.routes");
const healthcareRoutes = require("./routes/healthcare.routes");
const paymentRoutes = require("./routes/payment.routes");

// Import database connection
const { connectToDatabase } = require("./config/db");

// middleware
app.use(
    cors({
        origin: [
            "http://localhost:5173",
            "https://project-petverse.netlify.app",
            "https://petverse-8f5b7.web.app",
        ],
        credentials: true,
    })
);
app.use(express.json());
app.use(cookieParser());

// Basic route
app.get("/", (req, res) => {
    res.send("aastha server is running...");
});

//! Use routes
app.use("/", authRoutes);
app.use("/", userRoutes);
app.use("/", productRoutes);
app.use("/", cartRoutes);
app.use("/", threadRoutes);
app.use("/", groomingRoutes);
app.use("/", healthcareRoutes);
app.use("/", paymentRoutes);


// Connect to database and start server
connectToDatabase()
    .then(() => {
        app.listen(port, () => {
            console.log(`Server running on port ${port}`);
        });
    })
    .catch((error) => {
        console.error("Failed to start server:", error);
        process.exit(1);
    });
