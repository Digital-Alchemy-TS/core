export type MaybeHttpError = {
  error: string;
  message: string;
  statusCode: number;
};

export class FetchRequestError extends Error {
  error: string;
  message: string;
  statusCode: number;

  constructor({ error, message, statusCode }: MaybeHttpError) {
    super(`Fetch Request Error - ${statusCode} ${error}: ${message}`);
    this.name = this.constructor.name;
    this.error = error;
    this.message = message;
    this.statusCode = statusCode;
  }
}

export class BootstrapException extends Error {
  context: string;
  cause: string;
  timestamp: Date;

  constructor(context: string, cause: string, message: string) {
    super(`Bootstrap Error in ${context}: ${message}`);
    this.name = "BootstrapException";
    this.context = context; // The part of the system where the error occurred
    this.cause = cause; // A short description of the cause of the error
    this.timestamp = new Date(); // Timestamp when the error occurred
  }
}
