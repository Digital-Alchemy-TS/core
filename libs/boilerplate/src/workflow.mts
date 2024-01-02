import { eachSeries, ZCC } from "@zcc/utilities";

import { BootstrapOptions } from "./bootstrap.mjs";

const NONE = -1;

async function Bootstrap(
  application: string,
  options: BootstrapOptions,
): Promise<void> {
  // const configDefaults = {
  //   provide: CONFIG_DEFAULTS,
  //   useValue: bootOptions?.application?.config ?? {},
  // };
  // globals.exports.push(configDefaults);
  // globals.providers.push(configDefaults);
  // // * Pull data out of the bootstrap config
  // const {
  //   logging: { prettyLog = false, nestNoopLogger = false } = {},
  //   http: { cors = true, enabled: httpEnabled = false } = {},
  //   lifecycle: { init = true, preInit = [], postInit = [] } = {},
  // } = bootOptions;
  // // * Updates to the logger
  // if (prettyLog && supportsColor) {
  //   UsePrettyLogger(is.object(prettyLog) ? prettyLog : undefined);
  // }
  // // * Set up the actual nest application
  // let server: Express;
  // const options = {
  //   cors,
  //   // Shh... no talky
  //   logger: nestNoopLogger ? NEST_NOOP_LOGGER : AutoLogService.nestLogger,
  // };
  // let app: INestApplication;
  // try {
  //   if (httpEnabled) {
  //     server = express();
  //     app = await NestFactory.create(
  //       application,
  //       new ExpressAdapter(server),
  //       options,
  //     );
  //   } else {
  //     app = await NestFactory.create(application, options);
  //   }
  // } catch (error) {
  //   // eslint-disable-next-line no-console
  //   console.error(error);
  // }
  // if (init === false) {
  //   return app;
  // }
  // const logger = await app.resolve(AutoLogService);
  // logger.setContext(LIB_BOILERPLATE, { name: "Bootstrap" });
  // // * additional lifecycle events
  // app.enableShutdownHooks();
  // // * kick off the lifecycle
  // const lifecycle = app.get(LifecycleService);
  // const explorer = await app.resolve(LogExplorerService);
  // logger.trace(`Pre loading log context`);
  // explorer.load();
  // // * preInit
  // logger.trace(`preInit`);
  // await eachSeries(preInit, async item => {
  //   await item(app, server, bootOptions);
  // });
  // await lifecycle.preInit(app, { options: bootOptions, server });
  // // * init
  // // onModuleCreate
  // // onApplicationBootstrap
  // logger.trace(`init`);
  // await app.init();
  // // * postInit
  // logger.trace(`postInit`);
  // await eachSeries(postInit, async item => {
  //   await item(app, server, bootOptions);
  // });
  // await lifecycle.postInit(app, { options: bootOptions, server });
  // // ? done !
  // return app;
}

type LifecycleCallback = () => void | Promise<void>;
type CallbackList = [LifecycleCallback, number][];

async function RunCallbacks(list: CallbackList) {
  await eachSeries(list, async ([callback]) => {
    await callback();
  });
  //
}

function CreateLifecycle() {
  const preInitCallbacks: CallbackList = [];
  const bootstrapCallbacks: CallbackList = [];
  const postInitCallbacks: CallbackList = [];
  const readyCallbacks: CallbackList = [];

  return {
    async exec(): Promise<void> {
      await eachSeries(
        [
          preInitCallbacks,
          bootstrapCallbacks,
          postInitCallbacks,
          readyCallbacks,
        ],
        async i => await RunCallbacks(i),
      );
    },
    onBootstrap: (callback: LifecycleCallback, priority = NONE) =>
      bootstrapCallbacks.push([callback, priority]),
    onPostInit: (callback: LifecycleCallback, priority = NONE) =>
      postInitCallbacks.push([callback, priority]),
    onPreInit: (callback: LifecycleCallback, priority = NONE) =>
      preInitCallbacks.push([callback, priority]),
    onReady: (callback: LifecycleCallback, priority = NONE) =>
      readyCallbacks.push([callback, priority]),
  };
}

declare module "@zcc/utilities" {
  export interface ZCC_Definition {
    bootstrap: typeof Bootstrap;
    lifecycle: ReturnType<typeof CreateLifecycle>;
  }
}
ZCC.bootstrap = Bootstrap;
ZCC.lifecycle = CreateLifecycle();
