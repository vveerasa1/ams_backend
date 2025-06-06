const Appraisal = require("../models/appraisal");
const { successResponse } = require("../utils/responseHandler");
const CustomError = require("../utils/customError");
const User = require("../models/user");
const AppraisalTemplate = require("../models/appraisalTemplate");

const createAppraisal = async (req, res, next) => {
  try {
    const details = req.body.appraisalDetails;

    const data = JSON.parse(details);

    if (req.file) {
      const appraisalPdf = req.file;
      const location = await s3Uploads(appraisalPdf, "appraisals");
      data.appraisalPdf = location;
    }

    const appraisal = await Appraisal.create(data);
    const { employeeId, appraisalTemplateId } = appraisal;
    const appraisalTemplate = await AppraisalTemplate.findOne(
      appraisalTemplateId
    );
    const points = appraisalTemplate.points;

    console.log(points);
    if (employeeId && typeof points === "number") {
      await User.findByIdAndUpdate(
        employeeId,
        { $inc: { totalPoints: -points } },
        { new: true }
      );
    }

    return successResponse(
      res,
      "Appraisal created successfully",
      appraisal,
      200
    );
  } catch (err) {
    next(err);
  }
};

const getFilteredAppraisalsByManager = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const { managerId, type, managerAppraisalStatus, search = "" } = req.query;

    if (!managerId) {
      throw new CustomError("Manager ID is required", 400);
    }

    // Build filter for employees managed by this manager
    const employeeQuery = { managedBy: managerId };

    if (search) {
      const searchRegex = new RegExp(search, "i");
      employeeQuery.$or = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex },
      ];
    }

    const employeeList = await User.find(employeeQuery, "_id");
    const employeeIds = employeeList.map((emp) => emp._id);

    // Build appraisal filter
    const appraisalFilter = { employeeId: { $in: employeeIds } };

    if (type) {
      appraisalFilter.type = type;
    }

    if (managerAppraisalStatus) {
      appraisalFilter.managerAppraisalStatus = managerAppraisalStatus;
    }

    const [appraisals, total] = await Promise.all([
      Appraisal.find(appraisalFilter)
        .skip(skip)
        .limit(limit)
        .populate("appraisalTemplateId")
        .populate("employeeId", "firstName lastName email")
        .populate("createdBy", "firstName lastName"),
      Appraisal.countDocuments(appraisalFilter),
    ]);

    return successResponse(res, "Appraisals fetched successfully", {
      appraisals,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
};

const getAppraisalsByEmployeeId = async (req, res, next) => {
  try {
    const { employeeId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const skip = (page - 1) * limit;

    if (!employeeId) {
      throw new CustomError("Employee ID is required", 400);
    }

    const filter = { employeeId };

    const [appraisals, total] = await Promise.all([
      Appraisal.find(filter)
        .skip(skip)
        .limit(Number(limit))
        .populate("appraisalTemplateId")
        .populate("employeeId", "firstName lastName email")
        .populate("createdBy", "firstName lastName"),
      Appraisal.countDocuments(filter),
    ]);

    return successResponse(res, "Appraisals fetched successfully", {
      appraisals,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
};

const getAppraisalById = async (req, res, next) => {
  try {
    const appraisal = await Appraisal.findById(req.params.id)
      .populate("appraisalTemplateId")
      .populate("role", "name")
      .populate("employeeId", "firstName lastName")
      .populate("createdBy", "firstName lastName");
    if (!appraisal) throw new CustomError("Appraisal not found", 404);

    return successResponse(res, "Appraisal fetched successfully", appraisal);
  } catch (err) {
    next(err);
  }
};

const updateAppraisal = async (req, res, next) => {
  try {
    const updated = await Appraisal.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!updated) throw new CustomError("Appraisal not found", 404);

    return successResponse(res, "Appraisal updated successfully", updated);
  } catch (err) {
    next(err);
  }
};

const deleteAppraisal = async (req, res, next) => {
  try {
    const deleted = await Appraisal.findByIdAndDelete(req.params.id);
    if (!deleted) throw new CustomError("Appraisal not found", 404);

    return successResponse(res, "Appraisal deleted successfully", deleted);
  } catch (err) {
    next(err);
  }
};

const updateAppraisalStatusAndFeedback = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { feedback, status } = req.query;
    const role = req.query.role?.toLowerCase();

    if (!["employee", "manager", "admin"].includes(role)) {
      throw new CustomError(
        "Invalid role. Must be 'employee', 'manager', 'hr' or 'admin'",
        400
      );
    }

    if (
      !["approved", "rejected"].includes(status)
    ) {
      throw new CustomError("Invalid status value", 400);
    }

    const updateFields = {};

    // Map role to field names
    if (role === "employee") {
      if (feedback) updateFields.employeeFeedBack = feedback;
    } else if (role === "manager") {
      updateFields.managerApprovalStatus = status;
      if (feedback) updateFields.managerFeedBack = feedback;
    } else if (role === "admin") {
      if (status === "approved") updateFields.status = status;
      updateFields.adminApprovalStatus = status;
      if (feedback) updateFields.adminFeedBack = feedback;
    } 

    if (status === "rejected") {
      updateFields.status = status;
      const appraisal = await Appraisal.findById(id).populate(
        "appraisalTemplateId",
        "points"
      );

      if (
        appraisal.employeeId &&
        typeof appraisal.appraisalTemplateId.points === "number"
      ) {
        await User.findByIdAndUpdate(
          appraisal.employeeId,
          { $inc: { totalPoints: appraisal.appraisalTemplateId.points } },
          { new: true }
        );
      }
    }

    const updated = await Appraisal.findByIdAndUpdate(id, updateFields, {
      new: true,
    });

    if (!updated) throw new CustomError("Appraisal not found", 404);

    return successResponse(res, "Appraisal updated successfully", updated);
  } catch (err) {
    next(err);
  }
};

const getFilteredAppraisalsByCreator = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const createdBy = req.params.employeeId;
    console.log(createdBy + "here");

    const { type, hrAppraisalStatus, search = "" } = req.query;

    if (!createdBy) {
      throw new CustomError("createdBy (HR ID) is required", 400);
    }

    // Base filter for appraisals created by this HR
    const appraisalFilter = { createdBy };

    if (type) {
      appraisalFilter.type = type;
    }

    if (hrAppraisalStatus) {
      appraisalFilter.hrAppraisalStatus = hrAppraisalStatus;
    }

    // If search exists, find matching employees first
    let employeeIds = [];
    if (search) {
      const searchRegex = new RegExp(search, "i");
      const employees = await User.find(
        {
          $or: [
            { firstName: searchRegex },
            { lastName: searchRegex },
            { email: searchRegex },
          ],
        },
        "_id"
      );

      employeeIds = employees.map((emp) => emp._id);

      // If no employees matched, return early
      if (employeeIds.length === 0) {
        return successResponse(res, "Appraisals fetched successfully", {
          appraisals: [],
          total: 0,
          page,
          totalPages: 0,
        });
      }

      appraisalFilter.employeeId = { $in: employeeIds };
    }

    const [appraisals, total] = await Promise.all([
      Appraisal.find(appraisalFilter)
        .skip(skip)
        .limit(limit)
        .populate("employeeId", "firstName lastName email")
        .populate("createdBy", "firstName lastName"),
      Appraisal.countDocuments(appraisalFilter),
    ]);

    return successResponse(res, "Appraisals fetched successfully", {
      appraisals,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
};

const getMatchedUsersByTemplate = async (req, res, next) => {
  try {
    const { department, role } = req.body;

    if (!department || !role) {
      throw new CustomError("Department and role are required", 400);
    }

    const template = await AppraisalTemplate.findOne({
      department: { $in: [department] },
      role: { $in: [role] },
    });
    if (!template) {
      throw new CustomError(
        "No appraisal template found for given department and role",
        404
      );
    }

    const matchedUsers = await User.find({
      department,
      role,
      totalPoints: { $lte: template.points || 0 },
    }).select("firstName lastName email totalPoints");

    return successResponse(res, "Matched users fetched successfully", {
      template,
      matchedUsers,
    });
  } catch (err) {
    next(err);
  }
};

const bulkCreateAppraisals = async (req, res, next) => {
  try {
    const { appraisalTemplateId, users } = req.body;
    const createdBy = req.user?._id; // assuming you have middleware for auth

    if (!appraisalTemplateId || !Array.isArray(users) || users.length === 0) {
      throw new CustomError(
        "AppraisalTemplateId and users array are required",
        400
      );
    }

    const template = await AppraisalTemplate.findById(appraisalTemplateId);
    if (!template) {
      throw new CustomError("Appraisal Template not found", 404);
    }

    const appraisalDocs = users.map(
      ({ employeeId, appraisalStartDate, appraisalEndDate }) => ({
        employeeId,
        appraisalTemplateId,
        appraisalStartDate: appraisalStartDate || null,
        appraisalEndDate: appraisalEndDate || null,
        department,
        role,
        createdBy,
      })
    );

    await Appraisal.insertMany(appraisalDocs);

    return successResponse(
      res,
      "Appraisals created successfully for all users"
    );
  } catch (err) {
    next(err);
  }
};

module.exports = {
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
};
