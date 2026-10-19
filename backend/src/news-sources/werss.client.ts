import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { setTimeout as delay } from 'node:timers/promises';

export interface WerssFeed {
  id: string;
  mp_name: string;
  sync_time?: number;
}
export interface WerssArticle {
  id: string;
  title: string;
  url: string;
  content?: string;
  has_content?: number;
}

@Injectable()
export class WerssClient {
  constructor(private readonly config: ConfigService) {}

  get configured(): boolean {
    return Boolean(
      this.config.get('WERSS_BASE_URL') &&
        this.config.get('WERSS_ACCESS_KEY') &&
        this.config.get('WERSS_SECRET_KEY'),
    );
  }

  get adminUrl(): string | null {
    const adminOrigin = this.config.get<string>('ADMIN_APP_URL');
    const value =
      this.config.get<string>('WERSS_ADMIN_URL') ||
      (adminOrigin ? `${adminOrigin.replace(/\/$/, '')}/werss/` : null);
    if (!value) return null;
    try {
      const url = new URL(value);
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.username ||
        url.password
      )
        return null;
      return url.href;
    } catch {
      return null;
    }
  }

  private http(): AxiosInstance {
    if (!this.configured)
      throw new ServiceUnavailableException(
        '请先配置 WeRSS 服务地址和 API 密钥',
      );
    return axios.create({
      baseURL: `${this.config.get<string>('WERSS_BASE_URL')!.replace(/\/$/, '')}/api/v1/wx/`,
      headers: {
        Authorization: `AK-SK ${this.config.get('WERSS_ACCESS_KEY')}:${this.config.get('WERSS_SECRET_KEY')}`,
      },
      timeout: 15000,
      maxRedirects: 0,
      maxContentLength: 8 * 1024 * 1024,
    });
  }

  private async get<T>(
    path: string,
    params?: Record<string, unknown>,
  ): Promise<T> {
    try {
      const res = await this.http().get(path, { params });
      if (res.data?.code !== 0) throw new Error();
      return res.data.data as T;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      throw new BadGatewayException(
        'WeRSS 请求失败，请检查服务、API 密钥和采集授权',
      );
    }
  }

  async feeds(): Promise<WerssFeed[]> {
    const items: WerssFeed[] = [];
    for (let offset = 0; ; offset += 100) {
      const page = await this.get<{ list: WerssFeed[]; total: number }>('mps', {
        offset,
        limit: 100,
      });
      items.push(...page.list);
      if (items.length >= page.total || page.list.length === 0) return items;
    }
  }

  async refresh(mpId: string): Promise<void> {
    const path = `mps/${encodeURIComponent(mpId)}`;
    const before = await this.get<WerssFeed>(path);
    // WeRSS acknowledges refresh before its collector finishes; wait for the persisted sync timestamp.
    let accepted = true;
    try {
      const res = await this.http().get(
        `mps/update/${encodeURIComponent(mpId)}`,
      );
      if (res.data?.code === 40402) accepted = false;
      else if (res.data?.code !== 0) throw new Error();
    } catch {
      throw new BadGatewayException('WeRSS 采集请求失败，请检查采集授权');
    }
    if (
      !accepted &&
      before.sync_time &&
      Date.now() / 1000 - before.sync_time < 90
    )
      return;
    for (let i = 0; i < 22; i++) {
      await delay(2000);
      const after = await this.get<WerssFeed>(path);
      if (Number(after.sync_time || 0) > Number(before.sync_time || 0)) return;
    }
    throw new BadGatewayException(
      'WeRSS 采集未完成，请在 WeRSS 检查微信读书授权和采集结果',
    );
  }

  async articles(mpId: string, offset: number) {
    return this.get<{ list: WerssArticle[]; total: number }>('articles', {
      mp_id: mpId,
      offset,
      limit: 100,
      has_content: true,
    });
  }
  async article(id: string) {
    return this.get<WerssArticle>(`articles/${encodeURIComponent(id)}`);
  }
}
