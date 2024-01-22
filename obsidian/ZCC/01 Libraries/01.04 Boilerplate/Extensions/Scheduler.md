- [[01 Libraries/01.04 Boilerplate/Boilerplate]]
- [[Lifecycle]]
- #metrics
- #cron
- #throws

## Description

The scheduler is a general purpose tool for interacting with timers. It keeps metrics on operations, and works with the application lifecycle where appropriate

## Errors

- `INVALID_SCHEDULE`
	- No valid scheduling options provided (Typescript should have caught)
- `DOUBLE_SCHEDULE_START`
	- Called `.start()` twice on the same schedule. This shouldn't be done, without a stop in between

## Metrics

All variations of the scheduler may be passed a `label`. If passed, it will initiate the collection of metrics for each run


- [[SCHEDULE_EXECUTION_COUNT]]
- [[SCHEDULE_ERRORS]]
- [[SCHEDULE_EXECUTION_TIME]]

Always tracked, not specific to any particular schedule
- [[ACTIVE_SCHEDULES]]

## Schedule Types

### Implementations

- Implemented in [[0.1 Tang]]
	- cron
	- setInterval
- [[0.2 Horton]]
	- timeout
	- #bottleneck wrapper
	- sliding inverval
	- target `Date` / #dayjs mode

All schedules types are aware of & respect the application lifecycle. They will not start until the application is ready, and will attempt to stop on application shutdown.

Attempting to start a schedule before prior to the application being ready will cause that to be queued until the application is ready. 

Only 1  schedule type per function call is permitted, Typescript enforced
### cron
Run a callback on a #cron schedule

> [!package] NPM [node-cron](https://www.npmjs.com/package/node-cron)

```typescript
export function MyService({ schedule, context }: TServiceParams) {
	schedule({
		context,
		label: "backups",
		cron: CronExpression.EVERY_DAY_AT_2AM,
		exec: async () => {
			await runBackup();
		}
	})
}
```

### interval
Run a callback every `interval` ms

```typescript
export function MyService({ schedule, context }: TServiceParams) {
	schedule({
		context,
		label: "backups",
		inerval: 5000,
		exec: async () => {
			await ping();
		}
	})
}
```
