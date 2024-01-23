import {
  FilteredFetchArguments,
  LIB_BOILERPLATE,
  TFetchBody,
  TServiceParams,
} from "@zcc/boilerplate";
import { ZCC } from "@zcc/utilities";

import { LIB_GOTIFY } from "../gotify.module.mjs";

export function GotifyFetch({ lifecycle, context }: TServiceParams) {
  let baseUrl: string;
  let token: string;
  const fetcher = ZCC.createFetcher({ context }).fetch;

  lifecycle.onPostConfig(() => {
    baseUrl = LIB_GOTIFY.getConfig("BASE_URL");
    token = LIB_GOTIFY.getConfig("TOKEN");
  });

  return async function fetch<T, BODY extends TFetchBody = undefined>(
    fetchWith: Partial<FilteredFetchArguments<BODY>>,
  ): Promise<T> {
    return await fetcher({
      ...fetchWith,
      baseUrl,
      headers: { ["X-Gotify-Key"]: token },
    });
  };
}
