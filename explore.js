// explore.js
console.log("[explore.js] Loaded");
const {EXPLORE_BACKEND,KEY,CID}=window.GENEX;
console.log("[explore] config:",{EXPLORE_BACKEND,KEY,CID});
const exploreBtn=document.getElementById("exploreBtn");
const frameSlider=document.getElementById("frameSlider");
const statusT=document.getElementById("statusText");
const timerSp=document.getElementById("timer");
const logBox=document.getElementById("log");
let frameBlobs=[];
let tHandle=null;
function log(msg){
  console.log("[explore]",msg);
  logBox.textContent+="[explore] "+msg+"\n";
  logBox.scrollTop=logBox.scrollHeight;
}
function startTimer(){
  let s=0;
  timerSp.textContent="00:00";
  clearInterval(tHandle);
  tHandle=setInterval(()=>{
    s++;
    timerSp.textContent=`${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
  },1000);
}
function stopTimer(){
  clearInterval(tHandle);
  timerSp.textContent="00:00";
}
function showPanorama(src){
  const old=window.GENEX.panorama;
  const yaw=old?.getYaw()??0;
  const pitch=old?.getPitch()??0;
  if(old){
    old.destroy();
  } else {
    document.getElementById("placeholder")?.remove();
  }
  window.GENEX.panorama=pannellum.viewer("panorama",{
    type:"equirectangular",
    panorama:src,
    autoLoad:true,
    showZoomCtrl:true,
    sceneFadeDuration:0,
    yaw,
    pitch
  });
}
async function extractFrames(mp4Blob){
  log(`extractFrames: MP4 ${mp4Blob.size} bytes`);
  frameBlobs=[];
  const vid=document.createElement("video");
  vid.src=URL.createObjectURL(mp4Blob);
  await new Promise(r=>(vid.onloadedmetadata=r));
  const fps=7;
  const total=Math.round(vid.duration*fps);
  const canvas=document.createElement("canvas");
  canvas.width=vid.videoWidth;
  canvas.height=vid.videoHeight;
  const ctx=canvas.getContext("2d");
  for(let i=0;i<total;i++){
    await new Promise(r=>{
      vid.currentTime=i/fps;
      vid.onseeked=r;
    });
    ctx.drawImage(vid,0,0);
    const blob=await new Promise(cb=>canvas.toBlob(cb,"image/png"));
    frameBlobs.push(blob);
    log(`frame ${i+1}/${total}`);
  }
  vid.remove();
  log("extractFrames complete");
}
function setupSlider(){
  frameSlider.min=0;
  frameSlider.max=frameBlobs.length-1;
  frameSlider.value=0;
  frameSlider.style.display="block";
  frameSlider.oninput=()=>{
    const idx=+frameSlider.value;
    log(`slider → frame ${idx}`);
    showPanorama(URL.createObjectURL(frameBlobs[idx]));
  };
}
exploreBtn.addEventListener("click",async()=>{
  log("Explore Forward clicked");
  const panoBlob=window.GENEX.panoramaBlob;
  if(!panoBlob){ alert("Please generate or load a panorama first."); return; }
  statusT.textContent="Submitting…";
  startTimer();
  const form=new FormData();
  form.append("image",panoBlob,"pano.png");
  try{
    const res=await fetch(`${EXPLORE_BACKEND}/explore/`,{
      method:"POST",
      headers:{"x-api-key":KEY,"x-client-id":CID},
      body:form
    });
    if(res.status===503||res.status===429){ statusT.textContent="Idle"; stopTimer(); return; }
    if(res.ok&&res.headers.get("content-type")?.startsWith("video/")){
      const mp4Blob=await res.blob();
      await extractFrames(mp4Blob);
      setupSlider();
      statusT.textContent="Done ✔";
    } else {
      statusT.textContent="Idle";
    }
  }catch(e){
    statusT.textContent="Idle";
  }finally{
    stopTimer();
  }
});
console.log("[explore.js] Ready");
