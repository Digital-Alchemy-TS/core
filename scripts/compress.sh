#!/bin/sh
cd docker/homeassistant || exit
rm ./reference.tar.gz
tar -czvf ./reference.tar.gz ./config
