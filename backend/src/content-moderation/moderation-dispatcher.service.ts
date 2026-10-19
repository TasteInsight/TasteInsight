import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModerationWorkerService } from './moderation-worker.service';

@Injectable()
export class ModerationDispatcher implements OnModuleInit {
  constructor(private readonly worker: ModerationWorkerService) {}
  onModuleInit() {
    this.worker.start();
  }
}
