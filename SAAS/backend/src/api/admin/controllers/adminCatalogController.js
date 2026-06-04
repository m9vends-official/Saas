import * as catalogService from "../../../services/catalogService.js";

export const addProduct = async (req,res, next) => {

    try {
        const entry = await catalogService.addProductToMachine({company_id: req.company_id,...req.body,});

        res.status(201).json({
            success: true,
            data: entry,
        });
    } catch (error) {
        next(error);
    }
};

export const updateEntry = async (req,res,next) => {
    
    try {
        const entry =await catalogService.updateCatalogEntry(req.company_id,req.params.id,req.body);

        res.json({
            success: true,
            data: entry,
        });
    } catch (error) {
        next(error);
    }
};

export const removeEntry = async (req,res,next) => {

    try {
        await catalogService.removeCatalogEntry(req.company_id,req.params.id);

        res.json({
            success: true,
            message:
                "Catalog entry removed successfully",
        });
    } catch (error) {
        next(error);
    }
};

export const listCatalogEntries = async (req, res, next) => {
    try {
        const {machine_id} = req.query;
        const entries = await catalogService.getMachineCatalog(req.company_id, machine_id);
        res.json({ success: true, data: entries});
    } catch (error) {
        next(error);
    }
}