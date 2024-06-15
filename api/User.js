const express = require("express");
const router = express.Router();
const User = require("../models/User");
const UserVerification = require("../models/UserVerification");
const nodemailer = require("nodemailer");
const { v4: uuidv4 } = require("uuid");
require("dotenv").config();
const bcrypt = require("bcrypt");
const path = require("path");
const jwt = require("jsonwebtoken");
const keysecret = process.env.SECRET_KEY;
// nodemailer stuff
let transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.AUTH_EMAIL,
        pass: process.env.AUTH_PASS,
    },
});

// testing process
transporter.verify((error, success) => {
    if (error) {
        console.log(error);
    } else {
        console.log("ready for messages");
        console.log(success);
    }
});
const sendVerificationEmail = ({ _id, email }, res) => {
    const currentUrl = "http://localhost:5000/";
    const uniqueString = uuidv4() + _id;

    const mailOptions = {
        from: process.env.AUTH_EMAIL,
        to: email,
        subject: "Verify your email",
        html: `<p>Verify your email address to complete the signup and login into your account.</p>
    <p>This link is expire in 6 hours</b>.</p>
    <p>Press <a href=${
      currentUrl + "user/verify/" + _id + "/" + uniqueString
    }>here</a> to proceed</p>`,
    };
    const saltRounds = 10;
    bcrypt
        .hash(uniqueString, saltRounds)
        .then((hashedUniqueSTring) => {
            const newVerificattion = new UserVerification({
                userId: _id,
                uniqueString: hashedUniqueSTring,
                createdAt: Date.now(),
                expiresAt: Date.now() + 21600000,
            });
            newVerificattion
                .save()
                .then(() => {
                    transporter
                        .sendMail(mailOptions)
                        .then(() => {
                            res.json({
                                status: "PENDING",
                                message: "Verification email sent",
                            });
                        })
                        .catch((err) => {
                            console.log(err);
                            res.json({
                                status: "FAILED",
                                message: "verification email failed",
                            });
                        });
                })
                .catch((err) => {
                    console.log(err);
                    res.json({
                        status: "FAILED",
                        message: "couldn't save verification data",
                    });
                });
        })
        .catch(() => {
            res.json({
                status: "FAILED",
                message: "error occured whine hasing email data ",
            });
        });
};
// verify email
router.get("/verify/:userId/:uniqueString", (req, res) => {
    let { userId, uniqueString } = req.params;
    UserVerification.find({ userId })
        .then((result) => {
            if (result.length > 0) {
                const { expiresAt } = result[0];
                const hashedUniqueString = result[0].uniqueString;

                if (expiresAt < Date.now()) {
                    UserVerification.deleteOne({ userId })
                        .then((result) => {
                            User.deleteOne({ _id: userId })
                                .then(() => {
                                    let message = "Link has expired. Please signup again";
                                    res.redirect(
                                        ` /users/verified?error=true&message=${message}`
                                    );
                                })
                                .catch((e) => {
                                    let message =
                                        "Clearing user with expired unique string failed";
                                    res.redirect(
                                        ` /users/verified?error=true&message=${message}`
                                    );
                                });
                        })
                        .catch((e) => {
                            console.log(e);
                            let message =
                                "An error ocurred while clearing expired user verification record";
                            res.redirect(` /users/verified?error=true&message=${message}`);
                        });
                } else {
                    bcrypt
                        .compare(uniqueString, hashedUniqueString)
                        .then((result) => {
                            if (result) {
                                User.updateOne({ _id: userId }, { verified: true })
                                    .then(() => {
                                        UserVerification.deleteOne({ userId })
                                            .then(() => {
                                                res.sendFile(
                                                    path.join(__dirname, "../views/verified.html")
                                                );
                                            })
                                            .catch((e) => {
                                                console.log(e);
                                                let message =
                                                    "An error ocurred while finalizing succesfull verification.";
                                                res.redirect(
                                                    ` /users/verified?error=true&message=${message}`
                                                );
                                            });
                                    })
                                    .catch((e) => {
                                        console.log(e);
                                        let message =
                                            "An error ocurred while updating user record to show verified";
                                        res.redirect(
                                            ` /users/verified?error=true&message=${message}`
                                        );
                                    });
                            } else {
                                let message =
                                    "Invalid varification details passed. Check your inbox";
                                res.redirect(` /users/verified?error=true&message=${message}`);
                            }
                        })
                        .catch((e) => {
                            let message = "An error ocurred while comparing unique strings";
                            res.redirect(` /users/verified?error=true&message=${message}`);
                        });
                }
            } else {
                let message =
                    "Account record doesn't exist or has been verified already. Please sign up or log in.";
                res.redirect(` /users/verified?error=true&message=${message}`);
            }
        })
        .catch((e) => {
            console.log(e);
            let message =
                "An error ocurred while checking for existing user verification record";
            res.redirect(` /users/verified?error=true&message=${message}`);
        });
});
// verified page route
router.get("/verified", (req, res) => {
    res.sendFile(path.join(__dirname, "../views/verified.html"));
});
// signup
router.post("/signup", async(req, res) => {
    const { name, email, password, mobileNumber } = req.body;

    // Check if any field is empty
    if (!name || !email || !password || !mobileNumber) {
        return res.json({
            status: "FAILED",
            message: "Fill input fields",
        });
    }

    // Validate name (only alphabet characters and spaces)
    if (!/^[a-zA-Z\s]+$/.test(name)) {
        return res.json({
            status: "FAILED",
            message: "Invalid name entered",
        });
    }

    // Validate email
    if (!/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email)) {
        return res.json({
            status: "FAILED",
            message: "Invalid email entered",
        });
    }

    // Validate password length
    if (password.length < 8) {
        return res.json({
            status: "FAILED",
            message: "Password is too short",
        });
    }

    try {
        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.json({
                status: "FAILED",
                message: "User already exists",
            });
        }

        // Hash the password
        const saltRounds = 10;
        const hashPassword = await bcrypt.hash(password, saltRounds);

        // Create and save the new user
        const newUser = new User({
            name,
            email,
            password: hashPassword,
            mobileNumber,
            verified: false,
        });

        // const result = await newUser.save()
        newUser
            .save()
            .then((result) => {
                sendVerificationEmail(result, res);
            })
            .catch((err) => {
                console.error("Error during signup:", err);
                return res.json({
                    status: "FAILED",
                    message: "An error occurred during saving account",
                });
            });

        // return res.json({
        //     status: "SUCCESS",
        //     message: "Signup successfully",
        //     data: result,
        // });
    } catch (err) {
        console.error("Error during signup:", err);
        return res.json({
            status: "FAILED",
            message: "An error occurred during signup",
        });
    }
});
// sign in for cookies
// router.post("/signin", async (req, res) => {
//   const { email, password } = req.body;

//   try {
//     const user = await User.findOne({ email });
//     if (!user) {
//       return res
//         .status(400)
//         .json({ status: "FAILED", message: "Invalid credentials" });
//     }

//     const isMatch = await user.comparePassword(password); // Assuming you have a method to compare passwords
//     if (!isMatch) {
//       return res
//         .status(400)
//         .json({ status: "FAILED", message: "Invalid password" });
//     }

//     const userData = {
//       _id: user._id,
//       name: user.name,
//       email: user.email,
//       // Include any other relevant user data
//     };

//     console.log("User data to be sent:", userData); // Log the user data

//     return res.json({
//       status: "SUCCESS",
//       message: "Signin successful",
//       user: userData,
//     });
//   } catch (error) {
//     console.error("Signin error:", error);
//     return res.status(500).json({ status: "FAILED", message: "Server error" });
//   }
// });
// signin for localstorage
// router.post("/signin", (req, res) => {
//     const { email, password } = req.body;
//     if (email == "" || password == "") {
//         res.json({
//             status: "FAILED",
//             message: "fill unput fields",
//         });
//     } else {
//         User.find({ email })
//             .then((data) => {
//                 if (data.length) {
//                     if (!data[0].verified) {
//                         res.json({
//                             status: "FAILED",
//                             message: "Email hasn't been verified yet. Check your inbox",
//                         });
//                     } else {
//                         const hashedPassword = data[0].password;
//                         bcrypt
//                             .compare(password, hashedPassword)
//                             .then((result) => {
//                                 if (result) {
//                                     res.json({
//                                         status: "SUCCESS",
//                                         message: "signin succesfull",
//                                         user: {
//                                             id: data._id,
//                                             email: data.email,
//                                             name: data.name,
//                                             // other user details...
//                                         }
//                                     });
//                                 } else {
//                                     res.json({
//                                         status: "FAILED",
//                                         message: "invalid password entered",
//                                     });
//                                 }
//                             })
//                             .catch((e) => {
//                                 res.json({
//                                     status: "FAILED",
//                                     message: "error while comparing passwords",
//                                 });
//                             });
//                     }
//                 } else {
//                     res.json({
//                         status: "FAILED",
//                         message: "invalid credentials entered",
//                     });
//                 }
//             })
//             .catch((e) => {
//                 res.json({
//                     status: "FAILED",
//                     message: "error occured while checking for existing user",
//                 });
//             });
//     }
// });

// signin for localstorage correct// Assuming bcryptjs for password hashing

router.post("/signin", (req, res) => {
    const { email, password } = req.body;

    if (email === "" || password === "") {
        return res.json({
            status: "FAILED",
            message: "Fill input fields",
        });
    }

    User.findOne({ email })
        .then((user) => {
            if (!user) {
                return res.json({
                    status: "FAILED",
                    message: "Invalid credentials entered",
                });
            }

            if (!user.verified) {
                return res.json({
                    status: "FAILED",
                    message: "Email hasn't been verified yet. Check your inbox",
                });
            }

            // Compare hashed password with user provided password
            bcrypt.compare(password, user.password)
                .then((passwordMatch) => {
                    if (!passwordMatch) {
                        return res.json({
                            status: "FAILED",
                            message: "Invalid password entered",
                        });
                    }

                    // If credentials are valid, return the user data
                    return res.json({
                        status: "SUCCESS",
                        message: "Sign in successful",
                        user
                    });
                })
                .catch((e) => {
                    console.error("Error while comparing passwords:", e);
                    return res.json({
                        status: "FAILED",
                        message: "Error while comparing passwords",
                    });
                });
        })
        .catch((e) => {
            console.error("Error occurred while checking for existing user:", e);
            return res.json({
                status: "FAILED",
                message: "Error occurred while checking for existing user",
            });
        });
});


// router.post("/signin", async(req, res) => {
//     const { email, password } = req.body;

//     if (!email || !password) {
//         return res.status(422).json({ error: "Fill all the details" });
//     }

//     try {
//         // Find user by email
//         const user = await User.findOne({ email });

//         if (!user) {
//             return res
//                 .status(401)
//                 .json({ status: "FAILED", message: "Invalid credentials" });
//         }

//         if (!user.verified) {
//             return res.json({
//                 status: "FAILED",
//                 message: "Email hasn't been verified yet. Check your inbox",
//             });
//         }

//         // Compare passwords
//         const isMatch = await bcrypt.compare(password, user.password);

//         if (!isMatch) {
//             return res.json({
//                 status: "FAILED",
//                 message: "Invalid password entered",
//             });
//         }

//         // Generate authentication token
//         const token = await user.generateAuthToken();

//         // Set cookie
//         res.cookie("usercookie", token, {
//             expires: new Date(Date.now() + 9000000),
//             httpOnly: true,
//         });

//         // Respond with success
//         const result = {
//             user,
//             token,
//         };
//         res.status(201).json({
//             status: "SUCCESS",
//             message: "Signin successful",
//             result
//         });
//     } catch (error) {
//         console.error("Signin error:", error);
//         res.status(500).json({ status: "FAILED", message: "Server error" });
//     }
// });
router.post("/sendpasswordlink", async(req, res) => {
    console.log(req.body);

    const { email } = req.body;

    if (!email) {
        res.status(401).json({ status: 401, message: "Enter Your Email" });
    }

    try {
        const userfind = await User.findOne({ email: email });

        // token generate for reset password
        const token = jwt.sign({ _id: userfind._id }, keysecret, {
            expiresIn: "120s",
        });

        const setusertoken = await User.findByIdAndUpdate({ _id: userfind._id }, { verifytoken: token }, { new: true });

        if (setusertoken) {
            const mailOptions = {
                from: process.env.AUTH_EMAIL,
                to: email,
                subject: "Email For password Reset",
                text: `This Link Valid For 2 MINUTES http://localhost:5173/#/forgotpass/${userfind.id}/${setusertoken.verifytoken}`,
            };

            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.log("error", error);
                    res.status(401).json({ status: 401, message: "email not send" });
                } else {
                    console.log("Email sent", info.response);
                    res
                        .status(201)
                        .json({ status: 201, message: "Email sent Succsfully" });
                }
            });
        }
    } catch (error) {
        res.status(401).json({ status: 401, message: "invalid user" });
    }
});
// verify user for forgot password time
router.get("/forgotpassword/:id/:token", async(req, res) => {
    const { id, token } = req.params;

    try {
        const validuser = await User.findOne({ _id: id, verifytoken: token });

        const verifyToken = jwt.verify(token, keysecret);

        console.log(verifyToken);

        if (validuser && verifyToken._id) {
            res.status(201).json({ status: 201, validuser });
        } else {
            res.status(401).json({ status: 401, message: "user not exist" });
        }
    } catch (error) {
        res.status(401).json({ status: 401, error });
    }
});

// change password

router.post("/:id/:token", async(req, res) => {
    const { id, token } = req.params;

    const { password } = req.body;

    try {
        const validuser = await User.findOne({ _id: id, verifytoken: token });

        const verifyToken = jwt.verify(token, keysecret);

        if (validuser && verifyToken._id) {
            const newpassword = await bcrypt.hash(password, 12);

            const setnewuserpass = await User.findByIdAndUpdate({ _id: id }, { password: newpassword });

            setnewuserpass.save();
            res.status(201).json({ status: 201, setnewuserpass });
        } else {
            res.status(401).json({ status: 401, message: "user not exist" });
        }
    } catch (error) {
        res.status(401).json({ status: 401, error });
    }
});
router.get("/logout", async(req, res) => {
    try {
        // Filter out the token from req.rootUser.tokens array
        req.rootUser.tokens = req.rootUser.tokens.filter((currElem) => {
            return currElem.token !== req.token;
        });

        // Clear the "usercookie" cookie
        res.clearCookie("usercookie", { path: "/" });

        // Save the updated user object
        await req.rootUser.save();

        // Respond with a success status
        res.status(200).json({ status: 200, message: "Logout successful" });
    } catch (error) {
        console.error("Logout error:", error);
        // Handle any errors that occur during the logout process
        res.status(500).json({ status: 500, error: "Logout failed" });
    }
});

module.exports = router;