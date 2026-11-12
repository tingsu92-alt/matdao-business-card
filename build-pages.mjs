import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const read = name => readFileSync(new URL('src/' + name, import.meta.url), 'utf8');
const image = name => 'data:image/png;base64,' + readFileSync(new URL('src/assets/' + name, import.meta.url)).toString('base64');
const defaultCard = read('card.js')
  .replace("/*__DEFAULT_LOGO__*/ ''", () => JSON.stringify(image('brand-logos-business-transparent.png')))
  .replace("/*__DEFAULT_REGULAR_LOGO__*/ ''", () => JSON.stringify(image('brand-logos-regular-optical.png')))
  .replace("/*__DEFAULT_QR__*/ ''", () => JSON.stringify(image('fixed-qr-cropped.png')));
export function loadTemplates(){
  const path=new URL('templates/published.json',import.meta.url);
  return existsSync(path)?JSON.parse(readFileSync(path,'utf8')).templates:null;
}
function cardSource(templates){
  return defaultCard.replace('/*__TEMPLATES__*/ null',()=>JSON.stringify(templates).replaceAll('<','\\u003c'));
}
export function buildEmployee(templates=loadTemplates()){
return read('employee.html')
  .replace('<!--__DESIGNER_LINK__-->', '')
  .replace('/*__CSS__*/', () => read('style.css'))
  .replace('/*__CARD__*/', () => cardSource(templates))
  .replace('/*__PAGE__*/', () => read('zip.js') + '\n' + read('employee.js'));
}
export function buildDesigner(session,revision){
  return read('designer.html')
    .replace('/*__CSS__*/',()=>read('style.css'))
    .replace('/*__DESIGNER_SESSION__*/',()=>`const DESIGNER_SESSION=${JSON.stringify(session)};let DESIGNER_REVISION=${JSON.stringify(revision)};`)
    .replace('/*__CARD__*/',()=>cardSource(loadTemplates()))
    .replace('/*__PAGE__*/',()=>read('designer.js'));
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
  writeFileSync(new URL('index.html', import.meta.url), buildEmployee());
}
