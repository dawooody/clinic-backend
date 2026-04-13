/**
 * Standard success response
 * Flutter app will always check success: true / false
 */
const success = (res, data = {}, message = 'Success', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

/**
 * Standard error response
 */
const error = (res, message = 'Something went wrong', statusCode = 500, errors = null) => {
  const response = { success: false, message };
  if (errors) response.errors = errors;
  return res.status(statusCode).json(response);
};

/**
 * Paginated list response
 */
const paginated = (res, rows, count, page, limit, message = 'Success') => {
  return res.status(200).json({
    success: true,
    message,
    data: rows,
    pagination: {
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / limit),
    },
  });
};

module.exports = { success, error, paginated };
