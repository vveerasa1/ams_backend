const mongoose = require("mongoose");

const PointsSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    pointsChange: {
      type: Number,
      required: true,
    },
    reason: {
      type: String,
      required: true,
    },
    transactionType: {
      type: String,
      enum: ["bonuses", "deductions"],
      required: true,
    },
    balanceAfter: {
      type: Number,
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Point", PointsSchema);
