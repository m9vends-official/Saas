import MachineCatalog from "../models/MachineCatalog.js";
import Device from "../models/Device.js";
import Product from "../models/Product.js";
import ApiError from "../utils/ApiError.js";

export const addProductToMachine = async ({ company_id, machine_id, product_id, stock, slot_label, price_override }) => {

    const machine = await Device.findOne({company_id,device_id: machine_id});

    if(!machine){
        throw ApiError.notFound("Machine not Found");
    }

    const product = await Product.findOne({_id: product_id, company_id});

    if(!product){
        throw ApiError.notFound("Product not found");
    }

    const existing = await MachineCatalog.findOne({
        machine_id,
        product_id,
    })

    if(existing){
        throw ApiError.conflict("Product Already exists in machine catalog");
    }

    return MachineCatalog.create({
        company_id,
        machine_id,
        product_id,
        stock,
        slot_label,
        price_override,
    })
}

export const updateCatalogEntry = async (company_id, catalogId, updates) => {
    
    const entry = await MachineCatalog.findOneAndUpdate(
        {
            _id: catalogId,
            company_id,
        },
        updates,
        {
            new: true,
            runValidators: true
        }
    )

    if(!entry){
        throw ApiError.notFound("Catalog entry not found");
    }
    return entry;
}

export const removeCatalogEntry = async (company_id,catalogId) => {
    
    const entry = await MachineCatalog.findOneAndDelete({
        _id: catalogId,
        company_id,
    });

    if (!entry) {
        throw ApiError.notFound(
            "Catalog entry not found"
        );
    }

    return entry;
};

export const getMachineCatalog = async (company_id, machine_id) => {
    return MachineCatalog.find({company_id, machine_id})
       .populate("product_id","product_name price image_url")
       .sort({slot_label: 1});
}