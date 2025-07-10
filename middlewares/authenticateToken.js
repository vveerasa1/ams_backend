const jwt = require("jsonwebtoken");
const CustomError = require("../utils/customError.js");
const config = require("../config.js");

const JWT_SECRET = config.jwt.AccessTokenSecretKey;

const authenticateToken = (req, res, next) => {
  const token = req.header("Authorization")?.split(" ")[1];

  if (!token) {
    throw new CustomError("Token required", 401);
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    const message =
      error.name === "TokenExpiredError"
        ? "Token has expired"
        : "Invalid token";
    next(new CustomError(message, 401));
  }
};

module.exports = authenticateToken;
