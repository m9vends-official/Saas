import mongoose from "mongoose";
import logger from "../utils/logger.js";
import "../models/User.js";
import "../models/Company.js";
import "../models/Product.js";
import "../models/MachineCatalog.js";

export const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    logger.info("MongoDB Connected");
  } catch (error) {
    // Log the full error object so you can see exactly what went wrong
    logger.error({ err: error }, " MongoDB connection failed");

    // Exit immediately — no point running the server without a database
    process.exit(1);
  }
};