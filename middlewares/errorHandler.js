const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  const error = err.error || err.stack || "";

  res.status(statusCode).json({
    statusCode,
    success: false,
    message,
    error,
  });
};

module.exports = errorHandler;
