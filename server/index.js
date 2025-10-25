import express from "express";
import cors from "cors";
import 'dotenv/config';
import cookieParser from "cookie-parser";
import connectDB from "./config/mongodb.js"
import authRouter from './routes/authRoutes.js'
import userRouter from "./routes/userRoutes.js";

const app = express();
// The hosting provider (Render/Railway) will set process.env.PORT dynamically.
const port = process.env.PORT || 4000

// --- DEPLOYMENT-READY CORS CONFIGURATION ---

// 1. Define allowed origins: Frontend URL (Hardcoded for deployment stability) and local dev URL
// NOTE: We are temporarily hardcoding the Vercel URL here because process.env.FRONTEND_URL
// was not being read correctly in the deployed Render environment, causing CORS errors.
const allowedOrigins = [
    'https://mern-authentication-system-gamma.vercel.app',
    'http://localhost:5173'
];

// 2. Use a dynamic origin check for robust cross-origin security
const corsOptions = {
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, Postman, curl)
        if (!origin) return callback(null, true);

        // Check if the origin is in our allowed list
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        // Block all other origins
        const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
        return callback(new Error(msg), false);
    },
    credentials: true
};

// --- MIDDLEWARE ---
app.use(express.json());
app.use(cookieParser());
app.use(cors(corsOptions)); // Apply the new dynamic CORS options

// API Endpoints
app.get('/', (req, res) => res.send("API Working - CORS Update Checked"));
app.use('/api/auth', authRouter)
app.use('/api/user', userRouter)

// We wrap the listen call in an async function to ensure the database connects first.
const startServer = async () => {
    try {
        await connectDB(); // Wait for the DB connection to complete
        app.listen(port, () => console.log(`Server started on PORT: ${port}`));
    } catch (err) {
        // If connectDB throws an error (e.g., MONGODB_URI is bad), the server won't start
        console.error("Failed to start server due to database connection error.");
        process.exit(1);
    }
}

startServer();

// import express from "express";
// import cors from "cors";
// import 'dotenv/config';
// import cookieParser from "cookie-parser";
// import connectDB from "./config/mongodb.js"
// import authRouter from './routes/authRoutes.js'
// import userRouter from "./routes/userRoutes.js";

// const app = express();
// const port = process.env.PORT || 4000

// // Configuration for CORS
// const allowedOrigins = ['http://localhost:5173']

// app.use(express.json());
// app.use(cookieParser());
// app.use(cors({ origin: allowedOrigins, credentials: true }))

// // API Endpoints
// app.get('/', (req, res) => res.send("API Working"));
// app.use('/api/auth', authRouter)
// app.use('/api/user', userRouter)

// // We wrap the listen call in an async function to ensure the database connects first.
// const startServer = async () => {
//     try {
//         await connectDB(); // Wait for the DB connection to complete
//         app.listen(port, () => console.log(`Server started on PORT: ${port}`));
//     } catch (err) {
//         // If connectDB throws an error (e.g., MONGODB_URI is bad), the server won't start
//         console.error("Failed to start server due to database connection error.");
//         process.exit(1);
//     }
// }

// startServer();
// // import express from "express";
// // import cors from "cors";
// // import 'dotenv/config';
// // import cookieParser from "cookie-parser";
// // import connectDB from "./config/mongodb.js"
// // import authRouter from './routes/authRoutes.js'
// // import userRouter from "./routes/userRoutes.js";

// // const app = express();
// // const port = process.env.PORT || 4000
// // connectDB();

// // const allowedOrigins = ['http://localhost:5173']

// // app.use(express.json());
// // app.use(cookieParser());
// // app.use(cors({origin: allowedOrigins, credentials: true}))

// // //API Endpoints
// // app.get('/', (req, res)=> res.send("API Working"));
// // app.use('/api/auth', authRouter)
// // app.use('/api/user', userRouter)

// // app.listen(port, ()=> console.log(`Server started on PORT:${port}`));