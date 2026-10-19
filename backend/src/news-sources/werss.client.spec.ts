import { WerssClient } from './werss.client';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import {
  BadGatewayException,
  ServiceUnavailableException,
} from '@nestjs/common';
jest.mock('axios');
jest.mock('node:timers/promises', () => ({
  setTimeout: jest.fn().mockResolvedValue(undefined),
}));
describe('WeRSS protocol', () => {
  let get: jest.Mock, client: WerssClient;
  beforeEach(() => {
    get = jest.fn();
    (axios.create as jest.Mock).mockReturnValue({ get });
    client = new WerssClient(
      new ConfigService({
        WERSS_BASE_URL: 'http://localhost:8001',
        WERSS_ACCESS_KEY: 'ak',
        WERSS_SECRET_KEY: 'sk',
      }),
    );
  });
  const ok = (data: unknown) => ({ data: { code: 0, data } });
  it('waits for collection to finish rather than treating acceptance as completion', async () => {
    get
      .mockResolvedValueOnce(ok({ sync_time: 10 }))
      .mockResolvedValueOnce(ok({}))
      .mockResolvedValueOnce(ok({ sync_time: 10 }))
      .mockResolvedValueOnce(ok({ sync_time: 11 }));
    await client.refresh('mp');
    expect(get).toHaveBeenCalledTimes(4);
  });
  it('reports timeout when upstream accepts a refresh that never completes', async () => {
    get.mockResolvedValue(ok({ sync_time: 10 }));
    await expect(client.refresh('mp')).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });
  it('reads saved articles when upstream collection was completed moments ago', async () => {
    get
      .mockResolvedValueOnce(ok({ sync_time: Math.floor(Date.now() / 1000) }))
      .mockResolvedValueOnce({ data: { code: 40402 } });
    await client.refresh('mp');
    expect(get).toHaveBeenCalledTimes(2);
  });
  it('does not leak credentials or upstream bodies into API errors', async () => {
    get.mockRejectedValue(new Error('secret-token'));
    await expect(client.feeds()).rejects.toThrow('WeRSS 请求失败');
  });
  it('supports paginated feeds and authenticated article reads', async () => {
    get
      .mockResolvedValueOnce(
        ok({ list: [{ id: 'a', mp_name: 'A' }], total: 101 }),
      )
      .mockResolvedValueOnce(ok({ list: [], total: 101 }));
    expect(await client.feeds()).toEqual([{ id: 'a', mp_name: 'A' }]);
    expect(get).toHaveBeenLastCalledWith('mps', {
      params: { offset: 100, limit: 100 },
    });
  });
  it('requires explicit configured credentials', async () => {
    client = new WerssClient(new ConfigService({}));
    await expect(client.feeds()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
  it('keeps the browser panel address separate from internal API configuration', () => {
    const internal = new WerssClient(
      new ConfigService({ WERSS_BASE_URL: 'http://werss:8001' }),
    );
    expect(internal.adminUrl).toBeNull();
    const configured = new WerssClient(
      new ConfigService({
        WERSS_BASE_URL: 'http://werss:8001',
        WERSS_ADMIN_URL: 'https://rss.school.example/panel/',
      }),
    );
    expect(configured.adminUrl).toBe('https://rss.school.example/panel/');
  });
  it('uses the admin origin subpath as the default production panel URL', () => {
    const client = new WerssClient(
      new ConfigService({ ADMIN_APP_URL: 'https://admin.school.example/' }),
    );
    expect(client.adminUrl).toBe('https://admin.school.example/werss/');
    const external = new WerssClient(
      new ConfigService({
        ADMIN_APP_URL: 'https://admin.school.example',
        WERSS_ADMIN_URL: 'https://collector.school.example/',
      }),
    );
    expect(external.adminUrl).toBe('https://collector.school.example/');
  });
  it.each([
    ['http://localhost:8001', 'http://localhost:8001/'],
    ['https://rss.school.example', 'https://rss.school.example/'],
    ['javascript:alert(1)', null],
    ['data:text/html,hello', null],
    ['https://admin:password@rss.school.example', null],
    ['ftp://rss.school.example', null],
    ['not-a-url', null],
  ])(
    'accepts only credential-free HTTP(S) panel URLs: %s',
    (value, expected) => {
      const configured = new WerssClient(
        new ConfigService({ WERSS_ADMIN_URL: value }),
      );
      expect(configured.adminUrl).toBe(expected);
    },
  );
});
