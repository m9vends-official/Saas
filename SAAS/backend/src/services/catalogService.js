import MachineCatalog from "../models/MachineCatalog.js";
import Product from "../models/Product.js";
import ApiError from "../utils/ApiError.js";

export const addProductToMachine = async ({ company_id, machine_id, product_id, stock, slot_label, price_override }) => {

    const normalizedMachineId = machine_id;

    const productQuery = { _id: product_id };
    if (company_id) productQuery.company_id = company_id;
    const product = await Product.findOne(productQuery);

    if(!product){
        throw ApiError.notFound("Product not found");
    }

    const existing = await MachineCatalog.findOne({
        machine_id: normalizedMachineId,
        product_id,
    });

    if(existing){
        throw ApiError.conflict("Product Already exists in machine catalog");
    }

    return MachineCatalog.create({
        company_id: product.company_id,
        machine_id: normalizedMachineId,
        product_id,
        stock,
        slot_label,
        price_override,
    });
}

export const updateCatalogEntry = async (company_id, catalogId, updates) => {

    // Whitelist: only these fields can be changed via the update endpoint.
    // Prevents accidental or malicious reassignment of company_id, machine_id, product_id.
    const allowed = {};
    if (updates.stock          !== undefined) allowed.stock          = updates.stock;
    if (updates.is_enabled     !== undefined) allowed.is_enabled     = updates.is_enabled;
    if (updates.price_override !== undefined) allowed.price_override = updates.price_override;
    if (updates.slot_label     !== undefined) allowed.slot_label     = updates.slot_label;
    if (updates.max_capacity   !== undefined) allowed.max_capacity   = updates.max_capacity;

    // Auto-set last_restocked_at whenever stock is explicitly updated
    if (updates.stock !== undefined) {
        allowed.last_restocked_at = new Date();
    }

    if (Object.keys(allowed).length === 0) {
        throw ApiError.badRequest('No valid fields provided for update');
    }

    const query = { _id: catalogId };
    if (company_id) query.company_id = company_id;

    const entry = await MachineCatalog.findOneAndUpdate(
        query,
        allowed,
        { new: true, runValidators: true }
    );

    if (!entry) {
        throw ApiError.notFound('Catalog entry not found');
    }
    return entry;
}


export const removeCatalogEntry = async (company_id,catalogId) => {
    
    const query = { _id: catalogId };
    if (company_id) query.company_id = company_id;

    const entry = await MachineCatalog.findOneAndDelete(query);

    if (!entry) {
        throw ApiError.notFound(
            "Catalog entry not found"
        );
    }

    return entry;
};

export const getMachineCatalog = async (company_id, machine_id) => {
    const normalizedMachineId = machine_id;
    const query = {};
    if (company_id) query.company_id = company_id; 
    if (machine_id) query.machine_id = machine_id; 
    
    return MachineCatalog.find(query)
       .populate("product_id", "product_name price image_url")
       .sort({ slot_label: 1 });
}
