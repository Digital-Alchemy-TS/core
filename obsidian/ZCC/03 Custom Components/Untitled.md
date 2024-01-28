Gotcha. Let's plan out what we need for next steps, don't generate code yet. Just list file names, and a description of what they are going to contain / do. 

Here's a description of things I need the component to do.

## Multi-Application

This component will be communicating with a node.js application, and there exists the possibility for more than 1 app. Code should not be build with the assumption of 1 home assistant -> 1 application

All entities from a single nodejs app will be grouped together by a shared application name

## Configuration

When setting up the component, it needs to take in a base url (`{base_url}/hass/health`), admin key (which it uses as `x-admin-key: {value}` in the headers)

## Home Assistant -> Application

### POST /hass/configure

Indicates that the application should reach out to home assistant, and re-configure all entities

### GET /hass/health

Poll this every 10 seconds to make sure app is online. Disable entities associated with app if 3 polls fail

## Application -> Home Assistant

### Generate Entity (1 call / entity)

Provides the following for all entities

- entity_id
- friendly_name
- icon
- application name

### Update Entity (1 call / update)

- entity_id
- status
- attributes{name:value}

### Remove Entity

- entity_id

### Reset Application

- application name

Drop all entities related to an app. The app probably wants to just rebuild everything, or was removed by the user
## Areas

The system will generally be interested in manipulating the areas in home assistant, and could possibly end up creating, modifying, or moving entities from other integrations (and own) between areas