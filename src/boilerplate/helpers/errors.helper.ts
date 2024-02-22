import { TContext } from "../..";

export type MaybeHttpError = {
  error: string;
  message: string;
  statusCode: number;
};

export class BootstrapException extends Error {
  context: TContext;
  override cause: string;
  timestamp: Date;

  constructor(context: TContext, cause: string, message: string) {
    super();
    this.name = "BootstrapException";
    this.message = cause;
    this.context = context;
    this.cause = message;
    this.timestamp = new Date();
  }
}

export class InternalError extends Error {
  context: TContext;
  override cause: string;
  timestamp: Date;

  constructor(context: TContext, cause: string, message: string) {
    super();
    this.name = "InternalError";
    this.message = cause;
    this.context = context;
    this.cause = message;
    this.timestamp = new Date();
  }
}

export class FetchRequestError extends Error {
  statusCode: number;
  error: string;
  timestamp: Date;
  context: TContext;

  constructor(
    context: TContext,
    statusCode: number,
    error: string,
    message: string,
  ) {
    super();
    this.context = context;
    this.name = "FetchRequestError";
    this.message = message;
    this.statusCode = statusCode;
    this.error = error;
    this.timestamp = new Date();
  }
}
