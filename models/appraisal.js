const mongoose = require("mongoose");

const AppraisalSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    appraisalTemplateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AppraisalTemplate",
      required: true,
    },

    appraisalStartDate: {
      type: Date,
      default: Date.now,
    },
    appraisalEndDate: {
      type: Date,
    },
    department: {
      type: String,
    },
    role: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },

    managerApprovalStatus: {
      type: String,
      enum: ["new", "pending", "approved", "rejected"],
      default: "new",
    },
    adminApprovalStatus: {
      type: String,
      enum: ["new", "pending", "approved", "rejected"],
      default: "new",
    },
    appraisalPdf: {
      type: String,
    },
    employeeFeedBack: {
      type: String,
    },
    managerFeedBack: {
      type: String,
      trim: true,
    },
    adminFeedBack: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Appraisal", AppraisalSchema);
