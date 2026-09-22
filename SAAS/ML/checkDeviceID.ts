import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const check = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_STRING as string);
        const { Devices } = await import("./src/models/device.model.ts");
        const device = await Devices.findOne({ serialNumber: "MACH-001" });
        console.log("MACH-001 ID:", device ? device._id : "Not found");
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
};

check();
