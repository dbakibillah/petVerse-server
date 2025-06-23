const { client } = require("../config/db");
const verifyToken = require("./verifyToken");

const verifyAdmin = async (req, res, next) => {
    const userCollection = client.db("petVerse").collection("users");
    const email = req.decoded.email;
    const query = { email: email };
    const user = await userCollection.findOne(query);
    const isAdmin = user?.type === "admin";
    if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
    }
    next();
};

module.exports = verifyAdmin;
