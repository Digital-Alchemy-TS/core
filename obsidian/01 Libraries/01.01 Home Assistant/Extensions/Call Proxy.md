- [[01.01 Home Assistant]]

## Current Functionality

## Future Enhancements

#TODO

### Tighter integration with [[Entity Manager]]

> [!info] In addition to current functionality

`entity.byId` returns a proxy object. Right now, this is used for non-dynamic things, like id, state, attributes. 

This will take additional type definitions to be built, but the call methods can be attached directly to the entity objects. This would aid discoverability for services that could possibly be called using this entity. 

This would need to account for stuff like integrations, which is beyond the current capabilities of [[Type Writer]]

#### Goals
```typescript
export function Office({ getApis }: TServiceParams) {
  const hass = getApis(LIB_HOME_ASSISTANT);
  const fan = hass.entity.byId("fan.office_fan");


  onSomeEvent(async () => {
    // automatically passes through entity_id
    await fan.increase_speed();
  })
}
```