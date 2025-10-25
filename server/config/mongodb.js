import mongoose from "mongoose";

const connectDB = async () => {
    try {
        // 1. Listen for the 'connected' event before attempting to connect
        mongoose.connection.on('connected', () => console.log("✅ Database Connected Successfully!"));

        // 2. Attempt the connection
        // The MONGODB_URI should already include the protocol and credentials
        // e.g., mongodb+srv://user:pass@cluster0.gdj0ckh.mongodb.net/
        await mongoose.connect(`${process.env.MONGODB_URI}/mern-auth`);

    } catch (error) {
        // 3. Log the error and exit the process if the connection fails
        console.error("❌ Mongoose Connection Error:", error.message);
        
        // This line is often used in production to stop the server if the DB is unreachable
        // process.exit(1); 
    }
};

export default connectDB;
// import mongoose, { mongo } from "mongoose";

// const connectDB = async ()=> {

// mongoose.connection.on('connected', ()=> console.log("Database Connected"));

//     await mongoose.connect(`${process.env.MONGODB_URI}/mern-auth`);
// };

// export default connectDB;