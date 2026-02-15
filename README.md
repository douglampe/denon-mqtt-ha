# Home Assistant Configuration Companion for denon-mqtt

This project is a companion to [denon-mqtt](https://github.com/douglampe/denon-mqtt/) which provides an MQTT interface
for Denon and Marantz Audio Video Receivers (AVRs). This command-line utility requires a configuration file consistent with `denon-mqtt` v0.0.5 or later. It publishes 
[MQTT device and entity discovery](https://www.home-assistant.io/integrations/mqtt/#mqtt-discovery)
data for consumption by [Home Assistant](https://www.home-assistant.io/). It also generates YAML configuration files
for media player devices leveraging the Home Assistant
[Universal Media Player](https://www.home-assistant.io/integrations/universal/).

## Usage

```bash
# Create folder to store configuration:
mkdir denon-mqtt
cd denon-mqtt
# Install globally
yarn global add denon-mqtt # OR npm i -g denon-mqtt
# Discover receiver configuration and write to receivers.json (EXPERIMENTAL):
denon-mqtt -d -f receivers.json -a your.avr.ip.address
yarn global add denon-mqtt-ha # OR npm i -g denon-mqtt-ha
# Publish configuration
denon-mqtt-ha
```

Command-line options:
```
Usage: denon-mqt-ha [options]

Options:
  -i, --info                        Display current version number
  -f, --file <file>                 Name of configuration JSON file (default: "receivers.json")
  -m, --mqtt <url>                  MQTT URL (default: "192.168.1.131")
  -u, --username <username>         MQTT username (default: "user")
  -p, --password <password>         MQTT password (default: "password")
  --port                            MQTT port <port>
  --prefix                          MQTT topic prefix <prefix>
  --short-names                     Use only zone names for entities
  -h --hass                         Home Assistant discovery topic Prefix <hass>
  -o --output                       Home Assistant Media Player config file <output>
  -s, --state-topic <stateTopic>    MQTT state topic (default: "state")
  -c, --change-topic <changeTopic>  MQTT change topic (default: "change")
  --help                            display help for command
```

## Devices

For each configured receiver, a device is created for each zone. The device ID is `{avr_id}_{zone_id}` where `{avr_id}`
is the `id` value of the receiver config and `{zone_id}` is `main_zone` for zone 1, and `zone2`, `zone3`, etc. for
additional zones (ex: `home_theater_main_zone`). The name of the device is `{receiver} {zone}` where `{receiver}` is 
the `name` value of the receiver config and `{zone}` is the `name` value of the zone config.

## Entities

Entities are created as required to support the Universal Media Player. Each entity ID is `{device_id}_{entity_id}` 
where `{device_id}` is the ID described above (ex: `home_theater_main_zone`) and `{entity_id}` is the ID listed below
(ex: `home_theater_main_zone_power`). Entity names are `{component name} {entity name}` where `{component name}` is the
device name described above unless `--short-names` is specified in which case it is the zone name. The value for
{entity name}` is the name listed below.

|Type  |ID            |Name          |
|------|--------------|--------------|
|switch|power         |Power         |
|switch|mute          |Mute          |
|switch|mute_toggle   |Mute Toggle   |
|switch|volume_up_down|Volume Up/Down|
|sensor|volume_percent|Volume Percent|
|fan   |volume        |Volume        |
|selet |source        |Source        |

## Media Players

For each receiver and zone, a media player is configured with ID `{device_id}_media_player` and name 
`{device name} Audio`.
