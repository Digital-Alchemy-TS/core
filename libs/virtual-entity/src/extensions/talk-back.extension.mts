import { TServiceParams } from "@zcc/boilerplate";
import {
  BadRequestError,
  GENERIC_SUCCESS_RESPONSE,
  LIB_SERVER,
} from "@zcc/server";
import { is } from "@zcc/utilities";
import { FastifyRequest } from "fastify";

import { LIB_VIRTUAL_ENTITY } from "../virtual-entity.module.mjs";

export function TalkBack({
  logger,
  context,
  lifecycle,
  getApis,
}: TServiceParams) {
  const server = getApis(LIB_SERVER);
  const virtual = getApis(LIB_VIRTUAL_ENTITY);

  let baseUrl: string;
  let httpPrefix: string;

  lifecycle.onPostConfig(() => {
    baseUrl = LIB_VIRTUAL_ENTITY.getConfig("BASE_URL");
    httpPrefix = LIB_VIRTUAL_ENTITY.getConfig("HTTP_PREFIX");
  });

  lifecycle.onBootstrap(() => {
    attachRoutes();
  });

  function attachRoutes() {
    logger.debug({ baseUrl, httpPrefix }, `Attaching talk back routes`);

    // Button Presses
    server.bindings.httpServer.get(
      `${httpPrefix}/button-press/:button`,
      async (
        request: FastifyRequest<{
          Params: { button: string };
        }>,
      ) => {
        const button = request.params.button;
        if (is.empty(button)) {
          throw new BadRequestError(
            context,
            "NO_BUTTON",
            "Provide a value for the button to press",
          );
        }
        logger.debug({ button }, `Received button press`);
        await virtual.button.onPress(button);
        return GENERIC_SUCCESS_RESPONSE;
      },
    );
  }
}
