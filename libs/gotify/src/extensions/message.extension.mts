import { TServiceParams } from "@zcc/boilerplate";

import { LIB_GOTIFY } from "../gotify.module.mjs";
import { Message } from "../helpers/index.mjs";

export function GotifyMessage({ logger, getApis }: TServiceParams) {
  const gotify = getApis(LIB_GOTIFY);

  return {
    async create(body: Message): Promise<Message> {
      logger.trace(`message create`);
      return await gotify.fetch({
        body,
        method: "post",
        url: "/message",
      });
    },

    async delete(id: number) {
      logger.trace(`message delete`);
      return await gotify.fetch({
        method: "delete",
        url: `/message/${id}`,
      });
    },

    async deleteAll() {
      logger.trace(`message deleteAll`);
      return await gotify.fetch({
        method: "delete",
        url: `/message`,
      });
    },

    async list(): Promise<Message> {
      logger.trace(`message list`);
      return await gotify.fetch({
        url: "/message",
      });
    },
  };
}
