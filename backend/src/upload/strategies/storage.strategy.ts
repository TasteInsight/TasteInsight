export interface UploadResult {
  url: string;
  filename: string;
}

export interface StorageStrategy {
  upload(file: Express.Multer.File): Promise<UploadResult>;
}
