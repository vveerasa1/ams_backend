const router = require("express").Router();
const {
  createOrUpdatePoint,
  getAllPoints,
  getPointById,
  getAllPointsByEmployeeId,
  deletePoint,
  sortPoints,
  filterPoints,
  getAllPointsByCreator,
} = require("../services/pointService");

router.post("/", createOrUpdatePoint);
router.post("/:id", createOrUpdatePoint);
router.get("/sort", sortPoints);
router.get("/filter", filterPoints);
router.get("/", getAllPoints);
router.get("/:id", getPointById);
router.get("/creator/:id", getAllPointsByCreator);
router.get("/employee/:id", getAllPointsByEmployeeId);
router.delete("/:id", deletePoint);

module.exports = router;
