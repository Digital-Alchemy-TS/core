import { GetApis, InternalError, TServiceParams } from "@zcc/boilerplate";
import {
  BadRequestError,
  GENERIC_SUCCESS_RESPONSE,
  LIB_SERVER,
} from "@zcc/server";
import { is, TBlackHole, TContext, ZCC } from "@zcc/utilities";
import { FastifyRequest } from "fastify";

import { Icon } from "../helpers/index";
import {
  BUTTON_ERRORS,
  BUTTON_EXECUTION_COUNT,
  BUTTON_EXECUTION_TIME,
} from "../helpers/metrics.helper";
import { LIB_VIRTUAL_ENTITY } from "../virtual-entity.module";

type TButton = {
  exec: () => TBlackHole;
  context: TContext;
  label?: string;
  icon?: Icon;
  id: string;
  name?: string;
};

type TParams = {
  Params: { button: string };
};
type TRequest = FastifyRequest<TParams>;

export function Button({
  logger,
  lifecycle,
  getApis,
  context: parentContext,
}: TServiceParams) {
  // wtf of the week -
  // builds fail without this assertion, but vscode is just fine
  const server = getApis(LIB_SERVER) as GetApis<typeof LIB_SERVER>;

  let baseUrl: string;
  let httpPrefix: string;
  const register = new Map<string, TButton>();

  lifecycle.onPostConfig(() => {
    baseUrl = LIB_VIRTUAL_ENTITY.getConfig("BASE_URL");
    httpPrefix = LIB_VIRTUAL_ENTITY.getConfig("HTTP_PREFIX");
  });

  lifecycle.onBootstrap(() => {
    logger.debug({ baseUrl, httpPrefix }, `Attaching talk back`);

    server.bindings.httpServer.get<TParams>(
      `${httpPrefix}/button-press/:button`,
      { preValidation: [server.auth.AdminKey] },
      async function (request: TRequest) {
        const button = request.params.button;
        if (is.empty(button)) {
          throw new BadRequestError(
            parentContext,
            "NO_BUTTON",
            "Provide a value for the button to press",
          );
        }
        if (!register.has(button)) {
          throw new BadRequestError(
            parentContext,
            "INVALID_BUTTON",
            `${button} is not registered`,
          );
        }
        logger.debug({ button }, `Received button press`);
        const { exec, context, label } = register.get(button);
        setImmediate(async () => {
          await ZCC.safeExec({
            duration: BUTTON_EXECUTION_TIME,
            errors: BUTTON_ERRORS,
            exec: async () => await exec(),
            executions: BUTTON_EXECUTION_COUNT,
            labels: { context, label },
          });
        });
        return GENERIC_SUCCESS_RESPONSE;
      },
    );
  });

  function create(button: TButton) {
    if (is.empty(button.id)) {
      throw new InternalError(parentContext, "INVALID_ID", "id is required");
    }
    if (register.has(button.id)) {
      throw new InternalError(
        parentContext,
        "DUPLICATE_BUTTON",
        "button id is already in use",
      );
    }
    logger.debug({ button }, `Create button`);
    register.set(button.id, button);
  }

  return create;
}
