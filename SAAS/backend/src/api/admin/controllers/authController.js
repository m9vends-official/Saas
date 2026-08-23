import { loginUser, registerUser, refreshTokenService, logoutUser } from "../../../services/authService.js";
import Company from "../../../models/Company.js";

// ─── POST /api/admin/auth/register ────────────────────────────────────────────
export const register = async (req, res, next) => {
  try {
    // req.body is already validated and sanitized by validateRegister middleware
    const { company_id, name, email, password, role } = req.body;

    // ✅ Register logic moved to service layer (separation of concerns)
    const user = await registerUser({ company_id, name, email, password, role });

    // ✅ password_hash is never returned — safeUser is returned from service
    res.status(201).json({
      success: true,
      message: "User registered successfully",
      data:    user,
    });
  } catch (error) {
    // Pass to global error middleware — handles ApiError and unexpected errors
    next(error);
  }
};

// ─── POST /api/admin/auth/login ───────────────────────────────────────────────
export const login = async (req, res, next) => {
  try {
    // req.body is already validated by validateLogin middleware
    const { email, password } = req.body;

    const { accessToken, refreshToken, user } = await loginUser({ email, password });

    // Set refresh token as httpOnly cookie — more secure than exposing in body
    // httpOnly: JS cannot access it (XSS safe)
    // secure: only sent over HTTPS in production
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge:   7 * 24 * 60 * 60 * 1000, // 7 days in ms
    });

    res.json({
      success:     true,
      message:     "Login successful",
      accessToken, // Access token goes in response body — frontend stores in memory
      user,
    });
  } catch (error) {
    next(error);
  }
};

// ─── POST /api/admin/auth/refresh ────────────────────────────────────────────
export const refresh = async (req, res, next) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    const tokens = await refreshTokenService(refreshToken);

    // Rotate the cookie with the new refresh token
    res.cookie("refreshToken", tokens.refreshToken, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge:   7 * 24 * 60 * 60 * 1000, // 7 days in ms
    });

    res.json({
      success:     true,
      accessToken: tokens.accessToken,
    });
  } catch (error) {
    // Delegate to global error middleware — same as register and login
    next(error);
  }
};

// ─── POST /api/admin/auth/logout ────────────────────────────────────────────
// Protected — requires authMiddleware (user must be authenticated to logout)
export const logout = async (req, res, next) => {
  try {
    // req.user is set by authMiddleware — contains user_id from verified JWT
    await logoutUser(req.user.user_id);

    // Clear the httpOnly cookie on the client side
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure:   process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    res.json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    next(error);
  }
};

// ─── GET /api/admin/auth/me ───────────────────────────────────────────────────
// Returns the current user's company name (for display in the header)
export const me = async (req, res, next) => {
  try {
    const company = await Company.findById(req.user.company_id).select('company_name plan').lean();
    res.json({
      success: true,
      data: {
        user_id:      req.user.user_id,
        company_id:   req.user.company_id,
        company_name: company?.company_name || 'My Company',
        plan:         company?.plan || 'FREE',
        role:         req.user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};