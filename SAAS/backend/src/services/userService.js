import User from "../models/User.js";
import bcrypt from "bcrypt";
import logger from "../utils/logger.js";
import ApiError from "../utils/ApiError.js";

export const listCompanyUsers = async (company_id) => {
    return User.find(company_id ? { company_id } : {})
       .select("-password_hash")
       .sort({createdAt: -1});
}

// BUG 2 FIX: Changed from positional args to destructured object
// to match how userController.js calls: userService.inviteUser({ company_id, ...req.body })
export const inviteUser = async ({ company_id, name, email, password, role }) => {

    const existing = await User.findOne({email});
    if(existing){
        throw ApiError.conflict("User with email already exists");
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const user = await User.create({
        company_id,
        name,
        email,
        password_hash,
        role,
    });

    logger.info({user_id: user._id, role}, "New user invited");

    const {password_hash: _, ...safeUser} = user.toObject();
    return safeUser;
}

export const updateUserStatus = async (company_id, userId, is_active) => {

    const user = await User.findOneAndUpdate(
        {_id: userId, company_id},
        {is_active},
        {new: true, runValidators: true}
    ).select("-password_hash");

    if(!user){
        throw ApiError.notFound("User not Found");
    }

    logger.info({user_id: userId, is_active},"User status updated");

    return user;
}
