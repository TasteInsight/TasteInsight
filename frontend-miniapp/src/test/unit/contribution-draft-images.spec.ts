import {
  persistDraftImage,
  serializeDraftImage,
  restoreDraftImage,
  removeSavedDraftImages,
} from '@/pages/add-dish/composables/draft-images';
beforeEach(() => {
  (global as any).uni = {};
  URL.createObjectURL = jest.fn(() => 'blob:restored-image');
  URL.revokeObjectURL = jest.fn();
});
afterEach(() => {
  delete (global as any).fetch;
});
test('H5 persists bytes, never an expiring blob URL, and rebuilds an uploadable local URL', async () => {
  (global as any).fetch = jest.fn(async () => ({
    ok: true,
    blob: async () => new Blob(['image-content'], { type: 'image/png' }),
  }));
  const saved = await persistDraftImage({ source: 'temporary', path: 'blob:old-image' });
  const serialized = serializeDraftImage(saved);
  expect(serialized.path).toBe('');
  expect(serialized.dataUrl).toMatch(/^data:image\/png;base64,/);
  expect(JSON.stringify(serialized)).not.toContain('blob:old-image');
  expect(restoreDraftImage(serialized).path).toBe('blob:restored-image');
  expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
});
test('App uses saveFile when the filesystem manager is not available', async () => {
  uni.saveFile = jest.fn(({ success }: any) =>
    success({ savedFilePath: '/saved/app-image' })
  ) as any;
  expect(await persistDraftImage({ source: 'temporary', path: '/tmp/app-image' })).toEqual({
    source: 'saved',
    path: '/saved/app-image',
  });
});
test('cleanup only removes explicitly saved local files', () => {
  uni.removeSavedFile = jest.fn() as any;
  removeSavedDraftImages([
    { source: 'remote', path: 'https://cdn.test/photo' },
    { source: 'saved', path: '/saved/own' },
    { source: 'embedded', path: 'blob:local', dataUrl: 'data:image/png;base64,YQ==' },
  ]);
  expect(uni.removeSavedFile).toHaveBeenCalledTimes(1);
  expect(uni.removeSavedFile).toHaveBeenCalledWith(
    expect.objectContaining({ filePath: '/saved/own' })
  );
});
