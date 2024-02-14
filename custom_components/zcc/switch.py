from homeassistant.components.switch import SwitchEntity
from homeassistant.core import callback
from .const import DOMAIN

import logging

_LOGGER = logging.getLogger(__name__)


async def async_setup_platform(hass, config, async_add_entities, discovery_info=None):
    """Set up the ZCC switch platform."""
    if DOMAIN not in hass.data:
        return False

    if "switch" not in hass.data[DOMAIN]:
        hass.data[DOMAIN]["switch"] = {}

    async def handle_application_upgrade(event):
        """Handle updates to the list of switches."""
        # * Process entities
        updated_switches = event.data.get('domains', {}).get("switch", {})
        app = event.data.get('app')
        _LOGGER.info(f"{app} sent {len(updated_switches)} entities")
        existing_switch_ids = set(hass.data[DOMAIN]["switch"].keys())
        updated_switch_ids = {switch.get("id") for switch in updated_switches}

        for switch_info in updated_switches:
            switch_id = switch_info.get("id")
            if switch_id in existing_switch_ids:
                # * Update existing entity
                entity = hass.data[DOMAIN]["switch"][switch_id]
                entity._handle_switch_update_direct(
                    switch_info
                )  # Direct update without event
                _LOGGER.debug(f"updating {switch_info.get('name')}")
            else:
                # * Create new entity
                _LOGGER.debug(f"{app} adding {switch_info}")
                new_switch = ZccSwitch(hass, app, switch_info)
                hass.data[DOMAIN]["switch"][switch_id] = new_switch
                async_add_entities([new_switch], True)

        # * Remove entities not in the update
        for switch_id in existing_switch_ids - updated_switch_ids:
            entity = hass.data[DOMAIN]["switch"].pop(switch_id)
            _LOGGER.debug(f"remove {entity._name}")
            await entity.async_remove()

    # * Attach update listener
    hass.bus.async_listen("zcc_application_state", handle_application_upgrade)
    return True


class ZccSwitch(SwitchEntity):
    def __init__(self, hass, app, switch_info):
        """Initialize the switch."""
        self.hass = hass
        self._app = app
        self._id = switch_info.get("id")
        self._name = switch_info.get("name")
        self._icon = switch_info.get("icon", "mdi:electric-switch")
        self._state = switch_info.get("state", "off") == "on"

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
        return self.hass.data[DOMAIN]["health_status"].get(self._app, False)

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
            self.hass.bus.async_fire(
                "zcc_switch_update", {"data": {"switch": self._id, "state": new_state}}
            )

    def _handle_switch_update_direct(self, switch_info):
        self._name = switch_info["name"]
        self._icon = switch_info.get("icon")
        self._state = switch_info["state"] == "on"
        self.async_write_ha_state()

    async def async_added_to_hass(self):
        """When entity is added to Home Assistant."""
        self.async_on_remove(
            self.hass.bus.async_listen("zcc_event", self._handle_switch_update)
        )
        self.async_on_remove(
            self.hass.bus.async_listen(
                f"zcc_{self._app}_health_status_updated", self._handle_health_update
            )
        )

    @callback
    def _handle_switch_update(self, event):
        """Handle incoming switch state updates."""
        if event.data.get("id") == self._id:
            new_state = event.data.get("data", {}).get("state")

            # Prevent circular updates by checking if the state actually changed
            if new_state != ("on" if self._state else "off"):
                self._state = new_state == "on"
                self.async_write_ha_state()

    @callback
    async def _handle_health_update(self, event):
        """Handle health status update."""
        self.async_schedule_update_ha_state(True)
