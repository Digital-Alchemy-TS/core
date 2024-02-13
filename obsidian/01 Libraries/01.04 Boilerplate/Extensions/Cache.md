
# Boilerplate Cache Configuration

Boilerplate provides a flexible caching system that can be configured to use different caching providers, such as Redis or memory. You can configure the library's cache settings by creating an `.rc` file in your project's root directory.

This guide will provide an example configuration file and detailed descriptions for each caching related setting.

## Example Configuration

```rc
[libs.boilerplate]

; Use a prefix with all cache keys. If blank, then the application name is used.
; This value should be a string.
CACHE_PREFIX=

; The caching provider to use. Redis is preferred if available, but memory can also be used.
; The possible values for this setting are 'redis' and 'memory'.
; Default: 'memory'
CACHE_PROVIDER=memory

; The time-to-live (TTL) for cache entries, in seconds.
; This setting applies to all cache providers.
; Default: 86400 seconds (24 hours)
CACHE_TTL=86400

; The URL of the Redis server to use for caching. 
; This setting only applies when using the 'redis' cache provider. 
; Default: 'redis://localhost:6379'
REDIS_URL=redis://localhost:6379

```

## [[Configuration]]

### [[CACHE_PREFIX]]

This option allows you to specify a prefix that will be used for all cache keys. If left blank, the application name will be used as the prefix instead.

### [[CACHE_PROVIDER]]

The `CACHE_PROVIDER` option specifies which caching system will be used. You can choose between `redis` and `memory`. By default, it uses memory-based caching.

### [[CACHE_TTL]]

The `CACHE_TTL` option sets the time-to-live (TTL) for cache entries in seconds. After this duration, cached entries will automatically expire and be removed from the cache.

### [[REDIS_URL]]

This option specifies the URL of the Redis server that will be used for caching. This setting is only applicable when you've selected `redis` as your `CACHE_PROVIDER`.

----

## Code Examples

```typescript
export function WeatherForecastService({ logger, cache, lifecycle }: TServiceParams) {
  
  // Simulates fetching weather data from an external API
  async function fetchWeatherData(city: string): Promise<string> {
    // Imagine this function makes an API call to get weather data
    return `Weather data for ${city}`;
  }

  // Updates the cache with new weather data
  async function updateWeatherCache(city: string) {
    const weatherData = await fetchWeatherData(city);
    await cache.set(city, weatherData, 7200); // Cache for 2 hours
    logger.info(`Updated weather cache for ${city}`);
  }

  // Retrieves weather data for a given city, either from cache or fresh from API
  async function getWeather(city: string): Promise<string> {
    let weatherData = await cache.get<string>(city);
    if (!weatherData) {
      logger.info(`Cache miss for ${city}. Fetching new data.`);
      await updateWeatherCache(city);
      weatherData = await fetchWeatherData(city);
    } else {
      logger.info(`Cache hit for ${city}. Using cached data.`);
    }
    return weatherData;
  }

  // Clears weather data for a city from the cache
  async function clearWeatherCache(city: string) {
    await cache.del(city);
    logger.info(`Cleared weather data from cache for ${city}`);
  }

  // Lists all cities with cached weather data
  async function listCachedCities() {
    const keys = await cache.keys();
    logger.info(`Cached cities: ${keys.join(', ')}`);
    return keys;
  }

  // Initialize the service and pre-cache data for a set of cities
  lifecycle.onBootstrap(async () => {
    const cities = ['New York', 'London', 'Tokyo'];
    for (const city of cities) {
      await updateWeatherCache(city);
    }
    logger.info('Service initialized and weather data pre-cached for key cities.');
    
  // Set an interval to update the cache every hour
    setInterval(async () => {
      for (const city of cities) {
        await updateWeatherCache(city);
        logger.info(`Cache auto-refreshed for ${city}`);
      }
    }, 3600000); // 3600000 milliseconds = 1 hour
  });

  // Expose service methods
  return {
    getWeather,
    clearWeatherCache,
    listCachedCities,
  };
}
```


### Detailed Cache Methods and Metrics Table

| Cache Method  | Success Metrics                             | Error Metrics                     | Labels/Tags                                      |
|---------------|---------------------------------------------|-----------------------------------|--------------------------------------------------|
| `get`         | [[CACHE_GET_OPERATIONS_TOTAL]]                | [[CACHE_DRIVER_ERROR_COUNT]]        | `hit_miss` (hit/miss), `key`, `prefix`           |
| `set`         | [[CACHE_SET_OPERATIONS_TOTAL]]                | [[CACHE_DRIVER_ERROR_COUNT]]        | `key`, `prefix`                                  |
| `del`         | [[CACHE_DELETE_OPERATIONS_TOTAL]]             | [[CACHE_DRIVER_ERROR_COUNT]]        | `key`, `prefix`                                  |
| `keys`        | (Not directly tracked)                      | [[CACHE_DRIVER_ERROR_COUNT]]        | (No specific labels for success)                 |

