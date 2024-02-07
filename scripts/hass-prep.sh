#!/bin/sh

docker compose -f ./docker/homeassistant/docker-compose.yaml down --remove-orphans -t 1
npm run hass:cleanup
npm run hass:decompress
