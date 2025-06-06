const express = require("express");
const router = express.Router();
const upload = require("../middlewares/upload");

const {
  createAppraisal,
  getAppraisalById,
  updateAppraisal,
  deleteAppraisal,
  getAppraisalsByEmployeeId,
  getFilteredAppraisalsByManager,
  updateAppraisalStatusAndFeedback,
  getFilteredAppraisalsByCreator,
  getMatchedUsersByTemplate,
  bulkCreateAppraisals,
} = require("../services/appraisalService");

router.get("/creator/:employeeId", getFilteredAppraisalsByCreator);
router.post("/", upload.single("appraisalPdf"), createAppraisal);
router.post("/bulk", bulkCreateAppraisals);
router.get("/:id", getAppraisalById);
router.put("/:id", updateAppraisal);
router.get("/employee/:employeeId", getAppraisalsByEmployeeId);
router.get("/manager/:employeeId", getFilteredAppraisalsByManager);
router.get("/template/match", getMatchedUsersByTemplate);
router.put("/:id/status", updateAppraisalStatusAndFeedback);
router.delete("/:id", deleteAppraisal);

module.exports = router;
