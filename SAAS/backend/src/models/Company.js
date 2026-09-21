import mongoose from "mongoose";

const companySchema = new mongoose.Schema(
  {
    company_name: {
      type: String,
      required: true,
      trim: true,
    },

    plan: {
      type: String,
      enum: ["FREE", "PRO", "ENTERPRISE"],
      default: "FREE",
    },

    // Added: contact email of the business owner / company admin
    contact_email: {
      type: String,
      trim: true,
      lowercase: true,
      default: null,
    },

    // Added: contact phone number for support
    contact_phone: {
      type: String,
      default: null,
    },

    // Added: toggle to suspend a company account without deleting it
    is_active: {
      type: Boolean,
      default: true,
    },

    // Added: when their current plan expires — needed for billing in future
    plan_expires_at: {
      type: Date,
      default: null,
    },

    // Added: BYOK Razorpay Integration
    razorpay_key_id: {
      type: String,
      default: null,
    },
    razorpay_key_secret: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Company", companySchema);