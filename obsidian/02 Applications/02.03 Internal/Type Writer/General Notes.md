
[TypeScript AST Viewer](https://ts-ast-viewer.com)

## Future Enhancements

- #TODO

### supported_features

Some properties may not be available to all entities within a domain. The type definitions do not currently account for this. There 

> [!info] **Example domain**: `light`

#### Service Definition
```json
fields: {
  transition: {
	filter: {
	  supported_features: [
	  // exclude this property if the targeted entity_id doesn't have access
		32
	  ]
	},
	selector: {
	  number: {
		min: 0,
		max: 300,
		unit_of_measurement: 'seconds'
	  }
	},
	name: 'Transition',
	description: 'Duration it takes to get to next state.'
  },
 // ...
```
#### Reference Entity
```json
    "office_fan": {
      "entity_id": "light.office_fan",
      "state": "on",
      "attributes": {
        "min_color_temp_kelvin": 2202,
        "max_color_temp_kelvin": 6535,
        "min_mireds": 153,
        "max_mireds": 454,
        "effect_list": [
          "None",
          "candle"
        ],
        "supported_color_modes": [
          "color_temp"
        ],
        "color_mode": "color_temp",
        "brightness": 255,
        "color_temp_kelvin": 2840,
        "color_temp": 352,
        "hs_color": [
          28.109,
          61.425
        ],
        "rgb_color": [
          255,
          171,
          98
        ],
        "xy_color": [
          0.512,
          0.385
        ],
        "effect": "None",
        "entity_id": [
          "light.office_fan_1",
          "light.office_fan_2",
          "light.office_fan_3"
        ],
        "icon": "mdi:lightbulb-group",
        "friendly_name": "Office Fan",
        // vvvv here vvvv
        "supported_features": 44
        // ^^^^ here ^^^^
      },
      "last_changed": "2024-02-05T15:09:07.269119+00:00",
      "last_updated": "2024-02-05T23:10:09.389637+00:00",
      "context": {
        "id": "01HNXRJGFAJFMEHJ8RKJA4AA20",
        "parent_id": null,
        "user_id": null
      }
    },
```

```typescript
function supportsFeature(supportedFeatures: number, requiredFeature: number): boolean {
    return (supportedFeatures & requiredFeature) === requiredFeature;
}

// Example usage:
const lightSupportedFeatures = 44;
const requiredFeature = 32;
const isSupported = supportsFeature(lightSupportedFeatures, requiredFeature);

console.log(isSupported); // This will log true if the feature is supported, false otherwise
```