import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const seed = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_STRING as string);
        const { Devices } = await import("./src/models/device.model.ts");

        const serialNumber = "MACH-001";
        let device = await Devices.findOne({ serialNumber });
        if (!device) {
            device = await Devices.create({
                serialNumber,
                model: "M9-Snack-Standard",
                status: "offline",
                components: [
                    { catagory: "Sensor", name: "Temperature", type: "sensor" },
                    { catagory: "Sensor", name: "WaterLevel", type: "sensor" }
                ]
            });
            console.log(`Factory device ${serialNumber} created!`);
        } else {
            console.log(`Device ${serialNumber} already exists.`);
        }
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
};

seed();
