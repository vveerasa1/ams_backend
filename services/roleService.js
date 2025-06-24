const Role = require("../models/role");
const User = require("../models/user");

const CustomError = require("../utils/customError");
const { successResponse } = require("../utils/responseHandler");

const upsertRole = async (req, res, next) => {
  try {
    const { id, name, permissions, description } = req.body;
    let role;
    if (id) {
      // Update
      role = await Role.findByIdAndUpdate(
        id,
        { name, permissions, description },
        { new: true }
      );
      if (!role) throw new CustomError("Role not found", 404);
      return successResponse(res, "Role updated successfully", role);
    } else {
      // Create
      role = await Role.create({ name, permissions, description });
      return successResponse(res, "Role created successfully", role);
    }
  } catch (err) {
    next(err);
  }
};

// Delete Role
const deleteRole = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if any user has this role
    const userWithRole = await User.findOne({ role: id });
    if (userWithRole) {
      throw new CustomError(
        "Role cannot be deleted because users are assigned to it.",
        400
      );
    }

    const role = await Role.findByIdAndDelete(id);
    if (!role) throw new CustomError("Role not found", 404);

    return successResponse(res, "Role deleted successfully");
  } catch (err) {
    next(err);
  }
};

const getAllRoles = async (req, res, next) => {
  try {
    const roles = await Role.find({ name: { $ne: "Super Admin" } });
    return successResponse(res, "Roles fetched successfully", roles);
  } catch (err) {
    next(err);
  }
};

const getRoleById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) throw new CustomError("Role Id is required", 404);

    const role = await Role.findById(id);
    return successResponse(res, "Roles fetched successfully", role);
  } catch (err) {
    next(err);
  }
};

const getFilteredRoles = async (req, res, next) => {
  try {
    const { role } = req.query;
    const excludeRoles = ["Super Admin"];
    if (role) excludeRoles.push(role);

    const roles = await Role.find({ name: { $nin: excludeRoles } });
    return successResponse(res, "Roles fetched successfully", roles);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  upsertRole,
  deleteRole,
  getAllRoles,
  getRoleById,
  getFilteredRoles,
};
