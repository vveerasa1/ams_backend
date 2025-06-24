const mongoose = require("mongoose");
const { Schema, Types } = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    employeeId: {
      type: String,
      required: true,
      unique: true,
    },

    firstName: {
      type: String,
      required: true,
    },

    lastName: {
      type: String,
      required: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },

    password: {
      type: String,
      required: true,
    },

    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
    },

    designation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Designation",
    },

    dob: {
      type: Date,
    },

    dateOfJoining: {
      type: Date,
    },

    phoneNumber: {
      type: String,
    },

    status: {
      type: String,
      enum: ["Active", "Inactive", "Suspended"],
      default: "Active",
    },

    address: {
      type: String,
    },
    city: {
      type: String,
    },
    province: {
      type: String,
    },
    postalCode: {
      type: String,
    },
    country: {
      type: String,
    },

    role: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
      required: true,
      default: new Types.ObjectId("683157fd55615f6712603b64"), // use 'new'
    },

    profilePhotoUrl: {
      type: String,
    },

    totalPoints: {
      type: Number,
      default: 0,
    },

    reportingTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Admin who created this employee
    },

    modifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Admin who created this employee
    },

    modifiedTime: {
      type: Date,
    },

    teamMembers: {
      type: Array,
    },

    // seenBy: [
    //   {
    //     type: mongoose.Schema.Types.ObjectId,
    //     ref: "User", // HR user ID
    //   },
    // ],
    // readBy: [
    //   {
    //     type: mongoose.Schema.Types.ObjectId,
    //     ref: "User",
    //   },
    // ],

    otp: {
      type: String,
    },

    otpExpires: {
      type: Date,
    },
  },
  {
    timestamps: true, // adds createdAt & updatedAt automatically
  }
);

const Employee = mongoose.model("User", UserSchema);

module.exports = Employee;
