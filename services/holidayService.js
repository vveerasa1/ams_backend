const Holiday = require("../models/holiday");
const CustomError = require("../utils/customError");
const { successResponse } = require("../utils/responseHandler");

const upsertHoliday = async (req, res, next) => {
  try {
    const { id, userId, name, date, description } = req.body;
    let holiday;

    if (id) {
      // Update
      holiday = await Holiday.findByIdAndUpdate(
        id,
        { name, date, description, modifiedBy: userId },
        { new: true }
      );
      if (!holiday) throw new CustomError("Holiday not found", 404);
      return successResponse(res, "Holiday updated successfully", holiday);
    } else {
      // Create
      holiday = await Holiday.create({
        name,
        date,
        description,
        addedBy: userId,
      });
      return successResponse(res, "Holiday created successfully", holiday);
    }
  } catch (err) {
    next(err);
  }
};

const deleteHoliday = async (req, res, next) => {
  try {
    const { id } = req.params;

    const holiday = await Holiday.findByIdAndDelete(id);
    if (!holiday) throw new CustomError("Holiday not found", 404);

    return successResponse(res, "Holiday deleted successfully");
  } catch (err) {
    next(err);
  }
};

const getAllHolidays = async (req, res, next) => {
  try {
    const { search } = req.query;

    const filter = {};
    if (search) {
      filter.name = { $regex: search, $options: "i" };
    }

    const holidays = await Holiday.find(filter).sort({ date: 1 });
    return successResponse(res, "Holidays fetched successfully", holidays);
  } catch (err) {
    next(err);
  }
};

const getHolidayById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const holiday = await Holiday.findById(id)
      .populate("addedBy", "firstName lastName")
      .populate("modifiedBy", "firstName lastName");

    if (!holiday) throw new CustomError("Holiday not found", 404);

    return successResponse(res, "Holiday fetched successfully", holiday);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  upsertHoliday,
  deleteHoliday,
  getAllHolidays,
  getHolidayById,
};
