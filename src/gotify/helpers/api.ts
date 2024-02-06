/* eslint-disable @typescript-eslint/no-magic-numbers */
/* eslint-disable sonarjs/cognitive-complexity */
/* eslint-disable @typescript-eslint/member-ordering */

export enum MessagePriority {
  min = 0,
  low = 3,
  normal = 6,
  high = 9,
}

/**
 * The Application holds information about an app which can send notifications.
 */
export interface Application {
  /**
   * The description of the application.
   * @example Backup server for the interwebs
   */
  description: string;

  /**
   * The application id.
   * @format int64
   * @example 5
   */
  id: number;

  /**
   * The image of the application.
   * @example image/image.jpeg
   */
  image: string;

  /**
   * Whether the application is an internal application. Internal applications should not be deleted.
   * @example false
   */
  internal: boolean;

  /**
   * The application name. This is how the application should be displayed to the user.
   * @example Backup Server
   */
  name: string;

  /**
   * The application token. Can be used as `appToken`. See Authentication.
   * @example AWH0wZ5r0Mac.r
   */
  token: string;
}

/**
 * Params allowed to create or update Applications
 */
export interface ApplicationParameters {
  /**
   * The description of the application.
   * @example Backup server for the interwebs
   */
  description?: string;

  /**
   * The application name. This is how the application should be displayed to the user.
   * @example Backup Server
   */
  name: string;
}

/**
 * The Client holds information about a device which can receive notifications (and other stuff).
 */
export interface Client {
  /**
   * The client id.
   * @format int64
   * @example 5
   */
  id: number;

  /**
   * The client name. This is how the client should be displayed to the user.
   * @example Android Phone
   */
  name: string;

  /**
   * The client token. Can be used as `clientToken`. See Authentication.
   * @example CWH0wZ5r0Mac.r
   */
  token: string;
}

/**
 * The Error contains error relevant information.
 */
export interface Error {
  /**
   * The general error message
   * @example Unauthorized
   */
  error: string;

  /**
   * The http error code.
   * @format int64
   * @example 401
   */
  errorCode: number;

  /**
   * The http error code.
   * @example you need to provide a valid access token or user credentials to access this api
   */
  errorDescription: string;
}

/**
 * Health represents how healthy the application is.
 */
export interface Health {
  /**
   * The health of the database connection.
   * @example green
   */
  database: string;

  /**
   * The health of the overall application.
   * @example green
   */
  health: string;
}

export interface MessageExtra {
  "android::action"?: {
    onReceive?: {
      intentUrl: string;
    };
  };
  "client::display"?: {
    contentType: "text/plain" | "text/markdown";
  };
  "client::notification"?: {
    bigImageUrl?: string;
    click?: {
      url: string;
    };
  };
}

/**
 * The MessageExternal holds information about a message which was sent by an Application.
 */
export interface Message {
  /**
   * The application id that send this message.
   * @format int64
   * @example 5
   */
  appid?: number;

  /**
   * The date the message was created.
   * @format date-time
   * @example 2018-02-27T19:36:10.5045044+01:00
   */
  date?: string;

  /**
   * The extra data sent along the message.
   *
   * The extra fields are stored in a key-value scheme. Only accepted in CreateMessage requests with application/json content-type.
   * The keys should be in the following format: &lt;top-namespace&gt;::[&lt;sub-namespace&gt;::]&lt;action&gt;
   * These namespaces are reserved and might be used in the official clients: gotify android ios web server client. Do not use them for other purposes.
   * @example {"home::appliances::lighting::on":{"brightness":15},"home::appliances::thermostat::change_temperature":{"temperature":23}}
   */
  extras?: MessageExtra;

  /**
   * The message id.
   * @format int64
   * @example 25
   */
  id?: number;

  /**
   * The message. Markdown (excluding html) is allowed.
   * @example **Backup** was successfully finished.
   */
  message: string;

  /**
   * The priority of the message.
   * @format int64
   * @example 2
   */
  priority?: MessagePriority;

  /**
   * The title of the message.
   * @example Backup
   */
  title?: string;
}

/**
 * Wrapper for the paging and the messages
 */
export interface PagedMessages {
  /** The messages. */
  messages: Message[];

  /** The Paging holds information about the limit and making requests to the next page. */
  paging: Paging;
}

/**
 * The Paging holds information about the limit and making requests to the next page.
 */
export interface Paging {
  /**
   * The limit of the messages for the current request.
   * @format int64
   * @min 1
   * @max 200
   * @example 123
   */
  limit: number;

  /**
   * The request url for the next page. Empty/Null when no next page is available.
   * @example http://example.com/message?limit=50&since=123456
   */
  next?: string;

  /**
   * The ID of the last message returned in the current request. Use this as alternative to the next link.
   * @format int64
   * @min 0
   * @example 5
   */
  since: number;

  /**
   * The amount of messages that got returned in the current request.
   * @format int64
   * @example 5
   */
  size: number;
}

/**
 * Holds information about a plugin instance for one user.
 */
export interface PluginConfig {
  /**
   * The author of the plugin.
   * @example zoe-codez
   */
  author?: string;

  /**
   * Capabilities the plugin provides
   * @example ["webhook","display"]
   */
  capabilities: string[];

  /**
   * Whether the plugin instance is enabled.
   * @example true
   */
  enabled: boolean;

  /**
   * The plugin id.
   * @format int64
   * @example 25
   */
  id: number;

  /**
   * The license of the plugin.
   * @example MIT
   */
  license?: string;

  /**
   * The module path of the plugin.
   * @example github.com/gotify/server/plugin/example/echo
   */
  modulePath: string;

  /**
   * The plugin name.
   * @example RSS poller
   */
  name: string;

  /**
   * The user name. For login.
   * @example P1234
   */
  token: string;

  /**
   * The website of the plugin.
   * @example gotify.net
   */
  website?: string;
}

/**
 * The User holds information about permission and other stuff.
 */
export interface User {
  /**
   * If the user is an administrator.
   * @example true
   */
  admin?: boolean;

  /**
   * The user id.
   * @format int64
   * @example 25
   */
  id: number;

  /**
   * The user name. For login.
   * @example unicorn
   */
  name: string;
}

/**
 * The Password for updating the user.
 */
export interface UserPass {
  /**
   * The user password. For login.
   * @example hunter2
   */
  pass: string;
}

/**
 * The UserWithPass holds information about the credentials and other stuff.
 */
export interface UserWithPass {
  /**
   * If the user is an administrator.
   * @example true
   */
  admin?: boolean;

  /**
   * The user id.
   * @format int64
   * @example 25
   */
  id: number;

  /**
   * The user name. For login.
   * @example unicorn
   */
  name: string;

  /**
   * The user password. For login.
   * @example hunter2
   */
  pass: string;
}

/**
 * VersionInfo Model
 */
export interface VersionInfo {
  /**
   * The date on which this binary was built.
   * @example 2018-02-27T19:36:10.5045044+01:00
   */
  buildDate: string;

  /**
   * The git commit hash on which this binary was built.
   * @example ae9512b6b6feea56a110d59a3353ea3b9c293864
   */
  commit: string;

  /**
   * The current version.
   * @example 5.2.6
   */
  version: string;
}
