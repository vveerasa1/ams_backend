const User = require("../models/user.js");
const Appraisal = require("../models/appraisal");
const Point = require("../models/point.js");
const Role = require("../models/role.js");
const { successResponse } = require("../utils/responseHandler.js");
const CustomError = require("../utils/customError.js");
const bcrypt = require("bcrypt");
const { s3Uploads, deleteFromS3 } = require("../utils/s3Uploads.js");
const nodemailer = require("nodemailer");
const AppraisalTemplate = require("../models/appraisalTemplate");

require("dotenv").config();

const createOrUpdateUser = async (req, res, next) => {
  try {
    const details = req.body.user;
    const data = JSON.parse(details);
    const userId = req.params.id;
    const isUpdate = !!userId;

    let existingUser = null;
    let oldReportingId = null;

    if (isUpdate) {
      existingUser = await User.findById(userId);
      if (!existingUser) throw new CustomError("User not found", 404);
      oldReportingId = existingUser.reportingTo?.toString();
    }

    if (req.file) {
      if (isUpdate && existingUser.profilePhotoUrl) {
        const oldKey = existingUser.profilePhotoUrl.split(".com/")[1];
        await deleteFromS3(oldKey);
      }
      const location = await s3Uploads(req.file, "profile-photo");
      data.profilePhotoUrl = location;
    }

    let user;
    if (isUpdate) {
      user = await User.findByIdAndUpdate(userId, data, { new: true });
    } else {
      const alreadyExists = await User.findOne({ email: data.email });
      if (alreadyExists) {
        throw new CustomError("Email already exists", 409);
      }

      const plainPassword = Math.random().toString(36).slice(-8);
      data.password = await bcrypt.hash(plainPassword, 10);

      user = await User.create(data);

      // Send credentials via email
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.EMAIL,
          pass: process.env.PASSWORD,
        },
      });

      await transporter.sendMail({
        from: process.env.EMAIL,
        to: data.email,
        subject: "Employee Account Created",
        html: `<p>Dear ${data.firstName},<br/>
               Your account has been created.<br/>
               <b>Email:</b> ${data.email}<br/>
               <b>Password:</b> ${plainPassword}<br/>
               Please log in and change your password.</p>`,
      });
    }

    // 🔁 Handle teamMembers logic for both create and update
    const newReportingId = data.reportingTo?.toString();
    const userObjectId = user._id;

    if (isUpdate && oldReportingId && oldReportingId !== newReportingId) {
      // Remove from old reporting manager
      await User.findByIdAndUpdate(oldReportingId, {
        $pull: { teamMembers: userObjectId },
      });
    }

    if (newReportingId) {
      await User.findByIdAndUpdate(newReportingId, {
        $addToSet: { teamMembers: userObjectId },
      });
    }

    return successResponse(
      res,
      `User ${isUpdate ? "updated" : "created"} successfully`,
      user
    );
  } catch (err) {
    next(err);
  }
};

const getAllUsers = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const { search = "", designation, department, totalPointsRange, role } = req.query;

    // Find the Super Admin role id
    const superAdminRole = await Role.findOne({ name: "Super Admin" });
    let filter = {
      status: "Active", // ✅ Only fetch users with active status
    };
    if (superAdminRole) {
      filter.role = { $ne: superAdminRole._id };
    }
    if (totalPointsRange) {
      const [min, max] = totalPointsRange.split("-").map(Number);
      if (!isNaN(min) && !isNaN(max)) {
        filter.totalPoints = { $gte: min, $lte: max };
      }
    }

    // Search filter
    if (search) {
      const searchRegex = new RegExp(search, "i");
      filter.$or = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex },
      ];
    }

    // Role filter
    if (designation) {
      filter.designation = designation;
    }

    if (role) {
      filter.role = role;
    }

    // Department filter
    if (department) {
      filter.department = department;
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .skip(skip)
        .limit(limit)
        .populate({ path: "role", select: "name" }),
      User.countDocuments(filter),
    ]);

    return successResponse(res, "Users fetched successfully", {
      users,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
};

const getAllManagers = async (req, res, next) => {
  try {
    const { search = "" } = req.query;

    // Find roles for Manager and Super Admin
    const roles = await Role.find(
      { name: { $in: ["Manager", "Super Admin"] } },
      "_id"
    );
    const roleIds = roles.map((r) => r._id);

    // Base filter for roles
    let filter = { role: { $in: roleIds }, status: "Active" };

    // If search string provided, add search conditions
    if (search) {
      const searchRegex = new RegExp(search, "i");
      filter.$or = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex },
      ];
    }

    const managers = await User.find(
      filter,
      "firstName lastName _id role"
    ).populate({ path: "role", select: "name" });

    return successResponse(res, "Managers fetched successfully", managers);
  } catch (err) {
    next(err);
  }
};

const getAllEmployeesForReporting = async (req, res, next) => {
  try {
    const { search = "", email } = req.query;
    const searchRegex = new RegExp(search, "i");

    // Find excluded role IDs (Super Admin and HR)
    const excludedRoles = await Role.find({
      name: { $in: ["HR"] },
    });

    const excludedRoleIds = excludedRoles.map((r) => r._id);

    // Base filter
    let filter = {
      role: { $nin: excludedRoleIds },
      status: "Active",
    };

    // Exclude a specific email if provided
    if (email) {
      filter.email = { $ne: email };
    }

    // Add search filter if search string is provided
    if (search) {
      filter.$or = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex },
      ];
    }

    // Fetch employees
    const employees = await User.find(
      filter,
      "_id firstName lastName designation"
    );

    return successResponse(res, "Employees fetched successfully", employees);
  } catch (err) {
    console.log(err);
    next(err);
  }
};

const getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id)
      .populate("role", "name")
      .populate({
        path: "reportingTo",
        select: "firstName lastName role",
        populate: {
          path: "role",
          select: "name",
        },
      });
    if (!user) throw new CustomError("User not found", 404);

    return successResponse(res, "User fetched successfully", user);
  } catch (err) {
    next(err);
  }
};

const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { status: "Inactive" },
      { new: true }
    );

    if (!user) throw new CustomError("User not found", 404);

    return successResponse(res, "User marked as inactive successfully", user);
  } catch (err) {
    next(err);
  }
};

const updateUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.query;

    if (!["Active", "Inactive", "Suspended"].includes(status)) {
      throw new CustomError("Invalid status value", 400);
    }

    const user = await User.findByIdAndUpdate(id, { status }, { new: true });

    if (!user) throw new CustomError("User not found", 404);

    return successResponse(res, "Status updated successfully", user);
  } catch (err) {
    next(err);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const { email, otp, newPassword, confirmPassword } = req.body;
    const user = await User.findOne({ email });
    if (!user) throw new CustomError("User not found", 404);

    if (
      !user.otp ||
      user.otp !== otp ||
      !user.otpExpires ||
      user.otpExpires < Date.now()
    ) {
      throw new CustomError("Invalid or expired OTP", 400);
    }

    if (newPassword !== confirmPassword) {
      throw new CustomError("Passwords do not match", 400);
    }

    const isSame = await bcrypt.compare(newPassword, user.password);
    if (isSame) {
      throw new CustomError("New password must not be the old password", 400);
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();
    return successResponse(res, "Password reset successfully");
  } catch (err) {
    next(err);
  }
};

const updatePassword = async (req, res, next) => {
  try {
    const { oldPassword, newPassword, confirmPassword } = req.body;
    const { id } = req.params; // Assumes user is authenticated and req.user is set

    const user = await User.findById(id);
    if (!user) throw new CustomError("User not found", 404);

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      throw new CustomError("Old password is incorrect", 400);
    }

    if (newPassword !== confirmPassword) {
      throw new CustomError(
        "New password and confirm password do not match",
        400
      );
    }

    const isSame = await bcrypt.compare(newPassword, user.password);
    if (isSame) {
      throw new CustomError("New password must not be the old password", 400);
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    return successResponse(res, "Password updated successfully");
  } catch (err) {
    next(err);
  }
};

const getAllEmployeesByReporterId = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      search = "",
      role,
      totalPointsRange,
      page = 1,
      limit = 10,
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // 1. Get reporter with teamMembers
    const reporter = await User.findById(id).select("teamMembers");

    if (
      !reporter ||
      !reporter.teamMembers ||
      reporter.teamMembers.length === 0
    ) {
      throw new CustomError("No employees found under this reporter", 404);
    }

    // 2. Build filter with teamMembers list
    let filter = {
      _id: { $in: reporter.teamMembers },
      status: "Active",
    };

    // 3. Add search filter
    if (search) {
      const searchRegex = new RegExp(search, "i");
      filter.$or = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex },
      ];
    }

    // 4. Add role filter
    if (role) {
      filter.role = role;
    }

    // 5. Add totalPoints range filter
    if (totalPointsRange) {
      const [min, max] = totalPointsRange.split("-").map(Number);
      if (!isNaN(min) && !isNaN(max)) {
        filter.totalPoints = { $gte: min, $lte: max };
      }
    }

    // 6. Query users and count
    const [users, total] = await Promise.all([
      User.find(filter)
        .skip(skip)
        .limit(parseInt(limit))
        .populate("role", "name"),
      User.countDocuments(filter),
    ]);

    return successResponse(res, "Employees fetched successfully", {
      users,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
};

const getAllEmployeesByCreatorId = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      search = "",
      role,
      totalPointsRange,
      page = 1,
      limit = 10,
    } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let filter = {
      createdBy: id,
      status: "Active",
    };
    // Search filter
    if (search) {
      const searchRegex = new RegExp(search, "i");
      filter.$or = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex },
      ];
    }

    // Role filter
    if (role) {
      filter.role = role;
    }

    // totalPoints range filter (e.g., "10-100")
    if (totalPointsRange) {
      const [min, max] = totalPointsRange.split("-").map(Number);
      if (!isNaN(min) && !isNaN(max)) {
        filter.totalPoints = { $gte: min, $lte: max };
      }
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .skip(skip)
        .limit(parseInt(limit))
        .populate("role", "name")
        .lean(), // <-- this is key!
      User.countDocuments(filter),
    ]);

    if (!users || users.length === 0) {
      throw new CustomError("No employees found for this creator", 404);
    }
    const enrichedUsers = await Promise.all(
      users.map(async (user) => {
        const hasTemplate = await AppraisalTemplate.exists({
          role: user.role._id,
          department: user.department,
          points: { $lte: user.totalPoints || 0 }, // fallback in case totalPoints is undefined
        });

        return {
          ...user,
          assignAppraisal: !!hasTemplate,
        };
      })
    );

    return successResponse(res, "Employees fetched successfully", {
      users: enrichedUsers,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
};

const getDashboardStats = async (req, res, next) => {
  try {
    const role = req.query.role;
    const { id } = req.params;

    if (!role || !["admin", "hr", "manager"].includes(role)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid or missing role parameter" });
    }
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // ----- Admin Dashboard -----
    if (role === "admin") {
      const superAdminRole = await Role.findOne({ name: "Super Admin" });
      const managerRole = await Role.findOne({ name: "Manager" });

      // Total Users excluding Super Admin
      const totalUsers = await User.countDocuments({
        role: { $ne: superAdminRole?._id },
      });

      // Managers
      const totalManagers = await User.countDocuments({
        role: managerRole?._id,
      });

      // Users added in current month
      const usersThisMonth = await User.countDocuments({
        role: { $ne: superAdminRole?._id },
        createdAt: { $gte: startOfMonth, $lte: endOfMonth },
      });

      // Managers added in current month
      const managersThisMonth = await User.countDocuments({
        role: managerRole?._id,
        createdAt: { $gte: startOfMonth, $lte: endOfMonth },
      });

      // Points aggregation
      const pointAgg = await Point.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: "$pointChange" },
          },
        },
      ]);
      const totalPoints = pointAgg[0]?.total || 0;

      // Bonuses this month (pointChange > 0)
      const bonusesThisMonth = await Point.countDocuments({
        transactionType: "bonuses",
        createdAt: { $gte: startOfMonth, $lte: endOfMonth },
      });

      // Deductions this month
      const deductionsThisMonth = await Point.countDocuments({
        transactionType: "deductions",
        createdAt: { $gte: startOfMonth, $lte: endOfMonth },
      });

      // Total points transactions (to calculate bonus/deduction %)
      const totalPointTransactionsThisMonth =
        bonusesThisMonth + deductionsThisMonth;

      // Pending appraisals total and this month
      const pendingAppraisals = await Appraisal.countDocuments({
        adminApprovalStatus: "pending",
        hrApprovalStatus: "approved",
      });

      const pendingAppraisalsThisMonth = await Appraisal.countDocuments({
        adminApprovalStatus: "pending",
        hrApprovalStatus: "approved",
        createdAt: { $gte: startOfMonth, $lte: endOfMonth },
      });

      // Percentages
      const percentUsersThisMonth =
        totalUsers > 0 ? Math.round((usersThisMonth / totalUsers) * 100) : 0;

      const percentManagersThisMonth =
        totalManagers > 0
          ? Math.round((managersThisMonth / totalManagers) * 100)
          : 0;

      const percentBonuses =
        totalPointTransactionsThisMonth > 0
          ? Math.round(
              (bonusesThisMonth / totalPointTransactionsThisMonth) * 100
            )
          : 0;

      const percentDeductions =
        totalPointTransactionsThisMonth > 0
          ? Math.round(
              (deductionsThisMonth / totalPointTransactionsThisMonth) * 100
            )
          : 0;

      const percentPendingAppraisalsThisMonth =
        pendingAppraisals > 0
          ? Math.round((pendingAppraisalsThisMonth / pendingAppraisals) * 100)
          : 0;

      return successResponse(res, "Admin dashboard data", {
        totalUsers,
        totalManagers,
        totalPoints,
        pendingAppraisals,
        percentUsersThisMonth: `${percentUsersThisMonth}%`,
        percentManagersThisMonth: `${percentManagersThisMonth}%`,
        percentBonusesThisMonth: `${percentBonuses}%`,
        percentDeductionsThisMonth: `${percentDeductions}%`,
        percentPendingAppraisalsThisMonth: `${percentPendingAppraisalsThisMonth}%`,
      });
    }

    // ----- HR Dashboard -----
    if (role === "hr") {
      const superAdminRole = await Role.findOne({ name: "Super Admin" });

      const hrUserCount = await User.countDocuments({
        role: { $ne: superAdminRole._id },
        status: "Active",
      });

      const hrUsersThisMonth = await User.countDocuments({
        role: { $ne: superAdminRole._id },
        status: "Active",
        createdAt: { $gte: startOfMonth, $lte: endOfMonth },
      });

      const percentHrUsersThisMonth =
        hrUserCount > 0
          ? Math.round((hrUsersThisMonth / hrUserCount) * 100)
          : 0;
      const hr = await User.findById(id);

      // const hrEmployees = await User.find(
      //   { status: "Active" },
      //   { $ne: superAdminRole._id },
      //   { _id: 1 }
      // );
      // const employeeIds = hrEmployees.map((emp) => emp._id);

      // const hrPointsAgg = await Point.aggregate([
      //   { $match: { employeeId: { $in: employeeIds } } },
      //   { $group: { _id: null, total: { $sum: "$pointChange" } } },
      // ]);
      // const hrTotalPoints = hrPointsAgg[0]?.total || 0;

      return successResponse(res, "HR dashboard data", {
        totalUsers: hrUserCount,
        usersThisMonthPercentage: percentHrUsersThisMonth,
        totalPoints: hr.totalPoints,
      });
    }

    // ----- Manager Dashboard -----
    if (role === "manager") {
      // Total users managed by this manager
      const managerUserCount = await User.countDocuments({ managedBy: id });

      const managerUsersThisMonth = await User.countDocuments({
        managedBy: id,
        createdAt: { $gte: startOfMonth, $lte: endOfMonth },
      });

      const percentManagerUsersThisMonth =
        managerUserCount > 0
          ? Math.round((managerUsersThisMonth / managerUserCount) * 100)
          : 0;

      const managedEmployees = await User.find({ managedBy: id }, { _id: 1 });
      const managedEmployeeIds = managedEmployees.map((user) => user._id);
      // Pending appraisals
      const pendingAppraisals = await Appraisal.countDocuments({
        employeeId: { $in: managedEmployeeIds },
        managerApprovalStatus: "pending",
        employeeApprovalStatus: "approved",
      });

      const managerPendingAppraisalsThisMonth = await Appraisal.countDocuments({
        createdBy: id,
        adminApprovalStatus: "pending",
        createdAt: { $gte: startOfMonth, $lte: endOfMonth },
      });

      const percentPendingManagerAppraisalsThisMonth =
        pendingAppraisals > 0
          ? Math.round(
              (managerPendingAppraisalsThisMonth / pendingAppraisals) * 100
            )
          : 0;

      // Total points earned by this manager
      const managerPointsAgg = await Point.aggregate([
        { $match: { employeeId: id } },
        { $group: { _id: null, total: { $sum: "$pointChange" } } },
      ]);
      const totalPoints = managerPointsAgg[0]?.total || 0;

      return successResponse(res, "Manager dashboard data", {
        totalUsers: managerUserCount,
        usersThisMonthPercentage: percentManagerUsersThisMonth,
        pendingAppraisals: pendingAppraisals,
        pendingAppraisalsThisMonthPercentage:
          percentPendingManagerAppraisalsThisMonth,
        totalPoints: totalPoints, // as requested, just value — no percentage
      });
    }
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createOrUpdateUser,
  getAllUsers,
  getUserById,
  deleteUser,
  updateUserStatus,
  getAllEmployeesByReporterId,
  getAllEmployeesByCreatorId,
  resetPassword,
  updatePassword,
  getAllManagers,
  getAllEmployeesForReporting,
  getDashboardStats,
};
