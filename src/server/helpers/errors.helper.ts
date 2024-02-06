import { TContext } from "../../utilities";

export class BadRequestError extends Error {
  context: TContext;
  cause: string;
  timestamp: Date;

  constructor(context: TContext, cause: string, message = "Bad Request") {
    super(
      `[BadRequestError] Context: ${context}, Cause: ${cause}, Message: ${message} | Timestamp: ${new Date().toISOString()}`,
    );
    this.name = "BadRequestError";
    this.context = context;
    this.cause = cause;
    this.timestamp = new Date();
  }
}

export class UnauthorizedError extends Error {
  context: TContext;
  cause: string;
  timestamp: Date;

  constructor(context: TContext, cause: string, message = "Unauthorized") {
    super(
      `[UnauthorizedError] Context: ${context}, Cause: ${cause}, Message: ${message} | Timestamp: ${new Date().toISOString()}`,
    );
    this.name = "UnauthorizedError";
    this.context = context;
    this.cause = cause;
    this.timestamp = new Date();
  }
}

export class ForbiddenError extends Error {
  context: TContext;
  cause: string;
  timestamp: Date;

  constructor(context: TContext, cause: string, message = "Forbidden") {
    super(
      `[ForbiddenError] Context: ${context}, Cause: ${cause}, Message: ${message} | Timestamp: ${new Date().toISOString()}`,
    );
    this.name = "ForbiddenError";
    this.context = context;
    this.cause = cause;
    this.timestamp = new Date();
  }
}

export class NotFoundError extends Error {
  context: TContext;
  cause: string;
  timestamp: Date;

  constructor(context: TContext, cause: string, message = "Not Found") {
    super(
      `[NotFoundError] Context: ${context}, Cause: ${cause}, Message: ${message} | Timestamp: ${new Date().toISOString()}`,
    );
    this.name = "NotFoundError";
    this.context = context;
    this.cause = cause;
    this.timestamp = new Date();
  }
}

export class MethodNotAllowedError extends Error {
  context: TContext;
  cause: string;
  timestamp: Date;

  constructor(
    context: TContext,
    cause: string,
    message = "Method Not Allowed",
  ) {
    super(
      `[MethodNotAllowedError] Context: ${context}, Cause: ${cause}, Message: ${message} | Timestamp: ${new Date().toISOString()}`,
    );
    this.name = "MethodNotAllowedError";
    this.context = context;
    this.cause = cause;
    this.timestamp = new Date();
  }
}

export class ConflictError extends Error {
  context: TContext;
  cause: string;
  timestamp: Date;

  constructor(context: TContext, cause: string, message = "Conflict") {
    super(
      `[ConflictError] Context: ${context}, Cause: ${cause}, Message: ${message} | Timestamp: ${new Date().toISOString()}`,
    );
    this.name = "ConflictError";
    this.context = context;
    this.cause = cause;
    this.timestamp = new Date();
  }
}

export class InternalServerError extends Error {
  context: TContext;
  cause: string;
  timestamp: Date;

  constructor(
    context: TContext,
    cause: string,
    message = "Internal Server Error",
  ) {
    super(
      `[InternalServerError] Context: ${context}, Cause: ${cause}, Message: ${message} | Timestamp: ${new Date().toISOString()}`,
    );
    this.name = "InternalServerError";
    this.context = context;
    this.cause = cause;
    this.timestamp = new Date();
  }
}

export class NotImplementedError extends Error {
  context: TContext;
  cause: string;
  timestamp: Date;

  constructor(context: TContext, cause: string, message = "Not Implemented") {
    super(
      `[NotImplementedError] Context: ${context}, Cause: ${cause}, Message: ${message} | Timestamp: ${new Date().toISOString()}`,
    );
    this.name = "NotImplementedError";
    this.context = context;
    this.cause = cause;
    this.timestamp = new Date();
  }
}

export class BadGatewayError extends Error {
  context: TContext;
  cause: string;
  timestamp: Date;

  constructor(context: TContext, cause: string, message = "Bad Gateway") {
    super(
      `[BadGatewayError] Context: ${context}, Cause: ${cause}, Message: ${message} | Timestamp: ${new Date().toISOString()}`,
    );
    this.name = "BadGatewayError";
    this.context = context;
    this.cause = cause;
    this.timestamp = new Date();
  }
}

export class ServiceUnavailableError extends Error {
  context: TContext;
  cause: string;
  timestamp: Date;

  constructor(
    context: TContext,
    cause: string,
    message = "Service Unavailable",
  ) {
    super(
      `[ServiceUnavailableError] Context: ${context}, Cause: ${cause}, Message: ${message} | Timestamp: ${new Date().toISOString()}`,
    );
    this.name = "ServiceUnavailableError";
    this.context = context;
    this.cause = cause;
    this.timestamp = new Date();
  }
}

export class GatewayTimeoutError extends Error {
  context: TContext;
  cause: string;
  timestamp: Date;

  constructor(context: TContext, cause: string, message = "Gateway Timeout") {
    super(
      `[GatewayTimeoutError] Context: ${context}, Cause: ${cause}, Message: ${message} | Timestamp: ${new Date().toISOString()}`,
    );
    this.name = "GatewayTimeoutError";
    this.context = context;
    this.cause = cause;
    this.timestamp = new Date();
  }
}
