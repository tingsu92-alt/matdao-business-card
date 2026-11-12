// PNGs are already compressed. Store both as-is in one UTF-8 ZIP download.
const crcTable=Uint32Array.from({length:256},(_,byte)=>{
  let crc=byte;
  for(let i=0;i<8;i++) crc=(crc>>>1)^((crc&1)?0xedb88320:0);
  return crc;
});
function crc32(bytes){
  let crc=0xffffffff;
  for(const byte of bytes) crc=(crc>>>8)^crcTable[(crc^byte)&255];
  return (crc^0xffffffff)>>>0;
}
function zipHeader(size,signature,values){
  const bytes=new Uint8Array(size);
  const view=new DataView(bytes.buffer);
  view.setUint32(0,signature,true);
  for(const [offset,value,length] of values){
    if(length===4) view.setUint32(offset,value,true);
    else view.setUint16(offset,value,true);
  }
  return bytes;
}
async function zipPngs(files){
  const encoder=new TextEncoder();
  const records=[], directory=[];
  let offset=0, directorySize=0;
  for(const {filename,blob} of files){
    const name=encoder.encode(filename);
    const crc=crc32(new Uint8Array(await blob.arrayBuffer()));
    const local=zipHeader(30,0x04034b50,[
      [4,20],[6,0x800],[12,33],[14,crc,4],[18,blob.size,4],[22,blob.size,4],[26,name.length]
    ]);
    const central=zipHeader(46,0x02014b50,[
      [4,20],[6,20],[8,0x800],[14,33],[16,crc,4],[20,blob.size,4],[24,blob.size,4],[28,name.length],[42,offset,4]
    ]);
    records.push(local,name,blob);
    directory.push(central,name);
    offset+=local.length+name.length+blob.size;
    directorySize+=central.length+name.length;
  }
  const end=zipHeader(22,0x06054b50,[[8,files.length],[10,files.length],[12,directorySize,4],[16,offset,4]]);
  return new Blob([...records,...directory,end],{type:'application/zip'});
}
