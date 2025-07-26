const express = require("express");
const router = express.Router();
const authRoutes = require("./authRoutes");
const employeeRoute = require("./userRoutes");
const pointRoutes = require("./pointRoutes");
const appraisalRoutes = require("./appraisalRoutes");
const appraisalTemplateRoutes = require("./appraisalTemplateRoutes");
const designationRoutes = require("./designationRoutes");
const departmentRoutes = require("./departmentRoutes");
const attendanceRoutes = require("./attendanceRoutes");
const holidayRoutes = require("./holidayRoutes");

const roleRoutes = require("./roleRoutes");

router.use("/auth", authRoutes);
router.use("/users", employeeRoute);
router.use("/points", pointRoutes);
router.use("/appraisals", appraisalRoutes);
router.use("/templates", appraisalTemplateRoutes);
router.use("/designations", designationRoutes);
router.use("/departments", departmentRoutes);
router.use("/attendance", attendanceRoutes);
router.use("/roles", roleRoutes);
router.use("/holidays", holidayRoutes);

module.exports = router;
