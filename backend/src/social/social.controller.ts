import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@/auth/guards/auth.guard';
import { OptionalAuthGuard } from '@/auth/guards/optional-auth.guard';
import { StudentGuard } from '@/auth/guards/student.guard';
import { SocialService } from './social.service';
import { ContentLikesService } from './content-likes.service';
import {
  CreatePostCommentDto,
  CreatePostDto,
  ReportPostDto,
  SocialQueryDto,
  UpdatePostDto,
} from './dto/social.dto';

@Controller()
export class SocialController {
  constructor(
    private readonly social: SocialService,
    private readonly likes: ContentLikesService,
  ) {}
  @Get('users/:id')
  @UseGuards(OptionalAuthGuard)
  profile(@Param('id') id: string) {
    return this.social.publicProfile(id);
  }
  @Get('user/posts')
  @UseGuards(AuthGuard)
  mine(@Request() req, @Query() query: SocialQueryDto) {
    return this.social.listPosts(query, req.user.sub, true);
  }
  @Get('posts')
  @UseGuards(OptionalAuthGuard)
  list(@Request() req, @Query() query: SocialQueryDto) {
    return this.social.listPosts(query, req.user?.sub);
  }
  @Get('posts/:id')
  @UseGuards(OptionalAuthGuard)
  get(@Request() req, @Param('id') id: string) {
    return this.social.getPost(id, req.user?.sub);
  }
  @Post('posts')
  @UseGuards(AuthGuard, StudentGuard)
  create(@Request() req, @Body() dto: CreatePostDto) {
    return this.social.createPost(req.user.sub, dto);
  }
  @Put('posts/:id')
  @UseGuards(AuthGuard, StudentGuard)
  update(@Request() req, @Param('id') id: string, @Body() dto: UpdatePostDto) {
    return this.social.updatePost(req.user.sub, id, dto);
  }
  @Delete('posts/:id')
  @UseGuards(AuthGuard)
  remove(@Request() req, @Param('id') id: string) {
    return this.social.deletePost(req.user.sub, id);
  }
  @Put('posts/:id/like')
  @UseGuards(AuthGuard, StudentGuard)
  like(@Request() req, @Param('id') id: string) {
    return this.likes.setLike(req.user.sub, 'post', id, true);
  }
  @Delete('posts/:id/like')
  @UseGuards(AuthGuard, StudentGuard)
  unlike(@Request() req, @Param('id') id: string) {
    return this.likes.setLike(req.user.sub, 'post', id, false);
  }
  @Post('posts/:id/report')
  @UseGuards(AuthGuard, StudentGuard)
  report(@Request() req, @Param('id') id: string, @Body() dto: ReportPostDto) {
    return this.social.report(req.user.sub, 'post', id, dto);
  }
  @Get('posts/:id/comments')
  @UseGuards(OptionalAuthGuard)
  comments(
    @Request() req,
    @Param('id') id: string,
    @Query() query: SocialQueryDto,
  ) {
    return this.social.listComments(id, query, req.user?.sub);
  }
  @Post('posts/:id/comments')
  @UseGuards(AuthGuard, StudentGuard)
  comment(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: CreatePostCommentDto,
  ) {
    return this.social.createComment(req.user.sub, id, dto);
  }
  @Delete('post-comments/:id')
  @UseGuards(AuthGuard)
  deleteComment(@Request() req, @Param('id') id: string) {
    return this.social.deleteComment(req.user.sub, id);
  }
  @Put('post-comments/:id/like')
  @UseGuards(AuthGuard, StudentGuard)
  likeComment(@Request() req, @Param('id') id: string) {
    return this.likes.setLike(req.user.sub, 'postComment', id, true);
  }
  @Delete('post-comments/:id/like')
  @UseGuards(AuthGuard, StudentGuard)
  unlikeComment(@Request() req, @Param('id') id: string) {
    return this.likes.setLike(req.user.sub, 'postComment', id, false);
  }
  @Post('post-comments/:id/report')
  @UseGuards(AuthGuard, StudentGuard)
  reportComment(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: ReportPostDto,
  ) {
    return this.social.report(req.user.sub, 'postComment', id, dto);
  }
}
