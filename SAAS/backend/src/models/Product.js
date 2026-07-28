import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    company_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },

    product_name: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
      default: null,
    },

    image_url: {
      type: String,
      default: null,
    },

    price: {
      type: Number,
      required: true,
      min: [0, "Price cannot be negative"],
    },

    is_available: {
      type: Boolean,
      default: true,
    },

    // Added: product category — useful for catalog grouping and filtering on customer UI
    // e.g. "Snacks", "Beverages", "Pani Puri"
    category: {
      type: String,
      trim: true,
      default: "General",
    },

    // Added: SKU / internal product code for inventory tracking
    sku: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },

    // Added: GST / tax percentage — needed for payment & billing integration (Week 6)
    tax_percent: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    // Change #5 — soft delete support
    // Never hard-delete products — machine catalogs & sales history reference them
    is_deleted: {
      type: Boolean,
      default: false,
    },

    deleted_at: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// SKU uniqueness per company (sparse: ignore docs where sku is null)
productSchema.index({ company_id: 1, sku: 1 }, { unique: true, sparse: true });

// Fast category-scoped listing
productSchema.index({ company_id: 1, category: 1 });

// Fast name-scoped searches (also supports text prefix range queries)
productSchema.index({ company_id: 1, product_name: 1 });

export default mongoose.model("Product", productSchema);