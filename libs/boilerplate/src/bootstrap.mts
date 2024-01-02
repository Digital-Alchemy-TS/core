import { Express } from "express";

import { PrettyLoggerConfig } from "./pretty-logger.mjs";
import { AbstractConfig } from "./types/configuration.mjs";

export interface BootstrapOptions {
  /**
   * Changes to the way the application is wired & defaults
   */
  application?: {
    /**
     * Provide alternate default values for configurations.
     * Takes priority over definitions from `@InjectConfig` and modules.
     * Overridden by all user values.
     */
    config?: AbstractConfig;
    /**
     * Ignore user provided configuration values.
     * Only use defaults / bootstrap provided config
     */
    skipConfigLoad?: boolean;
  };
  http?: {
    /**
     * Server is cors enabled
     *
     * default: true
     */
    cors?: boolean;
    /**
     * Attach express to the nestjs app.
     * `ServerModule` from `@digital-alchemy/server` needs to be imported to actually listen for requests
     */
    enabled?: boolean;
  };
  /**
   * Modify the application lifecycle
   */
  lifecycle?: {
    /**
     * If set to false, the application module be created but not initialized.
     * Testing feature
     */
    init?: boolean;
    /**
     * Additional functions to run postInit.
     * First in line
     */
    postInit?: ((
      expressServer: Express,
      bootOptions: BootstrapOptions,
    ) => Promise<void> | void | unknown | Promise<unknown>)[];
    /**
     * Additional functions to run preInit.
     * First in line
     */
    preInit?: ((
      expressServer: Express,
      bootOptions: BootstrapOptions,
    ) => Promise<void> | void)[];
  };
  /**
   * Options to fine tune the logging experience
   */
  logging?: {
    /**
     * Disable nestjs log messages
     */
    nestNoopLogger?: boolean;
    /**
     * Output logs using the pretty logger formatter instead of standard json logs.
     * Use with development environments only
     */
    prettyLog?: boolean | PrettyLoggerConfig;

    /**
     * Log with blocking operations (default: false).
     *
     * Logging library does async logging for performance reasons.
     * This can cause logs to render in strange ways when used with `@digital-alchemy/tty`.
     * Forcing sync logs will resolve.
     *
     * Has a performance penalty for more traditional applications.
     * Leave on for most normal nodejs applications
     */
    sync?: boolean;
  };
}
