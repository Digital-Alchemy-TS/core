
# @zcc Error Handling Documentation

## Overview

This document outlines the error handling strategy within the @zcc library, detailing the custom error classes, their intended use, and best practices for interaction. The @zcc library is designed to throw errors primarily during the bootstrap phase, with runtime errors being logged rather than thrown, ensuring smooth operation and stability.

### Error Classes Format

Each error class in the @zcc library follows a standardized format:

- **Context**: Indicates where the error occurred, typically a module or function name.
- **Cause**: Specific reason or trigger for the error (mainly used in `BootstrapException` and `InternalError`).
- **Message**: Clear, concise description of the error.
- **Timestamp**: Precise time when the error was created, aiding in debugging.

### General Usage

1. **BootstrapException**: Thrown during the initialization phase for issues preventing proper startup.
2. **InternalError**: Used for unexpected issues post-initialization, indicating internal logic or state problems.
3. **FetchRequestError**: Specific to network request errors, particularly for external API interactions.

## Boilerplate Library Errors

The boilerplate library, being foundational, throws errors mainly during the bootstrap phase. Here are the errors it can throw, along with best practices and examples.

### 1. BootstrapException

Use for initialization and setup phase errors.

**Example Message**:

> [BootstrapException] Context: ConfigLoader, Cause: MissingConfig, Message: Configuration file not found | Timestamp: 2021-07-01T12:00:00.000Z

### 2. InternalError

Utilize for unexpected internal issues.

**Example Message**:

> [InternalError] Context: ServiceManager, Cause: InconsistentState, Message: Service state is invalid | Timestamp: 2021-07-01T12:00:00.000Z

### 3. FetchRequestError

Employ for handling errors related to network fetch requests.

**Example Message**:

> [FetchRequestError - 404] Error: NotFound, Message: Requested resource not found | Timestamp: 2021-07-01T12:00:00.000Z

## Boilerplate Library Errors (Continued)

Following the `FetchRequestError`, the boilerplate library includes several more error classes tailored to its specific features.

### 4. CacheError

Used for issues related to the caching mechanisms.

**Example Message**:

> [CacheError] Context: RedisCache, Message: Failed to connect to Redis server | Timestamp: 2021-07-01T12:00:00.000Z

**Best Practice**: Use this error for problems directly associated with cache operations, such as connection failures, serialization issues, or read/write errors. Note that runtime cache misses are not treated as errors but are handled gracefully.

### 5. ConfigError

Employed for problems encountered with configuration loading or parsing.

**Example Message**:

> [ConfigError] Context: ConfigParser, Message: Invalid configuration format | Timestamp: 2021-07-01T12:00:00.000Z

**Best Practice**: Utilize this error for issues related to loading, parsing, or validating configuration files or data. It's essential for quickly identifying misconfigurations or data format issues.

### 6. CronError

Specific to issues in cron job setup or execution.

**Example Message**:

> [CronError] Context: Scheduler, Message: Invalid cron pattern provided | Timestamp: 2021-07-01T12:00:00.000Z

**Best Practice**: Use this error for errors related to setting up cron jobs or issues encountered during their execution. This includes invalid cron patterns, scheduling conflicts, or execution failures.

## Home Assistant Library Errors

The Home Assistant library will have its own set of errors, relevant to its specific functionalities.

### 1. HomeAssistantFetchError

Used for errors in network requests to the Home Assistant API.

**Example Message**:

> [HomeAssistantFetchError - 401] Error: Unauthorized, Message: Invalid token, authentication failed | Timestamp: 2021-07-01T12:00:00.000Z

**Best Practice**: Employ this error for handling all types of HTTP errors encountered when interacting with the Home Assistant API, including authentication issues, resource not found, or server errors. This error should contain sufficient information to understand the HTTP context and the nature of the error.
