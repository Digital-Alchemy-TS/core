# Digital Alchemy + Home Assistant reference install

> note: Inside of this file the only install of note is the one contained within this directory
>
> No code is intended to interact with an existing running instance.
> All port defaults have been selected to comfortably run alongside existing installs, but a different machine may be preferable for just trying things out.

The reference install is a barely configured docker based Home Assistant install, set up on a non-standard port as to not conflict with any other installs.

## Container management

> commands are run from repository root

| command | requires root | description | notes |
| --- | --- | --- | --- |
| `yarn hass:compress` | `*` | compressess the reference install back into the tar file | install should not be running |
| `yarn hass:decompress` |  | extract the reference install | install should not be running |
| `yarn hass:reset` | `*` | tear down the containers, remove the data, extract from reference, start again | install should not be running |
| `yarn hass:cleanup` | `*` | cleanup data from reference install |  install should not be running |
| `yarn container:hass:{start\|stop}` | depends on permissions | start / stop the docker container |

## Setup notes

> username: steggy
>
> password: nom nom

- Some additional tweaks to the `configuration.yaml` may be required if you want a reverse proxy in the mix

### Configuring apps

All apps in the examples folder come pre-configured with some defaults (that work on my machine).
The configuration files can be found in the repository root, named `.{app_name}rc`.
Tweak values as needed for your setup invididual test setup.

## App setup workflow

There is a chicken & egg workflow initially populating entities into Home Assistant from a new script.
This is resolved by sticking your fingers in your ears, ignoring any errors, and letting the code run long enough to write the new configs.
Restarting home assistant will allow the new packages to be imported

1) Start up home assistant
2) Start up node app
   - The apps inside the repo are configured to write out configs 5 seconds after startup
   - Your code will need to include the call to write configs
3) Ensure the new YAML is properly attached
   - verify `homeassistant.packages` properly `!include`s `packages/root_include.yaml`
   - verify the desired mappings within the root_include are uncommented (or add your own)
4) Log into home assistant
5) `Developer tools` -> `Check Configuration` + `Restart`
6) Go back to `Overview`
7) profit
