class CustomError extends Error {
  constructor(message, statusCode = 500, error = "") {
    super(message);
    this.statusCode = statusCode;
    this.error = error;
  }
}

module.exports = CustomError;
