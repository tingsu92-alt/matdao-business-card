const templates = TEMPLATES ?? DEFAULTS;
const form = $('card-form');
const render = Object.fromEntries(Object.keys(LANGUAGES).map(language=>[language,makeRenderer($('card-'+language))]));
const sample = {zh:SAMPLE,en:EN_SAMPLE};
const names = {zh:['name','role'],en:['nameEn','roleEn']};
const affiliations = {zh:'affiliation',en:'affiliationEn'};
const choice = $('download-language');
const idle = '默认只需填写中文信息。需要英文名片时，展开「英文信息」填写；电话和邮箱两版共用。';
let mode='business';

function field(key){return form.elements.namedItem(key);}
function value(key){return field(key).value.trim();}
function values(language){
  const [name,role]=names[language];
  return {name:value(name),role:value(role),affiliation:value(affiliations[language]),phone:value('phone'),email:value('email')};
}
function selected(){return choice.value==='both'?['zh','en']:[choice.value];}
function status(message,style=''){
  $('form-status').textContent=message;
  $('form-status').className='note '+style;
}
function preview(){
  $('mode-label').textContent=MODES[mode];
  for(const language of Object.keys(LANGUAGES)){
    const data=values(language);
    const demo=!data.name&&!data.role;
    $(language+'-state').textContent=demo?'示例':'实时';
    void render[language](mode,templates[mode],demo?{...sample[language],affiliation:data.affiliation,phone:data.phone||sample[language].phone,email:data.email||sample[language].email}:data,language);
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
  status(idle);
  preview();
});
form.addEventListener('submit',event=>{
  event.preventDefault();
  if(!check(selected())) return;
  status('所选语言的信息已确认，可以下载名片。','status-ok');
});
bindSwitch(next=>{mode=next;preview();});
choice.addEventListener('change',()=>{
  const both=choice.value==='both';
  if(choice.value==='en'||both) $('english-fields').open=true;
  $('download-label').textContent=both?'下载 ZIP':'下载 PNG';
  $('export-note').textContent=both?'ZIP 内含两张透明圆角 PNG。':'PNG 图片保留透明圆角。';
  status(idle);
});

async function makePng(version,language,data){
  const canvas=document.createElement('canvas');
  canvas.width=WIDTH;
  canvas.height=HEIGHT;
  await renderCard(canvas.getContext('2d'),version,templates[version],data,language);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
  if(!blob) throw new Error('PNG');
  return blob;
}
function safeName(name){return name.replace(/[\\/:*?"<>|]/g,'_');}
async function pngFiles(version,languages){
  return Promise.all(languages.map(async language=>{
    const data=values(language);
    const filename=safeName(data.name)+'-新材道电子名片-'+MODES[version]+'-'+LANGUAGES[language]+'.png';
    return {language,filename,blob:await makePng(version,language,data)};
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
  const languages=selected(),version=mode;
  if(!check(languages)) return;
  const button=$('save-phone');
  button.disabled=true;
  try{
    const files=await pngFiles(version,languages);
    const images=await Promise.all(files.map(file=>imageDataUrl(file.blob)));
    $('phone-save-images').replaceChildren();
    $('phone-save-status').textContent='';
    files.forEach((file,index)=>{
      const figure=document.createElement('figure');
      const caption=document.createElement('figcaption');
      caption.textContent=LANGUAGES[file.language]+' · PNG · '+WIDTH+' × '+HEIGHT+' px';
      const image=document.createElement('img');
      image.src=images[index];
      image.alt=LANGUAGES[file.language]+'名片保存图片';
      image.width=WIDTH;image.height=HEIGHT;
      const actions=document.createElement('div');
      actions.className='phone-save-actions';
      const png=new File([file.blob],file.filename,{type:'image/png'});
      let canShare=false;
      try{canShare=Boolean(navigator.share&&navigator.canShare&&navigator.canShare({files:[png]}));}catch{}
      if(canShare){
        const share=document.createElement('button');
        share.type='button';share.className='primary';share.textContent='分享'+LANGUAGES[file.language]+'图片';
        share.addEventListener('click',async()=>{
          share.disabled=true;
          try{
            await navigator.share({files:[png]});
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
      download.type='button';download.className='secondary';download.textContent='下载'+LANGUAGES[file.language]+' PNG 文件';
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
  const languages=selected(),version=mode;
  if(!check(languages)) return;
  const button=$('download');
  button.disabled=true;
  try{
    const files=await pngFiles(version,languages);
    if(files.length===1) downloadFile(files[0].blob,files[0].filename);
    else downloadFile(await zipPngs(files),'新材道电子名片-'+MODES[version]+'-中英双版.zip');
  }catch{
    status('名片生成失败，请重试。','status-error');
  }finally{
    button.disabled=false;
  }
});
preview();
