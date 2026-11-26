const templates = withTemplateDefaults(TEMPLATES ?? DEFAULTS);
const form = $('card-form');
const previewSequence={zh:0,en:0};
const FRAME_WIDTH=1800,FRAME_HEIGHT=1120;
const PRESENTATION={regular:{color:'#e7e9ec',label:'浅灰衬底'},brandRed:{color:'#232326',label:'炭黑衬底'},business:{color:'#e7e9ec',label:'浅灰衬底'}};
let exportFormat='jpg';
const sample = {zh:SAMPLE,en:EN_SAMPLE};
const names = {zh:['name','role'],en:['nameEn','roleEn']};
const affiliations = {zh:'affiliation',en:'affiliationEn'};
const idle = '';
let mode='regular';
const editedEnglish=new Set();
const DRAFT_KEY='matdao-card:employee-draft:v1';
const DRAFT_FIELDS=['name','role','phone','email','affiliation','nameEn','roleEn','affiliationEn'];

function field(key){return form.elements.namedItem(key);}
function value(key){return field(key).value.trim();}
function values(language){
  const [name,role]=names[language];
  return {name:value(name),role:value(role),affiliation:value(affiliations[language]),phone:value('phone'),email:value('email')};
}
function hasEnglish(){return Boolean(value('nameEn')||value('roleEn')||(editedEnglish.has('affiliationEn')&&value('affiliationEn')));}
function selected(){return hasEnglish()?['zh','en']:['zh'];}
function status(message,style=''){
  $('form-status').textContent=message;
  $('form-status').hidden=!message;
  $('form-status').className='note '+style;
}
function saveDraft(){
  try{
    const fields=Object.fromEntries(DRAFT_FIELDS.map(key=>[key,field(key).value]));
    localStorage.setItem(DRAFT_KEY,JSON.stringify({version:1,fields,englishEdited:[...editedEnglish],englishOpen:$('english-fields').open}));
    $('draft-status').textContent='已自动保存在当前浏览器';
    $('clear-draft').disabled=false;
  }catch{
    $('draft-status').textContent='当前浏览器未能保存信息，本次填写仍可正常使用';
  }
}
function restoreDraft(){
  try{
    const raw=localStorage.getItem(DRAFT_KEY);
    if(!raw) return;
    const draft=JSON.parse(raw);
    if(draft.version!==1||!draft.fields||typeof draft.fields!=='object') throw new Error('无效的保存信息');
    for(const key of DRAFT_FIELDS){
      if(typeof draft.fields[key]==='string') field(key).value=draft.fields[key].slice(0,field(key).maxLength);
    }
    if(Array.isArray(draft.englishEdited)){
      for(const key of draft.englishEdited){
        if(['nameEn','roleEn','affiliationEn'].includes(key)) editedEnglish.add(key);
      }
    }
    $('english-fields').open=draft.englishOpen===true||hasEnglish();
    $('clear-draft').disabled=false;
    $('draft-status').textContent='已恢复上次填写的信息（当前浏览器）';
  }catch{
    $('draft-status').textContent='未能恢复已保存信息，仍可正常填写';
  }
}
$('clear-draft').addEventListener('click',()=>{
  try{
    localStorage.removeItem(DRAFT_KEY);
    form.reset();
    for(const key of DRAFT_FIELDS) field(key).setCustomValidity('');
    editedEnglish.clear();$('english-fields').open=false;
    $('clear-draft').disabled=true;
    $('draft-status').textContent='已清除；重新填写后会自动保存';
    status(idle);preview();
  }catch{
    $('draft-status').textContent='未能清除已保存信息，请检查浏览器设置';
  }
});
function preview(){
  const bilingual=hasEnglish();
  const label=exportFormat==='jpg'?'JPG':'PNG';
  $('download-label').textContent=bilingual?'下载中英双版 '+label+' ZIP':'下载中文 '+label;
  const size=cardDimensions(mode),frameHeight=mode==='business'?1080:FRAME_HEIGHT;
  $('export-note').textContent=(bilingual?'2 张 · ':'')+(exportFormat==='jpg'?'JPG · '+FRAME_WIDTH+' × '+frameHeight+' px · '+PRESENTATION[mode].label:'PNG · '+size.width+' × '+size.height+' px · '+(templates[mode].radius===0?'直角名片':'透明圆角'));
  $('preview-stage').classList.toggle('framed-preview',exportFormat==='jpg');
  $('en-preview').hidden=!bilingual;
  $('preview-stage').classList.toggle('zh-only',!bilingual);
  for(const language of Object.keys(LANGUAGES)){
    if(language==='en'&&!bilingual) continue;
    const data=values(language);
    const demo=!data.name&&!data.role;
    void renderPreview(language,mode,exportFormat,demo?{...sample[language],affiliation:data.affiliation,phone:data.phone||sample[language].phone,email:data.email||sample[language].email}:data);
  }
}
function check(languages){
  const keys=[...languages.flatMap(language=>names[language]),'phone','email'];
  for(const key of Object.values(names).flat().concat('phone','email')){
    const input=field(key);
    input.required=keys.includes(key);
    input.setCustomValidity(input.required&&!value(key)?'请填写'+input.labels[0].firstElementChild.textContent:'');
  }
  const invalid=keys.map(field).find(input=>!input.validity.valid);
  if(invalid){
    for(let parent=invalid.parentElement;parent&&parent!==form;parent=parent.parentElement){
      if(parent.tagName==='DETAILS') parent.open=true;
    }
    invalid.reportValidity();return false;
  }
  return true;
}
form.addEventListener('input',event=>{
  event.target.setCustomValidity('');
  if(['nameEn','roleEn','affiliationEn'].includes(event.target.name)) editedEnglish.add(event.target.name);
  saveDraft();
  status(idle);
  preview();
});
form.addEventListener('submit',event=>event.preventDefault());
bindSwitch(next=>{mode=next;preview();});
document.querySelectorAll('[data-format]').forEach(button=>button.addEventListener('click',()=>{
  exportFormat=button.dataset.format;
  document.querySelectorAll('[data-format]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));
  status(idle);preview();
}));
async function imageCanvas(version,language,data,format){
  const card=document.createElement('canvas');
  card.width=cardDimensions(version).width;card.height=HEIGHT;
  await renderCard(card.getContext('2d'),version,templates[version],data,language);
  if(format==='png') return card;
  const frame=document.createElement('canvas');
  frame.width=FRAME_WIDTH;frame.height=version==='business'?1080:FRAME_HEIGHT;
  const ctx=frame.getContext('2d');
  ctx.fillStyle=PRESENTATION[version].color;
  ctx.fillRect(0,0,frame.width,frame.height);
  const width=FRAME_WIDTH*.84,height=width*card.height/card.width;
  const x=(FRAME_WIDTH-width)/2,y=(frame.height-height)/2;
  ctx.save();
  ctx.imageSmoothingQuality='high';
  ctx.shadowColor=version==='regular'?'rgba(20,24,30,.22)':'rgba(0,0,0,.38)';
  ctx.shadowBlur=54;ctx.shadowOffsetY=28;
  ctx.drawImage(card,x,y,width,height);
  ctx.restore();
  return frame;
}
async function renderPreview(language,version,format,data){
  const revision=++previewSequence[language];
  try{
    const image=await imageCanvas(version,language,data,format);
    if(revision!==previewSequence[language]) return;
    const canvas=$('card-'+language);
    canvas.width=image.width;canvas.height=image.height;
    canvas.getContext('2d').drawImage(image,0,0);
  }catch{status('预览生成失败，请重试。','status-error');}
}
function safeName(name){return name.replace(/[\\/:*?"<>|]/g,'_');}
async function imageFiles(version,languages,format){
  return Promise.all(languages.map(async language=>{
    const data=values(language);
    const canvas=await imageCanvas(version,language,data,format);
    const type=format==='jpg'?'image/jpeg':'image/png';
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,type,.95));
    if(!blob) throw new Error('图片生成失败');
    const filename=safeName(data.name)+'-新材道电子名片-'+MODES[version]+'-'+LANGUAGES[language]+(format==='jpg'?'-带背景.jpg':'.png');
    return {language,filename,blob,type,format:format.toUpperCase(),width:canvas.width,height:canvas.height};
  }));
}
function imageDataUrl(blob){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(reader.result);
    reader.onerror=reject;
    reader.readAsDataURL(blob);
  });
}
const phoneDialog=$('phone-save');
$('phone-save-close').addEventListener('click',()=>phoneDialog.close());
$('save-phone').addEventListener('click',async()=>{
  const languages=selected(),version=mode,format=exportFormat;
  if(!check(languages)) return;
  saveDraft();
  const button=$('save-phone');
  button.disabled=true;
  try{
    const files=await imageFiles(version,languages,format);
    const images=await Promise.all(files.map(file=>imageDataUrl(file.blob)));
    $('phone-save-images').replaceChildren();
    $('phone-save-status').textContent='';
    files.forEach((file,index)=>{
      const figure=document.createElement('figure');
      const caption=document.createElement('figcaption');
      caption.textContent=LANGUAGES[file.language]+' · '+file.format+' · '+file.width+' × '+file.height+' px';
      const image=document.createElement('img');
      image.src=images[index];
      image.alt=LANGUAGES[file.language]+'名片保存图片';
      image.width=file.width;image.height=file.height;
      const actions=document.createElement('div');
      actions.className='phone-save-actions';
      const shareFile=new File([file.blob],file.filename,{type:file.type});
      let canShare=false;
      try{canShare=Boolean(navigator.share&&navigator.canShare&&navigator.canShare({files:[shareFile]}));}catch{}
      if(canShare){
        const share=document.createElement('button');
        share.type='button';share.className='primary';share.textContent='分享'+LANGUAGES[file.language]+'图片';
        share.addEventListener('click',async()=>{
          share.disabled=true;
          try{
            await navigator.share({files:[shareFile]});
            $('phone-save-status').textContent='分享菜单已关闭，请到相册确认是否已保存。';
          }catch(error){
            $('phone-save-status').textContent=error.name==='AbortError'?'已取消分享，可重新点击。':'当前浏览器未能打开系统分享，请在 Safari 中打开此网页后重试。';
          }finally{share.disabled=false;}
        });
        actions.append(share);
      }else{
        const hint=document.createElement('p');hint.className='note';
        hint.textContent='当前浏览器不支持图片系统分享。iPhone 请在 Safari 中打开此网页后重试。';
        figure.append(hint);
      }
      const download=document.createElement('button');
      download.type='button';download.className='secondary';download.textContent='下载'+LANGUAGES[file.language]+' '+file.format+' 文件';
      download.addEventListener('click',()=>downloadFile(file.blob,file.filename));
      actions.append(download);
      figure.prepend(caption,image);figure.append(actions);
      $('phone-save-images').append(figure);
    });
    phoneDialog.showModal();
  }catch{
    status('图片生成失败，请重试。','status-error');
  }finally{button.disabled=false;}
});
$('copy-page-link').addEventListener('click',async()=>{
  try{
    await navigator.clipboard.writeText(location.href);
    $('phone-save-status').textContent='链接已复制，请打开 Safari，在地址栏粘贴。';
  }catch{
    $('phone-save-status').textContent='未能自动复制，请从浏览器地址栏或右上角菜单复制网页链接。';
  }
});
$('download').addEventListener('click',async ()=>{
  const languages=selected(),version=mode,format=exportFormat;
  if(!check(languages)) return;
  saveDraft();
  const button=$('download');
  button.disabled=true;
  try{
    const files=await imageFiles(version,languages,format);
    if(files.length===1) downloadFile(files[0].blob,files[0].filename);
    else downloadFile(await zipImages(files),'新材道电子名片-'+MODES[version]+'-中英双版-'+format.toUpperCase()+'.zip');
  }catch{
    status('名片生成失败，请重试。','status-error');
  }finally{
    button.disabled=false;
  }
});
restoreDraft();
preview();
