import { FileValidator } from '@nestjs/common';

export class CustomFileTypeValidator extends FileValidator<{
  fileType: RegExp | string;
}> {
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
    const expectedType =
      this.validationOptions.fileType instanceof RegExp
        ? this.validationOptions.fileType.source
        : this.validationOptions.fileType;
    return `Invalid file type. Expected: ${expectedType}, but got: ${file.mimetype}`;
  }
}
