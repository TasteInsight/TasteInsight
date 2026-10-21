import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LocalStorageStrategy } from './strategies/local-storage.strategy';
import { S3StorageStrategy } from './strategies/s3-storage.strategy';
import { StorageStrategy } from './strategies/storage.strategy';
import { storageConfiguration, StorageConfiguration } from './storage.config';

@Injectable()
export class StorageService implements OnModuleDestroy {
  private readonly settings: StorageConfiguration;
  private readonly adapters = new Map<string, StorageStrategy>();

  constructor(config: ConfigService) {
    this.settings = storageConfiguration((key) => config.get(key));
  }

  get defaultId(): string {
    return this.settings.defaultId;
  }
  get ids(): string[] {
    return Object.keys(this.settings.instances);
  }

  forId(id = this.defaultId): StorageStrategy {
    if (!Object.hasOwn(this.settings.instances, id))
      throw new Error('Image storage instance is not configured');
    const cached = this.adapters.get(id);
    if (cached) return cached;
    const config = this.settings.instances[id];
    const adapter =
      config.type === 'local'
        ? new LocalStorageStrategy(config)
        : new S3StorageStrategy(config);
    this.adapters.set(id, adapter);
    return adapter;
  }

  onModuleDestroy(): void {
    for (const adapter of this.adapters.values()) adapter.destroy?.();
  }
}
