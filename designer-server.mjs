import {createServer} from 'node:http';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {buildEmployee,buildDesigner} from './build-pages.mjs';

const localTest=process.env.MATDAO_LOCAL_TEST==='1';
if(!localTest&&(process.env.CODESPACES!=='true'||process.env.GITHUB_USER!=='tingsu92-alt'||process.env.GITHUB_REPOSITORY!=='tingsu92-alt/matdao-business-card')){
  throw new Error('此配置台只允许在 tingsu92-alt 的指定 GitHub 私有工作区内启动。');
}
const root=fileURLToPath(new URL('.',import.meta.url));
const token=randomBytes(32).toString('hex');
const port=8765;
const origin=localTest?`http://127.0.0.1:${port}`:`https://${process.env.CODESPACE_NAME}-${port}.${process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN||'app.github.dev'}`;
let publishing=false;
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',timeout:90000,stdio:['ignore','pipe','pipe']}).trim();
const head=()=>localTest?'local-test':git('rev-parse','HEAD');
const send=(res,status,data,type='application/json')=>{
  res.writeHead(status,{'Content-Type':type+'; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Content-Security-Policy':"frame-ancestors 'none'"});
  res.end(type==='application/json'?JSON.stringify(data):data);
};
function validToken(value){
  if(typeof value!=='string'||value.length!==token.length)return false;
  return timingSafeEqual(Buffer.from(value),Buffer.from(token));
}
function validate(payload){
  if(payload.version!==2||!payload.templates||typeof payload.baseRevision!=='string')throw new Error('无效的模板数据。');
  const clean={version:2,templates:{}};
  for(const mode of ['business','regular']){
    const item=payload.templates[mode],result={};
    if(!item||typeof item!=='object')throw new Error('缺少模板。');
    for(const key of ['company','address','slogan','companyEn','addressEn','sloganEn']){
      if(typeof item[key]!=='string'||item[key].length>500)throw new Error('文字数据不正确。');
      result[key]=item[key];
    }
    for(const key of ['ink','muted','accent']){
      if(!/^#[a-f\d]{6}$/i.test(item[key]))throw new Error('颜色数据不正确。');
      result[key]=item[key];
    }
    if(!Number.isFinite(item.radius)||item.radius<0||item.radius>120)throw new Error('圆角数据不正确。');
    result.radius=item.radius;
    for(const key of ['logo','background','qr']){
      if(typeof item[key]!=='string'||item[key].length>6*1024*1024||(item[key]&&!/^data:image\/(png|jpeg|webp);base64,[a-z\d+/=]+$/i.test(item[key])))throw new Error('图片数据不正确。');
      result[key]=item[key];
    }
    result.layout={};
    for(const key of ['logo','company','affiliation','name','role','phone','email','address','addressEn','slogan','qr']){
      const box=item.layout?.[key];
      if(!Array.isArray(box)||box.length!==4||box.some(value=>!Number.isFinite(value)||value<0||value>100)||box[2]<3||box[3]<1)throw new Error('元素位置数据不正确。');
      result.layout[key]=box;
    }
    clean.templates[mode]=result;
  }
  return clean;
}
const server=createServer(async(req,res)=>{
  const path=new URL(req.url,'http://localhost').pathname;
  if(req.method==='GET'&&(path==='/'||path==='/designer.html')){
    try{send(res,200,buildDesigner(token,head()),'text/html');}catch{send(res,500,{error:'配置台启动失败。'});}
    return;
  }
  if(req.method==='GET'&&path==='/health'){send(res,200,{ready:true});return;}
  if(req.method!=='POST'||path!=='/api/publish'){send(res,404,{error:'未找到页面。'});return;}
  if(req.headers.origin!==origin||!validToken(req.headers['x-designer-session'])){send(res,403,{error:'当前页面验证已失效，请刷新配置台。'});return;}
  if(localTest){send(res,403,{error:'本地检查模式禁止发布。'});return;}
  if(publishing){send(res,409,{error:'另一项发布正在进行，请稍后重试。'});return;}
  if(!req.headers['content-type']?.startsWith('application/json')){send(res,415,{error:'请求格式不正确。'});return;}
  publishing=true;
  try{
    const chunks=[];let size=0;
    for await(const chunk of req){size+=chunk.length;if(size>35*1024*1024)throw new Error('模板过大，请压缩图片后重试。');chunks.push(chunk);}
    const payload=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    const clean=validate(payload);
    if(git('status','--porcelain'))throw new Error('工作区有未提交的修改，请先备份模板并联系维护人员处理。');
    git('pull','--ff-only','origin','main');
    if(payload.baseRevision!==head())throw new Error('线上源码已有更新，请先导出模板备份，再刷新工作区与配置台。');
    mkdirSync(new URL('templates/',import.meta.url),{recursive:true});
    writeFileSync(new URL('templates/published.json',import.meta.url),JSON.stringify(clean,null,2)+'\n');
    writeFileSync(new URL('index.html',import.meta.url),buildEmployee(clean.templates));
    git('add','--','templates/published.json','index.html');
    if(git('diff','--cached','--name-only')){
      git('-c','user.name=tingsu92-alt','-c','user.email=260798127+tingsu92-alt@users.noreply.github.com','commit','-m','Update card templates from private designer workspace');
      git('push','origin','HEAD:main');
    }
    send(res,200,{commit:head()});
  }catch(error){
    const message=error.message?.startsWith('Command failed:')?'保存或推送未完成。请先导出模板备份，保留工作区并联系维护人员处理。':error.message;
    send(res,400,{error:message||'保存失败，请先导出备份后重试。'});
  }finally{publishing=false;}
});
server.requestTimeout=120000;
server.listen(port,'127.0.0.1',()=>console.log(`设计师配置台已启动：${origin}（端口必须保持 Private）`));
