const express = require("express");
const router = express.Router();
const upload = require("../middlewares/upload");
// const authentcateToken = require("../middlewares/authenticateToken")

const {
  createOrUpdateUser,
  getAllUsers,
  getUserById,
  getAllEmployeesForReporting,
  deleteUser,
  updateUserStatus,
  resetPassword,
  updatePassword,
  getAllEmployeesByReporterId,
  getAllEmployeesByCreatorId,
  getDashboardStats,
  updatePhoneNumber,
  updateRole,
  getUserTree,
  getUsersGroupedByDepartment,
  getTeamMembersByUserId,
  getPermissions,
  getAllEmployeesForAppraisal
} = require("../services/userService");

router.get("/tree", getUserTree);
router.get("/reporters", getAllEmployeesForReporting);
router.post("/", upload.single("image"), createOrUpdateUser);
router.get("/:id/all", getAllUsers);
router.get("/:id", getUserById);
router.get("/reporter/:id/employees", getAllEmployeesByReporterId);
router.get("/creator/:id/employees", getAllEmployeesByCreatorId);
router.get("/:id/employees", getAllEmployeesForAppraisal);
router.delete("/:id", deleteUser);
router.put("/:id/status", updateUserStatus);
router.post("/reset/password", resetPassword);
router.post("/update/password/:id", updatePassword);
router.get("/:id/dashboard", getDashboardStats);
router.put("/:id/number", upload.single("image"), updatePhoneNumber);
router.put("/:id/role", updateRole);
router.get("/departments/users", getUsersGroupedByDepartment);
router.get("/:id/team-members", getTeamMembersByUserId);
router.get("/permissions/:id", getPermissions);

// router.put("/mark-seen/:id", markAllUsersAsSeen);
// router.put("/mark-read", markUserAsReadByViewer);

module.exports = router;
