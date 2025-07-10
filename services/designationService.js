const Designation = require("../models/designation");
const { successResponse } = require("../utils/responseHandler.js");
const CustomError = require("../utils/customError.js");
const User = require("../models/user");

const upsertDesignation = async (req, res, next) => {
  try {
    const { id, name, userId, status } = req.body;

    if (!name) {
      throw new CustomError("Name is required", 400);
    }

    let designation;

    if (id) {
      if (status === "Inactive") {
        const usersInDesignation = await User.findOne({ designation: id });
        if (usersInDesignation) {
          throw new CustomError(
            "Cannot update status: Users exist in this Designation",
            400
          );
        }
      }
      designation = await Designation.findByIdAndUpdate(
        id,
        { name, modifiedBy: userId, modifiedTime: new Date(), status },
        { new: true, runValidators: true }
      );

      if (!designation) {
        throw new CustomError("Designation not found", 404);
      }
    } else {
      designation = new Designation({ name, addedBy: userId });
      await designation.save();
    }

    return successResponse(
      res,
      `Designation ${id ? "updated" : "created"} successfully`,
      designation
    );
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: "Designation name already exists" });
    }
    next(err);
  }
};

const deleteDesignation = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if any user exists with this designation
    const userExists = await User.exists({ designation: id, isDeleted: false });
    if (userExists) {
      throw new CustomError(
        "Cannot delete: Users exist with this designation",
        400
      );
    }

    const designation = await Designation.findById(id);
    if (!designation) {
      throw new CustomError("Designation not found", 404);
    }

    await Designation.findByIdAndDelete(id);

    return successResponse(res, "Designation deleted successfully", null);
  } catch (err) {
    next(err);
  }
};

const getAllDesignations = async (req, res, next) => {
  try {
    const { search } = req.query;

    let filter = {};
    if (search) {
      filter.name = { $regex: search, $options: "i" };
    }

    const designations = await Designation.find(filter)
      .sort({ name: 1 })
      .populate({ path: "addedBy", select: "firstName lastName" })
      .populate({ path: "modifiedBy", select: "firstName lastName" });

    return successResponse(
      res,
      "Designations fetched successfully",
      designations
    );
  } catch (err) {
    next(err);
  }
};

const getDesignationById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const designation = await Designation.findById(id)
      .populate({ path: "addedBy", select: "firstName lastName" })
      .populate({ path: "modifiedBy", select: "firstName lastName" });

    if (!designation) {
      throw new CustomError("Designation not found", 404);
    }

    return successResponse(
      res,
      "Designation fetched successfully",
      designation
    );
  } catch (err) {
    next(err);
  }
};

module.exports = {
  upsertDesignation,
  deleteDesignation,
  getAllDesignations,
  getDesignationById,
};
