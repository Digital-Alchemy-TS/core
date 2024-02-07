import fastify, {
  FastifyBaseLogger,
  FastifyError,
  FastifyHttpOptions,
  FastifyHttpsOptions,
  FastifyReply,
  FastifyRequest,
} from "fastify";
import { existsSync, readFileSync } from "fs";
import { Server, ServerOptions } from "https";
import { register } from "prom-client";

import { BootstrapException, TServiceParams } from "../../boilerplate";
import { is } from "../../utilities";
import {
  BadGatewayError,
  BadRequestError,
  ConflictError,
  ForbiddenError,
  GatewayTimeoutError,
  HttpStatusCode,
  InternalServerError,
  MethodNotAllowedError,
  NotFoundError,
  NotImplementedError,
  ServiceUnavailableError,
  THROWN_ERRORS,
  UnauthorizedError,
} from "../helpers";

export function Server_Bindings({
  logger,
  lifecycle,
  config,
  context,
}: TServiceParams) {
  let httpServer: ReturnType<typeof initServer>;
  let extraOptions: FastifyHttpOptions<Server, FastifyBaseLogger>;

  lifecycle.onPostConfig(() => {
    httpServer = initServer();
    out.httpServer = httpServer;
  });

  lifecycle.onReady(async () => {
    errorHandler();
    registerMetrics();
    const port = config.server.PORT;
    if (port) {
      const options = { host: config.server.LISTEN_HOST, port };
      logger.info(options, `server listen`);
      await httpServer.listen(options);
    }
  });

  lifecycle.onShutdownStart(async () => {
    logger.info(`server teardown`);
    await httpServer.close();
  });

  function registerMetrics() {
    if (!config.server.EXPOSE_METRICS) {
      return;
    }
    logger.info(`Exposing /metrics for prometheus requests`);
    // nothing special
    httpServer.get("/metrics", async (_, reply) => {
      reply.header("Content-Type", register.contentType);
      return register.metrics();
    });
  }

  function initServer() {
    let https: ServerOptions;
    // Allow errors to bubble up to interrupt bootstrapping
    // Indicates that a port is in use, or a bad port selection or something
    const sslKeyPath = config.server.SSL_KEY_PATH;
    const sslCertPath = config.server.SSL_CERT_PATH;

    if (!is.empty(sslKeyPath) && !is.empty(sslCertPath)) {
      logger.debug({ sslCertPath, sslKeyPath }, `Configuring server for https`);
      if (!existsSync(sslKeyPath)) {
        throw new BootstrapException(
          context,
          "MISSING_SSL_KEYFILE",
          "Cannot start https server without a valid ssl key",
        );
      }
      if (!existsSync(sslCertPath)) {
        throw new BootstrapException(
          context,
          "MISSING_SSL_CERTFILE",
          "Cannot start https server without a valid ssl cert",
        );
      }
      https = {
        cert: readFileSync(sslCertPath),
        key: readFileSync(sslKeyPath),
      };
    }
    return fastify({
      https,
      ...extraOptions,
    });
  }

  function errorHandler() {
    logger.debug(`Adding error handler`);
    httpServer.setErrorHandler(
      (error: FastifyError, _: FastifyRequest, reply: FastifyReply) => {
        let statusCode = HttpStatusCode.INTERNAL_SERVER_ERROR;
        let message = "Internal Server Error";
        let status_code = "INTERNAL_SERVER_ERROR";

        if (error instanceof BadRequestError) {
          statusCode = HttpStatusCode.BAD_REQUEST;
          status_code = "BAD_REQUEST";
          message = error.message;
        } else if (error instanceof UnauthorizedError) {
          statusCode = HttpStatusCode.UNAUTHORIZED;
          status_code = "UNAUTHORIZED";
          message = error.message;
        } else if (error instanceof ForbiddenError) {
          statusCode = HttpStatusCode.FORBIDDEN;
          status_code = "FORBIDDEN";
          message = error.message;
        } else if (error instanceof NotFoundError) {
          statusCode = HttpStatusCode.NOT_FOUND;
          status_code = "NOT_FOUND";
          message = error.message;
        } else if (error instanceof MethodNotAllowedError) {
          statusCode = HttpStatusCode.METHOD_NOT_ALLOWED;
          status_code = "METHOD_NOT_ALLOWED";
          message = error.message;
        } else if (error instanceof ConflictError) {
          statusCode = HttpStatusCode.CONFLICT;
          status_code = "CONFLICT";
          message = error.message;
        } else if (error instanceof InternalServerError) {
          statusCode = HttpStatusCode.INTERNAL_SERVER_ERROR;
          status_code = "INTERNAL_SERVER_ERROR";
          message = error.message;
        } else if (error instanceof NotImplementedError) {
          statusCode = HttpStatusCode.NOT_IMPLEMENTED;
          status_code = "NOT_IMPLEMENTED";
          message = error.message;
        } else if (error instanceof BadGatewayError) {
          statusCode = HttpStatusCode.BAD_GATEWAY;
          status_code = "BAD_GATEWAY";
          message = error.message;
        } else if (error instanceof ServiceUnavailableError) {
          statusCode = HttpStatusCode.SERVICE_UNAVAILABLE;
          status_code = "SERVICE_UNAVAILABLE";
          message = error.message;
        } else if (error instanceof GatewayTimeoutError) {
          statusCode = HttpStatusCode.GATEWAY_TIMEOUT;
          status_code = "GATEWAY_TIMEOUT";
          message = error.message;
        }

        THROWN_ERRORS.labels({ status_code }).inc();

        reply.status(statusCode).send({ error: message });
      },
    );
  }
  function configure(options: FastifyHttpsOptions<Server, FastifyBaseLogger>) {
    if (httpServer) {
      throw new BootstrapException(
        context,
        "LATE_CONFIGURE",
        "Call configure before bootstrap event",
      );
    }
    logger.trace(`http server configure`);
    extraOptions = options;
  }

  const out = {
    /**
     * Pass in extra options for the fastify constructor
     *
     * Must be called prior to server init
     */
    configure,
    /**
     * Reference to fastify
     */
    httpServer,
    /**
     * If called, will use your instance of fastify as the http server
     *
     * Do so prior to `onPostConfig`, or an error will be thrown
     */
    setServer: (server: ReturnType<typeof initServer>) => {
      if (httpServer) {
        throw new BootstrapException(
          context,
          "LATE_SERVER_REGISTER",
          "To override the internal http server, run `setServer` during construction, or onPreInit",
        );
      }
      httpServer = server;
      out.httpServer = server;
    },
  };
  return out;
}
