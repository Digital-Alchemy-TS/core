import { TServiceParams } from "@zcc/boilerplate";
import { is } from "@zcc/utilities";
import { FastifyReply, FastifyRequest } from "fastify";

import { HTTP_REJECTED_AUTH, HttpStatusCode } from "../helpers/index.mjs";
import { LIB_SERVER } from "../server.module.mjs";

export function Auth({ logger, lifecycle }: TServiceParams) {
  let adminKey: string;

  lifecycle.onPostConfig(() => {
    adminKey = LIB_SERVER.getConfig("ADMIN_KEY");
  });

  lifecycle.onReady(() => {
    if (!is.empty(adminKey)) {
      logger.info(`Server ADMIN_KEY defined`);
    }
  });

  function AdminKey(request: FastifyRequest, reply: FastifyReply) {
    if (is.empty(adminKey)) {
      logger.warn(
        `Request was configured for ADMIN_KEY auth, but no ADMIN_KEY configured`,
      );
      return;
    }
    if (request.headers["admin-key"] === adminKey) {
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
