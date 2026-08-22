import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import morgan from "morgan";

// Route Imports 
// ADMIN routes (JWT protected)
import authRoutes         from "./api/admin/routes/authRoutes.js";
import userRoutes         from "./api/admin/routes/userRoutes.js";
import adminCatalogRoutes from "./api/admin/routes/adminCatalogRoutes.js";
import productRoutes      from "./api/admin/routes/productRoutes.js";
import adminOrderRoutes   from "./api/admin/routes/orderRoutes.js";
import analyticsRoutes    from "./api/admin/routes/analyticsRoutes.js";
import machineRoutes      from "./api/admin/routes/machineRoutes.js";
import assignmentRoutes   from "./api/admin/routes/assignmentRoutes.js";
// telemetryRoutes → now handled by mqttService.js + Socket.IO

// PUBLIC routes (no JWT required)
import catalogRoutes from "./api/public/routes/catalogRoutes.js";
import orderRoutes      from "./api/public/routes/orderRoutes.js";


//  Error Middleware 
// Must be imported and used LAST — after all routes
import errorMiddleware from "./api/admin/middlewares/errorMiddleware.js";

// Initialize the Express application
const app = express();

// Global Middleware 

// Parse incoming JSON request bodies safely, capturing rawBody for webhooks
app.use(express.json({
  verify: (req, res, buf) => {
    if (req.originalUrl === "/api/public/payment/webhook") {
      req.rawBody = buf.toString();
    }
  }
}));

// Enable CORS — allow frontend with credentials (cookies for refresh token)
app.use(cors({
  origin: [
    "http://localhost:5174",   // Vite dev server (kiosk, if running both)
    "http://localhost:3000",   // Next.js admin panel dev server
    process.env.FRONTEND_URL,  // Production URL from .env
  ].filter(Boolean),
  credentials: true,           // Required for httpOnly cookie refresh token
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// Set secure HTTP response headers (XSS, clickjacking, MIME sniffing, etc.)
app.use(helmet());

// Gzip compress responses — reduces payload size for faster transfers
app.use(compression());

// Parse cookies from incoming requests (needed for httpOnly refresh token)
app.use(cookieParser());

// Log every HTTP request to terminal in dev-friendly format
app.use(morgan("dev"));

//  Health Check 
// Used by load balancers / monitoring tools to verify server is alive
app.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Server is running",
    timestamp: new Date().toISOString(),
  });
});

//  PUBLIC Routes (NO JWT) 
// Customer-facing APIs — anyone with a machine_id can call these
app.use("/api/public/catalog", catalogRoutes);

// ADMIN Routes (JWT REQUIRED) 

// Auth routes — login/register/refresh are PUBLIC, logout is protected per-route
app.use("/api/admin/auth", authRoutes);

// User routes — ALL protected (authMiddleware + tenantMiddleware applied at router level)
app.use("/api/admin/users", userRoutes);

app.use("/api/admin/catalog",  adminCatalogRoutes);
app.use("/api/admin/products", productRoutes);
app.use("/api/admin/orders",   adminOrderRoutes); 

// Public order routes — POST /order, GET /order/:id/status
app.use("/api/public/order",   orderRoutes);     
// Webhook route — POST /api/public/payment/webhook

// NOTE: webhook middleware in app.js captures raw body for /api/public/payment/webhook
app.use("/api/public/payment", orderRoutes); 

// Analytics routes - GET 
app.use("/api/admin/analytics",   analyticsRoutes);

// Machine proxy routes — fetches device data from IoT backend
app.use("/api/admin/machines",    machineRoutes);

// Assignment routes — links Technicians to specific machines
app.use("/api/admin/assignments", assignmentRoutes);

// 404 Handler 
// Catches any request that didn't match a route above
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// Global Error Middleware 
// MUST be last — catches errors passed via next(error) from any controller
app.use(errorMiddleware);

export default app;