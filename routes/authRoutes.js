const express = require("express");
const router = express.Router();
const { login, sendOtp, verifyOtp } = require("../services/authService");

router.post("/login", login);
router.post("/send-otp", sendOtp);
router.post("/verify-otp", verifyOtp);

module.exports = router;
