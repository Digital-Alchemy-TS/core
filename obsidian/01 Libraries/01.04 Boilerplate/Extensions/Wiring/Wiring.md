- [[Lifecycle]]
- [[Safe Execution]]

## Overview

The wiring extension is responsible for defining and coordinating module level interactions. It works through a coordinated set of wiring functions, and utility types.

## Design Goals

> [!abstract] Some considerations that were taken in the design of the wiring system

This library has it's motivations originating from the architecturally unfixable problems with the previous Digital Alchemy project, which was based on NestJS

### Single Point Type Definitions

Everything that is "public" for a module is exported from a single point. This is done in a way that be processed by utility types to automatically provide new type definitions to application code. 

Exported configurations are automatically attached to an injected `config` variable.

Exported definitions are passed in through a new property on [[TServiceParams]]. This is done through #Typescript/Declaration-Merging

#### Circular References

#### Automatic updates

Adjustments to public definitions should not require a 2nd code change. The act of adding a new config / service / method to the public module automatically updates all references. There isn't a 2nd/3rd/nth spot to also update in addition, or any code to process the update and write back a definitions file.

### Low Imports

General effort to avoid the usage of `import` statements by the end application. Needed functions are readily on hand and strongly typed

### Strong Typing

Strict mode typescript on through the repo. A general goal to be more exact with type definitions where possible

### Grammar

Some portions of the code are built with the help of #Javascript/Proxy objects to fill some "magic" definitions

## Code Examples

In the below examples, libraries are being defined, and loaded via the module declaration immediately below the definition. The declaration provides library services information about themselves in a semi-circular fashion. This allows for strongly typed configurations, and api injection

### Configuration

> [!example] Configuration pass through

**Definition**
```typescript
export const LIB_MQTT = CreateLibrary({
  configuration: {
    CLIENT_OPTIONS: {
      default: {
        host: "localhost",
        password: undefined,
        port: 1883,
      } as IClientOptions,
      description: "See IClientOptions in mqtt npm package",
      type: "internal",
    },
  },
  name: "mqtt",
});

// Attach to definitions
declare module "../boilerplate" {
  export interface LoadedModules {
    mqtt: typeof LIB_MQTT;
  }
}
```
**Access**
```typescript
function MyService({ config, lifecycle }: TserviceParams) {
  let client: MqttClient;
  lifecycle.onPostConfig(async () => {
    client = await connectAsync({
      // IClientOptions type passed through from library, no casting, parameters, or imports needed
      ...config.mqtt.CLIENT_OPTIONS,
    });
    logger.info("MQTT Connected");
  });
}
```

### Services

> [!example] Service API

**Module Attachment**

```typescript
export const LIB_GOTIFY = CreateLibrary({
  configuration: {
    BASE_URL: {
      description: "Base URL for server",
      type: "string",
    },
    TOKEN: {
      description: "Application token",
      type: "string",
    },
  },
  name: "gotify",
  services: {
  // defines the property by which each service attaches to the injected api
    application: GotifyApplication,
    client: GotifyClient,
    fetch: GotifyFetch,
    message: GotifyMessage,
  },
});

declare module "../boilerplate" {
  export interface LoadedModules {
    gotify: typeof LIB_GOTIFY;
  }
}
```

> [!tip] Define a function as the service return

Services returning functions are supported, this can be used to provide config wrappers. 

```typescript
export function GotifyFetch({ context, config }: TServiceParams) {
  const fetcher = ZCC.createFetcher({ context }).fetch;

  // Don't call this before the onPostConfig lifecycle event!
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
```

> [!tip] Return an object as the service return

Services returning objects are supported, for creating multiple methods within a single group

```typescript
export function GotifyMessage({ logger, gotify }: TServiceParams) {
  return {
    async create(body: Message): Promise<Message> {
      logger.trace(`message create`);
      // Using the fetcher defined in GotifyFetch, without an explicit import in this file
      return await gotify.fetch({
        body,
        method: "post",
        url: "/message",
      });
    },
    // ...
  };
}

export function ConsumerService({ gotify }: TServiceParams) {
	OnSomeEvent(async () => {
	    // access the create method
		await gotify.message.create({ ... })
	})
}

```


> [!question] Other return types

Services with other return types are not included in injected definitions

### Loading by consuming applications

The declaration merging code is intended to load the relevant module, but it only occurs if the there is code in the end application (or extending library) directly referencing it. The project needs to be included in the list of libraries loaded to properly have the bootstrap process properly pass it through