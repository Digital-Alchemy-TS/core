import { AsyncLocalStorage } from "async_hooks";

import { AlsHook, AsyncLocalData, TBlackHole } from "../helpers";

export function ALS() {
  const storage = new AsyncLocalStorage<AsyncLocalData>();
  const hooks = new Set<AlsHook>();

  return {
    getStorage: () => storage,
    init(callback: () => TBlackHole) {
      let data = {id:v4};
      hooks.forEach((callback) => {
        data = { ...data, ...callback() };
      });
      storage.run(data as AsyncLocalData, () => {
        callback();
      });
    },
    register(callback: AlsHook) {
      hooks.add(callback);
    },
  };
}
