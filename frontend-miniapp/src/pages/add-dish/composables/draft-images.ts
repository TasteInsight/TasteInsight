export interface DraftImage {
  source: 'temporary' | 'saved' | 'embedded' | 'remote';
  path: string;
  dataUrl?: string;
  uploadedUrl?: string;
}

/** 小程序/App 使用持久文件；H5 保存图片内容，不保存刷新后失效的 blob 地址。 */
export async function persistDraftImage(image: DraftImage): Promise<DraftImage> {
  if (image.source !== 'temporary') return image;
  const fileSystem = uni.getFileSystemManager?.();
  if (fileSystem?.saveFile) {
    const path = await new Promise<string>((resolve, reject) =>
      fileSystem.saveFile({
        tempFilePath: image.path,
        success: result => resolve(result.savedFilePath),
        fail: reject,
      })
    );
    return { ...image, source: 'saved', path };
  }
  if (
    /^(blob:|data:)/.test(image.path) &&
    typeof FileReader !== 'undefined' &&
    typeof fetch !== 'undefined'
  ) {
    const response = await fetch(image.path);
    if (!response.ok) throw new Error('图片读取失败，请重新选择');
    const blob = await response.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('图片读取失败，请重新选择'));
      reader.readAsDataURL(blob);
    });
    return { ...image, source: 'embedded', dataUrl };
  }
  if (uni.saveFile) {
    const path = await new Promise<string>((resolve, reject) =>
      uni.saveFile({
        tempFilePath: image.path,
        success: result => resolve(result.savedFilePath),
        fail: reject,
      })
    );
    return { ...image, source: 'saved', path };
  }
  throw new Error('当前平台无法保存图片草稿，请保持页面打开并提交');
}

export function serializeDraftImage(image: DraftImage): DraftImage {
  return image.source === 'embedded'
    ? { ...image, path: '', dataUrl: image.dataUrl }
    : { ...image };
}

export function restoreDraftImage(image: DraftImage): DraftImage {
  if (image.source !== 'embedded' || !image.dataUrl) return { ...image };
  const [header, encoded] = image.dataUrl.split(',');
  const bytes = Uint8Array.from(atob(encoded), char => char.charCodeAt(0));
  const type = header.slice(5, header.indexOf(';'));
  return { ...image, path: URL.createObjectURL(new Blob([bytes], { type })) };
}

export function removeSavedDraftImages(images: DraftImage[]) {
  for (const path of new Set(
    images.filter(image => image.source === 'saved').map(image => image.path)
  )) {
    try {
      const fileSystem = uni.getFileSystemManager?.();
      const options = { filePath: path, fail: () => undefined };
      if (fileSystem?.removeSavedFile) fileSystem.removeSavedFile(options);
      else uni.removeSavedFile?.(options);
    } catch {
      /* The OS may already have removed a missing draft file. */
    }
  }
}
