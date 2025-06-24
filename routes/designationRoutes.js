// routes/designation.js
const express = require("express");
const router = express.Router();

const {
  upsertDesignation,
  deleteDesignation,
  getAllDesignations,
  getDesignationById,
} = require("../services/designationService");

router.post("/", upsertDesignation);
router.delete("/:id", deleteDesignation);
router.get("/", getAllDesignations);
router.get("/:id", getDesignationById);

module.exports = router;
