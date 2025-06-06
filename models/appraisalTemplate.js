const mongoose = require("mongoose");

const AppraisalTemplateSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      required: true,
    },
    appraisalStartDate: {
      type: Date,
      required: true,
    },
    appraisalEndDate: {
      type: Date,
      required: true,
    },
    department: {
      type: Array,
    },
    role: {
      type: Array,
    },
    points: {
      type: Number,
      required: true,
    },
    appraisalAmount: {
      type: Number,
      required: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    appraisalNotes: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("AppraisalTemplate", AppraisalTemplateSchema);
