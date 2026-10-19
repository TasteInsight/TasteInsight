import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  UseGuards,
  Query,
  Req,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';
import { UploadAuthGuard } from './upload-auth.guard';
import { UploadResponseDto } from './dto/upload.dto';
import { ConfigService } from '@nestjs/config';
import { AuthRealm } from '@/auth/decorators/auth-realm.decorator';

@Controller('upload')
@AuthRealm('combined')
export class UploadController {
  constructor(
    private readonly uploadService: UploadService,
    private readonly configService: ConfigService,
  ) {}

  @Post('image')
  @UseGuards(UploadAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(
    @UploadedFile()
    file: Express.Multer.File,
    @Query('purpose') purpose?: string,
    @Req() request?: { user?: { type: string; sub: string } },
  ): Promise<UploadResponseDto> {
    if (purpose && purpose !== 'dish-contribution')
      throw new BadRequestException('不支持的图片用途');
    if (purpose && request?.user?.type !== 'user')
      throw new ForbiddenException('菜品贡献图片需要用户身份');
    const maxSize = this.configService.get<number>(
      'UPLOAD_MAX_FILE_SIZE',
      10485760,
    );
    const pipe = new ParseFilePipe({
      validators: [new MaxFileSizeValidator({ maxSize })],
    });
    const validatedFile = await pipe.transform(file);
    return purpose
      ? this.uploadService.uploadFile(
          validatedFile,
          request!.user!.sub,
          request!.user!.sub,
        )
      : this.uploadService.uploadFile(
          validatedFile,
          undefined,
          request?.user?.type === 'user' ? request.user.sub : undefined,
        );
  }
}

@Controller('upload')
@AuthRealm('user')
export class PublicUploadController extends UploadController {}

@Controller('upload')
@AuthRealm('admin')
export class AdminUploadController extends UploadController {}
