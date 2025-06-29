const express = require("express");
const router = express.Router();
const { ObjectId } = require("mongodb");
const { client } = require("../config/db");

//! SSLCommerz Payment Integration
const SSLCommerzPayment = require("sslcommerz-lts");
const store_id = process.env.STORE_ID;
const store_passwd = process.env.STORE_PASS;
const is_live = false; //true for live, false for sandbox

// Generate a unique transaction ID
const transanctionId = new ObjectId().toString();

const orderCollection = client.db("petVerse").collection("orders");

router.post("/order", async (req, res) => {
    const orderData = req.body;
    const data = {
        total_amount: orderData?.totalAmount, // Number of items in the cart
        currency: "BDT",
        tran_id: transanctionId, // use unique tran_id for each api call
        success_url: "http://localhost:5173/",
        fail_url: "http://localhost:3030/fail",
        cancel_url: "http://localhost:3030/cancel",
        ipn_url: "http://localhost:3030/ipn",
        shipping_method: "Courier",
        product_name: "PetVerse Order",
        product_category: "Electronic",
        product_profile: "general",
        cus_name: "Customer Name",
        cus_email: "customer@example.com",
        cus_add1: "Dhaka",
        cus_add2: "Dhaka",
        cus_city: "Dhaka",
        cus_state: "Dhaka",
        cus_postcode: "1000",
        cus_country: "Bangladesh",
        cus_phone: "01711111111",
        cus_fax: "01711111111",
        ship_name: "Customer Name",
        ship_add1: "Dhaka",
        ship_add2: "Dhaka",
        ship_city: "Dhaka",
        ship_state: "Dhaka",
        ship_postcode: 1000,
        ship_country: "Bangladesh",
        products: orderData?.cartItems,
    };
    const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
    sslcz.init(data).then((apiResponse) => {
        // Redirect the user to payment gateway
        let GatewayPageURL = apiResponse.GatewayPageURL;
        res.send({ url: GatewayPageURL });

        orderCollection.insertOne({
            transactionId: transanctionId,
            ...orderData,
            status: "Confirmed",
            createdAt: new Date(),
        });
    });
});

//! get all orders for order collection
router.get("/orders", async (req, res) => {
    try {
        const orders = await orderCollection.find({}).toArray();
        res.status(200).json(orders);
    } catch (error) {
        console.error("Error fetching orders:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

module.exports = router;
