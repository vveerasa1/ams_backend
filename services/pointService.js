const Point = require("../models/point.js");
const { successResponse } = require("../utils/responseHandler");
const CustomError = require("../utils/customError.js");
const User = require("../models/user.js");

const createOrUpdatePoint = async (req, res, next) => {
  try {
    const { id } = req.params; // Optional: present only during update
    const { employeeId, pointsChange } = req.body;

    const transactionType = pointsChange > 0 ? "bonuses" : "deduction";

    if (!employeeId || typeof pointsChange !== "number") {
      throw new CustomError("Invalid employeeId or pointsChange", 400);
    }

    let transaction;

    if (id) {
      // 🛠 Update flow
      const existingTransaction = await Point.findById(id);
      if (!existingTransaction) {
        throw new CustomError("Transaction not found", 404);
      }

      const oldPointsChange = existingTransaction.pointsChange;
      const delta = pointsChange - oldPointsChange;

      // Update transaction
      transaction = await Point.findByIdAndUpdate(
        id,
        {
          ...req.body,
          transactionType,
        },
        { new: true }
      );

      // Update totalPoints for user with delta
      await User.findByIdAndUpdate(employeeId, {
        $inc: { totalPoints: delta },
      });
    } else {
      // ➕ Create flow
      transaction = await Point.create({
        ...req.body,
        transactionType,
      });

      // Increment totalPoints
      await User.findByIdAndUpdate(employeeId, {
        $inc: { totalPoints: pointsChange },
      });
    }

    return successResponse(
      res,
      `Transaction ${id ? "updated" : "created"} successfully`,
      transaction,
      id ? 200 : 201
    );
  } catch (err) {
    next(err);
  }
};

const getAllPoints = async (req, res, next) => {
  try {
    const transactions = await Point.find()
      .populate("employeeId", "firstName lastName")
      .populate("createdBy", "firstName lastName");

    return successResponse(
      res,
      "Transactions fetched successfully",
      transactions
    );
  } catch (err) {
    next(err);
  }
};

const getAllPointsByEmployeeId = async (req, res, next) => {
  try {
    const transactions = await Point.find({
      employeeId: req.params.id,
    }).populate("createdBy", "firstName lastName");

    const user = await User.findById(req.params.id).select("totalPoints");

    return successResponse(res, "Transactions fetched successfully", {
      user,
      transactions,
    });
  } catch (err) {
    next(err);
  }
};

const getAllPointsByCreator = async (req, res, next) => {
  try {
    const { id } = req.params; // creatorId
    const {
      search = "",
      pointsRange, // e.g. "10-50"
      dateRange, // e.g. "2024-01-01_to_2024-06-01"
      page = 1,
      limit = 10,
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    let filter = { createdBy: id };

    // Points range filter
    if (pointsRange) {
      const [min, max] = pointsRange.split("-").map(Number);
      if (!isNaN(min) && !isNaN(max)) {
        filter.pointsChange = { $gte: min, $lte: max };
      }
    }

    // Date range filter
    if (dateRange) {
      const [start, end] = dateRange.split("_to_");
      const startDate = new Date(start);
      const endDate = new Date(end);

      if (!isNaN(startDate) && !isNaN(endDate)) {
        filter.createdAt = {
          $gte: new Date(startDate.setHours(0, 0, 0, 0)),
          $lte: new Date(endDate.setHours(23, 59, 59, 999)),
        };
      }
    }

    // Search by employee name/email
    if (search) {
      const searchRegex = new RegExp(search, "i");

      const matchedUsers = await User.find({
        $or: [
          { firstName: searchRegex },
          { lastName: searchRegex },
          { email: searchRegex },
        ],
      }).select("_id");

      const matchedIds = matchedUsers.map((user) => user._id);
      filter.employeeId = { $in: matchedIds };
    }

    const [points, total] = await Promise.all([
      Point.find(filter)
        .populate("employeeId", "firstName lastName")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Point.countDocuments(filter),
    ]);

    return successResponse(res, "Points fetched successfully", {
      points,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
};

const getPointById = async (req, res, next) => {
  try {
    const transaction = await Point.findById(req.params.id)
      .populate("employeeId", "firstName lastName")
      .populate("createdBy", "firstName lastName");
    if (!transaction) throw new CustomError("Transaction not found", 404);

    return successResponse(
      res,
      "Transaction fetched successfully",
      transaction
    );
  } catch (err) {
    next(err);
  }
};

const deletePoint = async (req, res, next) => {
  try {
    const transaction = await Point.findById(req.params.id);

    if (!transaction) {
      throw new CustomError("Transaction not found", 404);
    }

    const { employeeId, pointsChange } = transaction;

    // Reverse the pointsChange in User model
    if (employeeId && typeof pointsChange === "number") {
      const reverseChange = -pointsChange; // if -2 => +2, if +2 => -2
      await User.findByIdAndUpdate(
        employeeId,
        { $inc: { totalPoints: reverseChange } },
        { new: true }
      );
    }

    // Finally, delete the transaction
    await Point.findByIdAndDelete(req.params.id);

    return successResponse(res, "Transaction deleted successfully");
  } catch (err) {
    next(err);
  }
};

const sortPoints = async (req, res, next) => {
  try {
    const {
      sortBy,
      order,
      transactionType,
      employeeId,
      page = 1,
      limit = 10,
    } = req.query;
    let sort = {};

    // Sorting logic
    if (sortBy && order) {
      const allowedSortFields = ["createdAt", "pointsChange", "balanceAfter"];
      const allowedOrder = ["asc", "desc", "ascending", "descending", 1, -1];

      if (allowedSortFields.includes(sortBy) && allowedOrder.includes(order)) {
        sort[sortBy] =
          order === "asc" || order === "ascending" || order === 1 ? 1 : -1;
      }
    }

    // Filtering logic
    let filter = {};

    // If transactionType is "Bonuses", show Bonuses first, then Deductions; if "Deductions", show Deductions first, then Bonuses
    if (
      transactionType &&
      ["Bonuses", "Deductions"].includes(transactionType)
    ) {
      // No filter here, we want both types but sort accordingly
      // Custom sort: transactionType matches first, then the other
      sort.transactionType = transactionType === "Bonuses" ? 1 : -1;
      // To sort both Bonuses and Deductions in descending order within their groups
      sort.createdAt = -1;
    }

    if (employeeId) {
      filter.employeeId = employeeId;
    }

    // Pagination logic
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [points, total] = await Promise.all([
      Point.find(filter).sort(sort).skip(skip).limit(parseInt(limit)),
      Point.countDocuments(filter),
    ]);

    return successResponse(res, "Points filtered and sorted successfully", {
      data: points,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
};

const filterPoints = async (req, res, next) => {
  try {
    const {
      transactionType,
      pointRange,
      dateRange,
      reason,
      page = 1,
      limit = 10,
      employeeId,
    } = req.query;
    let filter = {};

    // Filter by employeeId if provided
    if (employeeId) {
      filter.employeeId = employeeId;
    }

    // Transaction type filter (Bonuses or Deductions)
    if (
      transactionType &&
      ["Bonuses", "Deductions"].includes(transactionType)
    ) {
      filter.transactionType = transactionType;
    }

    // Point range filter (e.g., 1-50)
    if (pointRange) {
      const [min, max] = pointRange.split("-").map(Number);
      if (!isNaN(min) && !isNaN(max)) {
        filter.pointsChange = { $gte: min, $lte: max };
      }
    }
    // Date range filter (e.g., 2024-01-01_2024-01-31)
    if (dateRange) {
      const [start, end] = req.query.dateRange.split("_");
      filter.createdAt = { $gte: new Date(start), $lte: new Date(end) };
    }
    // Reason filter (case-insensitive partial match)
    if (reason) {
      filter.reason = { $regex: reason, $options: "i" };
    }

    // Pagination logic
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [points, total] = await Promise.all([
      Point.find(filter)
        .populate("employeeId", "firstName lastName")
        .populate("createdBy", "firstName lastName")
        .skip(skip)
        .limit(parseInt(limit)),
      Point.countDocuments(filter),
    ]);

    return successResponse(res, "Points filtered successfully", {
      data: points,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createOrUpdatePoint,
  getAllPoints,
  getAllPointsByEmployeeId,
  getPointById,
  deletePoint,
  sortPoints,
  filterPoints,
  getAllPointsByCreator,
};
