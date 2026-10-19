import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ModerationAssetsService } from './moderation-assets.service';
import { WechatModerationCallbackService } from './wechat-callback.service';
import { ModerationWorkerService } from './moderation-worker.service';

@Controller('content-moderation')
export class ModerationPublicController {
  constructor(
    private readonly assets: ModerationAssetsService,
    private readonly callbacks: WechatModerationCallbackService,
    private readonly worker: ModerationWorkerService,
  ) {}

  @Get('images/:id')
  async image(
    @Param('id') id: string,
    @Query('expires') expires: string,
    @Query('signature') signature: string,
    @Res() res: Response,
  ) {
    const { asset, buffer } = await this.assets.read(id, expires, signature);
    res
      .set({
        'Content-Type': asset.mimeType,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
      })
      .send(buffer);
  }
  @Get('wechat/callback')
  echo(@Query() query: Record<string, string>, @Res() res: Response) {
    res.type('text/plain').send(this.callbacks.verifyEcho(query));
  }
  @Post('wechat/callback')
  @HttpCode(200)
  async callback(
    @Query() query: Record<string, string>,
    @Body() body: unknown,
    @Res() res: Response,
  ) {
    const result = this.callbacks.decode(query, body);
    if (result) await this.worker.receive(result.traceId, result.decision);
    res.type('text/plain').send('success');
  }
}
