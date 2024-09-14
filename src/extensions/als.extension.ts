import { AsyncLocalStorage } from "async_hooks";
import { v4 } from "uuid";

import { AlsExtension, AlsHook, AsyncLocalData, TBlackHole, TServiceParams } from "../helpers";
import { is } from "./is.extension";

export function ALS({ internal }: TServiceParams): AlsExtension {
  const storage = new AsyncLocalStorage<AsyncLocalData>();
  const hooks = new Set<AlsHook>();

  // internal.boilerplate.logger.merge(() => {
  //   const data = storage.getStore();
  //   if (!is.empty(data?.logs?.id)) {
  //     return { async_id: data?.logs?.id };
  //   }
  //   return {};
  // });

  return {
    asyncStorage: () => storage,
    getStore: () => storage.getStore(),
    init(callback: () => TBlackHole) {
      let data = { logs: { id: v4() } };
      hooks.forEach(callback => {
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
