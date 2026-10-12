import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Param,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@/auth/guards/auth.guard';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import { UserProfileService } from './user-profile.service';
import { StudentGuard } from '@/auth/guards/student.guard';
import { UpdateUploadDto, UploadRevisionDto } from './dto/update-upload.dto';

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

  @Get('uploads/:id')
  getMyUpload(@Request() req: any, @Param('id') id: string) {
    return this.userService.getMyUpload(req.user.sub, id);
  }

  @Patch('uploads/:id')
  @UseGuards(StudentGuard)
  updateMyUpload(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateUploadDto,
  ) {
    return this.userService.updateMyUpload(req.user.sub, id, dto);
  }

  @Post('uploads/:id/withdraw')
  @UseGuards(StudentGuard)
  withdrawMyUpload(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UploadRevisionDto,
  ) {
    return this.userService.withdrawMyUpload(req.user.sub, id, dto.revision);
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
