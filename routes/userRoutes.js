const express = require("express");
const router = express.Router();
const upload = require("../middlewares/upload");
// const authentcateToken = require("../middlewares/authenticateToken")

const {
  createOrUpdateUser,
  getAllUsers,
  getUserById,
  getAllManagers,
  getAllEmployeesForReporting,
  deleteUser,
  updateUserStatus,
  resetPassword,
  updatePassword,
  getAllEmployeesByReporterId,
  getAllEmployeesByCreatorId,
  getDashboardStats,
} = require("../services/userService");

router.get("/reporters", getAllEmployeesForReporting);
router.post("/", upload.single("image"), createOrUpdateUser); // create
router.post("/:id", upload.single("image"), createOrUpdateUser);
router.get("/managers", getAllManagers);
router.get("/", getAllUsers);
router.get("/:id", getUserById);
router.get("/reporter/:id/employees", getAllEmployeesByReporterId);
router.get("/creator/:id/employees", getAllEmployeesByCreatorId);
router.delete("/:id", deleteUser);
router.put("/:id/status", updateUserStatus);
router.post("/reset/password", resetPassword);
router.post("/update/password/:id", updatePassword);
router.get("/managers", getAllManagers);
router.get("/:id/dashboard", getDashboardStats);

module.exports = router;
