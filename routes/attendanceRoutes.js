const express = require("express");
const router = express.Router();

const {
  upsertAttendance,
  getAttendanceById,
  deleteAttendanceById,
  getMonthlyAttendanceByEmployee,
} = require("../services/attendanceService");

router.post("/", upsertAttendance);
router.get("/:id", getAttendanceById);
router.delete("/:id", deleteAttendanceById);
router.get("/monthly/:userId", getMonthlyAttendanceByEmployee);
module.exports = router;
