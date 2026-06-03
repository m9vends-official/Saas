import * as productService from "../../../services/productService.js";

// ─── POST /api/admin/products ─────────────────────────────────────────────────
export const createProduct = async (req, res, next) => {
    try {
        const product = await productService.createProduct(req.company_id, req.body);

        res.status(201).json({
            success: true,
            data: product,
        });
    } catch (error) {
        next(error);
    }
};

// ─── GET /api/admin/products ──────────────────────────────────────────────────
// Optional query params: ?search=&category=&is_available=&page=&limit=
export const listProducts = async (req, res, next) => {
    try {
        const { search, category, is_available, page, limit } = req.query;
        const { products, pagination } = await productService.getCompanyProducts(req.company_id, {
            search,
            category,
            is_available,
            page,
            limit,
        });

        res.json({
            success: true,
            pagination,
            data: products,
        });
    } catch (error) {
        next(error);
    }
};

// ─── GET /api/admin/products/:id ──────────────────────────────────────────────
export const getProduct = async (req, res, next) => {
    try {
        const product = await productService.getProductById(req.company_id, req.params.id);

        res.json({
            success: true,
            data: product,
        });
    } catch (error) {
        next(error);
    }
};

// ─── PUT /api/admin/products/:id ──────────────────────────────────────────────
export const updateProduct = async (req, res, next) => {
    try {
        const product = await productService.updateProduct(req.company_id, req.params.id, req.body);

        res.json({
            success: true,
            data: product,
        });
    } catch (error) {
        next(error);
    }
};

// ─── DELETE /api/admin/products/:id ──────────────────────────────────────────
export const deleteProduct = async (req, res, next) => {
    try {
        await productService.deleteProduct(req.company_id, req.params.id);

        res.json({
            success: true,
            message: "Product deleted successfully",
        });
    } catch (error) {
        next(error);
    }
};
