// Load environment variables from .env file
require('dotenv').config();

console.log('MONGODB_URI:', process.env.MONGODB_URI); // Add this line to check the value

const mongoose = require("mongoose");

mongoose.connect(process.env.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    })
    .then(() => {
        console.log("mongodb connected");
    })
    .catch((err) => {
        console.log("error: " + err);
    });