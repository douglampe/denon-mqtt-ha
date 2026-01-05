import fs from 'fs/promises';
import { connectAsync } from 'mqtt';
import { MqttHassPublisher } from './MqttHassPublisher';

jest.mock('mqtt', () => {
  return {
    connectAsync: jest.fn(),
  };
});

describe('MqttHassPublisher', () => {
  (jest.spyOn(fs, 'writeFile') as any).mockImplementation(() => {});
  (jest.spyOn(fs, 'appendFile') as any).mockImplementation(() => {});
  describe('start()', () => {
    it('should call publish for each receiver', async () => {
      const mockPublish = jest.fn();
      jest.spyOn(MqttHassPublisher, 'create').mockImplementation(() => {
        return {
          publish: mockPublish,
        } as any;
      });
      (connectAsync as jest.Mock).mockResolvedValueOnce({
        on: jest.fn,
        endAsync: jest.fn(),
      });
      await MqttHassPublisher.start(
        [
          {
            name: 'AVR1',
            id: 'avr_1',
            ip: '1192.168.1.1234',
            sources: [],
            zones: [],
          },
          {
            name: 'AVR2',
            id: 'avr_2',
            ip: '1192.168.1.5678',
            sources: [],
            zones: [],
          },
        ],
        {
          host: 'mqtt',
          port: '1883',
          username: 'user',
          password: 'password',
          prefix: 'denon',
        },
        {
          prefix: 'homeassistant',
          configFile: 'media_player.yaml',
          shortNames: false,
        },
      );
      expect(mockPublish).toHaveBeenCalledTimes(2);
    });
  });

  describe('publish()', () => {
    it('should publish discovery payload', async () => {
      const mockPublish = jest.fn();
      (connectAsync as jest.Mock).mockResolvedValueOnce({
        publishAsync: mockPublish,
      });
      const client = await connectAsync('mqtt://foo:123');
      const publisher = new MqttHassPublisher({
        receiver: {
          id: 'avr_id',
          ip: '192.168.1.1234',
          name: 'AVR',
          sources: [
            { index: '1', display: 'DVD', code: 'DVD' },
            { index: '2', display: 'CD', code: 'CD' },
          ],
          zones: [
            { index: '1', name: 'Main', sources: ['DVD', 'CD'] },
            { index: '2', name: 'Zone2', sources: ['DVD', 'CD'] },
          ],
        },
        mqtt: {
          host: 'localhost',
          port: '1883',
          username: 'user',
          password: 'password',
          prefix: 'denon',
        },
        hass: {
          prefix: 'homeassistant',
          configFile: 'media_player.yaml',
          shortNames: false,
        },
        client,
      });

      let payloads = [] as any[],
        topics = [] as string[];

      mockPublish.mockImplementation((t, p) => {
        topics.push(t);
        payloads.push(JSON.parse(p));
      });

      await publisher.publish();

      expect(payloads.length).toEqual(2);

      expect(topics[0]).toEqual('homeassistant/device/avr_id_main_zone/config');
      expect(payloads[0].dev.ids).toEqual('avr_id_main_zone');
      expect(payloads[0].dev.name).toEqual('AVR Main');
      expect(payloads[0]['state_topic']).toEqual('denon/avr_id/main_zone/state');
      expect(payloads[0]['command_topic']).toEqual('denon/avr_id/main_zone/command');
    });
  });

  describe('publishMediaPlayerConfig()', () => {
    it('should write yaml file', async () => {
      const mockPublish = jest.fn();
      (connectAsync as jest.Mock).mockResolvedValueOnce({
        publishAsync: mockPublish,
      });
      const client = await connectAsync('mqtt://foo:123');
      const publisher = new MqttHassPublisher({
        receiver: {
          id: 'avr_id',
          ip: '192.168.1.1234',
          name: 'AVR',
          sources: [
            { index: '1', display: 'DVD', code: 'DVD' },
            { index: '2', display: 'CD', code: 'CD' },
          ],
          zones: [
            { index: '1', name: 'Main', sources: ['DVD', 'CD'] },
            { index: '2', name: 'Zone2', sources: ['DVD', 'CD'] },
          ],
        },
        mqtt: {
          host: 'localhost',
          port: '1883',
          username: 'user',
          password: 'password',
          prefix: 'denon',
        },
        hass: {
          prefix: 'homeassistant',
          configFile: 'media_player.yaml',
          shortNames: false,
        },
        client,
      });
      const mockAppendFile = jest.spyOn(fs, 'appendFile');

      await publisher.appendMediaPlayerConfig('My AVR Main Zone', 'my_avr_main_zone', 'main_zone');

      expect(mockAppendFile).toHaveBeenCalled();
    });
  });
});
