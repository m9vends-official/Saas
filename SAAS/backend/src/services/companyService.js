import Company from "../models/Company.js";
import ApiError from "../utils/ApiError.js";

// Get company profile for the current tenant
export const getCompanyProfile = async (company_id) => {
    // If SUPER_ADMIN (null company_id), they shouldn't fetch a single company profile blindly without ID
    // but for the sake of the Settings page, we'll throw an error if no company_id is provided.
    if (!company_id) {
        throw ApiError.badRequest("Super Admins must specify a company ID to fetch");
    }

    const company = await Company.findById(company_id).select("-__v");
    if (!company) {
        throw ApiError.notFound("Company not found");
    }
    return company;
};

// Update company profile for the current tenant
export const updateCompanyProfile = async (company_id, updates) => {
    if (!company_id) {
        throw ApiError.badRequest("Super Admins must specify a company ID to update");
    }

    const allowed = {};
    if (updates.company_name !== undefined) allowed.company_name = updates.company_name;
    if (updates.contact_email !== undefined) allowed.contact_email = updates.contact_email;
    if (updates.contact_phone !== undefined) allowed.contact_phone = updates.contact_phone;
    if (updates.razorpay_key_id !== undefined) allowed.razorpay_key_id = updates.razorpay_key_id;
    if (updates.razorpay_key_secret !== undefined) allowed.razorpay_key_secret = updates.razorpay_key_secret;

    if (Object.keys(allowed).length === 0) {
        throw ApiError.badRequest("No valid fields provided for update");
    }

    const company = await Company.findByIdAndUpdate(company_id, allowed, { new: true, runValidators: true }).select("-__v");
    if (!company) {
        throw ApiError.notFound("Company not found");
    }
    
    return company;
};
