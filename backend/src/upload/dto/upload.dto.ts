export class UploadResultDto {
  url: string;
  filename: string;
}

export class UploadResponseDto {
  code: number;
  message: string;
  data: UploadResultDto;
}
