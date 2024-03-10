import { TServiceParams } from "../..";

export function GotifyFetch({
  context,
  config,
  lifecycle,
  internal,
}: TServiceParams) {
  const fetcher = internal.createFetcher({ context });

  lifecycle.onPostConfig(() => {
    fetcher.setBaseUrl(config.gotify.BASE_URL);
    fetcher.setHeaders({ ["X-Gotify-Key"]: config.gotify.TOKEN });
  });

  return fetcher.fetch;
}
