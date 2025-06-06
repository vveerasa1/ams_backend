const express = require("express");
const router = express.Router();
const { login, sendOtp } = require("../services/authService");

router.post("/login", login);
router.post("/send-otp", sendOtp);


module.exports = router;
