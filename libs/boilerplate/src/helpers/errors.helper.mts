import { TContext } from "@zcc/utilities";

export type MaybeHttpError = {
  error: string;
  message: string;
  statusCode: number;
};

export class BootstrapException extends Error {
  context: TContext;
  cause: string;
  timestamp: Date;

  constructor(context: TContext, cause: string, message: string) {
    super(
      `[BootstrapException] Context: ${context}, Cause: ${cause}, Message: ${message} | Timestamp: ${new Date().toISOString()}`,
    );
    this.name = "BootstrapException";
    this.context = context;
    this.cause = cause;
    this.timestamp = new Date();
  }
}

export class InternalError extends Error {
  context: TContext;
  cause: string;
  timestamp: Date;

  constructor(context: TContext, cause: string, message: string) {
    super(
      `[InternalError] Context: ${context}, Cause: ${cause}, Message: ${message} | Timestamp: ${new Date().toISOString()}`,
    );
    this.name = "InternalError";
    this.context = context;
    this.cause = cause;
    this.timestamp = new Date();
  }
}

export class FetchRequestError extends Error {
  statusCode: number;
  error: string;
  timestamp: Date;

  constructor(statusCode: number, error: string, message: string) {
    super(
      `[FetchRequestError - ${statusCode}] Error: ${error}, Message: ${message} | Timestamp: ${new Date().toISOString()}`,
    );
    this.name = "FetchRequestError";
    this.statusCode = statusCode;
    this.error = error;
    this.timestamp = new Date();
  }
}

export class CacheError extends Error {
  context: TContext;
  timestamp: Date;

  constructor(context: TContext, message: string) {
    super(
      `[CacheError] Context: ${context}, Message: ${message} | Timestamp: ${new Date().toISOString()}`,
    );
    this.name = "CacheError";
    this.context = context;
    this.timestamp = new Date();
  }
}

export class ConfigError extends Error {
  context: TContext;
  timestamp: Date;

  constructor(context: TContext, message: string) {
    super(
      `[ConfigError] Context: ${context}, Message: ${message} | Timestamp: ${new Date().toISOString()}`,
    );
    this.name = "ConfigError";
    this.context = context;
    this.timestamp = new Date();
  }
}

export class CronError extends Error {
  context: TContext;
  timestamp: Date;

  constructor(context: TContext, message: string) {
    super(
      `[CronError] Context: ${context}, Message: ${message} | Timestamp: ${new Date().toISOString()}`,
    );
    this.name = "CronError";
    this.context = context;
    this.timestamp = new Date();
  }
}
