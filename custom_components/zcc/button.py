from homeassistant.components.button import ButtonEntity
from homeassistant.core import callback
from .const import DOMAIN

import logging

_LOGGER = logging.getLogger(__name__)


async def async_setup_platform(hass, config, async_add_entities, discovery_info=None):
    """Set up the ZCC button platform."""
    if DOMAIN not in hass.data:
        return False

    if "button" not in hass.data[DOMAIN]:
        hass.data[DOMAIN]["button"] = {}

    @callback
    def handle_application_upgrade(event):
        """Update button entities based on an event from the external system."""

        # * Process entities
        current_entities = hass.data[DOMAIN]["button"]
        buttons = event.data.get('domains', {}).get("button", {})
        updated_buttons = {button["id"]: button for button in buttons}
        _LOGGER.info(f"received update ({buttons} entities)")

        buttons_to_remove = set(current_entities) - set(updated_buttons)

        for button_id, button_info in updated_buttons.items():
            if button_id in current_entities:
                # * Update existing entity
                entity = current_entities[button_id]
                entity.update_info(button_info)
                _LOGGER.debug(f"updating {button_info['name']}")
            else:
                # * Create new entity
                _LOGGER.debug(f"adding {button_info['name']}")
                new_button = ZccButton(hass, button_info)
                current_entities[button_id] = new_button
                async_add_entities([new_button], True)

        # * Remove entities not in the update
        for button_id in buttons_to_remove:
            entity = current_entities.pop(button_id)
            _LOGGER.debug(f"remove {entity._name}")
            hass.async_create_task(entity.async_remove())

    # * Attach update listener
    hass.bus.async_listen("zcc_application_state", handle_application_upgrade)
    return True


class ZccButton(ButtonEntity):
    """A class for ZCC buttons."""

    def __init__(self, hass, button_info):
        """Initialize the button."""
        self.hass = hass
        self._id = button_info["id"]
        self._name = button_info["name"]
        self._icon = button_info.get("icon", "mdi:gesture-tap")

    @property
    def unique_id(self):
        """Return a unique identifier for this button."""
        return self._id

    @property
    def name(self):
        """Return the name of the button."""
        return self._name

    @property
    def icon(self):
        """Return the icon of the button."""
        return self._icon

    @property
    def available(self):
        return self.hass.data[DOMAIN].get("health_status", False)

    async def async_press(self):
        """Handle the button press."""
        _LOGGER.debug(f"emit zcc_button_press for {self._name} ({self._id})")
        self.hass.bus.async_fire("zcc_button_press", {"button": self._id})

    def update_info(self, button_info):
        """Update the button's information."""
        self._name = button_info.get("name", self._name)
        self._icon = button_info.get("icon", self._icon)
        _LOGGER.debug(f"receiving update {self._name}")
        self.async_write_ha_state()

    async def async_added_to_hass(self):
        """When entity is added to Home Assistant."""
        self.async_on_remove(
            self.hass.bus.async_listen(
                f"zcc_{self._app}_health_status_updated", self._handle_health_update
            )
        )

    @callback
    async def _handle_health_update(self, event):
        """Handle health status update."""
        self.async_schedule_update_ha_state(True)
