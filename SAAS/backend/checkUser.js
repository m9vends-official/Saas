import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const check = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const { default: User } = await import("./src/models/User.js");
        const user = await User.findById("6ab04ddfe308157348925821");
        console.log("User Email:", user ? user.email : "Not found");
        console.log("User Devices:", user ? user.devices : "[]");
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
};

check();
