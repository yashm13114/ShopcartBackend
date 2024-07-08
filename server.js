require("./config/db")
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const UserRouter = require("./api/User")
const app = express(); // Create an instance of an Express application
const cookieParser = require('cookie-parser');
app.use(bodyParser.json()); // Use bodyParser to parse JSON bodies into JS objects
app.use(cookieParser());
app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
        "Access-Control-Allow-Headers",
        "Origin, X-Requested-With, Content-Type, Accept, Authorization"
    );
    res.setHeader("Access-Control-Allow-Methods", "GET, POST,,PUT, PATCH, DELETE");
    next();
});
app.set({
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
});
app.use('/user', UserRouter)
app.use(
    cors({
        credentials: true,
        origin: "http://localhost:5173/",
    })
);
const port = 5000;
app.listen(port, () => {
    console.log("server is running at: " + port);
});