const Role = require("../models/role");
const CustomError = require("../utils/customError");
const { successResponse } = require("../utils/responseHandler");

// Add Role
const addRole = async (req, res, next) => {
  try {
    const { name, permissions, description } = req.body;
    const role = await Role.create({ name, permissions, description });
    return successResponse(res, "Role created successfully", role);
  } catch (err) {
    next(err);
  }
};

// Edit Role
const editRole = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, permissions, description } = req.body;
    const role = await Role.findByIdAndUpdate(
      id,
      { name, permissions, description },
      { new: true }
    );
    if (!role) throw new CustomError("Role not found", 404);
    return successResponse(res, "Role updated successfully", role);
  } catch (err) {
    next(err);
  }
};

// Delete Role
const deleteRole = async (req, res, next) => {
  try {
    const { id } = req.params;
    const role = await Role.findByIdAndDelete(id);
    if (!role) throw new CustomError("Role not found", 404);
    return successResponse(res, "Role deleted successfully");
  } catch (err) {
    next(err);
  }
};

const getAllRoles = async (req, res, next) => {
  try {
    const roles = await Role.find({});
    return successResponse(res, "Roles fetched successfully", roles);
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
  addRole,
  editRole,
  deleteRole,
  getAllRoles,
  getFilteredRoles,
};
