export interface UploadResult {
  url: string;
  filename: string;
}

export interface StorageStrategy {
  upload(
    file: Express.Multer.File,
    privateFile?: boolean,
  ): Promise<UploadResult>;
  read(storageKey: string): Promise<Buffer>;
  remove(storageKey: string): Promise<void>;
}
