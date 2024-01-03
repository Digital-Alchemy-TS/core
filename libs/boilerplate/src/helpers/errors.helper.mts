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
    this.name = "FetchRequestError";
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
    this.context = context;
    this.cause = cause;
    this.timestamp = new Date();
  }
}

export class InternalError extends Error {
  context: string;
  cause: string;
  timestamp: Date;

  constructor(context: string, cause: string, message: string) {
    super(`Internal System Error in ${context}: ${message}`);
    this.name = "InternalError";
    this.context = context;
    this.cause = cause;
    this.timestamp = new Date();
  }
}
