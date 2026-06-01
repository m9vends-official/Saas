import User from "../../../models/User.js";
import ApiError from "../../../utils/ApiError.js";
import logger from "../../../utils/logger.js";

// ─── GET /api/admin/users/me ──────────────────────────────────────────────────
// Returns the full profile of the currently authenticated user.
// req.user is populated by authMiddleware from the verified JWT payload.
export const getMe = async (req, res, next) => {
  try {
    // Fetch fresh data from DB — do NOT rely solely on JWT payload
    // (the JWT payload could be stale if role/status changed after last login)
    const user = await User.findById(req.user.user_id).select(
      "-password_hash -refresh_token"
    );

    if (!user) {
      throw ApiError.notFound("User not found");
    }

    if (!user.is_active) {
      throw ApiError.forbidden("Your account has been deactivated. Contact your admin.");
    }

    logger.info({ user_id: user._id }, "Profile fetched");

    res.json({
      success: true,
      user: {
        _id:          user._id,
        name:         user.name,
        email:        user.email,
        role:         user.role,
        company_id:   user.company_id,
        is_active:    user.is_active,
        last_login_at: user.last_login_at,
        createdAt:    user.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};
