// Success Response
const successResponse = (res, message, data = {}, statusCode = 200) => {
  return res.status(statusCode).json({
    statusCode: statusCode,
    success: true,
    message,
    data,
  });
};

module.exports = { successResponse };
