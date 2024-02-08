from aiohttp.web import Response, json_response
import logging
from . import DOMAIN

_LOGGER = logging.getLogger(__name__)

async def handle_webhook(hass, webhook_id, request):
    """Handle incoming webhook for switch updates."""

    incoming_admin_key = request.headers.get("x-admin-key")
    stored_admin_key = hass.data[DOMAIN]['admin_key']

    if incoming_admin_key != stored_admin_key:
        _LOGGER.error("Unauthorized webhook access attempt.")
        return Response(text="Unauthorized", status=401)

    data = await request.json()
    if "switch" in data:
        return await handle_switch(hass, data.get("switch"))
    elif "binary_sensor" in data:
        return await handle_binary_sensor(hass, data.get("binary_sensor"))
    elif "sensor" in data:
        return await handle_binary_sensor(hass, data.get("sensor"))

    return json_response({"error": "Invalid payload"}, status=400)


async def handle_switch(hass, data):
    switch_id = data.get("id")
    switch_state = data.get("state")

    # Find the switch entity
    switch = hass.data[DOMAIN]['switch_entities'].get(switch_id)
    if not switch:
        _LOGGER.error(f"Switch with ID {switch_id} not found.")
        return Response(text="Switch not found", status=404)

    # Update the switch state
    if switch_state == "on":
        await switch.async_turn_on()
    elif switch_state == "off":
        await switch.async_turn_off()
    else:
        _LOGGER.error("Invalid state received.")
        return Response(text="Invalid state", status=400)

    return Response(text="Success", status=200)

async def handle_sensor(hass, data):
    # Retrieve the sensor entity
    sensor_id = data.get('id')
    sensor = hass.data[DOMAIN]['sensor_entities'].get(sensor_id)
    if not sensor:
        _LOGGER.error(f"Sensor with ID {sensor_id} not found.")
        return Response(text="Switch not found", status=404)

    # Determine the type of update
    if 'state' in data and 'attributes' not in data:
        sensor.update_state(data['state'])
    elif 'attribute' in data and 'value' in data:
        sensor.update_attribute(data['attribute'], data['value'])
    elif 'state' in data and 'attributes' in data:
        sensor.update_all(data['state'], data['attributes'])
    else:
        return Response(text="Invalid state", status=400)

    return Response(text="Success", status=200)

async def handle_binary_sensor(hass, data):
    # Handle binary sensor update
    sensor_id = data.get('sensor_id')
    sensor_state = data.get('state') == "on"

    # Find and update the binary sensor entity
    sensor = hass.data[DOMAIN]['sensor_entities'].get(sensor_id)
    if sensor:
        if data.get('state') == "on":
            sensor.turn_on()
        else:
            sensor.turn_off()
    else:
        _LOGGER.error(f"Binary sensor with ID {sensor_id} not found.")
        return Response(text="Switch not found", status=404)

    return Response(text="Success", status=200)
