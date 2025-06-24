// routes/designation.js
const express = require("express");
const router = express.Router();

const {
  upsertDepartment,
  deleteDepartment,
  getAllDepartments,
  getDepartmentById,
} = require("../services/departmentService");

router.post("/", upsertDepartment);
router.delete("/:id", deleteDepartment);
router.get("/", getAllDepartments);
router.get("/:id", getDepartmentById);

module.exports = router;
