const router = require("express").Router();
const {
  createOrUpdatePoint,
  getAllPoints,
  getPointById,
  getAllPointsByEmployeeId,
  deletePoint,
  // getAllPointsByCreator,
  getEmployeeLatestPoints,
} = require("../services/pointService");

router.post("/", createOrUpdatePoint);
router.post("/:id", createOrUpdatePoint);
router.get("/", getAllPoints);
router.get("/:id", getPointById);
// router.get("/creator/:id", getAllPointsByCreator);
router.get("/employee/:id", getAllPointsByEmployeeId);
router.get("/employee/:id/latest", getEmployeeLatestPoints);

router.delete("/:id", deletePoint);

module.exports = router;
