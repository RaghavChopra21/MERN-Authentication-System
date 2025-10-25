import userModel from "../models/userModel.js";

export const getUserData = async (req, res)=>{

    try {
        // ✅ FIX: Read userId from the custom property attached by userAuth middleware
        const userId = req.userId; 

        if(!userId){
            // This case should ideally be caught by the middleware (userAuth.js), 
            // but we check just in case.
            return res.status(401).json({success: false, message: 'Authorization failed: Missing user ID.'});
        }

        // Find user using the ID
        const user = await userModel.findById(userId).select('-password'); // Exclude password from response

        if(!user){
            // User ID exists in token but not in database
            return res.status(404).json({success: false, message: 'User not found'});
        }

        // Send back the necessary user data
        res.json({
            success: true,
            userData: {
                name: user.name,
                // Ensure isAccountVerified is sent for the Navbar check
                isAccountVerified: user.isAccountVerified 
            }
        });
    } catch (error) {
        console.error("Error in getUserData:", error);
        return res.status(500).json({success: false, message: 'Server error while fetching user data.'});
    }
}
