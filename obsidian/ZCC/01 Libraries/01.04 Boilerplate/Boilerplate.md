- [[Libraries]]
## Overview

## Components

### [[Configuration]]

Multi source config loader, #Typescript friendly. Can load from
- rc files
- yaml files
- json files
- command line switches
- environment variables
- in code
	- at bootstrap
	- module definition
	- runtime injected
- custom providers
	- wire in a rest call, or anything else to retrieve the config

Will prioritize sources, merge, and provide values via `MY_MODULE.getConfig` calls

### [[Wiring]]

What connects all the dots
- `CreateApplication`
- `CreateLibrary`
- #bootstrap
- #teardown
- #lifecycle

### [[Logging]]

Wrapper around [pino](https://www.npmjs.com/package/pino). Automatically provides context to log statements, and has an optional pretty formatter built in
### [[Fetch]]

Base level fetch operations, utilizing node's built in #fetch method at the base. Wrapped by other libraries to create standardized #rest-api interfaces
### [[Cache]]

Generic caching interface. Built in support for memory caching & #redis
### [[Scheduler]]

Lifecycle aware scheduling functions
- #cron
### [[Metrics]]

#metrics 
[prom-client - npm](https://www.npmjs.com/package/prom-client)