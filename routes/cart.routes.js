const express = require("express");
const router = express.Router();
const { ObjectId } = require("mongodb");
const { client } = require("../config/db");

//! cart database
const cartCollection = client.db("petVerse").collection("carts");

// 1️⃣ CREATE CART
router.post("/carts", async (req, res) => {
    const { cartData } = req.body;
    const result = await cartCollection.insertOne(cartData);
    res.send(result);
});

// 2️⃣ GET CART of a user
router.get("/carts", async (req, res) => {
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
router.patch("/carts", async (req, res) => {
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
router.patch("/carts/increase", async (req, res) => {
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
            userCart.cartItems.reduce((sum, i) => sum + i.price, 0).toFixed(2)
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
router.patch("/carts/decrease", async (req, res) => {
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
            userCart.cartItems.reduce((sum, i) => sum + i.price, 0).toFixed(2)
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
router.delete("/carts/item", async (req, res) => {
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
            updatedItems.reduce((sum, item) => sum + item.price, 0).toFixed(2)
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
router.delete("/carts/clear", async (req, res) => {
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

module.exports = router;