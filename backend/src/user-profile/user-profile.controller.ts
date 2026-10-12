import {
  Body,
  Controller,
  Delete,
  Get,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@/auth/guards/auth.guard';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import { UserProfileService } from './user-profile.service';

@Controller('user')
@UseGuards(AuthGuard)
export class UserProfileController {
  constructor(private readonly userService: UserProfileService) {}

  @Get('profile')
  getUserProfile(@Request() req: any) {
    return this.userService.getUserProfile(req.user.sub);
  }

  @Put('profile')
  updateUserProfile(
    @Request() req: any,
    @Body() updateUserProfileDto: UpdateUserProfileDto,
  ) {
    return this.userService.updateUserProfile(
      req.user.sub,
      updateUserProfileDto,
    );
  }

  @Get('reviews')
  getMyReviews(
    @Request() req: any,
    @Query('page') page: number = 1,
    @Query('pageSize') pageSize: number = 20,
  ) {
    return this.userService.getMyReviews(req.user.sub, page, pageSize);
  }

  @Get('favorites')
  getMyFavorites(
    @Request() req: any,
    @Query('page') page: number = 1,
    @Query('pageSize') pageSize: number = 20,
  ) {
    return this.userService.getMyFavorites(req.user.sub, page, pageSize);
  }

  @Get('history')
  getBrowseHistory(
    @Request() req: any,
    @Query('page') page: number = 1,
    @Query('pageSize') pageSize: number = 50,
  ) {
    return this.userService.getBrowseHistory(req.user.sub, page, pageSize);
  }

  @Delete('history')
  clearBrowseHistory(@Request() req: any) {
    return this.userService.clearBrowseHistory(req.user.sub);
  }

  @Get('uploads')
  getMyUploads(
    @Request() req: any,
    @Query('page') page: number = 1,
    @Query('pageSize') pageSize: number = 20,
  ) {
    return this.userService.getMyUploads(req.user.sub, page, pageSize);
  }

  @Get('reports')
  getMyReports(
    @Request() req: any,
    @Query('page') page: number = 1,
    @Query('pageSize') pageSize: number = 20,
  ) {
    return this.userService.getMyReports(req.user.sub, page, pageSize);
  }
}
