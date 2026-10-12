import {
  Controller,
  Get,
  Param,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsIn, IsInt, Max, Min } from 'class-validator';
import { AuthGuard } from '@/auth/guards/auth.guard';
import {
  NotificationService,
  type NotificationScope,
} from './notification.service';

export class NotificationQueryDto {
  @Type(() => Number) @IsInt() @Min(1) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(50) pageSize = 20;
  @IsIn(['all', 'service']) scope: NotificationScope = 'all';
}

@Controller('notifications')
@UseGuards(AuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationService) {}
  @Get() list(@Request() req, @Query() query: NotificationQueryDto) {
    return this.notifications.getInbox(
      req.user.sub,
      query.page,
      query.pageSize,
      query.scope,
    );
  }
  @Get('unread-count') count(
    @Request() req,
    @Query() query: NotificationQueryDto,
  ) {
    return this.notifications.unreadCount(req.user.sub, query.scope);
  }
  @Get('weekly/:weekKey') weekly(@Param('weekKey') weekKey: string) {
    return this.notifications.getWeeklyCollection(weekKey);
  }
  @Put('read-all') readAll(
    @Request() req,
    @Query() query: NotificationQueryDto,
  ) {
    return this.notifications.read(req.user.sub, undefined, query.scope);
  }
  @Put(':id/read') read(
    @Request() req,
    @Param('id') id: string,
    @Query() query: NotificationQueryDto,
  ) {
    return this.notifications.read(req.user.sub, id, query.scope);
  }
}
