import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { resolve } from 'path';
import type { ServerResponse } from 'http';

@Module({
  imports: [
    ServeStaticModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          rootPath: resolve(
            process.cwd(),
            config.get<string>('UPLOAD_LOCAL_PATH', './uploads'),
          ),
          serveRoot: '/images',
          serveStaticOptions: {
            setHeaders: (response: ServerResponse) => {
              response.setHeader('X-Content-Type-Options', 'nosniff');
              response.setHeader(
                'Content-Security-Policy',
                "default-src 'none'; sandbox",
              );
            },
          },
        },
      ],
    }),
  ],
})
export class PublicFilesModule {}
