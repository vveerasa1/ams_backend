const Attendance = require("../models/attendence");

const upsertAttendance = async (req, res, next) => {
  try {
    const {
      id, // attendance record id for update
      employeeId,
      date,
      startTime,
      endTime,
      status,
      remarks,
      userId, // who is adding or modifying
    } = req.body;

    let attendance;
    if (id) {
      // Update
      attendance = await Attendance.findByIdAndUpdate(
        id,
        {
          employeeId,
          date,
          startTime,
          endTime,
          status,
          remarks,
          modifiedBy: userId,
        },
        { new: true, runValidators: true }
      );
      if (!attendance) throw new CustomError("Attendance not found", 404);
    } else {
      // Create
      attendance = new Attendance({
        employeeId,
        date,
        startTime,
        endTime,
        status,
        remarks,
        addedBy: userId,
      });
      await attendance.save();
    }

    return successResponse(
      res,
      `Attendance ${id ? "updated" : "created"} successfully`,
      attendance
    );
  } catch (err) {
    next(err);
  }
};

const getAttendanceById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const attendance = await Attendance.findById(id)
      .populate("employeeId", "firstName lastName email")
      .populate("addedBy", "firstName lastName")
      .populate("modifiedBy", "firstName lastName");
    if (!attendance) throw new CustomError("Attendance not found", 404);

    return successResponse(res, "Attendance fetched successfully", attendance);
  } catch (err) {
    next(err);
  }
};

const getMonthlyAttendanceByEmployee = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { month, year } = req.query;

    if (!userId || !month || !year) {
      throw new CustomError("employeeId, month, and year are required", 400);
    }

    // Convert month name to month number (0-based for JS Date)
    const monthIndex = new Date(`${month} 1, ${year}`).getMonth();
    if (isNaN(monthIndex)) {
      throw new CustomError("Invalid month", 400);
    }

    const startDate = new Date(year, monthIndex, 1);
    const endDate = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999); // Last day of month

    const attendances = await Attendance.find({
      employeeId: userId,
      date: { $gte: startDate, $lte: endDate },
    })
      .sort({ date: 1 })
      .populate("addedBy", "firstName lastName")
      .populate("modifiedBy", "firstName lastName");

    return successResponse(
      res,
      "Monthly attendance fetched successfully",
      attendances
    );
  } catch (err) {
    next(err);
  }
};

const deleteAttendanceById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const attendance = await Attendance.findByIdAndDelete(id);
    if (!attendance) throw new CustomError("Attendance not found", 404);

    return successResponse(res, "Attendance deleted successfully", null);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  upsertAttendance,
  getAttendanceById,
  deleteAttendanceById,
  getMonthlyAttendanceByEmployee,
};
