- [[Fetch]]
- [[01.01 Home Assistant]]

| Function                   | Description                                  | Returns                       |
|----------------------------|----------------------------------------------|------------------------------|
| `calendarSearch`           | Searches calendar events.                    | `Promise<CalendarEvent[]>`   |
| `callService`              | Calls a Home Assistant service.              | `Promise<ENTITY_STATE[]>`    |
| `checkConfig`              | Checks Home Assistant configuration.         | `Promise<CheckConfigResult>` |
| `fetch`                    | Generic fetch function.                      | `TFetch`                     |
| `fetchEntityCustomizations`| Fetches customizations for entities.         | `Promise<T>`                 |
| `fetchEntityHistory`       | Fetches history for a specified entity.      | `Promise<T[]>`               |
| `fireEvent`                | Fires an event in Home Assistant.            | `Promise<void>`              |
| `getAllEntities`           | Retrieves all entities from Home Assistant.  | `Promise<GenericEntityDTO[]>`|
| `getConfig`                | Retrieves Home Assistant configuration.      | `Promise<HassConfig>`        |
| `getLogs`                  | Retrieves logs from Home Assistant server.   | `Promise<HomeAssistantServerLogItem[]>` |
| `getRawLogs`               | Retrieves raw logs from the server.          | `Promise<string>`            |
| `listServices`             | Lists available services in Home Assistant.  | `Promise<HassServiceDTO[]>`  |
| `updateEntity`             | Updates an entity in Home Assistant.         | `Promise<void>`              |
| `webhook`                  | Sends a webhook to Home Assistant.           | `Promise<void>`              |


#### Configuration

- [[Configuration]]

- [[01 Libraries/01.01 Home Assistant/Configuration/BASE_URL|BASE_URL]]
- [[01 Libraries/01.01 Home Assistant/Configuration/TOKEN|TOKEN]]
