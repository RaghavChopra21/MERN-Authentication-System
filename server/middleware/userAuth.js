import jwt from "jsonwebtoken";

const userAuth = async (req, res, next)=>{
    const {token} = req.cookies;

    if(!token){
        // 🛑 Send a 401 status when unauthorized to signal the client explicitly
        return res.status(401).json({success: false, message: 'Not Authorized. Please log in again.'});
    }

    try {
        const tokenDecode = jwt.verify(token, process.env.JWT_SECRET);

        if(tokenDecode.id){
            // ✅ FIX: Attach the ID directly to the request object
            // This property (req.userId) will now be available in your userController.js
            req.userId = tokenDecode.id; 
            next();
        }else{
            // Token verified but missing expected ID payload
            return res.status(401).json({success: false, message: 'Invalid token structure.'});
        }

    } catch (error) {
        // Token is invalid/expired. Clear the cookie and return 401.
        res.clearCookie('token');
        console.error("JWT Verification failed:", error.message);
        return res.status(401).json({success: false, message: 'Session expired. Please log in again.'});
    }
}

export default userAuth; 
