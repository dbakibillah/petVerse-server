const express = require("express");
const router = express.Router();
const { ObjectId } = require("mongodb");
const { client } = require("../config/db");
const verifyToken = require("../middleware/verifyToken");

//! products database
const productCollection = client.db("petVerse").collection("products");
// ✅ Get all products
router.get("/products", async (req, res) => {
    const cursor = productCollection.find();
    const result = await cursor.toArray();
    res.send(result);
});

// ✅ Get product by ID
router.get("/product/:id", async (req, res) => {
    const { id } = req.params;
    const query = { _id: new ObjectId(id) };
    const product = await productCollection.findOne(query);

    if (!product) {
        return res.status(404).send({ error: "Product not found" });
    }
    res.send(product);
});

router.post("/add-product", verifyToken, async (req, res) => {
    const newProduct = req.body;
    const result = await productCollection.insertOne(newProduct);
    res.send(result);
});

module.exports = router;
