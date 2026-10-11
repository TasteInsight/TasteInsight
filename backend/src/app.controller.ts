import { Controller, Get, Header } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  @Header('Cache-Control', 'no-store')
  getHealth() {
    return this.appService.getHealth();
  }
}
