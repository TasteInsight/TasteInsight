const { mkdir } = require('node:fs/promises');
const path = require('node:path');
const sharp = require('../../backend/node_modules/sharp');

async function generate() {
  const source = path.resolve(__dirname, '../src/static/logo.png');
  const output = path.resolve(__dirname, '../src/static/app-icons');
  await mkdir(output, { recursive: true });

  for (const size of [72, 96, 144, 192]) {
    const logoSize = Math.round(size * 0.75);
    const logo = await sharp(source).resize(logoSize, logoSize).png().toBuffer();
    await sharp({
      create: { width: size, height: size, channels: 3, background: '#ffffff' },
    })
      .composite([{ input: logo, gravity: 'centre' }])
      .png()
      .toFile(path.join(output, `android-${size}.png`));
  }
  console.log('Generated Android launcher icons from static/logo.png.');
}

generate().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
