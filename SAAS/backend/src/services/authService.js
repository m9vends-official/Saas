import bcrypt from "bcrypt";
import User from "../models/User.js";
import { generateAccessToken, generateRefreshToken } from "../utils/jwt.js";
import ApiError from "../utils/ApiError.js";
import logger from "../utils/logger.js";
import jwt from "jsonwebtoken";

// ─── Login ────────────────────────────────────────────────────────────────────
export const loginUser = async ({ email, password }) => {
  const user = await User.findOne({ email });

  if (!user) {
    // Never reveal which one failed — prevents user enumeration attacks
    throw ApiError.unauthorized("Invalid credentials");
  }

  if (!user.is_active) {
    throw ApiError.forbidden("Your account has been deactivated. Contact your admin.");
  }

  const isMatch = await bcrypt.compare(password, user.password_hash);

  if (!isMatch) {
    logger.warn({ email }, "Failed login attempt");
    throw ApiError.unauthorized("Invalid credentials");
  }

  const payload = {
    user_id:    user._id,
    company_id: user.company_id,
    role:       user.role,
  };

  const accessToken  = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  // Store refresh token in DB for token rotation / logout invalidation
  user.refresh_token  = refreshToken;
  user.last_login_at  = new Date();
  await user.save();

  logger.info({ user_id: user._id, role: user.role }, "User logged in");

  // Security: strip sensitive fields before returning
  const safeUser = {
    _id:        user._id,
    name:       user.name,
    email:      user.email,
    role:       user.role,
    company_id: user.company_id,
    is_active:  user.is_active,
  };

  return { accessToken, refreshToken, user: safeUser };
};

// ─── Register ─────────────────────────────────────────────────────────────────
export const registerUser = async ({ company_id, name, email, password, role }) => {
  // Check if email already exists — give a clean 409 conflict error
  const existingUser = await User.findOne({ email });
  
  if (existingUser) {
    throw ApiError.conflict("A user with this email already exists");
  }

  const password_hash = await bcrypt.hash(password, 12);

  const user = await User.create({
    company_id,
    name,
    email,
    password_hash,
    role,
  });

  logger.info({ user_id: user._id, role }, "New user registered");

  //  Security: never return password_hash in any response
  const safeUser = {
    _id:        user._id,
    name:       user.name,
    email:      user.email,
    role:       user.role,
    company_id: user.company_id,
    is_active:  user.is_active,
    createdAt:  user.createdAt,
  };
  
  return safeUser;
};

export const refreshTokenService = async(refreshToken) => {

  if(!refreshToken){
    throw ApiError.unauthorized("Refresh token is required");
  }
  let decoded;
  try {
    decoded = jwt.verify(refreshToken,process.env.JWT_REFRESH_SECRET);
  } catch (error) {
    throw ApiError.unauthorized("Invalid refresh token");
  }

  const user = await User.findById(decoded.user_id);
  if (!user || user.refresh_token !== refreshToken) {
    throw ApiError.unauthorized("Invalid refresh token");
  }

  // Guard: deactivated users must not receive new tokens — same check as login
  if (!user.is_active) {
    throw ApiError.forbidden("Your account has been deactivated. Contact your admin.");
  }

  const payload = {
    user_id : user._id,
    company_id : user.company_id,
    role : user.role
  };

  const newAccessToken = generateAccessToken(payload);
  const newRefreshToken = generateRefreshToken(payload);

  user.refresh_token = newRefreshToken;
  await user.save();

  logger.info({ user_id: user._id }, "Access token refreshed");

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
};

// ─── Logout ───────────────────────────────────────────────────────────────────
export const logoutUser = async (userId) => {
  const user = await User.findById(userId);

  if (!user) {
    // Fail silently — if the user doesn't exist, logout intent is already satisfied
    return;
  }

  // Invalidate the refresh token in DB so the cookie becomes useless
  user.refresh_token = null;
  await user.save();

  logger.info({ user_id: userId }, "User logged out");
};