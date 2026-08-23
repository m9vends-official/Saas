import jwt from "jsonwebtoken"

export const generateAccessToken = (payload) => {
    return jwt.sign(
        payload,
        process.env.JWT_ACCESS_SECRET,
        {
            expiresIn: process.env.ACCESS_TOKEN_EXPIRY || "1d"
        }
    )
}

export const generateRefreshToken = (payload) => {
    return jwt.sign(
        payload,
        process.env.JWT_REFRESH_SECRET,
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRY || "7d"
        }
    )
}