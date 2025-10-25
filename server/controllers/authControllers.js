import bcrypt from 'bcryptjs';
import pkg from 'jsonwebtoken';
const jwt = pkg;
import userModel from '../models/userModel.js';
import transporter from '../config/nodemailer.js';
import { WELCOME_EMAIL_TEMPLATE, EMAIL_VERIFY_TEMPLATE, PASSWORD_RESET_TEMPLATE } from '../config/emailTemplates.js';

// ============== REGISTER ==============
export const register = async (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ success: false, message: 'Missing Details: Name, email, and password are required.' });
    }

    try {
        // 1. Check for existing user
        const existingUser = await userModel.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ success: false, message: 'User already exists with this email address.' });
        }

        // 2. Create and save the new user (CRITICAL DB OPERATION)
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new userModel({ name, email, password: hashedPassword });
        await user.save();

        // 3. Generate token and set cookie
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        // 4. Send Welcome Email (NON-CRITICAL - separate try/catch)
        try {
            await transporter.sendMail({
                from: `"Raghav_Verse App" <${process.env.SMTP_EMAIL}>`,
                to: email,
                subject: 'Welcome to Raghav_Verse',
                html: WELCOME_EMAIL_TEMPLATE.replace("{{name}}", name)
            });
        } catch (emailError) {
            // Log the email failure but DO NOT return an error response to the client
            console.error(`Email Failure for ${email}:`, emailError.message);
            // We can optionally add logic here to mark the email as needing a retry
        }

        // 5. Success response (regardless of email status)
        return res.status(201).json({ 
            success: true, 
            message: 'User registered successfully. Welcome email sent (or pending).',
            data: { id: user._id, name: user.name, email: user.email }
        });

    } catch (error) {
        // Catch block for Mongoose/bcrypt errors
        console.error('Registration Error:', error.message);
        return res.status(500).json({ success: false, message: 'Server error during registration. Please check database connection.' });
    }
};

// ============== LOGIN ==============
export const login = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email and Password are required' });
    }

    try {
        const user = await userModel.findOne({ email });
        if (!user) return res.status(404).json({ success: false, message: 'Invalid email or password' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ success: false, message: 'Invalid email or password' });

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
        });

        return res.status(200).json({
            success: true,
            message: 'Login successful',
            data: {
                id: user._id,
                name: user.name,
                email: user.email,
                isAccountVerified: user.isAccountVerified,
            },
        });
    } catch (error) {
        console.error('Login Error:', error.message);
        return res.status(500).json({ success: false, message: 'Server error during login.' });
    }
};

// ============== LOGOUT ==============
export const logout = async (req, res) => {
    try {
        res.clearCookie('token', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
        });
        return res.status(200).json({ success: true, message: 'Logged Out' });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ============== SEND VERIFY OTP ==============
export const sendVerifyOtp = async (req, res) => {
    try {
        // NOTE: req.userId must be set by a middleware that verifies the JWT token
        const userId = req.userId; 
        
        const user = await userModel.findById(userId);

        if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
        if (user.isAccountVerified)
            return res.status(400).json({ success: false, message: 'Account already verified' });

        const otp = String(Math.floor(100000 + Math.random() * 900000));
        
        // Save OTP to user (CRITICAL DB OPERATION)
        user.verifyOtp = otp;
        user.verifyOtpExpireAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
        await user.save();

        // Send Email (NON-CRITICAL - separate try/catch)
        try {
            await transporter.sendMail({
                from: `"Raghav_Verse App" <${process.env.SMTP_EMAIL}>`,
                to: user.email,
                subject: 'Account Verification OTP',
                html: EMAIL_VERIFY_TEMPLATE.replace("{{email}}", user.email).replace("{{otp}}", otp)
            });

            console.log(`Verification OTP sent to ${user.email}: ${otp}`);
            return res.status(200).json({ success: true, message: 'Verification OTP sent successfully.' });
        } catch (emailError) {
            console.error('Error sending verification OTP via email:', emailError.message);
            // Still return success since the OTP was saved to the database.
            return res.status(200).json({ success: true, message: 'OTP saved, but email failed to send. Check console for details.' });
        }

    } catch (error) {
        console.error('Error in sendVerifyOtp:', error);
        return res.status(500).json({ success: false, message: 'Server error while processing OTP request.' });
    }
};

// ============== VERIFY EMAIL ==============
export const verifyEmail = async (req, res) => {
    try {
        const { otp } = req.body;
        const userId = req.userId;

        const user = await userModel.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        if (!user.verifyOtp || user.verifyOtpExpireAt < Date.now())
            return res.status(400).json({ success: false, message: 'OTP expired or invalid.' });

        if (user.verifyOtp !== otp.toString())
            return res.status(401).json({ success: false, message: 'Invalid OTP' });

        user.isAccountVerified = true;
        user.verifyOtp = '';
        user.verifyOtpExpireAt = 0;
        await user.save();

        return res.status(200).json({ success: true, message: 'Email verified successfully' });
    } catch (error) {
        console.error('Error verifying email:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ============== AUTH CHECK ==============
export const isAuthenticated = async (req, res) => {
    return res.status(200).json({ success: true, message: 'User is authenticated' });
};

// ============== SEND RESET OTP ==============
export const SendResetOtp = async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    try {
        const user = await userModel.findOne({ email });
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        const otp = String(Math.floor(100000 + Math.random() * 900000));
        
        // Save OTP to user (CRITICAL DB OPERATION)
        user.resetOtp = otp;
        user.resetOtpExpireAt = Date.now() + 15 * 60 * 1000; // 15 min expiry
        await user.save();

        // Send Email (NON-CRITICAL - separate try/catch)
        try {
            await transporter.sendMail({
                from: `"Raghav_Verse App" <${process.env.SMTP_EMAIL}>`,
                to: user.email,
                subject: 'Password Reset OTP',
                html: PASSWORD_RESET_TEMPLATE.replace("{{email}}", user.email).replace("{{otp}}", otp)
            });

            console.log(`Reset OTP sent to ${user.email}: ${otp}`);
            return res.status(200).json({ success: true, message: 'OTP sent to your email' });
        } catch (emailError) {
            console.error('Error sending reset OTP via email:', emailError.message);
            // Still return success since the OTP was saved to the database.
            return res.status(200).json({ success: true, message: 'OTP saved, but email failed to send. Check console for details.' });
        }

    } catch (error) {
        console.error('Error in SendResetOtp:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ============== RESEND RESET OTP ==============
export const resendResetOtp = async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    try {
        const user = await userModel.findOne({ email });
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        // Generate a new OTP and save (CRITICAL DB OPERATION)
        const otp = String(Math.floor(100000 + Math.random() * 900000));
        user.resetOtp = otp;
        user.resetOtpExpireAt = Date.now() + 15 * 60 * 1000;
        await user.save();

        // Send Email (NON-CRITICAL - separate try/catch)
        try {
            await transporter.sendMail({
                from: `"Raghav_Verse App" <${process.env.SMTP_EMAIL}>`,
                to: user.email,
                subject: 'Password Reset OTP (Resent)',
                text: `Your new OTP is ${otp}. It will expire in 15 minutes.`,
            });
            console.log(`Resent OTP to ${user.email}: ${otp}`);
            return res.status(200).json({ success: true, message: 'New OTP sent successfully' });
        } catch (emailError) {
            console.error('Error resending OTP via email:', emailError.message);
            // Still return success since the OTP was saved to the database.
            return res.status(200).json({ success: true, message: 'New OTP saved, but email failed to send. Check console for details.' });
        }

    } catch (error) {
        console.error('Error in resendResetOtp:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ============== RESET PASSWORD ==============
export const resetPassword = async (req, res) => {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword)
        return res.status(400).json({ success: false, message: 'Missing details: email, OTP, and new password are required.' });

    try {
        const user = await userModel.findOne({ email });
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        if (user.resetOtpExpireAt < Date.now())
            return res.status(400).json({ success: false, message: 'OTP expired' });

        if (user.resetOtp !== otp)
            return res.status(401).json({ success: false, message: 'Invalid OTP' });

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        user.resetOtp = '';
        user.resetOtpExpireAt = 0;
        await user.save();

        return res.status(200).json({ success: true, message: 'Password reset successfully' });
    } catch (error) {
        console.error('Error resetting password:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};
// import bcrypt from 'bcryptjs';
// import pkg from 'jsonwebtoken';
// const jwt = pkg;
// import userModel from '../models/userModel.js';
// import transporter from '../config/nodemailer.js';
// import { WELCOME_EMAIL_TEMPLATE, EMAIL_VERIFY_TEMPLATE, PASSWORD_RESET_TEMPLATE } from '../config/emailTemplates.js';

// // ============== REGISTER ==============
// export const register = async (req, res) => {
//   const { name, email, password } = req.body;

//   if (!name || !email || !password) {
//     return res.json({ success: false, message: 'Missing Details' });
//   }

//   try {
//     const existingUser = await userModel.findOne({ email });
//     if (existingUser) {
//       return res.json({ success: false, message: 'User already exists' });
//     }

//     const hashedPassword = await bcrypt.hash(password, 10);
//     const user = new userModel({ name, email, password: hashedPassword });
//     await user.save();

//     const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

//     res.cookie('token', token, {
//       httpOnly: true,
//       secure: process.env.NODE_ENV === 'production',
//       sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
//       maxAge: 7 * 24 * 60 * 60 * 1000,
//     });

//     // Send Welcome Email
//     await transporter.sendMail({
//       from: `"Raghav_Verse App" <${process.env.SMTP_EMAIL}>`,
//       to: email,
//       subject: 'Welcome to Raghav_Verse',
//       // text: `Welcome to Raghav_Verse! Your account has been created with email: ${email}`,
//       html: WELCOME_EMAIL_TEMPLATE.replace("{{name}}",name)
//     });

//     return res.json({ success: true, message: 'User registered successfully' });
//   } catch (error) {
//     return res.json({ success: false, message: error.message });
//   }
// };

// // ============== LOGIN ==============
// export const login = async (req, res) => {
//   const { email, password } = req.body;

//   if (!email || !password) {
//     return res.json({ success: false, message: 'Email and Password are required' });
//   }

//   try {
//     const user = await userModel.findOne({ email });
//     if (!user) return res.json({ success: false, message: 'Invalid email' });

//     const isMatch = await bcrypt.compare(password, user.password);
//     if (!isMatch) return res.json({ success: false, message: 'Invalid password' });

//     const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

//     res.cookie('token', token, {
//       httpOnly: true,
//       secure: process.env.NODE_ENV === 'production',
//       sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
//     });

//     return res.json({
//       success: true,
//       message: 'Login successful',
//       data: {
//         id: user._id,
//         name: user.name,
//         email: user.email,
//         isAccountVerified: user.isAccountVerified,
//       },
//     });
//   } catch (error) {
//     return res.json({ success: false, message: error.message });
//   }
// };

// // ============== LOGOUT ==============
// export const logout = async (req, res) => {
//   try {
//     res.clearCookie('token', {
//       httpOnly: true,
//       secure: process.env.NODE_ENV === 'production',
//       sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
//     });
//     return res.json({ success: true, message: 'Logged Out' });
//   } catch (error) {
//     return res.json({ success: false, message: error.message });
//   }
// };

// // ============== SEND VERIFY OTP ==============
// export const sendVerifyOtp = async (req, res) => {
//   try {
//     const userId = req.userId;
//     const user = await userModel.findById(userId);

//     if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
//     if (user.isAccountVerified)
//       return res.json({ success: false, message: 'Account already verified' });

//     const otp = String(Math.floor(100000 + Math.random() * 900000));
//     user.verifyOtp = otp;
//     user.verifyOtpExpireAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
//     await user.save();

//       await transporter.sendMail({
//       from: `"Raghav_Verse App" <${process.env.SMTP_EMAIL}>`,
//       to: user.email,
//       subject: 'Account Verification OTP',
//       // text: `Your OTP for verifying your account is ${otp}. It will expire in 24 hours.`,
//       html: EMAIL_VERIFY_TEMPLATE.replace("{{email}}",user.email).replace("{{otp}}",otp)
//     });

//     console.log(`Verification OTP sent to ${user.email}: ${otp}`);
//     return res.json({ success: true, message: 'Verification OTP sent successfully.' });
//   } catch (error) {
//     console.error('Error sending verification OTP:', error);
//     return res.status(500).json({ success: false, message: 'Server error while sending OTP.' });
//   }
// };

// // ============== VERIFY EMAIL ==============
// export const verifyEmail = async (req, res) => {
//   try {
//     const { otp } = req.body;
//     const userId = req.userId;

//     const user = await userModel.findById(userId);
//     if (!user) return res.json({ success: false, message: 'User not found' });

//     if (!user.verifyOtp || user.verifyOtpExpireAt < Date.now())
//       return res.json({ success: false, message: 'OTP expired or invalid.' });

//     if (user.verifyOtp !== otp.toString())
//       return res.json({ success: false, message: 'Invalid OTP' });

//     user.isAccountVerified = true;
//     user.verifyOtp = '';
//     user.verifyOtpExpireAt = 0;
//     await user.save();

//     return res.json({ success: true, message: 'Email verified successfully' });
//   } catch (error) {
//     console.error('Error verifying email:', error);
//     return res.json({ success: false, message: error.message });
//   }
// };

// // ============== AUTH CHECK ==============
// export const isAuthenticated = async (req, res) => {
//   return res.json({ success: true, message: 'User is authenticated' });
// };

// // ============== SEND RESET OTP ==============
// export const SendResetOtp = async (req, res) => {
//   const { email } = req.body;
//   if (!email) return res.json({ success: false, message: 'Email is required' });

//   try {
//     const user = await userModel.findOne({ email });
//     if (!user) return res.json({ success: false, message: 'User not found' });

//     const otp = String(Math.floor(100000 + Math.random() * 900000));
//     user.resetOtp = otp;
//     user.resetOtpExpireAt = Date.now() + 15 * 60 * 1000; // 15 min expiry
//     await user.save();

//     await transporter.sendMail({
//       from: `"Raghav_Verse App" <${process.env.SMTP_EMAIL}>`,
//       to: user.email,
//       subject: 'Password Reset OTP',
//       // text: `Your OTP for resetting your password is ${otp}. It will expire in 15 minutes.`,
//       html: PASSWORD_RESET_TEMPLATE.replace("{{email}}",user.email).replace("{{otp}}",otp)

//     });

//     console.log(`Reset OTP sent to ${user.email}: ${otp}`);
//     return res.json({ success: true, message: 'OTP sent to your email' });
//   } catch (error) {
//     console.error('Error sending reset OTP:', error);
//     return res.json({ success: false, message: error.message });
//   }
// };

// // ============== RESEND RESET OTP ==============
// export const resendResetOtp = async (req, res) => {
//   const { email } = req.body;
//   if (!email) return res.json({ success: false, message: 'Email is required' });

//   try {
//     const user = await userModel.findOne({ email });
//     if (!user) return res.json({ success: false, message: 'User not found' });

//     // Generate a new OTP
//     const otp = String(Math.floor(100000 + Math.random() * 900000));
//     user.resetOtp = otp;
//     user.resetOtpExpireAt = Date.now() + 15 * 60 * 1000;
//     await user.save();

//     await transporter.sendMail({
//       from: `"Raghav_Verse App" <${process.env.SMTP_EMAIL}>`,
//       to: user.email,
//       subject: 'Password Reset OTP (Resent)',
//       text: `Your new OTP is ${otp}. It will expire in 15 minutes.`,
//     });

//     console.log(`Resent OTP to ${user.email}: ${otp}`);
//     return res.json({ success: true, message: 'New OTP sent successfully' });
//   } catch (error) {
//     console.error('Error resending OTP:', error);
//     return res.json({ success: false, message: error.message });
//   }
// };

// // ============== RESET PASSWORD ==============
// export const resetPassword = async (req, res) => {
//   const { email, otp, newPassword } = req.body;

//   if (!email || !otp || !newPassword)
//     return res.json({ success: false, message: 'Missing details' });

//   try {
//     const user = await userModel.findOne({ email });
//     if (!user) return res.json({ success: false, message: 'User not found' });

//     if (user.resetOtpExpireAt < Date.now())
//       return res.json({ success: false, message: 'OTP expired' });

//     if (user.resetOtp !== otp)
//       return res.json({ success: false, message: 'Invalid OTP' });

//     const hashedPassword = await bcrypt.hash(newPassword, 10);
//     user.password = hashedPassword;
//     user.resetOtp = '';
//     user.resetOtpExpireAt = 0;
//     await user.save();

//     return res.json({ success: true, message: 'Password reset successfully' });
//   } catch (error) {
//     return res.json({ success: false, message: error.message });
//   }
// };
