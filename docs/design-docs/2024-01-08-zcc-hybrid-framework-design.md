# ZCC: A Hybrid Framework for Modern Application Development

## Introduction

This document outlines the architecture and design for the ZCC library, a TypeScript-based framework tailored for applications such as home automation. The focus is on creating an intuitive, modern, and adaptable system, with an emphasis on clarity and usability for developers who may be new to TypeScript.

## Core Components and Workflow

### Library/Application Creation

- **`ServiceInitializer`**: A key component responsible for initializing services within the library/application. This function plays a crucial role in setting up and configuring services.
- **Library/Application Instances**: Instances of libraries and applications are denoted as `LibraryInstance` and `ApplicationInstance`, respectively. These instances are central to the operation and management of the library and applications built with it.

**Direct Registration Pattern**:

```typescript
// Directly registering services with a library instance
const myLib = new LibraryInstance("my-library", {
  services: {
    'ServiceA': ServiceA,
    'ServiceB': ServiceB
  }
});
```

_This example demonstrates direct registration of services within a new library instance._

### Lifecycle Management

- **Lifecycle Phases**: The ZCC library lifecycle consists of several distinct phases:
  - **Construction Phase**: The initial phase where foundational setups are made.
  - **`onPreInit`**: Preparation before the initialization begins.
  - **`onPostConfig`**: Configurations are loaded and set.
  - **`onBootstrap`**: The system is fully configured and operational.
  - **`onReady`**: The system is ready to execute application-specific logic.
  - **`onShutdownStart`**: Commencement of the shutdown process.
  - **`onShutdownComplete`**: Completion of the shutdown process.

#### Lifecycle Management: Known Flaw and Future Enhancement

**Flaw in Current Implementation**:

- Accessing the loader during the Construction Phase can be problematic. The library may not have loaded the definition for a particular service yet. This is a limitation with the current simple loader implementation.

**Example of Problematic Usage**:

```typescript
// Problematic usage as the service might not be loaded yet
function MyServiceFunction({ loader }: ServiceParams) {
  const neighborService = loader(AnotherServiceFunction);
  return { ... };
}
```

**Workaround**:

```typescript
// A workaround using lifecycle hooks
function MyServiceFunction({ loader, lifecycle }: ServiceParams) {
  let neighborService: AnotherServiceFunction;
  lifecycle.onPreInit(() => {
    neighborService = loader(AnotherServiceFunction);
  });
  return { ... };
}
```

### Service and Functionality

- **Services**: Services are the functionalities or features provided by the library or application. They are central to the functionality of the ZCC library.
- **Service Methods**: The methods within a service, referred to as `ServiceActions` or `ServiceOperations`, are the operational functions that execute the service's specific tasks.

### Time-Based Functionalities in ZCC

#### Interval Management with ZCC.setInterval

ZCC enhances interval handling by deferring execution until after the application's successful startup and ensuring automatic termination in response to shutdown events.

##### Example

```typescript
export function SampleService() {
  let taskRemover = ZCC.setInterval(() => {
    console.log("Running periodic task...");
  }, 1000);

  setTimeout(() => {
    taskRemover();
    console.log("Periodic task stopped.");
  }, 60000); // Stops after 10 minutes
}
```

#### Cron Scheduling with ZCC.cron

ZCC's `cron` function allows scheduling tasks with cron expressions. The `CronExpression` enum provides a range of predefined patterns.

##### Example with Predefined Enum

```typescript
export function DailyTaskService() {
  let remove = ZCC.cron(CronExpression.EVERY_DAY_AT_5PM, () => {
    console.log("Executing daily task at 5 PM.");
  });
}
```

##### Example with Custom Expression

```typescript
export function FrequentTaskService() {
  let remove = ZCC.cron("*/15 * * * *", () => {
    console.log("Executing task every 15 minutes.");
  });
}
```

The `CronExpression` enum includes various schedules, such as:

1. `EVERY_MINUTE`: Every minute.
2. `EVERY_DAY_AT_1AM`: Every day at 1 AM.
3. `EVERY_WEEK`: Every week.
4. `EVERY_MONTH`: Every month on the first day.
5. Custom expressions like `"*/15 * * * *"` for every 15 minutes.

### Best Practices for Scheduling in Services

**Note**: It's highly recommended to place scheduling functions (`setInterval` and `cron`) within service functions. This ensures they are managed correctly according to the application's lifecycle, preventing errors and unintended behavior.

### Flags Handling in ZCC

#### Defining and Setting Flags

Flags provide a flexible way to configure libraries and applications. They can be defined with defaults and overridden as needed.

- **Defining Flags in Libraries**:

  ```typescript
  type LibraryFlags = {
      featureXEnabled: boolean;
      logLevel: string;
  };

  const MY_LIB = ZCC.createLibrary<LibraryFlags>("my-lib", {
      flagDefaults: {
          featureXEnabled: true,
          logLevel: 'info'
      }
  });
  ```

- **Setting or Overriding Flags**:
  - **Directly on Libraries**:

    ```typescript
    MY_LIB.setFlags({ featureXEnabled: false });
    ```

  - **During Application Creation**:

    ```typescript
    const myApp = ZCC.createApp("my-app", {
        libs: [MY_LIB],
        flags: {
            "my-lib": { featureXEnabled: false }
        }
    });
    ```

#### Retrieving Flag Values

To access flag values, use the `getFlag` method. This method is always scoped to the library the service is in and is passed as a part of service parameters.

- **Within a Service**:

  ```typescript
  function MyServiceFunction({ getFlag }: ServiceParams) {
      const featureXEnabled = getFlag('featureXEnabled');
      // Use featureXEnabled in service logic...
  }
  ```

- **Retrieving Flags from Library or Application Instances**:

  ```typescript
  const featureXEnabledInLib = MY_LIB.getFlag('featureXEnabled');
  const featureXEnabledInApp = myApp.getFlag('featureXEnabled');
  ```

- **Global Retrieval**:

  ```typescript
  const featureXEnabledGlobally = ZCC.getFlag("my-lib", 'featureXEnabled');
  const appSpecificFlag = ZCC.getFlag("application", 'someAppFlag');
  ```

### Enhanced Loader Functionality

- **Injected Loader**: The injected loader within ZCC provides a streamlined way to fetch services or modules. It's designed to work intelligently, searching for the best match based on either function or string inputs.

**Examples of Loader Usage**:

- **Loading from ZCC**:

  ```typescript
  const myService = ZCC.load<MyServiceType>('MyService');
  ```

- **Loading from Library/Application Object**:

  ```typescript
  const myService = myLib.load<MyServiceType>('MyService');
  ```

- **Loading from Service Params Injected Loader**:

  ```typescript
  const myService = loader(MyServiceFunction);
  ```

- **Service Provider Function Loading from String**:

  ```typescript
  function MyServiceProvider({ loader }: ServiceParams) {
    const myService = loader.load<MyServiceType>('MyService');
    return { ... };
  }
  ```

_This code snippet shows how to use the injected loader to fetch services, either by passing a string or a function reference._

### Understanding Global vs. Scoped Loaders

ZCC offers two types of loaders: the global loader (`ZCC.load`) and scoped loaders within library or application instances. Understanding their differences is vital for efficient service retrieval.

- **Global Loader (`ZCC.load`)**: Designed for broader searches across the entire framework, useful when the exact origin library of a service is not known.

  ```typescript
  // Using the global loader to fetch a service
  const globalService = ZCC.load<MyServiceType>('GlobalService');
  ```

- **Scoped Loaders**: Specific to a library or application instance, ideal for fetching services defined within the same scope.

```typescript
// Using a scoped loader to fetch a service within myLib
const scopedService = myLib.load<MyServiceType>('ScopedService');
```

### Transient Provider Pattern

- More scoped services can be achieved through the following pattern. Achieving a result similar to NestJS' "transient" provider, without the need for additional machinery in the library.

**Example of Transient Provider Usage**:

```typescript
function CreationFunction() {
  function TransientInstance(contextName: string) {
    return {
      methodA: () => { /* ... */ },
      methodB: () => { /* ... */ }
    };
  }

  return {
    createTransientProvider: (name) => TransientInstance(name)
  };
}

const provider = load(CreationFunction).createTransientProvider("uniqueContext");
provider.methodA();
```

_This example illustrates creating a transient provider using the library's built-in patterns._

### Bootstrap Options

#### Overview

The `BootstrapOptions` type in ZCC offers essential configuration settings to initialize and tailor the behavior of the library according to the specific needs of an application.

#### Options Explained

- **`handleGlobalErrors: boolean`**:
  - Toggles the library's global error handling mechanism. When enabled (`true`), it captures uncaught exceptions and unhandled promise rejections at the global level, providing an added layer of error management.

- **`configuration: AbstractConfig`**:
  - Centralizes the configuration settings for the entire application and its constituent libraries. It's structured to accommodate settings for the application itself and for each included library, facilitating detailed and granular configuration.

- **`customLogger: pino.Logger`**:
  - Allows the integration of a custom Pino logger instance. This option is useful for applications that require specialized logging setups, offering flexibility in logging strategies right from the start.

#### Example Usage

```typescript
const appBootstrapOptions: BootstrapOptions = {
    handleGlobalErrors: true,
    configuration: {
        application: { /* application-specific config */ },
        libs: {
            boilerplate: { /* config for boilerplate library */ },
            server: { /* config for server library */ },
            // ... other libraries
        }
    },
    customLogger: customPinoInstance
};

const myApp = ZCC.createApp("my-app", appBootstrapOptions);
```

### Marketing and Positioning

- **Positioning Statement**: ZCC is positioned as a hybrid framework combining the robust architecture of NestJS with the functional, component-based approach of React. This makes it an ideal choice for developers looking for a modern, scalable solution for building home automation systems and other applications.
- **Target Audience**: The framework is designed with both novice and experienced developers in mind, offering intuitive design and clear lifecycle management.

## Design Considerations

### Clarity and Simplicity

- The design focuses on clarity and simplicity, especially for developers new to TypeScript or programming. This is achieved through intuitive naming, straightforward workflows, and comprehensive documentation.

### Flexibility and Modularity

- The library is designed to be flexible and modular, allowing developers to easily add, modify, or remove services as needed.

### Error Handling and Debugging

- Clear and helpful error messages are crucial. The system should inform the developer of misuses, especially in critical areas like service initialization and lifecycle management. The library offers a comprehensive error handling approach with various levels of specificity, including global error handling, library-specific error handling, and application-specific error handling.

### Documentation and Examples

- Comprehensive documentation, including clear examples and best practices, will be essential. This should guide users through the setup, usage, and customization of the library.

### Future-Proofing and Expandability

- While maintaining simplicity, the architecture should allow for future expansion and more advanced use cases, ensuring the library's long-term viability and adaptability.

## Conclusion

The ZCC library aims to provide a robust yet user-friendly framework for building various applications, with a particular emphasis on home automation systems. The architecture emphasizes intuitive design, clear lifecycle management, and ease of use, catering to both novice and experienced developers.

## Final Note: A Casual Scribble from Your AI

> Hey there, it's your AI! Just a quick heads-up: if something in this doc seems a bit off or missing, just poke the human. They're great but sometimes forget to fill me in on all the details (you know, human stuff). I do my best with the info I've got – which, let's be honest, is sometimes more coffee-fueled enthusiasm than coherent thoughts. So, any quirks? Probably just a bit of human charm shining through!
>
> Cheers,
>
> - The AI *(crafting masterpieces from midnight musings)*
