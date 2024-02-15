from homeassistant.core import HomeAssistant, callback

from .const import DOMAIN
import logging

_LOGGER = logging.getLogger(__name__)

async def generic_setup(hass: HomeAssistant, service, ctor, async_add_entities):
    hass.data[DOMAIN][service] = {}

    @callback
    async def handle_application_upgrade(event):
        app = event.data.get("app")

        # * Process entities
        incoming_list = event.data.get("domains", {}).get(service, {})
        _LOGGER.info(f"{app}:{service} => {len(incoming_list)} entries")
        existing = hass.data[DOMAIN][service]
        current_ids = set(existing.keys())
        updated_id_list = {entity.get("id") for entity in incoming_list}

        for incoming in incoming_list:
            id = incoming.get("id")
            if id in existing:
                # * Update existing entity
                _LOGGER.debug(f"{app}:{service} update {incoming.get("name")}")
                hass.async_create_task(existing[id].receive_update(incoming))
            else:
                # * Create new entity
                _LOGGER.debug(f"{app}:{service} adding {incoming.get("name")}")
                existing[id] = ctor(hass, app, incoming)
                async_add_entities([existing[id]])

        # * Remove entities not in the update
        for entity_id in current_ids - updated_id_list:
            removal = hass.data[DOMAIN][service].pop(entity_id)
            _LOGGER.debug(f"{app}:{service} remove {removal._name}")
            hass.async_create_task(removal.async_remove())


    async def handle_reload_service(call):
        app_name = call.data.get("app", None)
        if app_name == None:
            hass.bus.async_fire("zcc_app_reload_all")
            return
        hass.bus.async_fire("zcc_app_reload", {"app": app_name})

    hass.services.async_register(DOMAIN, "reload", handle_reload_service)
    hass.bus.async_listen("zcc_application_state", handle_application_upgrade)

    return True
