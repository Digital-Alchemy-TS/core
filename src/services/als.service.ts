import { AsyncLocalStorage } from "async_hooks";

import { AlsExtension, AsyncLocalData, AsyncLogData, TBlackHole } from "../helpers";

export function ALS(): AlsExtension {
  const storage = new AsyncLocalStorage<AsyncLocalData>();
  return {
    asyncStorage: () => storage,
    enterWith(data) {
      storage.enterWith(data);
    },
    getLogData: () => storage.getStore()?.logs ?? ({} as AsyncLogData),
    getStore: () => storage.getStore(),
    run(data: AsyncLocalData, callback: () => TBlackHole) {
      storage.run(data, () => {
        callback();
      });
    },
  };
}
