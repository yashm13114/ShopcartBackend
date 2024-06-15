const mongoose = require("mongoose");
const UserVerificationModel = mongoose.Schema({
    userId: {
        type: String,
    },
    uniqueString: {
        type: String
    },
    createdAt: {
        type: Date
    },
    expiresAt: {
        type: Date
    }
});
const UserVerification = mongoose.model("UserVerification", UserVerificationModel);
module.exports = UserVerification;