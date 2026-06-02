import mongoose from "mongoose";

const machineCatalogSchema = new mongoose.Schema(
  {
    // Tenant isolation — every admin query MUST filter by this
    company_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },

    // The machine this catalog entry belongs to (e.g. "VM-BPL-001")
    machine_id: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },

    product_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    // Current stock count in this machine's slot
    stock: {
      type: Number,
      default: 0,
      min: [0, "Stock cannot be negative"],
    },

    // Max capacity of this product slot in the machine
    // Added: needed to calculate fill percentage and trigger restocking alerts
    max_capacity: {
      type: Number,
      default: 50,
      min: 1,
    },

    // Whether this product is shown on the customer catalog
    is_enabled: {
      type: Boolean,
      default: true,
    },

    // Added: machine-level price override — operator can set a different price
    // per machine (e.g. airport vs local). Falls back to Product.price if null.
    price_override: {
      type: Number,
      default: null,
      min: 0,
    },

    // Added: slot/position label in the physical machine — e.g. "A1", "B3"
    // Useful for technician restocking UI
    slot_label: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },

    // Added: last time stock was updated — useful for restocking frequency analytics
    last_restocked_at: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Compound index: one product per machine per slot — prevents duplicate entries
machineCatalogSchema.index({ company_id: 1, machine_id: 1, product_id: 1 }, { unique: true });

// Index for fast company-scoped catalog lookups in admin routes
machineCatalogSchema.index({ company_id: 1, machine_id: 1 });

export default mongoose.model("MachineCatalog", machineCatalogSchema);