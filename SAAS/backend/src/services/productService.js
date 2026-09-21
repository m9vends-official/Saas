import mongoose from "mongoose";
import Product from "../models/Product.js";
import MachineCatalog from "../models/MachineCatalog.js";
import ApiError from "../utils/ApiError.js";
import logger from "../utils/logger.js";

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const assertValidId = (id) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw ApiError.badRequest("Invalid product id");
    }
};

// â”€â”€â”€ Create Product â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const createProduct = async (company_id, productData) => {

    // Change #1 â€” normalize SKU BEFORE the duplicate check so the schema
    // uppercase transform and the query both see the same value
    if (productData.sku) {
        productData.sku = productData.sku.toUpperCase();

        const existing = await Product.findOne({
            company_id,
            sku: productData.sku,
            is_deleted: false,
        });
        if (existing) {
            throw ApiError.conflict("A product with this SKU already exists");
        }
    }

    const product = await Product.create({ company_id, ...productData });

    logger.info({ product_id: product._id, company_id }, "Product created");

    return product;
};

// â”€â”€â”€ List Products (company-scoped, with filters + pagination) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Query params:
//   ?search=cola          â†’ partial match on product_name or SKU (case-insensitive)
//   ?category=Beverages   â†’ exact category match
//   ?is_available=true    â†’ filter by availability flag
//   ?page=1&limit=20      â†’ pagination (Change #4)
export const getCompanyProducts = async (company_id, filters = {}) => {
    const {
        search,
        category,
        is_available,
        page  = 1,
        limit = 20,
    } = filters;

    // Change #5 â€” always exclude soft-deleted products
    const query = { is_deleted: false };
    if (company_id) query.company_id = company_id;

    if (search) {
        const regex = new RegExp(search, "i");
        query.$or = [
            { product_name: regex },
            { sku: regex },
        ];
    }

    if (category) {
        query.category = category;
    }

    if (is_available !== undefined) {
        query.is_available = is_available === "true" || is_available === true;
    }

    const pageNum  = Math.max(1, parseInt(page,  10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip     = (pageNum - 1) * limitNum;

    // Change #3 â€” .lean() for read-only list: faster, lower memory
    const [products, total] = await Promise.all([
        Product.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
        Product.countDocuments(query),
    ]);

    return {
        products,
        pagination: {
            total,
            page:       pageNum,
            limit:      limitNum,
            totalPages: Math.ceil(total / limitNum),
        },
    };
};

// â”€â”€â”€ Get Single Product â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const getProductById = async (company_id, id) => {
    // Change #2 â€” guard against CastError before hitting the DB
    assertValidId(id);

    // Change #3 â€” .lean() for read-only single fetch
    const query = { _id: id, is_deleted: false };
    if (company_id) query.company_id = company_id;

    const product = await Product.findOne(query).lean();

    if (!product) {
        throw ApiError.notFound("Product not found");
    }

    return product;
};

// â”€â”€â”€ Update Product â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const updateProduct = async (company_id, id, updates) => {
    // Change #2
    assertValidId(id);

    const query = { _id: id, is_deleted: false };
    if (company_id) query.company_id = company_id;

    // Change #1 â€” normalize SKU before duplicate check
    if (updates.sku) {
        updates.sku = updates.sku.toUpperCase();

        const existing = await Product.findOne(query);
        if (!existing) throw ApiError.notFound("Product not found");

        const collision = await Product.findOne({
            company_id: existing.company_id,
            sku: updates.sku,
            _id:        { $ne: id },
            is_deleted: false,
        });
        if (collision) {
            throw ApiError.conflict("Another product with this SKU already exists");
        }
    }

    const product = await Product.findOneAndUpdate(
        query,
        updates,
        { new: true, runValidators: true }
    );

    if (!product) {
        throw ApiError.notFound("Product not found");
    }

    logger.info({ product_id: product._id, company_id: product.company_id }, "Product updated");

    return product;
};

// â”€â”€â”€ Delete Product (soft delete) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Change #5 â€” soft delete instead of findOneAndDelete.
// MachineCatalog entries / historical sales still reference the product safely.
export const deleteProduct = async (company_id, id) => {
    // Change #2
    assertValidId(id);

    const query = { _id: id, is_deleted: false };
    if (company_id) query.company_id = company_id;

    // Find the product first to get its actual company_id
    const existing = await Product.findOne(query);
    if (!existing) throw ApiError.notFound("Product not found");

    // M9Vends-specific â€” block deletion if product is assigned to any machine
    const inUse = await MachineCatalog.exists({ company_id: existing.company_id, product_id: id });
    if (inUse) {
        throw ApiError.conflict(
            "Cannot delete: product is assigned to one or more machine catalogs. " +
            "Please remove it from all machine configurations first."
        );
    }

    const product = await Product.findOneAndUpdate(
        query,
        { is_deleted: true, deleted_at: new Date() },
        { new: true }
    );

    logger.info({ product_id: id, company_id: product.company_id }, "Product soft-deleted");

    return product;
};
