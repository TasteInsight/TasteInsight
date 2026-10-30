import type { Plugin } from 'vite';
import { EXTNAME_JS_RE, normalizePath, parseSubpackagesRootOnce } from '@dcloudio/uni-cli-shared';

export function uniMpCommonChunks(): Plugin {
  return {
    name: 'project-mp-common-chunks',
    enforce: 'post',
    configResolved(config) {
      const inputDir = `${normalizePath(process.env.UNI_INPUT_DIR!)}/`;
      const roots = parseSubpackagesRootOnce(inputDir, 'mp-weixin').map(
        root => `${root.replace(/\/$/, '')}/`
      );
      const output = config.build.rollupOptions.output;
      for (const options of Array.isArray(output) ? output : [output]) {
        if (!options || typeof options.manualChunks !== 'function') continue;
        const assignChunk = options.manualChunks;
        options.manualChunks = (id, meta) => {
          const chunk = assignChunk(id, meta);
          const filename = normalizePath(id).split('?')[0];
          // Shared application scripts retain one instance in the main runtime chunk.
          if (
            typeof chunk === 'string' &&
            filename.startsWith(inputDir) &&
            EXTNAME_JS_RE.test(filename) &&
            !roots.some(root => chunk.startsWith(root))
          ) {
            return 'common/vendor';
          }
          return chunk;
        };
      }
    },
  };
}
