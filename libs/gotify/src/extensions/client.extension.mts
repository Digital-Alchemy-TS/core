import { TServiceParams } from "@zcc/boilerplate";

import { LIB_GOTIFY } from "../gotify.module.mjs";
import { Client } from "../helpers/api.mjs";

export function GotifyClient({ logger, getApis }: TServiceParams) {
  const gotify = getApis(LIB_GOTIFY);

  return {
    async create(body: Client): Promise<Client> {
      logger.trace(`client create`);
      return await gotify.fetch({
        body,
        method: "post",
        url: "/client",
      });
    },

    async delete(id: number) {
      logger.trace(`client delete`);
      return await gotify.fetch({
        method: "delete",
        url: `/client/${id}`,
      });
    },

    async list(): Promise<Client> {
      logger.trace(`client list`);
      return await gotify.fetch({
        url: "/client",
      });
    },

    async update(id: number, body: Client): Promise<Client> {
      logger.trace(`client update`);
      return await gotify.fetch({
        body,
        method: "put",
        url: `/client/${id}`,
      });
    },
  };
}
