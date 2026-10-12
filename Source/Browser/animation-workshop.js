// SPDX-License-Identifier: MIT
// Named clips use frame identities so reordering cannot silently select different art.
function wobbleClipRange() {
  const clip = project.animationClips?.find(c => c.id === project.activeClip);
  if (!clip) return {start:0,end:project.frames.length-1};
  const start = project.frames.findIndex(f=>f.id===clip.startId), end=project.frames.findIndex(f=>f.id===clip.endId);
  return start<0||end<0 ? {start:0,end:project.frames.length-1} : {start:Math.min(start,end),end:Math.max(start,end)};
}
frameSequence = function() {
  const {start,end}=wobbleClipRange(), a=Array.from({length:end-start+1},(_,i)=>start+i);
  if(project.loop==='reverse')return a.reverse();
  return project.loop==='pingpong'&&a.length>2?a.concat(a.slice(1,-1).reverse()):a;
};
beatForFrame = function(i) {
  let beats=0;
  for(const index of frameSequence()){if(index===i)return beats;beats+=project.frames[index].hold;}
  return 0;
};
const validateBeforeClips=validateProject;
validateProject=function(v){
  validateBeforeClips(v);
  if(v.animationClips!==undefined){
    if(!Array.isArray(v.animationClips)||v.animationClips.length>12)throw Error('Use up to twelve animation clips.');
    const ids=new Set();
    for(const c of v.animationClips){
      if(!c||typeof c.id!=='string'||c.id.length>80||ids.has(c.id)||typeof c.name!=='string'||!c.name.trim()||c.name.length>80||typeof c.startId!=='string'||c.startId.length>80||typeof c.endId!=='string'||c.endId.length>80)throw Error('Invalid animation clip.');
      ids.add(c.id);
    }
  }
  if(v.activeClip!==undefined && v.activeClip!==null && typeof v.activeClip!=='string')throw Error('Invalid selected animation clip.');
  return v;
};
function wobbleChooseClip(id){pause();project.activeClip=id||null;project.current=frameSequence()[0];commit('Animation range selected');syncWobbleClips();}
function syncWobbleClips(){
  const select=$('animationClip');if(!select)return;
  const wanted=project.activeClip||'';
  select.replaceChildren(new Option('Whole flipbook',''));
  for(const c of project.animationClips||[])select.add(new Option(c.name + ((!project.frames.some(f=>f.id===c.startId)||!project.frames.some(f=>f.id===c.endId))?' (range needs repair)':''),c.id));
  select.value=wanted;
  const range=wobbleClipRange();
  $('animationRangeSummary').textContent=`${range.start+1}–${range.end+1} · ${ (frameSequence().reduce((n,i)=>n+project.frames[i].hold,0)/project.fps).toFixed(2)}s`;
}
function wobbleAnimationWorkshop(){
  pause();const dlg=document.createElement('dialog');dlg.className='wobble-animation-workshop';
  dlg.innerHTML='<button type="button" aria-label="Close" class="close">×</button><h2>Animation workshop</h2><p>Shape the timing, then save a named section for a walk, blink or another little loop. Preview, GIF, PNG sequence and studio transfers use the selected section.</p><div class="row"><label>Clip name<input type="text" id="clipName" maxlength="80" placeholder="Walk cycle"></label><label>First frame<input id="clipStart" type="number" min="1"></label><label>Last frame<input id="clipEnd" type="number" min="1"></label></div><button id="saveAnimationClip">Save & select clip</button><button id="removeAnimationClip">Remove selected clip</button><h3>Frame holds</h3><p>One beat lasts 1 ÷ '+project.fps+' seconds. Changes below apply together and can be undone.</p><div class="wobble-hold-list"></div><div class="row"><label>Set every hold<input id="allFrameHold" type="number" min="1" max="24" value="1"></label><button id="setAllFrameHolds">Set fields</button></div><button id="applyWobbleHolds" class="primary">Apply timing</button><p role="status" id="clipStatus"></p>';
  document.body.append(dlg);const close=()=>{dlg.close();dlg.remove()};dlg.querySelector('.close').onclick=close;dlg.oncancel=()=>dlg.remove();
  const range=wobbleClipRange(),current=project.animationClips?.find(c=>c.id===project.activeClip);
  $('clipName').value=current?.name||'';$('clipStart').value=range.start+1;$('clipEnd').value=range.end+1;
  $('clipStart').max=$('clipEnd').max=project.frames.length;
  $('removeAnimationClip').disabled=!current;
  for(const [i,f]of project.frames.entries()){
    const label=document.createElement('label');label.textContent='Frame '+(i+1);const input=document.createElement('input');input.type='number';input.min=1;input.max=24;input.value=f.hold;input.dataset.hold=i;label.append(input);dlg.querySelector('.wobble-hold-list').append(label);
  }
  $('setAllFrameHolds').onclick=()=>{const n=clamp(Math.round(+$('allFrameHold').value)||1,1,24);dlg.querySelectorAll('[data-hold]').forEach(e=>e.value=n)};
  $('applyWobbleHolds').onclick=()=>{dlg.querySelectorAll('[data-hold]').forEach(e=>project.frames[+e.dataset.hold].hold=clamp(Math.round(+e.value)||1,1,24));commit('Frame timing updated');syncWobbleClips();close()};
  $('saveAnimationClip').onclick=()=>{
    const name=$('clipName').value.trim(),s=+$('clipStart').value-1,e=+$('clipEnd').value-1;
    if(!name||!Number.isInteger(s)||!Number.isInteger(e)||s<0||e<s||e>=project.frames.length){$('clipStatus').textContent='Name the clip and choose an ordered frame range.';return}
    project.animationClips||=[];if(!current&&project.animationClips.length>=12){$('clipStatus').textContent='This flipbook has twelve clips. Remove one first.';return}
    const c={id:current?.id||uid(),name,startId:project.frames[s].id,endId:project.frames[e].id};
    if(current)Object.assign(current,c);else project.animationClips.push(c);
    project.activeClip=c.id;project.current=s;commit('Animation clip saved');syncWobbleClips();close();
  };
  $('removeAnimationClip').onclick=()=>{project.animationClips=project.animationClips.filter(c=>c.id!==project.activeClip);project.activeClip=null;commit('Animation clip removed');syncWobbleClips();close()};
  dlg.showModal();
}
const workshopButton=document.createElement('button');workshopButton.id='animationWorkshop';workshopButton.textContent='Timing & clips…';workshopButton.onclick=wobbleAnimationWorkshop;
const clipSelect=document.createElement('select');clipSelect.id='animationClip';clipSelect.setAttribute('aria-label','Animation section');clipSelect.onchange=()=>wobbleChooseClip(clipSelect.value);
const rangeSummary=document.createElement('span');rangeSummary.id='animationRangeSummary';rangeSummary.className='muted';
$('frames').before(Object.assign(document.createElement('div'),{className:'wobble-clip-bar'}));document.querySelector('.wobble-clip-bar').append(workshopButton,clipSelect,rangeSummary);
const updateBeforeClips=updateUI;updateUI=function(){updateBeforeClips();syncWobbleClips()};
frameTimingWorkshop=wobbleAnimationWorkshop;
const clipCSS=document.createElement('style');clipCSS.textContent='.wobble-clip-bar{display:flex;align-items:center;gap:10px;padding:5px 16px;flex-wrap:wrap}.wobble-clip-bar select{max-width:220px}.wobble-animation-workshop{max-width:720px;width:90vw}.wobble-animation-workshop .close{float:right}.wobble-hold-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:10px;max-height:30vh;overflow:auto}.wobble-hold-list input{width:80px}.wobble-animation-workshop .row{flex-wrap:wrap}.wobble-animation-workshop input{max-width:200px}.wobble-animation-workshop label{display:flex;flex-direction:column;gap:6px}.wobble-animation-workshop .row{display:flex;align-items:end;gap:14px;margin:14px 0}.wobble-animation-workshop h3{margin-top:24px}.wobble-hold-list{padding:4px 0 12px}.wobble-animation-workshop .close{min-width:36px}';document.head.append(clipCSS);
syncWobbleClips();
window.JagoWobbleAnimation={range:wobbleClipRange,open:wobbleAnimationWorkshop,choose:wobbleChooseClip};

const actualSize=document.createElement('button');actualSize.textContent='1:1';actualSize.title='View actual canvas pixels';actualSize.onclick=()=>{zoom=1;pan={x:0,y:0};applyView()};$('fitBtn').after(actualSize);
const clipRenderFrames=renderFrames;renderFrames=function(){clipRenderFrames();const {start,end}=wobbleClipRange();[...$('frames').children].forEach((e,i)=>{if(i<project.frames.length){e.classList.toggle('outside-clip',i<start||i>end);e.title+=(i<start||i>end)?' · outside selected clip':''}})};
const rangeStyle=document.createElement('style');rangeStyle.textContent='.frame-card.outside-clip{opacity:.45}.frame-card.outside-clip:hover,.frame-card.outside-clip.active{opacity:1}';document.head.append(rangeStyle);

const onionWholeFrame=drawOnion;
drawOnion=function(fi,tint,alpha=.2){
  if(!onionSettings.activeOnly)return onionWholeFrame(fi,tint,alpha);
  const c=onionCanvas.getContext('2d');c.clearRect(0,0,project.width,project.height);c.globalCompositeOperation='source-over';
  c.drawImage(renderLayer(fi,project.activeLayer,0),0,0);
  if(tint){c.globalCompositeOperation='source-in';c.fillStyle=tint;c.fillRect(0,0,project.width,project.height);c.globalCompositeOperation='source-over'}
  ctx.save();ctx.globalAlpha=alpha;ctx.drawImage(onionCanvas,0,0);ctx.restore();
};
paintOnionFrames=function(fi){
  const range=wobbleClipRange(),inside=fi>=range.start&&fi<=range.end;
  const start=inside?range.start:0,end=inside?range.end:project.frames.length-1,length=end-start+1;
  const used=new Set([fi]);
  for(let d=1;d<=Math.max(onionSettings.before,onionSettings.after);d++)for(const direction of [-1,1]){
    if(d>(direction<0?onionSettings.before:onionSettings.after))continue;
    let i=fi+direction*d;
    if(onionSettings.wrap)i=start+((i-start)%length+length)%length;
    if(i<start||i>end||used.has(i))continue;used.add(i);
    drawOnion(i,onionSettings.original?null:(direction<0?'#ea5c86':'#53aacf'),onionSettings.opacity/(onionSettings.fade?d:1));
  }
};
