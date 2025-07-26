const router = require("express").Router();
const {
  upsertHoliday,
  deleteHoliday,
  getAllHolidays,
  getHolidayById,
} = require("../services/holidayService");

router.post("/", upsertHoliday);
router.get("/", getAllHolidays);
router.get("/:id", getHolidayById);
router.delete("/:id", deleteHoliday);

module.exports = router;
