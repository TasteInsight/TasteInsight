import { FileValidator } from '@nestjs/common';

export class CustomFileTypeValidator extends FileValidator<{ fileType: RegExp | string }> {
  isValid(file: any): boolean {
    const { fileType } = this.validationOptions;
    if (!file.mimetype) {
      return false;
    }
    
    if (fileType instanceof RegExp) {
      return fileType.test(file.mimetype);
    }
    
    return file.mimetype.includes(fileType);
  }

  buildErrorMessage(file: any): string {
    return `Validation failed (current file type is ${file.mimetype}, expected type is ${this.validationOptions.fileType})`;
  }
}
