import { TServiceParams, ZCC } from "../..";

export function GotifyFetch({ context, config, lifecycle }: TServiceParams) {
  const fetcher = ZCC.createFetcher({ context });

  lifecycle.onPostConfig(() => {
    fetcher.setBaseUrl(config.gotify.BASE_URL);
    fetcher.setHeaders({ ["X-Gotify-Key"]: config.gotify.TOKEN });
  });

  return fetcher.fetch;
}
