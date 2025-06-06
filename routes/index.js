const express = require("express");
const router = express.Router();
const authRoutes = require("./authRoutes");
const employeeRoute = require("./userRoutes");
const pointRoutes = require("./pointRoutes");
const appraisalRoutes = require("./appraisalRoutes");
const appraisalTemplateRoutes = require("./appraisalTemplateRoutes");
const roleRoutes = require("./roleRoutes");

router.use("/auth", authRoutes);
router.use("/users", employeeRoute);
router.use("/points", pointRoutes);
router.use("/appraisals", appraisalRoutes);
router.use("/templates", appraisalTemplateRoutes);

router.use("/roles", roleRoutes);

module.exports = router;
