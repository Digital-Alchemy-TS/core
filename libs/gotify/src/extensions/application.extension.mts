import { TServiceParams } from "@zcc/boilerplate";

import { LIB_GOTIFY } from "../gotify.module.mjs";
import {
  Application,
  ApplicationParameters,
  Message,
} from "../helpers/api.mjs";

export function GotifyApplication({ logger, getApis }: TServiceParams) {
  const gotify = getApis(LIB_GOTIFY);

  return {
    async create(body: ApplicationParameters): Promise<Application> {
      logger.trace(`application create`);
      return await gotify.fetch({
        body,
        method: "post",
        url: `/application`,
      });
    },

    async delete(id: number): Promise<void> {
      logger.trace(`application delete`);
      return await gotify.fetch({
        method: "delete",
        url: `/application/${id}`,
      });
    },

    async deleteMessages(id: number): Promise<void> {
      logger.trace(`application deleteMessages`);
      return await gotify.fetch({
        method: "delete",
        url: `/application/${id}/message`,
      });
    },

    async getMessages(
      id: number,
      params?: { limit?: number; since?: number },
    ): Promise<Message[]> {
      logger.trace(`application getMessages`);
      return await gotify.fetch({
        params,
        url: `/application/${id}/message`,
      });
    },

    async list(): Promise<Application[]> {
      logger.trace(`application list`);
      return await gotify.fetch({
        url: `/application`,
      });
    },

    async update(
      id: number,
      body: ApplicationParameters,
    ): Promise<Application> {
      logger.trace(`application update`);
      return await gotify.fetch({
        body,
        method: "put",
        url: `/application/${id}`,
      });
    },
  };
}
