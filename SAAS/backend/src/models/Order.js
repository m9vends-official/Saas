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
