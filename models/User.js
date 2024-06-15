const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const jwt = require("jsonwebtoken");
const userSchema = mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please enter your Name']
    },
    email: {
        type: String,
        required: [true, 'Please enter your Name']
    },
    password: {
        type: String,
        required: [true, 'Please enter your Name']
    },
    mobileNumber: {
        type: String,
        required: [true, 'Please enter your phne number']
    },
    verified: {
        type: Boolean,
    },
    verifytoken: {
        type: String,
    }


})
userSchema.methods.comparePassword = async function(candidatePassword) {
    try {
        return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
        throw new Error(error);
    }
};
userSchema.methods.generateAuthToken = async function() {
    const token = jwt.sign({ _id: this._id }, process.env.JWT_SECRET_KEY);
    return token;
};
const User = mongoose.model("User", userSchema)
module.exports = User