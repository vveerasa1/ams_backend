const express = require("express");
const router = express.Router();
const {
  createAppraisalTemplate,
  getAllAppraisalTemplates,
  getAppraisalTemplateById,
  updateAppraisalTemplate,
  deleteAppraisalTemplate,
  getAppraisalTemplateByCriteria,
} = require("../services/appraisalTemplateService");

router.get("/match", getAppraisalTemplateByCriteria);
router.post("/", createAppraisalTemplate);
router.get("/", getAllAppraisalTemplates);
router.get("/:id", getAppraisalTemplateById);
router.put("/:id", updateAppraisalTemplate);
router.delete("/:id", deleteAppraisalTemplate);


module.exports = router;
