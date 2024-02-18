#!/bin/bash
NODE_OPTIONS="$NODE_OPTIONS --experimental-vm-modules" npx jest "$1"
