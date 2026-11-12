import {readFileSync, writeFileSync} from 'node:fs';
const read = name => readFileSync(new URL('src/' + name, import.meta.url), 'utf8');
const image = name => 'data:image/png;base64,' + readFileSync(new URL('src/assets/' + name, import.meta.url)).toString('base64');
const card = read('card.js')
  .replace("/*__DEFAULT_LOGO__*/ ''", () => JSON.stringify(image('brand-logos-business-transparent.png')))
  .replace("/*__DEFAULT_REGULAR_LOGO__*/ ''", () => JSON.stringify(image('brand-logos-regular-optical.png')))
  .replace("/*__DEFAULT_QR__*/ ''", () => JSON.stringify(image('fixed-qr-cropped.png')));
const html = read('employee.html')
  .replace('<!--__DESIGNER_LINK__-->', '')
  .replace('/*__CSS__*/', () => read('style.css'))
  .replace('/*__CARD__*/', () => card)
  .replace('/*__PAGE__*/', () => read('zip.js') + '\n' + read('employee.js'));
writeFileSync(new URL('index.html', import.meta.url), html);
