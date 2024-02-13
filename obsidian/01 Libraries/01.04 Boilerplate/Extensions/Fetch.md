```typescript
export function GotifyFetch({ context, config, lifecycle }: TServiceParams) {
  const fetcher = ZCC.createFetcher({ context });

  lifecycle.onPostConfig(() => {
    fetcher.setBaseUrl(config.gotify.BASE_URL);
    fetcher.setHeaders({ ["X-Gotify-Key"]: config.gotify.TOKEN });
  });

  return {
    async callMyService() {
      await fetcher.fetch({
        method: "post",
        url: "/api/service",
      });
    },
  };
}
```
