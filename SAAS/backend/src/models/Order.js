import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema({
    catalog_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "MachineCatalog",
        required: true
    },
    product_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true
    },
    product_name: {
        type: String,
        required: true
    },
    quantity: {
        type: Number,
        required: true,
    },
    unit_price: {
        type: Number,
        required: true,
    },
    subtotal: {
        type: Number,
        required: true
    }
},{_id: false});

const orderSchema = new mongoose.Schema({
    company_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Company",
        required: true,
    },
    machine_id: {
        type: String,
        required: true,
        uppercase: true,
        trim: true
    },

    items: [orderItemSchema],

    total_amount: {
        type: Number,
        required: true,
        min: 1,
    },
      // Razorpay order ID — returned when we create a payment order
      razorpay_order_id: {
        type: String,
        default: null
      },
      // Razorpay payment ID — returned after successful payment
      razorpay_payment_id: {
        type: String,
        default: null
      },
      payment_status: {
        type: String,
        enum: ["PENDING", "PAID", "FAILED", "REFUNDED"],
        default: "PENDING",
      },
      order_status: {
        type: String,
        enum: ["PLACED", "DISPENSING", "COMPLETED", "CANCELLED"],
        default: "PLACED",
      },
        // QR code image URL or data — displayed on machine screen
      qr_code: {
      type: String,
      default: null,
      },
      // UPI payment link — embedded in QR
      payment_link: {
        type: String,
        default: null,
      },
      paid_at: {
        type: Date,
        default: null,
  },
},{timestamps: true});

orderSchema.index({machine_id: 1, payment_status: 1});
orderSchema.index({company_id: 1, createdAt: -1});

export default mongoose.model("Order",orderSchema);