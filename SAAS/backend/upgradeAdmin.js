import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const update = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const { default: User } = await import("./src/models/User.js");
        
        const user = await User.findOne({ email: "admin@example.com" });
        if (user) {
            user.role = "SUPER_ADMIN";
            await user.save();
            console.log("Upgraded admin@example.com to SUPER_ADMIN!");
        }
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
};

update();
