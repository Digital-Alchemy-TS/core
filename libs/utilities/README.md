# 🛠️ Utilities Library README

## Overview 💡

This Utilities Library is a compact yet versatile toolkit designed for various utility functions and helpers in JavaScript programming. It's a foundational library, ensuring other parts of your project can depend on it without internal dependencies.

## ⭐ Library Features

1. **📌 Named Constants**: Common variables for internal library consistency and optional external use.
2. **🪄 Helper Functions**: Basic utilities, including sleep and cron, for optional utility enhancement.
3. **🔍 `is` Object**: Versatile type-checking toolkit, augment-friendly for custom validations.
4. **📡 `ZCC` Object**: Central hub for library augmentation and cross-module integration.

## 🧩 Augmentation

### Augmenting `ZCC`

To augment the ZCC object, you can add new properties or methods that extend its functionality. Below is an example of augmenting ZCC with a new method for handling custom events.

```typescript
import { ZCC } from "@zcc/utilities";

function createFeatureTracker() {
  const features = new Map();

  return {
    enableFeature: (featureName) => {
      features.set(featureName, true);
    },
    disableFeature: (featureName) => {
      features.set(featureName, false);
    },
    isFeatureEnabled: (featureName) => {
      return features.get(featureName) || false;
    },
  };
}

declare module "@zcc/utilities" {
  export interface ZCCDefinition {
    featureTracker: ReturnType<typeof createFeatureTracker>;
  }
}

// Adding featureTracker to ZCC
ZCC.featureTracker = createFeatureTracker();
```

### Augmenting `is`

Similarly, augmenting the is object allows adding new type-checking functions or other utilities. Here's an example:

```typescript
declare module "@zcc/utilities" {
  export interface IS_Definition {
    isColor: (value: unknown) => boolean;
  }
}

is.isColor = function(value) {
  const colorRegex = /^#(?:[0-9a-fA-F]{3}){1,2}$/;
  return typeof value === 'string' && colorRegex.test(value);
};
```

## 🌙 Exported Functions: sleep

The `sleep` function in the Utilities Library is a powerful and flexible tool designed for asynchronous operations. It serves to delay code execution for a specified duration or until a certain time. What makes this function stand out is its capability for early termination through a 'kill' method, providing greater control over asynchronous delays.

### Sleep Features

- **Duration-based Delay**: Allows setting a sleep duration in milliseconds.
- **Time-specific Delay**: Enables setting a sleep until a specific future Date object.
- **Early Termination**: Offers a 'kill' method to stop the sleep immediately.

### Usage Examples

1. **Basic Sleep for a Duration**:

```typescript
// Sleeps for 5 seconds
await sleep(5000);
```

2. Sleep Until a Specific Time:

```typescript
// Set a wake-up time for 7 AM, January 3, 3024
const wakeUpTime = new Date('3024-01-03T07:00:00');
// Sleeps until the specified wake-up time
await sleep(wakeUpTime);
```

3. Early Termination of Sleep:

```typescript
// Initiates a sleep for 10 seconds
const timer = sleep(10 * SECOND);
// Sets a condition to kill the sleep after 3 seconds
setTimeout(() => timer.kill("continue"), 3 * SECOND);
// Sleeps for only 3 seconds, as it's killed early
await timer;
```

### 🧮 Constants

### General Table

> Commonly used constants within the library. Many files define their own at the top, you can use these or not in your own code.

| Constant          | Value      | Example Usage                                | Description                                 |
|-------------------|------------|----------------------------------------------|---------------------------------------------|
| `EVEN`            | `2`        | `if (x % EVEN === 0)`                        | Used to check for even numbers.             |
| `PAIR`            | `2`        | `const pair = Array(PAIR).fill(val)`         | Represents a pair in arrays.                |
| `HALF`            | `0.5`      | `const half = total * HALF`                  | Represents half of a value.                 |
| `ONE_THIRD`       | `1/3`      | `const third = total * ONE_THIRD`            | Represents one third of a value.            |
| `TWO_THIRDS`      | `2/3`      | `const twoThirds = total * TWO_THIRDS`       | Represents two thirds of a value.           |
| `DEFAULT_LIMIT`   | `5`        | `const limit = DEFAULT_LIMIT`                | Default limit for various operations.       |
| `START`           | `0`        | `for (let i = START; i < length; i++)`       | Represents the starting index.              |
| `EMPTY`           | `0`        | `if (array.length === EMPTY)`                | Used to check for empty values.             |
| `NOT_FOUND`       | `-1`       | `if (arr.indexOf(item) === NOT_FOUND)`       | Indicates an unsuccessful search or match.  |
| `DOWN`            | `-1`       | `sortFunction(a, b) => a < b ? DOWN : UP`    | Used for descending sorting.                |
| `MINUTE`          | `60000`    | `setTimeout(() => {}, MINUTE)`               | Represents the number of milliseconds in a minute. |
| `HOUR`            | `3600000`  | `setTimeout(() => {}, HOUR)`                 | Represents the number of milliseconds in an hour.  |
| `DAY`             | `86400000` | `setTimeout(() => {}, DAY)`                  | Represents the number of milliseconds in a day.    |
| `SECOND`          | `1000`     | `setTimeout(() => {}, SECOND)`               | Represents the number of milliseconds in a second. |
| `PERCENT`         | `100`      | `const percent = value * PERCENT`            | Represents a full percentage value.         |
| `INCREMENT`       | `1`        | `for (let i = START; i <= max; i += INCREMENT)` | Used for standard incrementing.         |
| `SINGLE`          | `1`        | `if (items.length === SINGLE)`               | Indicates a single item.                   |
| `SAME`            | `0`        | `if (comparisonResult === SAME)`             | Used to indicate equality in comparisons.  |
| `UP`              | `1`        | `sortFunction((a, b) => a > b ? UP : DOWN)`  | Used for ascending sorting.                |
| `VALUE`           | `1`        | `const value = pair[VALUE]`                  | Represents the value in a key-value pair.  |
| `LABEL`           | `0`        | `const label = pair[LABEL]`                  | Represents the label in a key-value pair.  |
| `FIRST`           | `0`        | `const firstItem = items[FIRST]`             | Represents the first item in a collection. |
| `NO_CHANGE`       | `0`        | `if (result === NO_CHANGE)`                  | Indicates no change in value or state.     |
| `ARRAY_OFFSET`    | `1`        | `for (let i = START; i < arr.length - ARRAY_OFFSET; i++)` | Used as an offset for array lengths.  |

### ⏰ CronExpression

The CronExpression enum in the library provides a diverse set of predefined cron schedule patterns, simplifying the setup of routine tasks. These expressions cover a wide range of frequencies, from seconds to yearly schedules.

Summary of Cron Patterns:

- **Seconds**: Schedules for every second, every 5, 10, and 30 seconds.
- **Minutes**: Configurations for every minute, as well as every 5, 10, and 30 minutes.
- **Hourly**: Options for every hour, and every 2, 3, 4, ..., up to every 12 hours.
- **Daily**: Patterns for every day at specific hours, from 1 AM to 11 PM, including midnight.
- **Weekly**: Schedules for every week, weekdays, and weekends.
- **Monthly**: Monthly triggers, including every 1st day of the month at midnight and noon, and every 2nd month.
- **Quarterly and Biannually**: Options for every quarter and every 6 months.
- **Yearly**: Annual schedule.
- **Special Ranges**: For example, every 30 minutes between 9 AM and 5 PM, and specific schedules for weekdays at every hour.


🏁
