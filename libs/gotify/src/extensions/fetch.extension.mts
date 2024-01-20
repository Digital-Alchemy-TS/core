import {
  FilteredFetchArguments,
  TFetchBody,
  TServiceParams,
} from "@zcc/boilerplate";
import { ZCC } from "@zcc/utilities";

import {
  Application,
  ApplicationParameters,
  Client,
  Message,
} from "../helpers/api.mjs";
import { BASE_URL, TOKEN } from "../helpers/config.constants.mjs";

export function GotifyFetch({
  logger,
  getConfig,
  lifecycle,
  context,
}: TServiceParams) {
  let baseUrl: string;
  let token: string;
  const fetcher = ZCC.createFetcher({ context }).fetch;

  lifecycle.onPostConfig(() => {
    baseUrl = getConfig<string>(BASE_URL);
    token = getConfig<string>(TOKEN);
  });

  async function fetch<T, BODY extends TFetchBody = undefined>(
    fetchWith: FilteredFetchArguments<BODY>,
  ): Promise<T> {
    return await fetcher({
      ...fetchWith,
      baseUrl,
      headers: { ["X-Gotify-Key"]: token },
    });
  }

  const gotify = {
    application: {
      async create(body: ApplicationParameters): Promise<Application> {
        logger.trace(`application create`);
        return await fetch({
          body,
          method: "post",
          url: `/application`,
        });
      },

      async delete(id: number): Promise<void> {
        logger.trace(`application delete`);
        return await fetch({
          method: "delete",
          url: `/application/${id}`,
        });
      },

      async deleteMessages(id: number): Promise<void> {
        logger.trace(`application deleteMessages`);
        return await fetch({
          method: "delete",
          url: `/application/${id}/message`,
        });
      },

      async getMessages(
        id: number,
        params?: { limit?: number; since?: number },
      ): Promise<Message[]> {
        logger.trace(`application getMessages`);
        return await fetch({
          params,
          url: `/application/${id}/message`,
        });
      },

      async list(): Promise<Application[]> {
        logger.trace(`application list`);
        return await fetch({
          url: `/application`,
        });
      },

      async update(
        id: number,
        body: ApplicationParameters,
      ): Promise<Application> {
        logger.trace(`application update`);
        return await fetch({
          body,
          method: "put",
          url: `/application/${id}`,
        });
      },
    },
    client: {
      async create(body: Client): Promise<Client> {
        logger.trace(`client create`);
        return await fetch({
          body,
          method: "post",
          url: "/client",
        });
      },

      async delete(id: number) {
        logger.trace(`client delete`);
        return await fetch({
          method: "delete",
          url: `/client/${id}`,
        });
      },

      async list(): Promise<Client> {
        logger.trace(`client list`);
        return await fetch({
          url: "/client",
        });
      },

      async update(id: number, body: Client): Promise<Client> {
        logger.trace(`client update`);
        return await fetch({
          body,
          method: "put",
          url: `/client/${id}`,
        });
      },
    },
    fetch,
    message: {
      async create(body: Message): Promise<Message> {
        logger.trace(`message create`);
        return await fetch({
          body,
          method: "post",
          url: "/message",
        });
      },

      async delete(id: number) {
        logger.trace(`message delete`);
        return await fetch({
          method: "delete",
          url: `/message/${id}`,
        });
      },

      async deleteAll() {
        logger.trace(`message deleteAll`);
        return await fetch({
          method: "delete",
          url: `/message`,
        });
      },

      async list(): Promise<Message> {
        logger.trace(`message list`);
        return await fetch({
          url: "/message",
        });
      },
    },
  };

  ZCC.gotify = gotify;

  return gotify;
}

type GotifyApplication = {
  create(body: ApplicationParameters): Promise<Application>;
  delete(id: number): Promise<void>;
  deleteMessages(id: number): Promise<void>;
  getMessages(
    id: number,
    params?: {
      limit?: number;
      since?: number;
    },
  ): Promise<Message[]>;
  list(): Promise<Application[]>;
  update(id: number, body: ApplicationParameters): Promise<Application>;
};
type GotifyClient = {
  create(body: Client): Promise<Client>;
  delete(id: number): Promise<unknown>;
  list(): Promise<Client>;
  update(id: number, body: Client): Promise<Client>;
};
type GotifyMessage = {
  create(body: Message): Promise<Message>;
  delete(id: number): Promise<unknown>;
  deleteAll(): Promise<unknown>;
  list(): Promise<Message>;
};
type GotifyDefinition = {
  application: GotifyApplication;
  client: GotifyClient;
  message: GotifyMessage;
};

declare module "@zcc/utilities" {
  export interface ZCCDefinition {
    gotify: GotifyDefinition;
  }
}
