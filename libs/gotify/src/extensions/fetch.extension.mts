import { BodyInit, FilteredFetchArguments } from "@zcc/boilerplate";
import { ZCC } from "@zcc/utilities";

import { LIB_GOTIFY } from "../gotify.module.mjs";
import {
  Application,
  ApplicationParameters,
  Client,
  Message,
} from "../helpers/api.mjs";
import { BASE_URL, TOKEN } from "../helpers/config.constants.mjs";

export function GotifyFetch() {
  const baseUrl = LIB_GOTIFY.getConfig<string>(BASE_URL);
  const token = LIB_GOTIFY.getConfig<string>(TOKEN);

  async function fetch<T, BODY extends BodyInit = undefined>(
    fetchWith: FilteredFetchArguments<BODY>,
  ): Promise<T> {
    return await ZCC.fetch.fetch({
      ...fetchWith,
      baseUrl,
      headers: { ["X-Gotify-Key"]: token },
    });
  }

  return {
    application: {
      async create(body: ApplicationParameters): Promise<Application> {
        return await fetch({
          body: JSON.stringify(body),
          method: "post",
          url: `/application`,
        });
      },

      async delete(id: number): Promise<void> {
        return await fetch({
          method: "delete",
          url: `/application/${id}`,
        });
      },

      async deleteMessages(id: number): Promise<void> {
        return await fetch({
          method: "delete",
          url: `/application/${id}/message`,
        });
      },

      async getMessages(
        id: number,
        params?: { limit?: number; since?: number },
      ): Promise<Message[]> {
        return await fetch({
          params,
          url: `/application/${id}/message`,
        });
      },

      async list(): Promise<Application[]> {
        return await fetch({
          url: `/application`,
        });
      },

      async update(
        id: number,
        body: ApplicationParameters,
      ): Promise<Application> {
        return await fetch({
          body: JSON.stringify(body),
          method: "put",
          url: `/application/${id}`,
        });
      },
    },
    client: {
      async create(body: Client): Promise<Client> {
        return await fetch({
          body: JSON.stringify(body),
          method: "post",
          url: "/client",
        });
      },

      async delete(id: number) {
        return await fetch({
          method: "delete",
          url: `/client/${id}`,
        });
      },

      async list(): Promise<Client> {
        return await fetch({
          url: "/client",
        });
      },

      async update(id: number, body: Client): Promise<Client> {
        return await fetch({
          body: JSON.stringify(body),
          method: "put",
          url: `/client/${id}`,
        });
      },
    },
    fetch,
    message: {
      async create(body: Message): Promise<Message> {
        return await fetch({
          body: JSON.stringify(body),
          method: "post",
          url: "/message",
        });
      },

      async delete(id: number) {
        return await fetch({
          method: "delete",
          url: `/message/${id}`,
        });
      },

      async deleteAll() {
        return await fetch({
          method: "delete",
          url: `/message`,
        });
      },

      fetch,
      async list(): Promise<Message> {
        return await fetch({
          url: "/message",
        });
      },
    },
  };
}
