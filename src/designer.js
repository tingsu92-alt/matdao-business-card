const EMPLOYEE_PAGE = /*__EMPLOYEE_PAGE__*/ '';
const textKeys=['company','address','slogan','companyEn','addressEn','sloganEn'];
const colorKeys=['ink','muted','accent'];
const imageKeys=['background','logo','qr'];
const uploadTargets=[
  {id:'background',key:'background'},
  {id:'qr',key:'qr'},
  {id:'logo-business',key:'logo',version:'business'},
  {id:'logo-regular',key:'logo',version:'regular'},
];
const editable=[...textKeys,...colorKeys,'radius'];
const elementNames={logo:'Logo / 品牌简称',company:'公司全称',affiliation:'其他信息',name:'姓名',role:'职位',phone:'电话',email:'邮箱',address:'中文地址',addressEn:'英文地址',slogan:'口号',qr:'二维码'};
const limits=[[0,99],[0,99],[3,100],[1,100]];
const maxBytes=4*1024*1024;
let templates=Object.fromEntries(Object.entries(TEMPLATES ?? DEFAULTS).map(([key,template])=>[key,structuredClone(template)]));
let mode='business', busy=0;
const renderZh=makeRenderer($('card-zh'));
const renderEn=makeRenderer($('card-en'));
const clamp=(value,min,max,fallback)=>Number.isFinite(value)?Math.min(max,Math.max(min,value)):fallback;
function status(message,error=false){
  $('status').textContent=message;
  $('status').className='note template-status '+(error?'status-error':'status-ok');
}
function preview(){
  $('editing').textContent=MODES[mode];
  $('mode-label').textContent=MODES[mode];
  return Promise.all([renderZh(mode,templates[mode],SAMPLE,'zh'),renderEn(mode,templates[mode],EN_SAMPLE,'en')]);
}
const select=document.createElement('select');
select.id='element';
for(const [value,title] of Object.entries(elementNames)) select.add(new Option(title,value));
const selector=document.createElement('label');
selector.className='wide';
selector.append('元素',select);
$('layout').append(selector);
const fields=['左边距 %','上边距 %','宽度 %','高度 / 字号 %'].map((caption,index)=>{
  const label=document.createElement('label');
  const input=document.createElement('input');
  input.type='number';
  [input.min,input.max]=limits[index];
  input.step='0.1';
  label.append(caption,input);
  $('layout').append(label);
  input.addEventListener('input',()=>{
    if(!Number.isFinite(input.valueAsNumber)) return;
    const box=templates[mode].layout[select.value];
    box[index]=clamp(input.valueAsNumber,...limits[index],box[index]);
    void preview();
  });
  input.addEventListener('change',syncLayout);
  return input;
});
function syncLayout(){
  templates[mode].layout[select.value].forEach((value,index)=>fields[index].value=value);
}
function sync(){
  for(const key of editable) $(key).value=templates[mode][key];
  for(const target of uploadTargets){
    const version=target.version??mode;
    const hasImage=Boolean(templates[version][target.key]);
    const remove=document.querySelector('[data-remove="'+target.id+'"]');
    remove.disabled=busy>0||!hasImage;
    remove.textContent=hasImage?'移除':'未上传';
    if(target.version){
      const thumbnail=$(target.id+'-thumbnail');
      $(target.id+'-state').hidden=!hasImage;
      if(hasImage){
        const source=templates[version][target.key];
        if(thumbnail.getAttribute('src')!==source) thumbnail.src=source;
      }else{
        thumbnail.removeAttribute('src');
      }
    }
  }
  syncLayout();
  void preview();
}
select.addEventListener('change',syncLayout);
bindSwitch(next=>{
  if(next!==mode){
    for(const target of uploadTargets){
      if(!target.version) $(target.id).value='';
    }
  }
  mode=next;
  sync();
});
for(const key of editable){
  $(key).addEventListener('input',()=>{
    const value=key==='radius'?clamp($(key).valueAsNumber,0,120,templates[mode].radius):$(key).value;
    templates[mode][key]=value;
    void preview();
  });
  $(key).addEventListener('change',()=>$(key).value=templates[mode][key]);
}
function readData(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(reader.result);
    reader.onerror=()=>reject(new Error('读取失败'));
    reader.readAsDataURL(file);
  });
}
const validData=value=>typeof value==='string' && value.length<=maxBytes*1.34+128 && /^data:image\/(png|jpeg|webp);base64,[a-z0-9+/]+=*$/i.test(value);
function working(delta){
  busy+=delta;
  for(const id of ['publish','backup','restore',...uploadTargets.map(target=>target.id)]) $(id).disabled=busy>0;
  for(const target of uploadTargets){
    const version=target.version??mode;
    document.querySelector('[data-remove="'+target.id+'"]').disabled=busy>0||!templates[version][target.key];
  }
}
for(const target of uploadTargets){
  const {id,key}=target;
  $(id).addEventListener('change',async ()=>{
    const file=$(id).files[0], version=target.version??mode;
    if(!file) return;
    if(file.size>maxBytes || !['image/png','image/jpeg','image/webp'].includes(file.type)){
      status('请选择不超过 4 MB 的 PNG、JPG 或 WebP 图片。',true);
      $(id).value='';
      return;
    }
    working(1);
    try{
      const data=await readData(file);
      if(!validData(data)||!await getImage(data)) throw new Error('图片读取失败');
      assets.delete(templates[version][key]);
      templates[version][key]=data;
      sync();
      status(MODES[version]+(key==='logo'?' Logo':'素材')+'已载入。');
    }catch{
      $(id).value='';
      status('无法读取这张图片，请检查文件。',true);
    }
    finally{working(-1);}
  });
  document.querySelector('[data-remove="'+id+'"]').addEventListener('click',()=>{
    const version=target.version??mode;
    assets.delete(templates[version][key]);
    templates[version][key]='';
    $(id).value='';
    sync();
    status('已移除'+MODES[version]+(key==='logo'?' Logo。':'素材。'));
  });
}
function readTemplate(input,version){
  const entry={};
  for(const key of textKeys){
    const value=input[key]??BRAND[key];
    if(typeof value!=='string') throw new Error('文字');
    entry[key]=value.slice(0,+$(key).maxLength);
  }
  for(const key of colorKeys){
    if(typeof input[key]!=='string'||!/^#[a-f\d]{6}$/i.test(input[key])) throw new Error('颜色');
    entry[key]=input[key];
  }
  entry.radius=clamp(input.radius,0,120,68);
  for(const key of imageKeys){
    if(input[key]!==''&&!validData(input[key])) throw new Error('图片');
    entry[key]=input[key];
  }
  entry.layout=Object.fromEntries(Object.entries(DEFAULT_LAYOUT).map(([key,values])=>[
    key,values.map((fallback,index)=>clamp(version===2?input.layout?.[key]?.[index]:undefined,...limits[index],fallback))
  ]));
  return entry;
}
$('backup').addEventListener('click',()=>{
  downloadFile(new Blob([JSON.stringify({version:2,templates},null,2)],{type:'application/json'}),'新材道电子名片模板.json');
  status('已生成模板备份。');
});
$('restore').addEventListener('change',async ()=>{
  const file=$('restore').files[0];
  if(!file) return;
  working(1);
  try{
    if(file.size>35*1024*1024) throw new Error('备份过大');
    const payload=JSON.parse(await file.text());
    if(![1,2].includes(payload.version)) throw new Error('版本');
    const loaded=Object.fromEntries(Object.keys(MODES).map(key=>[key,readTemplate(payload.templates[key],payload.version)]));
    assets.clear();
    const pictures=await Promise.all(Object.values(loaded).flatMap(entry=>imageKeys.map(key=>entry[key])).filter(Boolean).map(getImage));
    if(pictures.some(picture=>!picture)) throw new Error('损坏的图片');
    for(const target of uploadTargets) $(target.id).value='';
    templates=loaded;
    sync();
    status(payload.version===1?'已恢复旧版素材和文案，并套用新版排版。':'两版模板已恢复。');
  }catch{status('无法导入，请选择有效的名片模板备份。',true);}
  finally{$('restore').value='';working(-1);}
});
$('publish').addEventListener('click',async()=>{
  if(!window.confirm('将当前两套模板保存到 GitHub 并更新员工网页？')) return;
  working(1);
  status('正在保存并发布，请稍候。');
  try{
    const response=await fetch('/api/publish',{
      method:'POST',headers:{'Content-Type':'application/json','X-Designer-Session':DESIGNER_SESSION},
      body:JSON.stringify({version:2,templates,baseRevision:DESIGNER_REVISION})
    });
    const result=await response.json();
    if(!response.ok) throw new Error(result.error||'发布失败');
    DESIGNER_REVISION=result.commit;
    status('已保存到 GitHub，Pages 正在更新。请稍后刷新员工网页查看。');
  }catch(error){status(error.message||'发布失败，请导出模板备份后重试。',true);}
  finally{working(-1);}
});
sync();
