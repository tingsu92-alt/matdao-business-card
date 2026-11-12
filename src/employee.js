const templates = TEMPLATES ?? DEFAULTS;
const form = $('card-form');
const render = Object.fromEntries(Object.keys(LANGUAGES).map(language=>[language,makeRenderer($('card-'+language))]));
const sample = {zh:SAMPLE,en:EN_SAMPLE};
const names = {zh:['name','role'],en:['nameEn','roleEn']};
const affiliations = {zh:'affiliation',en:'affiliationEn'};
const choice = $('download-language');
const idle = '电话和邮箱两版共用。按需填写对应语言的姓名和职位。';
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
  if(invalid){invalid.reportValidity();return false;}
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
$('download').addEventListener('click',async ()=>{
  const languages=selected(),version=mode;
  if(!check(languages)) return;
  const button=$('download');
  button.disabled=true;
  try{
    const files=await Promise.all(languages.map(async language=>{
      const data=values(language);
      const filename=safeName(data.name)+'-新材道电子名片-'+MODES[version]+'-'+LANGUAGES[language]+'.png';
      return {filename,blob:await makePng(version,language,data)};
    }));
    if(files.length===1) downloadFile(files[0].blob,files[0].filename);
    else downloadFile(await zipPngs(files),'新材道电子名片-'+MODES[version]+'-中英双版.zip');
  }catch{
    status('名片生成失败，请重试。','status-error');
  }finally{
    button.disabled=false;
  }
});
preview();
