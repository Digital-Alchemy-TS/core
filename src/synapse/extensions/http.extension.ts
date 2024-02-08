import { TFetch, TServiceParams } from "../../boilerplate";
import { PICK_ENTITY } from "../../hass";
import { ZCC } from "../../utilities";

export function HttpExtension({
  server,
  context,
  config,
  logger,
  lifecycle,
}: TServiceParams) {
  let fetch: TFetch;
  let webhook_id: string;
  const validation = { preValidation: [server.auth.AdminKey] };

  function BindHTTP() {
    const fastify = server.bindings.httpServer;

    // # Health check
    // Home Assistant will poll this to ensure the app is still around.
    // If we fail to respond, then entities will be flagged as unavailable
    fastify.get("/synapse/health", validation, () => ({ alive: true }));

    // # Fetch app data
    fastify.get("/synapse/application-data", validation, () => {
      logger.trace(`retrieve application data`);
      const application =
        config.synapse.APPLICATION_IDENTIFIER || ZCC.application.name;
      webhook_id = config.synapse.WEBHOOK_ID || `${application}_zcc_webhook`;
      return {
        application,
        webhook_id,
      };
    });
  }

  lifecycle.onBootstrap(() => BindHTTP());
  lifecycle.onPostConfig(() => {
    fetch = ZCC.createFetcher({
      baseUrl: config.hass.BASE_URL,
      context,
      headers: {
        ["x-admin-key"]: config.synapse.ADMIN_KEY,
      },
    }).fetch;
  });

  return {
    emitWebhook: async (body: object) => {
      logger.trace(`Update binary sensor`);
      return await fetch({
        body,
        method: "post",
        url: `/${webhook_id}`,
      });
    },
    systemUpdate: async () => {
      return await fetch({
        body: { upgrade: true },
        method: "post",
        url: `/${webhook_id}`,
      });
    },
    validation,
  };
}
