const WIDTH = 1680, HEIGHT = 960;
const MODES = { business: '商务版', regular: '常规版' };
const SAMPLE = {name:'姓名', role:'职位', phone:'138 0000 0000', email:'name@example.com', affiliation:'可信数据空间发展联盟 新材料特设组组长'};
const EN_SAMPLE = {name:'Name', role:'Title', phone:SAMPLE.phone, email:SAMPLE.email, affiliation:'Chair of the New Materials Task Force, Trusted Data Space Development Alliance'};
const LANGUAGES = {zh:'中文', en:'英文'};
const BRAND = {
  company:'北京新材道数智科技有限公司',
  companyEn:'Beijing Matdao Digital Intelligence Technology Co., Ltd.',
  address:'北京市朝阳区酒仙桥电子城总部10号楼',
  addressEn:'Building 10, Headquarters, Jiuxianqiao Electronics City, Chaoyang District, Beijing',
  slogan:'',sloganEn:'',
};
const DEFAULT_LAYOUT = {
  logo:[7,9,46,9], name:[7,44,56,8.5], role:[7,57,56,4.7],
  company:[7,69,56,4.1], affiliation:[7,76,56,3.5],
  phone:[65,59,28,3.85], email:[65,65,28,3.6],
  address:[65,72,28,3.6], addressEn:[65,72,28,3.25],
  slogan:[7,96,86,2.5], qr:[65,35,10.5,18.4],
};
const DEFAULT_LOGO = /*__DEFAULT_LOGO__*/ '';
const DEFAULT_REGULAR_LOGO = /*__DEFAULT_REGULAR_LOGO__*/ '';
const DEFAULT_QR = /*__DEFAULT_QR__*/ '';
const DEFAULTS = {
  business:{...BRAND,ink:'#f8eddb',muted:'#d2be9d',accent:'#e7be79',radius:68,background:'',logo:DEFAULT_LOGO,qr:DEFAULT_QR,layout:DEFAULT_LAYOUT},
  regular:{...BRAND,ink:'#242424',muted:'#575757',accent:'#404040',radius:68,background:'',logo:DEFAULT_REGULAR_LOGO,qr:DEFAULT_QR,layout:DEFAULT_LAYOUT}
};
const TEMPLATES = /*__TEMPLATES__*/ null;
const $ = (id) => document.getElementById(id);
const assets = new Map();
function getImage(src) {
  if (!src) return Promise.resolve(null);
  if (!assets.has(src)) {
    assets.set(src, new Promise((resolve) => {
      const picture = new Image();
      picture.onload = () => resolve(picture);
      picture.onerror = () => resolve(null);
      picture.src = src;
    }));
  }
  return assets.get(src);
}
function round(ctx,x,y,w,h,r) {
  ctx.beginPath();
  ctx.roundRect(x,y,w,h,r);
}
function fitImage(ctx,img,x,y,w,h,cover=false) {
  const factor=(cover?Math.max:Math.min)(w/img.width,h/img.height);
  const width=img.width*factor, height=img.height*factor;
  ctx.drawImage(img,x+(cover||h===w?(w-width)/2:0),y+(h-height)/2,width,height);
}
function demoBackground(ctx, mode) {
  const dark = mode==='business';
  const grad = ctx.createLinearGradient(0,HEIGHT,WIDTH,0);
  grad.addColorStop(0,dark?'#080808':'#ffffff');
  grad.addColorStop(.57,dark?'#17130f':'#fffdfd');
  grad.addColorStop(1,dark?'#302419':'#fff2f4');
  ctx.fillStyle=grad;
  ctx.fillRect(0,0,WIDTH,HEIGHT);
  const glow=ctx.createRadialGradient(1500,120,0,1500,120,850);
  glow.addColorStop(0,dark?'#aa753e55':'#00000000');
  glow.addColorStop(1,dark?'#aa753e00':'#00000000');
  ctx.fillStyle=glow;
  ctx.fillRect(0,0,WIDTH,HEIGHT);
  ctx.lineWidth=2;
  ctx.strokeStyle=dark?'#d8ad6733':'#ff112d10';
  for(let i=0;i<17;i++){
    ctx.beginPath();
    ctx.moveTo(700+i*31,990);
    ctx.bezierCurveTo(1490+i*17,780,560+i*40,185,1460+i*26,-35);
    ctx.stroke();
  }
}
function setFont(ctx,weight,size){
  ctx.font=weight+' '+size+'px "PingFang SC", "Microsoft YaHei", system-ui, sans-serif';
}
function writeLine(ctx,value,box,color,weight) {
  if(!value) return;
  const [x,y,width,height]=box;
  const size=HEIGHT*height/100, max=WIDTH*width/100;
  setFont(ctx,weight,size);
  const measured=ctx.measureText(value).width;
  if(measured>max) setFont(ctx,weight,Math.floor(size*max/measured));
  ctx.fillStyle=color;
  ctx.textBaseline='top';
  ctx.fillText(value,WIDTH*x/100,HEIGHT*y/100);
}
const wordSegmenter=new Intl.Segmenter('en',{granularity:'word'});
function wrapLines(ctx,paragraph,maxWidth){
  const segments=/[\p{Script=Han}]/u.test(paragraph)
    ?Array.from(wordSegmenter.segment(paragraph),part=>part.segment)
    :paragraph.match(/\S+|\s+/g)??[];
  const lines=[];
  let line='';
  for(const segment of segments){
    if(ctx.measureText(line+segment).width<=maxWidth){
      line+=segment;
      continue;
    }
    if(line.trim()) lines.push(line.trimEnd());
    line='';
    for(const character of segment.trimStart()){
      if(line&&ctx.measureText(line+character).width>maxWidth){
        lines.push(line);
        line='';
      }
      line+=character;
    }
  }
  if(line.trim()) lines.push(line.trimEnd());
  return lines;
}
function writeParagraphs(ctx,value,box,color,weight,availablePercent){
  if(!value) return;
  const [x,y,width,height]=box;
  const maxWidth=WIDTH*width/100;
  const maxHeight=HEIGHT*Math.min(availablePercent,100-y)/100;
  const paragraphs=value.split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
  if(!paragraphs.length||maxHeight<=0) return;
  let size=Math.floor(HEIGHT*height/100);
  let groups, lineHeight, gap;
  do{
    setFont(ctx,weight,size);
    groups=paragraphs.map(paragraph=>wrapLines(ctx,paragraph,maxWidth));
    lineHeight=size*1.28;
    gap=size*.38;
    const total=groups.reduce((sum,lines)=>sum+lines.length*lineHeight,0)+(groups.length-1)*gap;
    if(total<=maxHeight||size<=1) break;
    size-=1;
  }while(true);
  ctx.fillStyle=color;
  ctx.textBaseline='top';
  let top=HEIGHT*y/100;
  for(const lines of groups){
    for(const line of lines){
      ctx.fillText(line,WIDTH*x/100,top);
      top+=lineHeight;
    }
    top+=gap;
  }
}
async function renderCard(ctx, mode, template, data, language='zh') {
  const company=language==='en'?template.companyEn:template.company;
  const address=language==='en'?template.addressEn:template.address;
  const slogan=language==='en'?template.sloganEn:template.slogan;
  const [background,logo,qr]=await Promise.all([getImage(template.background),getImage(template.logo),getImage(template.qr)]);
  ctx.clearRect(0,0,WIDTH,HEIGHT);
  ctx.save();
  round(ctx,0,0,WIDTH,HEIGHT,template.radius);
  ctx.clip();
  demoBackground(ctx,mode);
  if(background) fitImage(ctx,background,0,0,WIDTH,HEIGHT,true);
  const l=template.layout;
  const box = ([x,y,w,h]) => [WIDTH*x/100,HEIGHT*y/100,WIDTH*w/100,HEIGHT*h/100];
  if(logo){
    if(mode==='business'){
      const [x,y,width,height]=box(l.logo);
      const layer=document.createElement('canvas');
      layer.width=Math.ceil(width);
      layer.height=Math.ceil(height);
      const logoContext=layer.getContext('2d');
      fitImage(logoContext,logo,0,0,width,height);
      // AI assets can have slightly translucent fills. Keep solid logo areas
      // opaque so the displayed gold matches the position text exactly.
      const pixels=logoContext.getImageData(0,0,layer.width,layer.height);
      for(let offset=3;offset<pixels.data.length;offset+=4){
        if(pixels.data[offset]>=220) pixels.data[offset]=255;
      }
      logoContext.putImageData(pixels,0,0);
      logoContext.globalCompositeOperation='source-in';
      logoContext.fillStyle=template.accent;
      logoContext.fillRect(0,0,layer.width,layer.height);
      ctx.drawImage(layer,x,y);
    }else{
      fitImage(ctx,logo,...box(l.logo));
    }
  }
  else if(company){
    const [x,y,w,h]=box(l.logo);
    const s=h*.68;
    ctx.fillStyle=template.accent;
    round(ctx,x,y+h*.1,s,s,s*.22);
    ctx.fill();
    ctx.strokeStyle=mode==='business'?'#17130f':'#fff';
    ctx.lineWidth=s*.075;
    ctx.beginPath();
    ctx.moveTo(x+s*.22,y+h*.1+s*.63);
    ctx.lineTo(x+s*.43,y+h*.1+s*.31);
    ctx.lineTo(x+s*.56,y+h*.1+s*.53);
    ctx.lineTo(x+s*.75,y+h*.1+s*.27);
    ctx.stroke();
    writeLine(ctx,language==='en'?'MATDAO':'新材道',[(x+s*1.32)/WIDTH*100,y/HEIGHT*100+h/HEIGHT*22,(w-s*1.32)/WIDTH*100,l.logo[3]*.42],template.ink,'650');
  }
  writeLine(ctx,data.name,l.name,template.ink,'750');
  writeParagraphs(ctx,data.role,l.role,template.accent,'650',9);
  writeLine(ctx,company,l.company,template.ink,'550');
  writeParagraphs(ctx,data.affiliation,l.affiliation,template.muted,'450',Math.max(1,l.slogan[1]-l.affiliation[1]-1));
  writeLine(ctx,data.phone,l.phone,template.ink,'450');
  writeLine(ctx,data.email,l.email,template.ink,'450');
  writeParagraphs(ctx,address,language==='en'?(l.addressEn??l.address):l.address,template.muted,'450',28);
  writeLine(ctx,slogan,l.slogan,template.muted,'450');
  const [qrX,qrY,qrWidth,qrHeight]=box(l.qr);
  const qrSize=Math.min(qrWidth,qrHeight);
  ctx.fillStyle=mode==='business'?'#17130f':'#fff';
  round(ctx,qrX,qrY,qrSize,qrSize,12);
  ctx.fill();
  ctx.strokeStyle=template.accent;
  ctx.lineWidth=4;
  ctx.stroke();
  // This fixed QR has 29 modules. Reserve a four-module quiet zone per side.
  const inset=template.qr===DEFAULT_QR?qrSize*4/37:Math.max(10,qrSize*.07);
  ctx.fillStyle=mode==='business'?'#fffaf0':'#ffffff';
  ctx.fillRect(qrX+inset,qrY+inset,qrSize-2*inset,qrSize-2*inset);
  if(qr){
    ctx.imageSmoothingEnabled=false;
    fitImage(ctx,qr,qrX+inset,qrY+inset,qrSize-2*inset,qrSize-2*inset);
    ctx.imageSmoothingEnabled=true;
  }else{
    ctx.save();
    ctx.fillStyle=mode==='business'?'#766346':'#6b6b6b';
    ctx.textAlign='center';
    ctx.textBaseline='middle';
    setFont(ctx,'550',qrSize*.12);
    ctx.fillText(language==='en'?'QR CODE':'二维码占位',qrX+qrSize/2,qrY+qrSize*.46);
    setFont(ctx,'400',qrSize*.073);
    ctx.fillText(language==='en'?'PLACEHOLDER':'待上传',qrX+qrSize/2,qrY+qrSize*.64);
    ctx.restore();
  }
  ctx.restore();
}
function makeRenderer(canvas){
  let sequence=0;
  return async (mode,template,data,language)=>{
    const revision=++sequence;
    const frame=document.createElement('canvas');
    frame.width=WIDTH;
    frame.height=HEIGHT;
    await renderCard(frame.getContext('2d'),mode,template,data,language);
    if(revision===sequence){
      const ctx=canvas.getContext('2d');
      ctx.clearRect(0,0,WIDTH,HEIGHT);
      ctx.drawImage(frame,0,0);
    }
  };
}
function downloadFile(blob,filename) {
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download=filename;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(url),10000);
}
function bindSwitch(onChange) {
  const buttons=[...document.querySelectorAll('[data-mode]')];
  buttons.forEach(button=>button.addEventListener('click',()=>{
    buttons.forEach(item=>item.setAttribute('aria-pressed',String(item===button)));
    onChange(button.dataset.mode);
  }));
}
