const { mkdir, writeFile } = require('node:fs/promises');
const path = require('node:path');
const sharp = require('../../backend/node_modules/sharp');

const icons = {
  user: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20v-1.5a7 7 0 0 1 14 0V20"/>',
  bell: '<path d="M6 10a6 6 0 0 1 12 0v4l2 3H4l2-3v-4Z"/><path d="M10 20h4M12 2v2"/>',
  settings:
    '<path d="m9.5 3-.6 2.2-1.8 1-2.2-.6-2.5 4.3L4 11.5v2l-1.6 1.6 2.5 4.3 2.2-.6 1.8 1 .6 2.2h5l.6-2.2 1.8-1 2.2.6 2.5-4.3-1.6-1.6v-2l1.6-1.6-2.5-4.3-2.2.6-1.8-1-.6-2.2h-5Z"/><circle cx="12" cy="12.5" r="3"/>',
  edit: '<path d="m14.5 5.5 4 4M4 20l4.5-1 11-11a2.8 2.8 0 0 0-4-4l-11 11L4 20Z"/>',
  bookmark: '<path d="M6 4h12v17l-6-4-6 4V4Z"/>',
  history: '<path d="M4 8a8 8 0 1 1-1 7M3 4v5h5M12 7v5l3 2"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z"/>',
  shield:
    '<path d="m12 3 8 3v5c0 5-4.5 8-8 10-3.5-2-8-5-8-10V6l8-3Z"/><path d="m8.5 12 2.3 2.3 4.7-4.6"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  'eye-off':
    '<path d="m3 3 18 18M9.5 5.3A12 12 0 0 1 12 5c6.5 0 10 7 10 7a20 20 0 0 1-3.2 4.1M6.1 6.1A20 20 0 0 0 2 12s3.5 7 10 7a12 12 0 0 0 5.9-1.9M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  'chevron-right': '<path d="m9 5 7 7-7 7"/>',
  'chevron-down': '<path d="m5 9 7 7 7-7"/>',
  plus: '<path d="M12 4v16M4 12h16"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',
  calendar:
    '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M7 14h3M14 14h3M7 17h3"/>',
  chat: '<path d="M20 11.5a8 8 0 0 1-8 8H4l1.8-4.2a8 8 0 1 1 14.2-3.8Z"/><path d="M8 10h8M8 13.5h5"/>',
  users:
    '<circle cx="9" cy="8" r="3"/><path d="M3 20v-1a6 6 0 0 1 12 0v1M16 5a3 3 0 0 1 0 6M17 14a5 5 0 0 1 4 5v1"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v.1"/>',
  logout: '<path d="M10 4H4v16h6M10 12h11m-4-4 4 4-4 4"/>',
};

const tones = {
  muted: '#667085',
  primary: '#660874',
  inverse: '#ffffff',
  danger: '#b42318',
};

function svgFor(name, color) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${icons[name]}</svg>\n`;
}

async function generate() {
  const output = path.resolve(__dirname, '../src/static/icons/ui');
  await mkdir(path.join(output, 'source'), { recursive: true });
  for (const name of Object.keys(icons)) {
    await writeFile(path.join(output, 'source', `${name}.svg`), svgFor(name, 'currentColor'));
    for (const [tone, color] of Object.entries(tones)) {
      await sharp(Buffer.from(svgFor(name, color)), { density: 216 })
        .resize(72, 72)
        .png()
        .toFile(path.join(output, `${name}-${tone}.png`));
    }
  }
  console.log(
    `Generated ${Object.keys(icons).length} line icons in ${Object.keys(tones).length} tones.`
  );
}

module.exports = { icons, tones, svgFor };

if (require.main === module) {
  generate().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
