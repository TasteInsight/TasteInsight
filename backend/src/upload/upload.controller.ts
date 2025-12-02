import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';
import { AuthGuard } from '@/auth/guards/auth.guard';
import { CustomFileTypeValidator } from './validators/custom-file-type.validator';
import { UploadResponseDto } from './dto/upload.dto';
import { ConfigService } from '@nestjs/config';

@Controller('upload')
export class UploadController {
  constructor(
    private readonly uploadService: UploadService,
    private readonly configService: ConfigService,
  ) {}

  @Post('image')
  @UseGuards(AuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(
    @UploadedFile()
    file: Express.Multer.File,
  ): Promise<UploadResponseDto> {
    const maxSize = parseInt(
      this.configService.get('UPLOAD_MAX_FILE_SIZE', '10485760'),
    );
    const pipe = new ParseFilePipe({
      validators: [
        new MaxFileSizeValidator({ maxSize }),
        new CustomFileTypeValidator({
          fileType: /^image\/(jpeg|jpg|png|gif|webp)$/,
        }),
      ],
    });
    const validatedFile = await pipe.transform(file);
    return this.uploadService.uploadFile(validatedFile);
  }
}
