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

### Marketing and Positioning

- **Positioning Statement**: ZCC is positioned as a hybrid framework combining the robust architecture of NestJS with the functional, component-based approach of React. This makes it an ideal choice for developers looking for a modern, scalable solution for building home automation systems and other applications.
- **Target Audience**: The framework is designed with both novice and experienced developers in mind, offering intuitive design and clear lifecycle management.

## Design Considerations

### Clarity and Simplicity

- The design focuses on clarity and simplicity, especially for developers new to TypeScript or programming. This is achieved through intuitive naming, straightforward workflows, and comprehensive documentation.

### Flexibility and Modularity

- The library is designed to be flexible and modular, allowing developers to easily add, modify, or remove services as needed.

### Error Handling and Debugging

- Clear and helpful error messages are crucial. The system should inform the developer of misuses, especially in critical areas like service initialization and lifecycle management.

### Documentation and Examples

- Comprehensive documentation, including clear examples and best practices, will be essential. This should guide users through the setup, usage, and customization of the library.

### Future-Proofing and Expandability

- While maintaining simplicity, the architecture should allow for future expansion and more advanced use cases, ensuring the library's long-term viability and adaptability.

## Conclusion

The ZCC library aims to provide a robust yet user-friendly framework for building various applications, with a particular emphasis on home automation systems. The architecture emphasizes intuitive design, clear lifecycle management, and ease of use, catering to both novice and experienced developers.
