export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean; // distinguishes known vs unknown errors

  constructor(
    message: string = "Something Went Wrong",
    statusCode: number = 500,
    isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    // Fix prototype chain (important for `instanceof` checks with TS)
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}