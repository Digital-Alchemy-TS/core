import {
  FilteredFetchArguments,
  TFetchBody,
  TServiceParams,
} from "../../boilerplate";
import { ZCC } from "../../utilities";

export function GotifyFetch({ context, config }: TServiceParams) {
  const fetcher = ZCC.createFetcher({ context }).fetch;

  return async function fetch<T, BODY extends TFetchBody = undefined>(
    fetchWith: Partial<FilteredFetchArguments<BODY>>,
  ): Promise<T> {
    return await fetcher({
      ...fetchWith,
      baseUrl: config.gotify.BASE_URL,
      headers: { ["X-Gotify-Key"]: config.gotify.TOKEN },
    });
  };
}
