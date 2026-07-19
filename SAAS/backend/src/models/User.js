import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    company_id: {
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Company",
      required: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,   
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Please provide a valid email"],
    },

    password_hash: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      enum: ["SUPER_ADMIN", "ADMIN", "TECHNICIAN"],
      required: true,
    },

    is_active: {
      type: Boolean,
      default: true,
    },

    devices: [mongoose.Schema.Types.ObjectId],

    // Added: track last login time — useful for admin audits and security
    last_login_at: {
      type: Date,
      default: null,
    },

    // Added: refresh token stored for token rotation / logout invalidation
    refresh_token: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);