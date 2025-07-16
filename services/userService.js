const User = require("../models/user.js");
const Appraisal = require("../models/appraisal.js");
const Point = require("../models/point.js");
const Role = require("../models/role.js");
const { successResponse } = require("../utils/responseHandler.js");
const CustomError = require("../utils/customError.js");
const bcrypt = require("bcrypt");
const { s3Uploads, deleteFromS3 } = require("../utils/s3Uploads.js");
const nodemailer = require("nodemailer");
const AppraisalTemplate = require("../models/appraisalTemplate.js");
const Department = require("../models/department.js");
const config = require("../config");

const createOrUpdateUser = async (req, res, next) => {
  try {
    const details = req.body.user;
    const data = JSON.parse(details);
    const updatingUserId = data.id;
    const modifierId = data.modifierId;
    const isUpdate = !!updatingUserId;

    const superAdminRole = await Role.findOne({ name: "Super Admin" });
    const superAdminId = superAdminRole?._id?.toString();
    console.log(superAdminId);
    console.log(updatingUserId);

    let existingUser = null;
    let oldReportingId = null;

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
      existingUser = await User.findById(updatingUserId);

      if (!existingUser) throw new CustomError("User not found", 404);
      oldReportingId = existingUser.reportingTo?.toString();

      if (
        superAdminId === existingUser.role.toString() &&
        (data.status !== existingUser.status ||
          data.role !== existingUser.role.toString())
      ) {
        throw new CustomError(
          "You cannot update Super Admin's status or role",
          403
        );
      }

      if (
        existingUser._id?.toString() === modifierId &&
        (data.status !== existingUser.status ||
          data.role !== existingUser.role.toString())
      ) {
        throw new CustomError("You cannot update your own status or role", 403);
      }

      data.modifiedBy = modifierId;
      data.modifiedTime = new Date();
      user = await User.findByIdAndUpdate(updatingUserId, data, { new: true });
    } else {
      const alreadyExists = await User.findOne({ email: data.email });
      if (alreadyExists) {
        throw new CustomError("Email already exists", 409);
      }

      const plainPassword = Math.random().toString(36).slice(-8);
      data.password = await bcrypt.hash(plainPassword, 10);

      // data.readBy = [data.createdBy];
      // data.seenBy = [data.createdBy];

      user = await User.create(data);

      // Send credentials via email
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: config.smtp.email,
          pass: config.smtp.password,
        },
      });

      await transporter.sendMail({
        from: config.smtp.email,
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
    const { password, ...userWithoutPassword } = user.toObject();

    return successResponse(
      res,
      `User ${isUpdate ? "updated" : "created"} successfully`,
      userWithoutPassword
    );
  } catch (err) {
    console.log(err);
    next(err);
  }
};

const updateUserField = async (req, res, next) => {
  try {
    const { id } = req.params; // User ID to update (the target)
    const { field, value, modifierId } = req.body; // Field name, new value, and who is updating

    if (!field || typeof value === "undefined") {
      throw new CustomError("Field and value are required", 400);
    }

    // Get Super Admin role id
    const superAdminRole = await Role.findOne({ name: "Super Admin" });
    const superAdminId = superAdminRole?._id?.toString();

    const userToUpdate = await User.findById(id);
    if (!userToUpdate) throw new CustomError("User not found", 404);

    // Prevent updating own status or role
    if (id === modifierId && (field === "status" || field === "role")) {
      throw new CustomError("You cannot update your own status or role", 403);
    }

    // Prevent updating Super Admin's status or role
    if (
      userToUpdate.role?.toString() === superAdminId &&
      (field === "status" || field === "role")
    ) {
      throw new CustomError(
        "You cannot update Super Admin's status or role",
        403
      );
    }

    // Prevent updating password here if you want
    if (field === "password") {
      throw new CustomError("Cannot update password using this API", 403);
    }

    // Build dynamic update object
    const updateObj = {
      [field]: value,
      modifiedTime: new Date(),
      modifiedBy: modifierId,
    };

    const updatedUser = await User.findByIdAndUpdate(id, updateObj, {
      new: true,
    });

    if (!updatedUser) throw new CustomError("User not found", 404);

    const { password, ...userWithoutPassword } = updatedUser.toObject();

    return successResponse(
      res,
      "User field updated successfully",
      userWithoutPassword
    );
  } catch (err) {
    next(err);
  }
};

const getAllUsers = async (req, res, next) => {
  try {
    const page =
      parseInt(req.query.pageIndex) >= 0
        ? parseInt(req.query.pageIndex) + 1
        : 1;
    const limit = parseInt(req.query.pageSize) || 10;
    const skip = (page - 1) * limit;

    // const viewerId = req.params.id; // 👈 ID of the user fetching the list (e.g., HR viewing users)

    const {
      search = "",
      designation,
      department,
      totalPointsRange,
      role,
    } = req.query;

    // Find the Super Admin role id
    // const superAdminRole = await Role.findOne({ name: "Super Admin" });
    let filter = { isDeleted: false };

    if (totalPointsRange) {
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
        { employeeId: searchRegex },
      ];
    }

    // Role filter
    if (designation) {
      filter.designation = designation;
    }

    if (role && role !== "[]") {
      console.log("here");
      let roleArray = role;
      if (typeof role === "string" && role.startsWith("[")) {
        // Remove brackets and split by comma
        roleArray = role
          .replace(/[\[\]\s]/g, "") // remove brackets and spaces
          .split(",")
          .filter(Boolean); // remove empty strings
      }
      if (Array.isArray(roleArray) && roleArray.length > 0) {
        filter.role = { $in: roleArray };
      } else if (roleArray) {
        filter.role = roleArray;
      }
    }

    // Department filter
    if (department) {
      filter.department = department;
    }

    const { source } = req.query;

    let users, total;

    if (source === "mobile") {
      // For mobile, fetch all users without pagination
      [users, total] = await Promise.all([
        User.find(filter)
          .populate({ path: "role", select: "name" })
          .populate({ path: "department", select: "name" })
          .populate({ path: "designation", select: "name" })
          .populate({ path: "reportingTo", select: "firstName lastName" })
          .populate({ path: "createdBy", select: "firstName lastName" })
          .populate({ path: "modifiedBy", select: "firstName lastName" }),

        User.countDocuments(filter),
      ]);
    } else {
      // For web, use pagination
      [users, total] = await Promise.all([
        User.find(filter)
          .skip(skip)
          .limit(limit)
          .populate({ path: "role", select: "name" })
          .populate({ path: "department", select: "name" })
          .populate({ path: "designation", select: "name" })
          .populate({ path: "reportingTo", select: "firstName lastName" })
          .populate({ path: "createdBy", select: "firstName lastName" })
          .populate({ path: "modifiedBy", select: "firstName lastName" }),

        User.countDocuments(filter),
      ]);
    }

    // const usersWithIsRead = users.map((user) => {
    //   const isRead = user.readBy?.includes(viewerId); // assuming readBy is an array of ObjectIds
    //   return {
    //     ...user.toObject(),
    //     isRead,
    //   };
    // });
    const usersWithoutPasswords = users.map((user) => {
      const { password, ...rest } = user.toObject();
      return rest;
    });

    return successResponse(res, "Users fetched successfully", {
      users: usersWithoutPasswords,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
};

const getAllEmployeesForReporting = async (req, res, next) => {
  try {
    const { search = "" } = req.query;
    const { id } = req.params;
    const searchRegex = new RegExp(search, "i");

    // Base filter
    let filter = {
      status: "Active",
      isDeleted: false,
    };

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
      "_id firstName lastName"
    ).populate("designation", "name");

    return successResponse(res, "Employees fetched successfully", employees);
  } catch (err) {
    next(err);
  }
};

const getAllEmployeesForAppraisal = async (req, res, next) => {
  try {
    const { search = "" } = req.query;
    const { id } = req.params;
    const searchRegex = new RegExp(search, "i");

    const superAdminRole = await Role.findOne({ name: "Super Admin" });
    const superAdminId = superAdminRole?._id?.toString();

    let filter = {
      status: "Active",
      isDeleted: false,
      role: { $ne: superAdminId },
      _id: { $ne: id },
    };

    if (search) {
      filter.$or = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex },
      ];
    }
    let users, total;

    [users, total] = await Promise.all([
      User.find(filter)
        .populate({ path: "role", select: "name" })
        .populate({ path: "department", select: "name" })
        .populate({ path: "designation", select: "name" })
        .populate({ path: "reportingTo", select: "firstName lastName" })
        .populate({ path: "createdBy", select: "firstName lastName" })
        .populate({ path: "modifiedBy", select: "firstName lastName" }),

      User.countDocuments(filter),
    ]);

    const usersWithoutPasswords = users.map((user) => {
      const { password, ...rest } = user.toObject();
      return rest;
    });
    return successResponse(res, "Employees fetched successfully", {
      users: usersWithoutPasswords,
    });
  } catch (err) {
    next(err);
  }
};

const getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id)
      .populate("role", "name")
      .populate("department", "name")
      .populate("designation", "name")
      .populate("createdBy", "firstName lastName")
      .populate("modifiedBy", "firstName lastName")

      .populate({
        path: "reportingTo",
        select: "employeeId firstName lastName role",
        populate: {
          path: "role",
          select: "name",
        },
      });

    if (!user) throw new CustomError("User not found", 404);

    const { password, ...userWithoutPassword } = user.toObject();
    return successResponse(
      res,
      "User fetched successfully",
      userWithoutPassword
    );
  } catch (err) {
    next(err);
  }
};

const deleteUser = async (req, res, next) => {
  try {
    const userIdToDelete = req.params.id;

    const superAdminRole = await Role.findOne({ name: "Super Admin" });
    const superAdmin = await User.findOne({ role: superAdminRole._id });
    if (!superAdmin) throw new CustomError("Super admin not found", 404);

    if (superAdmin._id.toString() === userIdToDelete.toString().trim()) {
      throw new CustomError("Super Admin cannot be deleted", 404);
    }
    // Step 1: Soft delete the user
    const user = await User.findByIdAndUpdate(
      userIdToDelete,
      { isDeleted: true },
      { new: true }
    );

    if (!user) throw new CustomError("User not found", 404);

    const teamMembersToMove = user.teamMembers || [];

    // Step 3: Add deleted user's teamMembers to superAdmin (avoid duplicates)
    superAdmin.teamMembers = Array.from(
      new Set([...(superAdmin.teamMembers || []), ...teamMembersToMove])
    );
    await superAdmin.save();

    // Step 4: Update each moved team member's reportingTo to superAdmin
    await User.updateMany(
      { _id: { $in: teamMembersToMove } },
      { $set: { reportingTo: superAdmin._id } }
    );

    // Step 5: Remove deleted user from their own reporting user's teamMembers
    if (user.reportingTo) {
      await User.findByIdAndUpdate(user.reportingTo, {
        $pull: { teamMembers: user._id },
      });
    }

    return successResponse(res, "User deleted successfully", user);
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

    return successResponse(res, "Status updated successfully", null);
  } catch (err) {
    next(err);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const { email, newPassword, confirmPassword } = req.body;

    const user = await User.findOne({ email });
    if (!user) throw new CustomError("User not found", 404);

    if (newPassword !== confirmPassword) {
      throw new CustomError("Passwords do not match", 400);
    }

    const isSame = await bcrypt.compare(newPassword, user.password);
    if (isSame) {
      throw new CustomError("New password must not be the old password", 400);
    }

    user.password = await bcrypt.hash(newPassword, 10);
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

    // 2. Build filter with teamMembers list
    let filter = {
      _id: { $in: reporter.teamMembers },
      status: "Active",
      isDeleted: false,
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
        .populate("role", "name")
        .populate("department", "name")
        .populate("designation", "name"),

      User.countDocuments(filter),
    ]);
    const usersWithoutPasswords = users.map((user) => {
      const { password, ...rest } = user.toObject();
      return rest;
    });

    return successResponse(res, "Employees fetched successfully", {
      users: usersWithoutPasswords,
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
      isdeleted: false,
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
        .populate("department", "name")
        .populate("designation", "name")
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
    const enrichedUsersWithoutPasswords = enrichedUsers.map(
      ({ password, ...rest }) => rest
    );

    return successResponse(res, "Employees fetched successfully", {
      users: enrichedUsersWithoutPasswords,
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
    const { role } = req.query;
    const { id } = req.params;

    // Date setups
    const today = new Date();
    const todayDay = today.getDate();
    const todayMonth = today.getMonth() + 1;
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(today.getDate() - 7);

    // Super Admin role
    const superAdminRole = await Role.findOne({ name: "Super Admin" });
    const superAdminId = superAdminRole?._id;

    // Common filter
    const activeNonSuperAdminFilter = {
      status: "Active",
      isDeleted: false,
      role: { $ne: superAdminId },
    };

    // New Hires (last 7 days)
    const newHires = await User.find({
      ...activeNonSuperAdminFilter,
      createdAt: { $gte: oneWeekAgo },
    })
      .sort({ createdAt: -1 })
      .select("firstName lastName email dateOfJoining createdAt")
      .populate("department", "name")
      .populate("designation", "name");

    // Birthday Users (today)
    const birthdayUsers = await User.find({
      ...activeNonSuperAdminFilter,
      $expr: {
        $and: [
          { $eq: [{ $dayOfMonth: "$dob" }, todayDay] },
          { $eq: [{ $month: "$dob" }, todayMonth] },
        ],
      },
    }).select("firstName lastName email dob");

    // Work Anniversaries (today)
    const workAnniversaryUsers = await User.aggregate([
      {
        $match: {
          ...activeNonSuperAdminFilter,
          $expr: {
            $and: [
              { $eq: [{ $dayOfMonth: "$dateOfJoining" }, todayDay] },
              { $eq: [{ $month: "$dateOfJoining" }, todayMonth] },
              { $lt: [{ $year: "$dateOfJoining" }, new Date().getFullYear()] }, // exclude users joining this year
            ],
          },
        },
      },
      {
        $addFields: {
          yearsCompleted: {
            $subtract: [new Date().getFullYear(), { $year: "$dateOfJoining" }],
          },
        },
      },
      {
        $project: {
          firstName: 1,
          lastName: 1,
          email: 1,
          dateOfJoining: 1,
          yearsCompleted: 1,
        },
      },
    ]);

    const totalUsers = await User.countDocuments(activeNonSuperAdminFilter);

    // ---------- ADMIN DASHBOARD ----------
    if (role === "Super Admin") {
      const totalRoles = await Role.countDocuments({
        _id: { $ne: superAdminId },
      });
      const totalDepartments = await Department.countDocuments();
      const admin = await User.findById(id).select("department");

      const departmentEmployees = await User.find({
        department: admin.department,
        isDeleted: false,
        _id: { $ne: id },
      }).select("employeeId firstName lastName");

      return successResponse(res, "Admin dashboard data", {
        totalUsers,
        totalRoles,
        newHiresCount: newHires.length,
        newHires,
        birthdayUsers,
        workAnniversaryUsers,
        totalDepartments,
        departmentEmployees,
      });
    }

    const user = await User.findById(id).select("totalPoints teamMembers");

    const teamMembersCount = await User.countDocuments({
      ...activeNonSuperAdminFilter,
      reportingTo: id,
    });

    const teamMembers = await User.find({
      _id: { $in: user.teamMembers },
      status: "Active",
      isDeleted: false,
    }).select("employeeId firstName lastName");

    return successResponse(res, "HR dashboard data", {
      totalUsers,
      teamMembersCount,
      teamMembers,
      totalPoints: user?.totalPoints || 0,
      newHiresCount: newHires.length,
      newHires,
      birthdayUsers,
      workAnniversaryUsers,
    });
  } catch (err) {
    next(err);
  }
};
const getAllEmployeesByDepartment = async (req, res, next) => {
  try {
    const { id } = req.params; // department id

    const employees = await User.find({
      department: id,
      isDeleted: false,
    }).select("EmployeeId firstName lastName");

    return successResponse(res, "Employees fetched successfully", employees);
  } catch (err) {
    next(err);
  }
};

const updatePhoneNumber = async (req, res, next) => {
  try {
    const { phoneNumber } = req.body;
    const { id } = req.params;

    if (!phoneNumber) throw new CustomError("Phone number is required", 400);

    const updatedUser = await User.findById(id);
    if (!updatedUser) throw new CustomError("User not found", 404);

    // Handle profile photo update
    if (req.file) {
      const oldUrl = updatedUser.profilePhotoUrl;
      if (oldUrl?.includes(".com/")) {
        const oldKey = oldUrl.split(".com/")[1];
        await deleteFromS3(oldKey);
      }

      const location = await s3Uploads(req.file, "profile-photo");
      updatedUser.profilePhotoUrl = location;
    }

    updatedUser.phoneNumber = phoneNumber;

    await updatedUser.save();

    return successResponse(res, "Profile updated successfully", updatedUser);
  } catch (err) {
    next(err);
  }
};

const updateRole = async (req, res, next) => {
  try {
    const { role } = req.body;
    const { id } = req.params;

    if (!role) throw new CustomError("role is required", 400);

    const updatedUser = await User.findByIdAndUpdate(
      id,
      { role },
      { new: true }
    );

    if (!updatedUser) throw new CustomError("User not found", 404);

    return successResponse(res, "Role updated successfully", updatedUser);
  } catch (err) {
    next(err);
  }
};

// const markAllUsersAsSeen = async (req, res, next) => {
//   try {
//     const viewerId = req.params.id; // user ID who is viewing

//     if (!viewerId) {
//       throw new CustomError("User ID is required", 400);
//     }

//     // Update all users not created by the viewer and where viewer hasn't read yet
//     const result = await User.updateMany(
//       {
//         createdBy: { $ne: viewerId },
//         seenBy: { $nin: [viewerId] }, // ✅ Correct way to filter array field
//       },
//       {
//         $addToSet: { seenBy: viewerId }, // ✅ Avoid duplicates
//       }
//     );

//     return successResponse(
//       res,
//       `Marked ${result.modifiedCount} users as seen by viewer`,
//       result
//     );
//   } catch (err) {
//     next(err);
//   }
// };

// const markUserAsReadByViewer = async (req, res, next) => {
//   try {
//     const { viewerId, userId } = req.body;

//     if (!viewerId || !userId) {
//       throw new CustomError("viewerId and userId are required", 400);
//     }

//     const user = await User.findById(userId);

//     if (!user) {
//       throw new CustomError("User not found", 404);
//     }

//     // Only update if viewerId is not already in readBy
//     if (!user.readBy?.includes(viewerId)) {
//       user.readBy = [...(user.readBy || []), viewerId];
//       await user.save();
//     }

//     return successResponse(res, "User marked as read by viewer", user);
//   } catch (err) {
//     next(err);
//   }
// };

const getUserTree = async (req, res, next) => {
  try {
    const superAdminRole = await Role.findOne({ name: "Super Admin" });
    const superAdmin = await User.findOne({ role: superAdminRole._id });
    const userId = superAdmin?._id;
    console.log(userId);

    if (!userId) {
      throw new CustomError("User ID is required", 400);
    }

    // Recursive function to build the team hierarchy
    const buildTree = async (id) => {
      const user = await User.findById(id)
        .select("_id firstName lastName reportingTo")
        .populate("designation", "name");

      if (!user) return null;

      const teamMembers = await User.find({
        reportingTo: id,
        isDeleted: false,
      }).select("_id firstName lastName email");

      const team = await Promise.all(
        teamMembers.map((member) => buildTree(member._id))
      );

      return {
        ...user.toObject(),
        team,
      };
    };

    const tree = await buildTree(userId);

    if (!tree) throw new CustomError("User not found", 404);

    return successResponse(res, "Organization tree fetched", tree);
  } catch (err) {
    next(err);
  }
};

const getUsersGroupedByDepartment = async (req, res, next) => {
  try {
    // Step 1: Get all departments
    const departments = await Department.find({}, "_id name");

    // Step 2: For each department, get users
    const result = await Promise.all(
      departments.map(async (dept) => {
        const users = await User.find({
          department: dept._id,
          isDeleted: false,
        })
          .select("_id firstName lastName email profilePhoto")
          .populate("designation", "name");

        return {
          _id: dept._id,
          name: dept.name,
          users,
        };
      })
    );

    return successResponse(res, "Users grouped by department", result);
  } catch (err) {
    next(err);
  }
};

const getTeamMembersByUserId = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { search = "", department, designation } = req.query;

    const visited = new Set(); // To prevent infinite loops
    const queue = [id];
    const allTeamMemberIds = new Set();

    while (queue.length > 0) {
      const currentUserId = queue.shift();
      if (visited.has(currentUserId)) continue;

      visited.add(currentUserId);

      const user = await User.findById(currentUserId).select("teamMembers");

      if (user?.teamMembers?.length) {
        user.teamMembers.forEach((memberId) => {
          if (!visited.has(String(memberId))) {
            queue.push(String(memberId));
            allTeamMemberIds.add(String(memberId));
          }
        });
      }
    }

    if (allTeamMemberIds.size === 0) {
      return successResponse(res, "No team members found", []);
    }

    // Build filters
    const filter = {
      _id: { $in: Array.from(allTeamMemberIds) },
      isDeleted: false,
    };

    if (search) {
      const searchRegex = new RegExp(search, "i");
      filter.$or = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex },
        { employeeId: searchRegex },
      ];
    }
    if (designation) filter.designation = designation;
    if (department) filter.department = department;

    const teamMembers = await User.find(filter)
      .populate("role", "name")
      .populate("department", "name")
      .populate("designation", "name")
      .populate("reportingTo", "firstName lastName")
      .populate("createdBy", "firstName lastName")
      .populate("modifiedBy", "firstName lastName");

    return successResponse(res, "Team members fetched successfully", {
      users: teamMembers,
    });
  } catch (err) {
    next(err);
  }
};

const getPermissions = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    const role = await Role.findById(user.role);
    const permissions = role.permissions;
    return successResponse(
      res,
      "Permissions fetched successfully",
      permissions
    );
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createOrUpdateUser,
  getAllUsers,
  getUserById,
  deleteUser,
  updateUserField,
  updateUserStatus,
  getAllEmployeesByReporterId,
  getAllEmployeesByCreatorId,
  getAllEmployeesForAppraisal,
  resetPassword,
  updatePassword,
  updateRole,
  getAllEmployeesForReporting,
  getDashboardStats,
  updatePhoneNumber,
  getAllEmployeesByDepartment,
  getUserTree,
  getUsersGroupedByDepartment,
  getTeamMembersByUserId,
  getPermissions,
};
