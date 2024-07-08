const jwt = require('jsonwebtoken');
const User = require('./models/User'); // Adjust path as per your project structure
const jwt_secret = "mysecretkey"
const authenticate = async(req, res, next) => {
    try {
        const token = req.header('Authorization').replace('Bearer ', '');
        const decoded = jwt.verify(token, jwt_secret); // Replace with your actual JWT secret

        // Find user by decoded user ID and matching token
        const user = await User.findOne({ _id: decoded._id, 'tokens.token': token });

        if (!user) {
            throw new Error('User not found');
        }

        // Attach token and user to request object for further middleware or routes
        req.token = token;
        req.user = user;

        next(); // Call next to proceed to the next middleware/route handler
    } catch (error) {
        console.error('Authentication error:', error);
        res.status(401).send({ error: 'Please authenticate.' });
    }
};

module.exports = authenticate;