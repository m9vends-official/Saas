import mongoose from "mongoose";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
dotenv.config();

const seed = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to DB");

        const { default: Company } = await import("./src/models/Company.js");
        const { default: User } = await import("./src/models/User.js");

        // 1. Create a Company
        let company = await Company.findOne({ company_name: "Test Company" });
        if (!company) {
            company = await Company.create({
                company_name: "Test Company",
                address: "123 Test St",
                status: "ACTIVE"
            });
            console.log("Created Company:", company._id);
        }

        // 2. Create the User
        const email = "admin@example.com";
        let user = await User.findOne({ email });
        if (!user) {
            const password_hash = await bcrypt.hash("password123", 10);
            user = await User.create({
                company_id: company._id,
                name: "Test Admin",
                email,
                password_hash,
                role: "ADMIN"
            });
            console.log("Created Admin User:", user.email);
        } else {
            console.log("Admin user already exists:", user.email);
            // Optionally update password to password123
            user.password_hash = await bcrypt.hash("password123", 10);
            user.company_id = company._id;
            user.role = "ADMIN";
            await user.save();
            console.log("Updated password to password123");
        }

        console.log("\n--- Admin User Credentials ---");
        console.log("Email: admin@example.com");
        console.log("Password: password123");
        console.log("------------------------------\n");

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
};

seed();
