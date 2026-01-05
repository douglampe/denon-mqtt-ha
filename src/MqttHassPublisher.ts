import fs from 'fs/promises';
import { MqttClient } from 'mqtt';
import { ReceiverConfig } from './ReceiverConfig';
import { connectAsync } from 'mqtt';

export interface MqttConfig {
  host: string;
  port: string;
  username: string;
  password: string;
  prefix: string;
}

export interface HomeAssistantConfig {
  prefix: string;
  configFile: string;
  shortNames: boolean;
}

export interface MqttManagerOptions {
  receiver: ReceiverConfig;
  mqtt: MqttConfig;
  hass: HomeAssistantConfig;
  client: MqttClient;
}

export interface EntityConfig {
  name: string;
  id: string;
  entity: Record<string, string | string[]>;
}

export interface EntitiesConfig {
  switches: EntityConfig[];
  buttons: EntityConfig[];
  sensors: EntityConfig[];
  fans: EntityConfig[];
  selects: EntityConfig[];
}

export class MqttHassPublisher {
  private receiver: ReceiverConfig;
  private mqtt: MqttConfig;
  private hass: HomeAssistantConfig;
  private client: MqttClient;

  constructor(options: MqttManagerOptions) {
    this.receiver = options.receiver;
    this.mqtt = options.mqtt;
    this.hass = options.hass;
    this.client = options.client;
  }

  public static async start(receivers: ReceiverConfig[], mqtt: MqttConfig, hass: HomeAssistantConfig) {
    const client = await connectAsync(`mqtt://${mqtt.host}:${mqtt.port}`, {
      username: mqtt.username,
      password: mqtt.password,
    });

    console.debug(`Connected to MQTT at ${mqtt.host}`);

    client.on('error', (err) => {
      console.error(err);
      process.exit();
    });

    const managers: MqttHassPublisher[] = [];

    await fs.writeFile(hass.configFile, '');

    for await (const receiver of receivers) {
      managers.push(MqttHassPublisher.create({ receiver, mqtt, hass, client }));
    }

    await Promise.all(managers.map((m) => m.publish()));

    await client.endAsync();

    console.debug('Disconnected from MQTT');
  }

  public static create(options: MqttManagerOptions) {
    return new MqttHassPublisher(options);
  }

  async publish() {
    console.debug(`Publishing configuration for ${this.receiver.name}`);
    const configData = await fs.readFile('hass-mqtt-config.json');
    const entityConfig = JSON.parse(configData.toString()) as EntitiesConfig;

    for (const zone of this.receiver.zones) {
      const zoneIndex = parseInt(zone.index);
      const zoneId = MqttHassPublisher.getZoneId(zoneIndex);
      const deviceId = `${this.receiver.id}_${zoneId}`;
      const deviceName = `${this.receiver.name} ${zone.name}`;
      const compName = this.hass.shortNames ? zone.name : `${this.receiver.name} ${zone.name}`;

      const payload = {
        dev: {
          ids: deviceId,
          name: deviceName,
        },
        o: {
          name: 'denon-mqtt-ha',
        },
        availability: {
          topic: `${this.mqtt.prefix}/${this.receiver.id}/main_zone/state`,
          value_template: '{{ value_json.state.main_power if value_json.state.main_power is defined else this.state }}',
          payload_available: 'ON',
        },
        cmps: {} as Record<string, Record<string, string>>,
        state_topic: `${this.mqtt.prefix}/${this.receiver.id}/${zoneId}/state`,
        command_topic: `${this.mqtt.prefix}/${this.receiver.id}/${zoneId}/command`,
      };

      for (const entity of entityConfig.switches) {
        this.addEntityConfig(payload.cmps, 'switch', zoneIndex, entity, compName);
      }
      for (const entity of entityConfig.buttons) {
        this.addEntityConfig(payload.cmps, 'button', zoneIndex, entity, compName);
      }
      for (const entity of entityConfig.sensors) {
        this.addEntityConfig(payload.cmps, 'sensor', zoneIndex, entity, compName);
      }
      for (const entity of entityConfig.fans) {
        this.addEntityConfig(payload.cmps, 'fan', zoneIndex, entity, compName);
      }
      for (const entity of entityConfig.selects) {
        this.addEntityConfig(payload.cmps, 'select', zoneIndex, entity, compName);
      }

      const topic = `${this.hass.prefix}/device/${deviceId}/config`;

      console.debug(`Publishing discovery payload to topic ${topic} for device ${payload.dev.name}`);

      await this.client.publishAsync(topic, JSON.stringify(payload));

      console.debug(`Writing Media Player configuration for ${deviceName}`);

      await this.appendMediaPlayerConfig(compName, deviceId, zoneId);
    }
  }

  addEntityConfig(cmps: Record<string, Record<string, string>>, type: string, zone: number, config: EntityConfig, deviceName: string) {
    const zoneId = MqttHassPublisher.getZoneId(zone);
    const id = `${this.receiver.id}_${zoneId}_${config.id}`;

    if (type === 'fan') {
      config.entity['percentage_command_topic'] = `${this.mqtt.prefix}/${this.receiver.id}/${zoneId}/command`;
      config.entity['percentage_state_topic'] = `${this.mqtt.prefix}/${this.receiver.id}/${zoneId}/state`;
    } else if (type === 'select') {
      config.entity['options'] = this.receiver.zones[zone - 1].sources;
    } else if (config.id === 'mute_toggle') {
      config.entity['command_template'] =
        `{ \"mute\": { \"text\": {% if is_state('switch.${this.receiver.id}_${zoneId}_mute', 'off') %}\"ON\"{% else %}\"OFF\"{% endif %} } }`;
    } else if (config.id === 'refresh') {
      config.entity['press_payload'] = 'REFRESH';
    }

    cmps[id] = {
      ...config.entity,
      name: `${deviceName} ${config.name}`,
      p: type,
      unique_id: id,
      default_entity_id: `${type}.${id}`,
    };
  }

  async appendMediaPlayerConfig(name: string, id: string, zone: string) {
    fs.appendFile(
      this.hass.configFile,
      `  - platform: universal
    name: ${name} Audio
    default_entity_id: media_player.${id}_media_player
    unique_id: ${id}_media_player
    commands:
      turn_on:
        action: switch.turn_on
        target:
          entity_id: switch.${id}_power
      turn_off:
        action: switch.turn_off
        target:
          entity_id: switch.${id}_power
      volume_up:
        action: button.press
        target:
          entity_id: button.${id}_volume_up
      volume_down:
        action: button.press
        target:
          entity_id: button.${id}_volume_down
      volume_mute:
        action: button.press
        target:
          entity_id: button.${id}_mute_toggle
      volume_set:
        action: fan.set_percentage
        target:
          entity_id: fan.${id}_volume
        data:
          percentage: "{{ (volume_level | float)*100 }}"

    attributes:
      state: switch.${id}_power
      is_volume_muted: switch.${id}_mute
      volume_level: sensor.${id}_volume_percent
      source_list: select.${id}_source|options
      source: state.select.${id}_source.state\n`,
    );
  }

  static getZoneId(zone: number) {
    return zone === 1 ? 'main_zone' : `zone${zone}`;
  }
}
