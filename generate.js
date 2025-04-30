// generate.js
(function(){
  console.log("[generate.js] Loaded");
  const BACKEND="https://genex-api-world-initialization.nvidia-oci.saturnenterprise.io";
  const EXPLORE_BACKEND="https://genex-api-world-exploration.nvidia-oci.saturnenterprise.io";
  const KEY="genex-super-secret-key";
  let CID=localStorage.getItem("genex_cid")||crypto.randomUUID();
  localStorage.setItem("genex_cid",CID);
  window.GENEX={BACKEND,EXPLORE_BACKEND,KEY,CID,panorama:null,panoramaBlob:null};
  const promptBox=document.getElementById("prompt");
  const promptBtn=document.getElementById("promptBtn");
  const dropZone=document.getElementById("dropZone");
  const fileInput=document.getElementById("fileInput");
  const preview=document.getElementById("preview");
  const dzText=document.getElementById("dzText");
  const imageBtn=document.getElementById("imageBtn");
  const statusT=document.getElementById("statusText");
  const timerSp=document.getElementById("timer");
  const logBox=document.getElementById("log");
  let tHandle=null;
  function log(msg){
    console.log("[generate]",msg);
    logBox.textContent+=msg+"\n";
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
  async function loadBlobAndShow(blob){
    window.GENEX.panoramaBlob=blob;
    showPanorama(URL.createObjectURL(blob));
    imageBtn.disabled=false;
    document.getElementById("exploreBtn").disabled=false;
  }
  (async()=>{
    log("Initial load: fetching history");
    try{
      const hdr={"x-api-key":KEY,"x-client-id":CID};
      const hResp=await fetch(`${BACKEND}/history/`,{headers:hdr});
      if(!hResp.ok) return;
      const{total}=await hResp.json();
      if(total===0) return;
      const rResp=await fetch(`${BACKEND}/recent/?count=1`,{headers:hdr});
      if(!rResp.ok) return;
      const{recent}=await rResp.json();
      if(recent?.length){
        const b64=recent[0].image_base64;
        const blob=await (await fetch(`data:image/png;base64,${b64}`)).blob();
        await loadBlobAndShow(blob);
      }
    }catch(e){}
  })();
  ["dragenter","dragover"].forEach(ev=>dropZone.addEventListener(ev,e=>{e.preventDefault();dropZone.classList.add("hover");}));
  ["dragleave","drop"].forEach(ev=>dropZone.addEventListener(ev,e=>{e.preventDefault();dropZone.classList.remove("hover");}));
  dropZone.addEventListener("drop",e=>{
    if(e.dataTransfer.files.length){
      fileInput.files=e.dataTransfer.files;
      updatePreview();
    }
  });
  dropZone.addEventListener("click",()=>fileInput.click());
  fileInput.addEventListener("change",updatePreview);
  function updatePreview(){
    if(fileInput.files.length){
      preview.src=URL.createObjectURL(fileInput.files[0]);
      preview.style.display="block";
      dzText.style.display="none";
      imageBtn.disabled=false;
      log("preview updated");
    }else{
      preview.style.display="none";
      dzText.style.display="block";
      imageBtn.disabled=true;
    }
  }
  document.querySelectorAll("#examples img").forEach(img=>{
    img.addEventListener("click",async()=>{
      document.querySelectorAll("#examples img").forEach(i=>i.classList.remove("selected"));
      img.classList.add("selected");
      const b=await (await fetch(img.dataset.src)).blob();
      const f=new File([b],"example.png",{type:b.type});
      const dt=new DataTransfer();
      dt.items.add(f);
      fileInput.files=dt.files;
      updatePreview();
    });
  });
  promptBtn.addEventListener("click",async()=>{
    const prompt=promptBox.value.trim();
    if(!prompt){ alert("Enter a prompt"); return; }
    log("Text→World prompt:"+prompt);
    statusT.textContent="Generating…";
    startTimer();
    try{
      const res = await fetch(`${BACKEND}/generate_from_text/`, {
        method: "POST",
        headers: {
          "x-api-key": KEY,
          "x-client-id": CID,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ prompt })
      });      
      const ct=res.headers.get("content-type")||"";
      if(ct.includes("application/json")){
        const p=await res.json();
        const uri=p.images?.[0]?.url;
        if(!uri) throw "no images[0].url";
        const blob=await (await fetch(uri)).blob();
        await loadBlobAndShow(blob);
      } else {
        const blob=await res.blob();
        await loadBlobAndShow(blob);
      }
      statusT.textContent="Done ✔";
    }catch(e){
      statusT.textContent="Idle";
    }finally{
      stopTimer();
    }
  });
  imageBtn.addEventListener("click",async()=>{
    if(!fileInput.files.length) return;
    const file=fileInput.files[0];
    log("Image→World file:"+file);
    statusT.textContent="Generating…";
    startTimer();
    try{
      const form=new FormData();
      form.append("image",file);
      const res=await fetch(`${BACKEND}/generate/`,{
        method:"POST",
        headers:{"x-api-key":KEY,"x-client-id":CID},
        body:form
      });
      if(res.status===503||res.status===429){ statusT.textContent="Idle"; return; }
      if(res.ok&&res.headers.get("content-type")?.startsWith("image/")){
        const blob=await res.blob();
        await loadBlobAndShow(blob);
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
  console.log("[generate.js] Ready");
})();
