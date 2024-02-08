import { FastifyReply, FastifyRequest } from "fastify";

import { is, TServiceParams } from "../..";
import { HTTP_REJECTED_AUTH, HttpStatusCode } from "..";

export function Auth({ logger, lifecycle, config }: TServiceParams) {
  lifecycle.onReady(() => {
    if (!is.empty(config.server.ADMIN_KEY)) {
      logger.info(`Server ADMIN_KEY defined`);
    }
  });

  function AdminKey(request: FastifyRequest, reply: FastifyReply) {
    if (is.empty(config.server.ADMIN_KEY)) {
      logger.warn(
        `Request was configured for ADMIN_KEY auth, but no ADMIN_KEY configured`,
      );
      return;
    }
    if (request.headers["admin-key"] === config.server.ADMIN_KEY) {
      // valid
      return;
    }
    reply.code(HttpStatusCode.UNAUTHORIZED).send({ error: "Unauthorized" });
    HTTP_REJECTED_AUTH.labels("ADMIN_KEY").inc();
  }

  return {
    AdminKey,
  };
}
