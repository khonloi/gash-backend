export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const successResponse = (res: any, statusCode: number, data: any, message = 'Success') => {
  return res.status(statusCode).json({
    status: 'success',
    message,
    data,
  });
};

export const errorResponse = (res: any, statusCode: number, message: string, errors: any = null) => {
  const payload: any = {
    status: 'error',
    message,
  };
  
  if (errors) {
    payload.errors = errors;
  }

  return res.status(statusCode).json(payload);
};
