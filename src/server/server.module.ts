import { CreateLibrary } from "../boilerplate";
import { HALF, MINUTE, SECOND } from "../utilities";
import { Auth, Server_Bindings } from ".";

export const LIB_SERVER = CreateLibrary({
  configuration: {
    ADMIN_KEY: {
      description:
        "Leave blank to disable. If this value is provided via x-admin-key header, the request will be authorized",
      type: "string",
    },
    BODY_LIMIT: {
      default: 1_048_576,
      description: "Max JSON body size",
      type: "number",
    },
    CONNECTION_TIMEOUT: {
      default: HALF * MINUTE,
      description: "Fastify connection timeout",
      type: "number",
    },
    EXPOSE_METRICS: {
      default: true,
      description: "Respond to prometheus metrics scrape requests",
      type: "boolean",
    },
    HEADERS_TIMEOUT: {
      default: MINUTE,
      type: "number",
    },
    KEEP_ALIVE_TIMEOUT: {
      default: 5 * SECOND,
      description:
        "This sets the maximum time in milliseconds that a socket can remain idle after sending a response. ",
      type: "number",
    },
    LISTEN_HOST: {
      default: "0.0.0.0",
      description: "Address to listen on for fastify",
      type: "string",
    },
    PORT: {
      default: 7000,
      description: "Set to value > 0 to enable",
      type: "number",
    },
    SSL_CERT_PATH: {
      description: "File path, required if SSL_PORT is active",
      type: "string",
    },
    SSL_KEY_PATH: {
      description: "File path, required if SSL_PORT is active",
      type: "string",
    },
  },
  name: "server",
  services: {
    auth: Auth,
    bindings: Server_Bindings,
  },
});

declare module "../boilerplate" {
  export interface LoadedModules {
    server: typeof LIB_SERVER;
  }
}
