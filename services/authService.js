const User = require("../models/user.js");
const { successResponse } = require("../utils/responseHandler.js");
const CustomError = require("../utils/customError.js");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const config = require("../config.js");
const accessTokenSecretKey = config.jwt.AccessTokenSecretKey;
const accessTokenExpireIn = config.jwt.AccessTokenExpiresIn;

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new CustomError("Email and password are required", 400);
    }
    const user = await User.findOne({
      email,
      status: "Active",
      isDeleted: false,
    }).populate("role", "name");
    let role = user?.role.name;

    if (!user) {
      throw new CustomError("Invalid credentials", 403);
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      throw new CustomError("Invalid credentials", 403);
    }

    const access_token = jwt.sign(
      { id: user._id, role: role },
      accessTokenSecretKey,
      {
        expiresIn: accessTokenExpireIn,
      }
    );
    const { password: _, ...userWithoutPassword } = user.toObject();

    return successResponse(res, "Login successful", {
      access_token,
      user: userWithoutPassword,
      role: role,
    });
  } catch (error) {
    next(error);
  }
};

const sendOtp = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) throw new CustomError("User not found", 404);

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp;
    user.otpExpires = Date.now() + 10 * 60 * 1000;
    await user.save();

    // Send email directly here
    let transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: config.smtp.email,
        pass: config.smtp.password,
      },
    });

    await transporter.sendMail({
      from: config.smtp.email,
      to: email,
      subject: "Your OTP Code",
      text: `Your OTP is: ${otp}`,
    });

    return successResponse(res, "OTP sent to email");
  } catch (err) {
    next(err);
  }
};

const verifyOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email });
    if (!user) throw new CustomError("User not found", 404);

    if (
      !user.otp ||
      user.otp !== otp ||
      !user.otpExpires ||
      user.otpExpires < Date.now()
    ) {
      throw new CustomError("Invalid or expired OTP", 400);
    }
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();
    return successResponse(res, "OTP verified successfully");
  } catch (err) {
    next(err);
  }
};

module.exports = { login, sendOtp, verifyOtp };
