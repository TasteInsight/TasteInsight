import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@/auth/guards/auth.guard';
import { StudentGuard } from '@/auth/guards/student.guard';
import { DiningInvitesService } from './dining-invites.service';
import {
  CreateDiningInviteDto,
  DecideDiningApplicationDto,
} from './dto/dining-invite.dto';
import { MealPlanQueryDto } from './dto/meal-plan-query.dto';

@Controller()
@UseGuards(AuthGuard)
export class DiningInvitesController {
  constructor(private readonly invites: DiningInvitesService) {}

  @Post('meal-plans/:id/dining-invites')
  @UseGuards(StudentGuard)
  create(
    @Param('id') id: string,
    @Request() req: any,
    @Body() dto: CreateDiningInviteDto,
  ) {
    return this.invites.create(id, req.user.sub, dto);
  }

  @Get('dining-invites')
  list(@Request() req: any, @Query() query: MealPlanQueryDto) {
    return this.invites.list(req.user.sub, query, false);
  }

  @Get('dining-invites/mine')
  mine(@Request() req: any, @Query() query: MealPlanQueryDto) {
    return this.invites.list(req.user.sub, query, true);
  }

  @Get('dining-invites/:id')
  detail(@Param('id') id: string, @Request() req: any) {
    return this.invites.get(id, req.user.sub);
  }

  @Post('dining-invites/:id/applications')
  @UseGuards(StudentGuard)
  @HttpCode(200)
  apply(@Param('id') id: string, @Request() req: any) {
    return this.invites.apply(id, req.user.sub);
  }

  @Put('dining-invites/:id/applications/:applicationId')
  @UseGuards(StudentGuard)
  decide(
    @Param('id') id: string,
    @Param('applicationId') applicationId: string,
    @Request() req: any,
    @Body() dto: DecideDiningApplicationDto,
  ) {
    return this.invites.decide(id, applicationId, req.user.sub, dto.action);
  }

  @Patch('dining-invites/:id/applications/:applicationId')
  @UseGuards(StudentGuard)
  patchDecision(
    @Param('id') id: string,
    @Param('applicationId') applicationId: string,
    @Request() req: { user: { sub: string } },
    @Body() dto: DecideDiningApplicationDto,
  ) {
    return this.decide(id, applicationId, req, dto);
  }

  @Delete('dining-invites/:id/applications/me')
  withdraw(@Param('id') id: string, @Request() req: any) {
    return this.invites.withdraw(id, req.user.sub);
  }

  @Delete('dining-invites/:id')
  cancel(@Param('id') id: string, @Request() req: any) {
    return this.invites.cancel(id, req.user.sub);
  }
}
