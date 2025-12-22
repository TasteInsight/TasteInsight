import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma.service';
import { AIProviderConfig } from './ai-provider/base-ai-provider.interface';

@Injectable()
export class AIConfigService {
  private readonly logger = new Logger(AIConfigService.name);
  private configCache: Map<string, string> = new Map();

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Get AI provider configuration
   * Priority: Database > Environment Variables
   */
  async getProviderConfig(): Promise<AIProviderConfig> {
    const provider = await this.get('ai.provider', 'openai');
    const apiKey = await this.get('ai.api_key', '');
    const model = await this.get('ai.model', 'gpt-4o-mini');
    const baseUrl = await this.get('ai.base_url', '');

    // Fallback to environment variables if not in database
    const finalApiKey =
      apiKey || this.configService.get<string>('AI_API_KEY') || '';
    const finalModel =
      model || this.configService.get<string>('AI_MODEL') || 'gpt-4o-mini';
    const finalBaseUrl =
      baseUrl || this.configService.get<string>('AI_BASE_URL');

    return {
      apiKey: finalApiKey,
      model: finalModel,
      baseUrl: finalBaseUrl || undefined,
    };
  }

  /**
   * Get a configuration value
   * @param key Configuration key (e.g., 'ai.provider')
   * @param defaultValue Default value if not found
   */
  async get(key: string, defaultValue: string = ''): Promise<string> {
    // Check cache first
    const cached = this.configCache.get(key);
    if (cached !== undefined) {
      return cached;
    }

    try {
      // Try to get from database
      const config = await this.prisma.aIConfig.findUnique({
        where: { key },
      });

      if (config) {
        this.configCache.set(key, config.value);
        return config.value;
      }
    } catch (error) {
      this.logger.warn(`Failed to get config from database: ${key}`, error);
    }

    // Return default value
    return defaultValue;
  }

  /**
   * Set a configuration value
   * @param key Configuration key
   * @param value Configuration value
   * @param category Configuration category
   */
  async set(
    key: string,
    value: string,
    category: string = 'general',
  ): Promise<void> {
    try {
      await this.prisma.aIConfig.upsert({
        where: { key },
        create: { key, value, category },
        update: { value, category },
      });

      // Update cache
      this.configCache.set(key, value);
    } catch (error) {
      this.logger.error(`Failed to set config: ${key}`, error);
      throw error;
    }
  }

  /**
   * Clear configuration cache
   */
  clearCache(): void {
    this.configCache.clear();
  }
}
