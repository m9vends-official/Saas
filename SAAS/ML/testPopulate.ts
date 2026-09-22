import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const check = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_STRING as string);
        const { User } = await import("./src/models/user.model.ts");
        // Must import Devices model so Mongoose knows it!
        await import("./src/models/device.model.ts");
        
        const user = await User.findById("6ab04ddfe308157348925821").populate("devices");
        console.log("Populated devices length:", user ? user.devices?.length : "Not found");
        console.log(user?.devices);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
};

check();
