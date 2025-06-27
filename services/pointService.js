const Point = require("../models/point.js");
const { successResponse } = require("../utils/responseHandler");
const CustomError = require("../utils/customError.js");
const User = require("../models/user.js");
const { ObjectId } = require("mongodb");

const createOrUpdatePoint = async (req, res, next) => {
  try {
    const { id } = req.params; // Optional: present only during update
    const { employeeId, pointsChange, balanceAfter } = req.body;

    const transactionType = pointsChange > 0 ? "bonuses" : "deductions";

    if (!employeeId || typeof pointsChange !== "number") {
      throw new CustomError("Invalid employeeId or pointsChange", 400);
    }

    let transaction;
    let newBalanceAfter;

    if (id) {
      // 🛠 Update flow
      const existingTransaction = await Point.findById(id);
      if (!existingTransaction) {
        throw new CustomError("Transaction not found", 404);
      }

      const now = new Date();
      const createdAt = existingTransaction.createdAt;
      const hoursDiff = (now - createdAt) / (1000 * 60 * 60);
      if (hoursDiff > 24) {
        throw new CustomError(
          "You can only update transactions within 24 hours of creation",
          403
        );
      }

      // Calculate point difference
      const oldPointsChange = existingTransaction.pointsChange;
      const newPointsChange = pointsChange;
      const delta = newPointsChange - oldPointsChange;

      newBalanceAfter =
        existingTransaction.balanceAfter - oldPointsChange + newPointsChange;

      // Update transaction
      transaction = await Point.findByIdAndUpdate(
        id,
        {
          ...req.body,
          transactionType,
          balanceAfter: newBalanceAfter,
        },
        { new: true }
      );

      // Update all subsequent records' balanceAfter for this employee
      await Point.updateMany(
        {
          employeeId,
          createdAt: { $gt: createdAt },
        },
        { $inc: { balanceAfter: delta } }
      );

      // Update totalPoints for user with delta
      await User.findByIdAndUpdate(employeeId, {
        $inc: { totalPoints: delta },
      });
    } else {
      // ➕ Create flow
      newBalanceAfter = balanceAfter + pointsChange;
      console.log(newBalanceAfter);
      transaction = await Point.create({
        ...req.body,
        transactionType,
        balanceAfter: newBalanceAfter,
      });

      // Increment totalPoints
      await User.findByIdAndUpdate(employeeId, {
        totalPoints: newBalanceAfter,
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
    const {
      search = "",
      pointsRange,
      dateRange,
      page,
      limit,
      sortBy,
      createdBy,
    } = req.query;

    // Build employee filter (for User collection)
    let employeeFilter = {};
    if (createdBy) {
      employeeFilter = { createdBy: createdBy };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    if (search) {
      const searchRegex = new RegExp(search, "i");

      const matchedUsers = await User.find({
        $or: [
          { firstName: searchRegex },
          { lastName: searchRegex },
          { email: searchRegex },
          { employeeId: searchRegex },
        ],
      }).select("_id");

      const matchedIds = matchedUsers.map((user) => user._id);
      employeeFilter.employeeId = { $in: matchedIds };
    }

    if (pointsRange) {
      // This regex will match two numbers, including negative ones
      const match = pointsRange.match(/(-?\d+)\s*-\s*(-?\d+)/);
      if (match) {
        const min = Number(match[1]);
        const max = Number(match[2]);
        if (!isNaN(min) && !isNaN(max)) {
          employeeFilter.pointsChange = { $gte: min, $lte: max };
        }
      }
    }
    if (dateRange) {
      const [start, end] = dateRange.split(" - ");
      const startDate = new Date(start);
      const endDate = new Date(end);

      if (!isNaN(startDate) && !isNaN(endDate)) {
        employeeFilter.createdAt = {
          $gte: new Date(startDate.setHours(0, 0, 0, 0)),
          $lte: new Date(endDate.setHours(23, 59, 59, 999)),
        };
      }
    }
    let sortOptions = { updatedAt: -1 }; // Default: descending by date
    if (sortBy === "date") {
      sortOptions = { updatedAt: 1 }; // Ascending by date
    } else if (sortBy === "points") {
      sortOptions = { pointsChange: -1 }; // Descending by points
    }

    let points, total;

    if (sortBy === "transaction") {
      // Fetch and sort manually: Bonuses first, then others
      [points, total] = await Promise.all([
        Point.find(employeeFilter)
          .populate("employeeId", "firstName lastName employeeId totalPoints")
          .populate("createdBy", "firstName lastName")
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        Point.countDocuments(employeeFilter),
      ]);
      points.sort((a, b) => {
        if (a.transactionType === b.transactionType) return 0;
        return a.transactionType === "bonuses" ? -1 : 1;
      });
    } else {
      [points, total] = await Promise.all([
        Point.find(employeeFilter)
          .populate("employeeId", "firstName lastName employeeId totalPoints")
          .populate("createdBy", "firstName lastName")
          .sort(sortOptions)
          .skip(skip)
          .limit(parseInt(limit)),
        Point.countDocuments(employeeFilter),
      ]);
    }

    return successResponse(res, "Transactions fetched successfully", points);
  } catch (err) {
    next(err);
  }
};

const getAllPointsByEmployeeId = async (req, res, next) => {
  try {
    const {
      sortBy,
      transactionType,
      pointRange,
      dateRange,
      reason,
      page = 1,
      limit = 10,
    } = req.query;

    const employeeId = req.params.id;
    let filter = { employeeId };

    // Transaction type filter
    if (
      transactionType &&
      ["Bonuses", "Deductions"].includes(transactionType)
    ) {
      filter.transactionType = transactionType;
    }

    // Point range filter
    if (pointRange) {
      const [min, max] = pointRange.split("-").map(Number);
      if (!isNaN(min) && !isNaN(max)) {
        filter.pointsChange = { $gte: min, $lte: max };
      }
    }

    // Date range filter
    if (dateRange) {
      const [start, end] = dateRange.split("_");
      filter.createdAt = { $gte: new Date(start), $lte: new Date(end) };
    }

    // Reason filter
    if (reason) {
      filter.reason = { $regex: reason, $options: "i" };
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Sorting logic
    let sortOptions = { updatedAt: -1 }; // Default: descending by date
    if (sortBy === "date") {
      sortOptions = { updatedAt: 1 };
    } else if (sortBy === "points") {
      sortOptions = { pointsChange: -1 };
    }

    let transactions;

    if (sortBy === "transactions") {
      // Manual sort for Bonuses first
      transactions = await Point.find(filter)
        .populate("createdBy", "firstName lastName")
        .skip(skip)
        .limit(parseInt(limit))
        .lean();

      transactions.sort((a, b) => {
        if (a.transactionType === b.transactionType) return 0;
        return a.transactionType === "bonuses" ? -1 : 1;
      });
    } else {
      transactions = await Point.find(filter)
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit))
        .populate("createdBy", "firstName lastName");
    }

    // Count for pagination
    const total = await Point.countDocuments(filter);

    const user = await User.findById(employeeId).select("totalPoints");

    return successResponse(res, "Transactions fetched successfully", {
      user,
      transactions,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
};

const getPointById = async (req, res, next) => {
  try {
    const transaction = await Point.findById(req.params.id)
      .populate("employeeId", "firstName lastName employeeId")
      .populate("createdBy", "firstName lastName employeeId");
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

    const { employeeId, pointsChange, createdAt } = transaction;

    // Reverse the pointsChange in User model
    if (employeeId && typeof pointsChange === "number") {
      const reverseChange = -pointsChange; // if -2 => +2, if +2 => -2

      // Update user's totalPoints
      await User.findByIdAndUpdate(
        employeeId,
        { $inc: { totalPoints: reverseChange } },
        { new: true }
      );

      // Update all subsequent Point records' balanceAfter for this employee
      await Point.updateMany(
        {
          employeeId,
          createdAt: { $gt: createdAt },
        },
        { $inc: { balanceAfter: reverseChange } }
      );
    }

    // Finally, delete the transaction
    await Point.findByIdAndDelete(req.params.id);

    return successResponse(res, "Transaction deleted successfully");
  } catch (err) {
    next(err);
  }
};

const getEmployeeLatestPoints = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Get date 7 days ago
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

    // Assuming you have a Points model with fields: employee, points, date
    const points = await Point.find({
      employeeId: id,
      createdAt: { $gte: sevenDaysAgo },
    }).sort({ createdAt: -1 });

    const user = await User.findById(id).select("totalPoints");

    return successResponse(res, "Last 7 days points fetched successfully", {
      points,
      totalPoints: user.totalPoints,
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
  getEmployeeLatestPoints,
};
