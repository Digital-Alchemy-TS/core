from homeassistant.components.switch import SwitchEntity
from homeassistant.core import callback
from .const import DOMAIN

import logging

_LOGGER = logging.getLogger(__name__)

class ZccSwitch(SwitchEntity):
    def __init__(self, hass, switch_info):
        """Initialize the switch."""
        self.hass = hass
        self._id = switch_info['id']
        self._name = switch_info['name']
        self._icon = switch_info['icon']
        self._state = switch_info['state'] == "on"

    @property
    def unique_id(self):
        """Return a unique identifier for this switch."""
        return self._id

    @property
    def name(self):
        """Return the name of the switch."""
        return self._name

    @property
    def is_on(self):
        """Return True if the switch is on."""
        return self._state

    @property
    def available(self):
        """Return if the switch is available."""
        return self.hass.data[DOMAIN].get('health_status', True)

    async def async_turn_on(self):
        """Turn the switch on."""
        await self._update_switch("on")

    async def async_turn_off(self):
        """Turn the switch off."""
        await self._update_switch("off")

    async def _update_switch(self, new_state):
        """Send a state update to the external service."""
        if self._state != (new_state == "on"):
            self._state = new_state == "on"
            self.async_write_ha_state()
            self.hass.bus.async_fire('zcc_switch_update', {
                'data': {'switch': self._id, 'state': new_state}
            })

    async def async_added_to_hass(self):
        """When entity is added to Home Assistant."""
        self.async_on_remove(
            self.hass.bus.async_listen('zcc_event_switch', self._handle_switch_update)
        )

    @callback
    def _handle_switch_update(self, event):
        """Handle incoming switch state updates."""
        if event.data.get('data', {}).get('switch') == self._id:
            new_state = event.data.get('data', {}).get('state')
            # Prevent circular updates by checking if the state actually changed
            if new_state != ("on" if self._state else "off"):
                self._state = new_state == "on"
                self.async_write_ha_state()

    def _handle_switch_update_direct(self, switch_info):
        """Handle direct updates to the switch without emitting events (to avoid loops)."""
        new_state = switch_info['state']
        if new_state != ("on" if self._state else "off"):
            self._state = new_state == "on"
            self.async_write_ha_state()



async def async_setup_platform(hass, config, async_add_entities, discovery_info=None):
    """Set up the ZCC switch platform."""
    if 'zcc_switch_entities' not in hass.data[DOMAIN]:
        hass.data[DOMAIN]['zcc_switch_entities'] = {}

    async def handle_list_update(event):
        """Handle updates to the list of switches."""
        updated_switches = event.data['switches']
        # Track existing switch entities by their unique IDs
        existing_switch_ids = set(hass.data[DOMAIN]['zcc_switch_entities'].keys())
        updated_switch_ids = {switch['id'] for switch in updated_switches}

        # Remove switches that are no longer present
        for switch_id in existing_switch_ids - updated_switch_ids:
            entity = hass.data[DOMAIN]['zcc_switch_entities'].pop(switch_id)
            await entity.async_remove()

        # Update existing entities and add new ones
        for switch_info in updated_switches:
            switch_id = switch_info['id']
            if switch_id in existing_switch_ids:
                # Update existing switch entity
                entity = hass.data[DOMAIN]['zcc_switch_entities'][switch_id]
                entity._handle_switch_update_direct(switch_info)  # Direct update without event
            else:
                # Create a new ZccSwitch entity
                new_switch = ZccSwitch(hass, switch_info)
                hass.data[DOMAIN]['zcc_switch_entities'][switch_id] = new_switch
                async_add_entities([new_switch], True)

    async def handle_switch_event(event):
        """Handle individual switch state updates."""
        switch_data = event.data['data']
        switch_id = switch_data['switch']
        if switch_id in hass.data[DOMAIN]['zcc_switch_entities']:
            entity = hass.data[DOMAIN]['zcc_switch_entities'][switch_id]
            entity._handle_switch_update(event)

    # Register event listeners
    hass.bus.async_listen('zcc_list_switches', handle_list_update)
    hass.bus.async_listen('zcc_event_switch', handle_switch_event)
