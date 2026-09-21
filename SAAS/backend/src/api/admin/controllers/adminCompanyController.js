import * as companyService from "../../../services/companyService.js";

export const getMyCompany = async (req, res, next) => {
    try {
        const company = await companyService.getCompanyProfile(req.company_id);
        res.json({
            success: true,
            data: company,
        });
    } catch (error) {
        next(error);
    }
};

export const updateMyCompany = async (req, res, next) => {
    try {
        const company = await companyService.updateCompanyProfile(req.company_id, req.body);
        res.json({
            success: true,
            data: company,
        });
    } catch (error) {
        next(error);
    }
};
