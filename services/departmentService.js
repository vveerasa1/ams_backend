const Department = require("../models/department");
const { successResponse } = require("../utils/responseHandler.js");
const CustomError = require("../utils/customError.js");
const User = require("../models/user");

const upsertDepartment = async (req, res, next) => {
  try {
    const { id, name, userId, departmentLead, parentDepartment } = req.body;

    if (!name) {
      throw new CustomError("Name is required", 400);
    }

    const departmentData = {
      name,
      modifiedBy: userId,
      modifiedTime: new Date(),
    };
    if (departmentLead) departmentData.departmentLead = departmentLead;
    if (parentDepartment) departmentData.parentDepartment = parentDepartment;

    let department;

    if (id) {
      if (parentDepartment && id === parentDepartment) {
        throw new CustomError(
          "Parent department should not be the same as the department itself",
          400
        );
      }
      // Update
      const unsetFields = {};
      if (!departmentLead) unsetFields.departmentLead = 1;
      if (!parentDepartment) unsetFields.parentDepartment = 1;

      department = await Department.findByIdAndUpdate(
        id,
        {
          $set: departmentData,
          ...(Object.keys(unsetFields).length && { $unset: unsetFields }),
        },
        { new: true, runValidators: true }
      );

      if (!department) {
        throw new CustomError("Department not found", 404);
      }
    } else {
      // Add
      const createData = {
        name,
        addedBy: userId,
      };
      if (departmentLead) createData.departmentLead = departmentLead;
      if (parentDepartment) createData.parentDepartment = parentDepartment;

      department = new Department(createData);
      await department.save();
    }

    return successResponse(
      res,
      `Department ${id ? "updated" : "created"} successfully`,
      department
    );
  } catch (err) {
    if (err.code === 11000) {
      throw new CustomError("Name already exists", 409);
    }
    next(err);
  }
};

const deleteDepartment = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if any user exists in this department
    const userExists = await User.exists({ department: id });
    if (userExists) {
      throw new CustomError(
        "Cannot delete: Users exist in this department",
        400
      );
    }

    const department = await Department.findByIdAndDelete(id);
    if (!department) {
      throw new CustomError("Department not found", 404);
    }
    return successResponse(res, "Department deleted successfully", null);
  } catch (err) {
    next(err);
  }
};

const getAllDepartments = async (req, res, next) => {
  try {
    const departments = await Department.find()
      .sort({ name: 1 })
      .populate({ path: "departmentLead", select: "firstName lastName" })
      .populate({ path: "parentDepartment", select: "name" })
      .populate({ path: "addedBy", select: "firstName lastName" })
      .populate({ path: "modifiedBy", select: "firstName lastName" });

    return successResponse(
      res,
      "Departments fetched successfully",
      departments
    );
  } catch (err) {
    next(err);
  }
};

const getDepartmentById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const department = await Department.findById(id)
      .populate({ path: "addedBy", select: "firstName lastName" })
      .populate({ path: "modifiedBy", select: "firstName lastName" })
      .populate({ path: "departmentLead", select: "firstName lastName" })
      .populate({ path: "parentDepartment", select: "name" });
    if (!department) {
      return res.status(404).json({ error: "Department not found" });
    }

    return successResponse(res, "Department fetched successfully", department);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  upsertDepartment,
  deleteDepartment,
  getAllDepartments,
  getDepartmentById,
};
