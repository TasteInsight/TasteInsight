export class UploadResponseDto {
  code: number;
  message: string;
  data: {
    url: string;
    filename: string;
  };
}
