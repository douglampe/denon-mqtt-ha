import { Command } from 'commander';
import fs from 'fs/promises';
import path from 'path';
import { ReceiverConfig } from './ReceiverConfig';
import { MqttHassPublisher } from './MqttHassPublisher';

export class CliParser {
  public static isTest: boolean;
  public static log: (message: any) => void = console.log;

  public static async run(options: { name: string; version: string; args: string[] }) {
    const program = new Command();

    if (CliParser.isTest) {
      program.exitOverride().configureOutput({
        writeOut: CliParser.log,
        writeErr: CliParser.log,
        getOutHelpWidth: () => 160,
        getErrHelpWidth: () => 160,
      });
    }

    program.name(options.name).version(options.version, '-i, --info', 'Display current version number');

    program
      .option('-f, --file <file>', 'Name of configuration JSON file', 'receivers.json')
      .option('-m, --mqtt <url>', 'MQTT URL', process.env.DMQTT_HOST ?? 'localhost')
      .option('-u, --username <username>', 'MQTT username', process.env.DMQTT_USER ?? 'user')
      .option('-p, --password <password>', 'MQTT password', process.env.DMQTT_PASSWORD ?? 'password')
      .option('--port', 'MQTT port <port>', process.env.DMQTT_PORT ?? '1883')
      .option('--prefix', 'MQTT topic prefix <prefix>', process.env.DMQTT_PREFIX ?? 'denon')
      .option('-h --hass', 'Home Assistant discovery topic Prefix <prefix>', process.env.DMQTT_HASS_PREFIX ?? 'homeassistant')
      .option('-o --output', 'Home Assistant Media Player config file <output>', process.env.DMQTT_HASS_OUTPUT ?? 'media_player.yaml')
      .action(CliParser.start);

    await program.parseAsync(options.args);
  }

  public static async start(_opts: any, command: Command) {
    const opts = command.optsWithGlobals();

    const receivers = [] as ReceiverConfig[];
    if (opts.file) {
      const file = path.resolve(opts.file);
      const stat = await fs.stat(file);
      if (!stat.isFile()) {
        throw new Error(`File ${opts.file} not found (path: ${file})`);
      }

      try {
        const json = await fs.readFile(file);
        const fileConfig = JSON.parse(json.toString());
        for (const config of fileConfig) {
          receivers.push(config);
        }
      } catch (err) {
        throw new Error(`Error parsing file ${opts.file}: ${err}`);
      }
    }

    await MqttHassPublisher.start(
      receivers,
      {
        host: opts.mqtt,
        port: opts.port,
        username: opts.username,
        password: opts.password,
        prefix: opts.prefix,
      },
      {
        prefix: opts.hass,
        configFile: opts.output,
      },
    );
  }
}
