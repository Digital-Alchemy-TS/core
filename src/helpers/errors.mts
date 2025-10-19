import type { TContext } from "./context.mts";

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
