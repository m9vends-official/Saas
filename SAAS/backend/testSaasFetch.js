const axios = require("axios");

async function test() {
    try {
        // Need to login as Sanjay Admin to get a token!
        // We can just query the SAAS DB to find all admins and their devices
        const mongoose = require("mongoose");
        require("dotenv").config();
        await mongoose.connect(process.env.MONGO_URI);
        const User = require("./src/models/User.js").default || require("./src/models/User.js");
        const allAdmins = await User.find({ role: { $in: ["ADMIN", "SUPER_ADMIN"] } }).select("email _id").lean();
        
        console.log("Admins:");
        for (const admin of allAdmins) {
            console.log(`- ${admin.email} (${admin._id})`);
            try {
                const res = await axios.get(`http://localhost:3002/api/device/user/${admin._id}`);
                console.log(`  Devices: ${res.data.device.length}`);
            } catch (e) {
                console.log(`  Error: ${e.response ? e.response.status + " " + JSON.stringify(e.response.data) : e.message}`);
            }
        }
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
test();
