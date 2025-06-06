const AppraisalTemplate = require("../models/appraisalTemplate");
const CustomError = require("../utils/customError");
const { successResponse } = require("../utils/responseHandler");
const Appraisal = require("../models/appraisal");

// Create Appraisal Template
const createAppraisalTemplate = async (req, res, next) => {
  try {
    const template = await AppraisalTemplate.create(req.body);
    return successResponse(
      res,
      "Appraisal Template created successfully",
      template
    );
  } catch (err) {
    next(err);
  }
};

// Get All Appraisal Templates
const getAllAppraisalTemplates = async (req, res, next) => {
  try {
    const templates = await AppraisalTemplate.find().populate("role", "name");
    return successResponse(
      res,
      "Appraisal Templates fetched successfully",
      templates
    );
  } catch (err) {
    next(err);
  }
};

// Get Appraisal Template by ID
const getAppraisalTemplateById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const template = await AppraisalTemplate.findById(id).populate(
      "role",
      "name"
    );
    if (!template) throw new CustomError("Appraisal Template not found", 404);
    return successResponse(
      res,
      "Appraisal Template fetched successfully",
      template
    );
  } catch (err) {
    next(err);
  }
};

// Update Appraisal Template
const updateAppraisalTemplate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const template = await AppraisalTemplate.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!template) throw new CustomError("Appraisal Template not found", 404);
    return successResponse(
      res,
      "Appraisal Template updated successfully",
      template
    );
  } catch (err) {
    next(err);
  }
};

// Delete Appraisal Template
const deleteAppraisalTemplate = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if the template is referenced in any Appraisal
    const isReferenced = await Appraisal.exists({ appraisalTemplateId: id });

    if (isReferenced) {
      // If referenced, set isDeleted: true
      const updated = await AppraisalTemplate.findByIdAndUpdate(
        id,
        { isDeleted: true },
        { new: true }
      );

      if (!updated) throw new CustomError("Appraisal Template not found", 404);

      return successResponse(
        res,
        "Appraisal Template marked as deleted due to existing references",
        updated
      );
    } else {
      // If not referenced, delete it
      const deleted = await AppraisalTemplate.findByIdAndDelete(id);
      if (!deleted) throw new CustomError("Appraisal Template not found", 404);

      return successResponse(res, "Appraisal Template deleted successfully");
    }
  } catch (err) {
    next(err);
  }
};

const getAppraisalTemplateByCriteria = async (req, res, next) => {
  try {
    const { totalPoints, role, department } = req.query;

    // Validate request body
    if (!totalPoints || !role || !department) {
      throw new CustomError(
        "totalPoints, role, and department are required",
        400
      );
    }
    console.log(role)

    // Find matching appraisal template
    const template = await AppraisalTemplate.findOne({
      role: { $in: [role] },
      department: { $in: [department] },
      points: { $lte: totalPoints },
    });

    if (!template) {
      throw new CustomError("No matching appraisal template found", 404);
    }

    return successResponse(
      res,
      "Appraisal Template fetched successfully",
      template
    );
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createAppraisalTemplate,
  getAllAppraisalTemplates,
  getAppraisalTemplateById,
  updateAppraisalTemplate,
  deleteAppraisalTemplate,
  getAppraisalTemplateByCriteria,
};
