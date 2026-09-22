import mongoose from "mongoose";
import 'dotenv/config'

export async function Mongo_Connect() {
    try {
        await mongoose.connect(process.env.MONGODB_STRING!)
        if (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "production") {
            console.log(">>> \x1b[32m MongoDB Connected \x1b[0m")
        }
    } catch (e) {
        if (process.env.NODE_ENV === "development") {
            console.error(e)
        }
        throw e
    }
}