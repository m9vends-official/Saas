import MachineCatalog from "../../../models/MachineCatalog.js";
import ApiError from "../../../utils/ApiError.js";
import logger from "../../../utils/logger.js";

// ─── GET /api/public/catalog/:machine_id ─────────────────────────────────────
// Public route — no JWT required.
// Returns the active product catalog for a given vending machine.
// Called by the customer-facing app when a QR code is scanned.
export const getCatalog = async (req, res, next) => {
  try {
    const { machine_id } = req.params;

    if (!machine_id) {
      throw ApiError.badRequest("Machine ID is required");
    }

    // 1. Fetch all enabled catalog entries for this machine (machine_id is deviceVID from IoT backend)
    //    Populate product details from the Product collection
    const catalogEntries = await MachineCatalog.find({
      machine_id: machine_id,
      is_enabled: true,
    }).populate({
      path: "product_id",
      select: "product_name description price image_url is_available",
    });

    // 2. Filter out entries where the linked product is missing or unavailable
    //    and shape the response payload for the customer app
    const catalog = catalogEntries
      .filter((entry) => entry.product_id && entry.product_id.is_available)
      .map((entry) => ({
        catalog_id:   entry._id,
        product_id:   entry.product_id._id,
        product_name: entry.product_id.product_name,
        description:  entry.product_id.description ?? null,
        image_url:    entry.product_id.image_url ?? null,
        // Use machine-level price override if set; otherwise fall back to product price
        price:        entry.price_override ?? entry.product_id.price,
        stock:        entry.stock,
        slot_label:   entry.slot_label ?? null,
      }));

    logger.info({ machine_id, items: catalog.length }, "Catalog fetched");

    res.json({
      success:    true,
      machine_id: machine_id, // deviceVID
      catalog,
    });
  } catch (error) {
    next(error);
  }
};


