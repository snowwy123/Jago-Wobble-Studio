// SPDX-License-Identifier: MIT
// Frame selection is transient and keyed by identity, never by changing positions.
let wobbleFrameSelection = new Set(), wobbleSelectionOwner = null, wobbleFrameAnchor = null;
function wobbleSelectedIndices() {
  if (wobbleSelectionOwner !== project) {
    wobbleSelectionOwner = project; wobbleFrameSelection.clear(); wobbleFrameAnchor = null;
  }
  const indices = project.frames.flatMap((f,i)=>wobbleFrameSelection.has(f.id)?[i]:[]);
  return indices.length ? indices : [project.current];
}
function wobbleBatchFrames(action, value) {
  if (drawing || exporting || moving) return;
  pause(); clearSelection();
  const indices = wobbleSelectedIndices(), chosen = new Set(indices);
  if (action === 'hold') {
    if (!Number.isInteger(value) || value < 1 || value > 24) return toast('Choose a hold from 1 to 24 beats.');
    indices.forEach(i=>project.frames[i].hold=value);
  } else if (action === 'duplicate') {
    if (project.frames.length+indices.length>48) return toast('A flipbook can contain up to 48 frames.');
    const frames=indices.map(i=>({...copy(project.frames[i]),id:uid()}));
    project.frames.splice(indices.at(-1)+1,0,...frames);
    wobbleFrameSelection=new Set(frames.map(f=>f.id)); project.current=indices.at(-1)+1;
  } else if (action === 'reverse') {
    const frames=indices.map(i=>project.frames[i]).reverse();
    indices.forEach((i,n)=>project.frames[i]=frames[n]);
  } else if (action === 'delete') {
    if (indices.length===project.frames.length) return toast('Keep at least one frame.');
    project.frames=project.frames.filter((f,i)=>!chosen.has(i));
    project.current=Math.min(indices[0],project.frames.length-1); wobbleFrameSelection.clear();
  } else if (action === 'left' || action === 'right') {
    const direction=action==='left'?-1:1;
    if (direction<0 ? indices[0]===0 : indices.at(-1)===project.frames.length-1) return;
    const currentId=currentFrame().id;
    for(const i of direction<0?indices:[...indices].reverse())
      [project.frames[i],project.frames[i+direction]]=[project.frames[i+direction],project.frames[i]];
    project.current=project.frames.findIndex(f=>f.id===currentId);
  } else return;
  commit('Selected frames updated');
}
const refreshFramesBase=renderFrames;
renderFrames=function(){
  refreshFramesBase(); const selected=new Set(wobbleSelectedIndices());
  [...$('frames').querySelectorAll('.frame-card')].forEach((button,i)=>{
    button.classList.toggle('batch-selected',selected.has(i));
    button.setAttribute('aria-pressed',String(selected.has(i)));
    button.title+=' · Shift: range · Ctrl: add/remove';
    button.onclick=e=>{
      if(drawing||exporting)return;
      const id=project.frames[i].id;
      if(e.shiftKey){
        const anchor=project.frames.findIndex(f=>f.id===wobbleFrameAnchor);
        const a=anchor<0?project.current:anchor;
        if(!e.ctrlKey&&!e.metaKey)wobbleFrameSelection.clear();
        for(let j=Math.min(a,i);j<=Math.max(a,i);j++)wobbleFrameSelection.add(project.frames[j].id);
      }else if(e.ctrlKey||e.metaKey){
        // Start an additive selection with the current frame included.
        if(!wobbleFrameSelection.size)wobbleFrameSelection.add(currentFrame().id);
        if(wobbleFrameSelection.has(id))wobbleFrameSelection.delete(id);else wobbleFrameSelection.add(id);
        wobbleFrameAnchor=id;
      }else{wobbleFrameSelection=new Set([id]);wobbleFrameAnchor=id;}
      selectFrame(i);
    };
  });
  if($('wobbleBatchSummary'))$('wobbleBatchSummary').textContent=selected.size+' selected';
};
const batchBar=document.createElement('div');batchBar.className='wobble-clip-bar wobble-batch-bar';
batchBar.innerHTML='<strong id="wobbleBatchSummary">1 selected</strong><span class="muted">Shift-click a range · Ctrl-click to select</span><button data-batch="all">Select all</button><button data-batch="clear">Clear</button><label>Hold <input id="wobbleBatchHold" type="number" min="1" max="24" value="1" aria-label="Selected frame hold in beats"></label><button data-batch="hold">Set hold</button><button data-batch="duplicate">Duplicate</button><button data-batch="reverse">Reverse order</button><button data-batch="left" aria-label="Move selected frames left">←</button><button data-batch="right" aria-label="Move selected frames right">→</button><button data-batch="delete">Delete selected…</button>';
$('frames').before(batchBar);
batchBar.onclick=e=>{
  const action=e.target.closest('[data-batch]')?.dataset.batch;if(!action)return;
  if(action==='all'){wobbleSelectedIndices();wobbleFrameSelection=new Set(project.frames.map(f=>f.id));renderFrames();return;}
  if(action==='clear'){wobbleFrameSelection.clear();renderFrames();return;}
  if(action==='delete'){confirmAction('Delete selected frames?', 'Delete '+wobbleSelectedIndices().length+' frames? Undo can restore them.',()=>wobbleBatchFrames('delete'));return;}
  wobbleBatchFrames(action,Number($('wobbleBatchHold').value));
};

// Deterministic directions change only an existing layer's motion.
function wobbleDirection(seed,index,family,base,locks={}){
  let n=2166136261;for(const c of String(seed)+':'+index)n=Math.imul(n^c.charCodeAt(0),16777619);
  const rand=()=>{n^=n<<13;n^=n>>>17;n^=n<<5;return(n>>>0)/4294967296;};
  const families={gentle:['sway','breathe','drift'],lively:['flutter','spring','ripple'],texture:['classic','crawl']};
  const types=families[family]||motionTypes;
  const type=locks.type?base.type:types[Math.floor(rand()*types.length)],m=motionDefaults(type);
  m.amount=locks.amount?base.amount:Math.round((type==='classic'?1:type==='crawl'?3:5)+rand()*(type==='classic'?4:14));
  m.speed=locks.speed?base.speed:1+Math.floor(rand()*3);
  m.angle=4+Math.round(rand()*12);m.wavelength=80+Math.round(rand()*180);
  m.path=['ellipse','line','figure8'][Math.floor(rand()*3)];m.phase=rand();m.gust=rand()*.4;
  if(locks.amount)for(const key of ['amount','angle','balanceX','balanceY','reach','gust'])m[key]=base[key];
  if(locks.speed)m.loop=base.loop;
  return validateMotion(m);
}
function wobbleExploreMotion(){
  if(drawing||exporting||!canDraw())return;
  pause();const owner=project,layer=activeLayer(),baseline=copy(layer.motion||motionDefaults());
  const dialog=document.createElement('dialog');dialog.className='wobble-directions';
  dialog.innerHTML='<button class="close" aria-label="Close motion directions">×</button><h2>Explore motion</h2><p>Four ways to bring your drawing to life. Apply changes only to the active layer across its frames. Your marks, colours and timing stay yours.</p><div class="direction-controls"><label>Family<select data-field="family"><option value="any">Any motion</option><option value="gentle">Gentle movement</option><option value="lively">Lively movement</option><option value="texture">Ink and texture</option></select></label><label>Seed<input data-field="seed" maxlength="64" value="little-movements"></label><button data-action="generate">Generate</button><button data-action="surprise">Surprise me</button></div><div class="direction-controls"><span>Keep:</span><label><input type="checkbox" data-lock="type"> Motion type</label><label><input type="checkbox" data-lock="amount"> Strength</label><label><input type="checkbox" data-lock="speed"> Speed</label></div><p class="muted">Hover or focus a preview to animate it. Apply is one Undo step. Save a favourite to keep it in your motion preset library.</p><div class="direction-grid"></div><p role="status" class="direction-status"></p>';
  document.body.append(dialog);const grid=dialog.querySelector('.direction-grid'),status=dialog.querySelector('.direction-status');
  status.textContent='Active layer: '+layer.name;
  let timer=null,disposed=false;
  function stop(){clearInterval(timer);timer=null;}
  function close(){stop();disposed=true;dialog.close();dialog.remove();renderNeeded=true;}
  dialog.querySelector('.close').onclick=close;dialog.oncancel=e=>{e.preventDefault();close();};
  function draw(canvas,m,tick){
    if(disposed||project!==owner)return;
    const oldDraft=motionDraft,oldPreview=motionPreview,oldSample=motionSampleActive;
    try{
      motionDraft=m;motionPreview=true;motionSampleActive=true;
      const raw=renderFrame(project.current,tick,true),ctx=canvas.getContext('2d');
      ctx.clearRect(0,0,canvas.width,canvas.height);const scale=Math.min(canvas.width/raw.width,canvas.height/raw.height);ctx.drawImage(raw,(canvas.width-raw.width*scale)/2,(canvas.height-raw.height*scale)/2,raw.width*scale,raw.height*scale);
    }finally{motionDraft=oldDraft;motionPreview=oldPreview;motionSampleActive=oldSample;}
  }
  function generate(){
    stop();grid.replaceChildren();
    const seed=dialog.querySelector('[data-field=seed]').value, family=dialog.querySelector('[data-field=family]').value;
    const locks=Object.fromEntries([...dialog.querySelectorAll('[data-lock]')].map(e=>[e.dataset.lock,e.checked]));
    for(let i=0;i<4;i++){
      const motion=wobbleDirection(seed,i,family,baseline,locks),card=document.createElement('section'),canvas=document.createElement('canvas');
      canvas.width=280;canvas.height=160;canvas.style.maxHeight='180px';canvas.tabIndex=0;canvas.setAttribute('aria-label','Preview '+motionNames[motion.type]);
      const label=document.createElement('strong');label.textContent=motionNames[motion.type]+' · '+motion.amount+' strength · '+motion.speed+' cycles';
      const apply=document.createElement('button');apply.textContent='Apply to active layer';
      apply.onclick=()=>{if(project!==owner||activeLayer()!==layer)return close();if(!canDraw())return;motionDraft=copy(motion);applyMotionToLayer();status.textContent=motionNames[motion.type]+' applied. Undo restores the previous motion.';};
      const save=document.createElement('button');save.textContent='Save favourite…';save.onclick=()=>{
        const name=prompt('Name this motion preset',motionNames[motion.type]);if(!name?.trim())return;
        if(studioLibrary.motions.length>=30)return status.textContent='Your motion library has 30 presets. Export or remove some first.';
        studioLibrary.motions.push({name:name.trim().slice(0,50),motion:copy(motion)});saveLibrary();status.textContent='Saved in Motion presets. Export your library to back it up.';
      };
      card.append(canvas,label,apply,save);grid.append(card);draw(canvas,motion,owner.boil*.5);
      const start=()=>{stop();let tick=0;timer=setInterval(()=>{if(!dialog.open||document.hidden||project!==owner){stop();return;}draw(canvas,motion,tick);tick+=owner.boil/8;},125);};
      canvas.onmouseenter=canvas.onfocus=start;canvas.onmouseleave=canvas.onblur=stop;
    }
  }
  dialog.querySelector('[data-action=generate]').onclick=generate;
  dialog.querySelector('[data-action=surprise]').onclick=()=>{dialog.querySelector('[data-field=seed]').value=crypto.randomUUID().slice(0,12);generate();};
  dialog.showModal();generate();
}
const quickBar=document.createElement('div');quickBar.className='wobble-clip-bar wobble-quick-bar';
for(const [label,action]of [['Explore motion…',wobbleExploreMotion],['Brushes & motions…',showLibrary]]){
  const b=document.createElement('button');b.textContent=label;b.onclick=action;quickBar.append(b);
}
$('viewport').before(quickBar);
const refreshStyle=document.createElement('style');refreshStyle.textContent='.wobble-batch-bar{border-top:1px solid var(--line,#b7aa90);font-size:12px;gap:6px}.wobble-batch-bar input{width:54px}.frame-card.batch-selected{outline:2px solid var(--accent,#997337);outline-offset:-3px}.wobble-directions{width:min(800px,94vw);max-height:88vh;overflow:auto;padding:22px;background:var(--panel,#fcf6e7);color:var(--text,#253335)}.wobble-directions .close{float:right}.direction-controls{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin:14px 0}.direction-controls label{display:flex;gap:6px;align-items:center}.direction-controls input:not([type=checkbox]){width:150px}.direction-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.direction-grid section{display:flex;flex-wrap:wrap;gap:8px;border:1px solid var(--line,#b7aa90);padding:12px}.direction-grid canvas{width:100%;object-fit:contain;background:repeating-conic-gradient(#8882 0 25%,transparent 0 50%) 0/16px 16px}.direction-grid strong{width:100%;font-size:13px}@media(max-width:540px){.direction-grid{grid-template-columns:1fr}.wobble-batch-bar .muted{width:100%}}';document.head.append(refreshStyle);
renderFrames();
window.JagoWobbleRefresh={selected:wobbleSelectedIndices,batch:wobbleBatchFrames,direction:wobbleDirection,explore:wobbleExploreMotion};

// Keep precision frame actions available without crowding the flipbook.
const batchDialog=document.createElement('dialog');batchDialog.className='wobble-batch-dialog';
const batchTitle=document.createElement('h2');batchTitle.textContent='Edit selected frames';
const batchHelp=document.createElement('p');batchHelp.textContent='Choose frames in the strip with Shift or Ctrl. Each operation is one Undo step. Reverse changes the order of selected frames; it does not reverse their artwork.';
const batchClose=document.createElement('button');batchClose.textContent='Done';batchClose.onclick=()=>batchDialog.close();
const batchActions=document.createElement('div');batchActions.className='wobble-batch-actions';
for(const node of [...batchBar.children])if(node.matches('label,[data-batch]'))batchActions.append(node);
batchDialog.append(batchTitle,batchHelp,batchActions,batchClose);document.body.append(batchDialog);
batchActions.onclick=batchBar.onclick;
const editSelected=document.createElement('button');editSelected.textContent='Edit selected…';editSelected.onclick=()=>{if(!drawing&&!exporting)batchDialog.showModal();};
batchBar.append(editSelected);
// Restore a direct multi-selection route; actions remain in a compact dialog.
const allFrames=document.createElement('button');allFrames.textContent='Select all';allFrames.onclick=()=>{wobbleSelectedIndices();wobbleFrameSelection=new Set(project.frames.map(f=>f.id));renderFrames();};batchBar.append(allFrames);
const focusCanvas=document.createElement('button');focusCanvas.textContent='Focus canvas';focusCanvas.setAttribute('aria-pressed','false');
focusCanvas.onclick=()=>{const focused=document.body.classList.toggle('wobble-focus');focusCanvas.textContent=focused?'Show timeline & settings':'Focus canvas';focusCanvas.setAttribute('aria-pressed',String(focused));requestAnimationFrame(fit);};quickBar.append(focusCanvas);
const polish=document.createElement('style');polish.textContent='.app{grid-template-rows:minmax(170px,1fr) 230px}.timeline{overflow:auto}.wobble-quick-bar{padding:4px 12px;gap:6px;flex:none}.wobble-quick-bar button{font-size:12px;min-height:30px}.wobble-batch-bar{padding:2px 0}.wobble-batch-dialog{width:min(600px,92vw);max-height:85vh;overflow:auto;background:var(--panel);color:var(--text);padding:24px}.wobble-batch-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:20px 0}.wobble-batch-actions input{width:60px}.wobble-focus .timeline,.wobble-focus #inspector{display:none}.wobble-focus .app{grid-template-rows:minmax(170px,1fr);grid-template-columns:64px minmax(200px,1fr)}.wobble-focus .tools{grid-row:1}.direction-grid canvas{height:150px}.wobble-directions select,.wobble-directions input{background:var(--raised);color:var(--text);border:1px solid var(--line);border-radius:6px;padding:5px}@media(max-width:650px){.wobble-batch-bar .muted{display:none}.wobble-quick-bar{flex-wrap:nowrap;overflow-x:auto}.wobble-quick-bar button{flex:none}.app{grid-template-rows:minmax(170px,1fr) 230px}}';document.head.append(polish);

// Synchronise controls on layer/document restoration, not on every slider input.
let wobbleMotionOwner=null,wobbleMotionLayer=null,wobbleStoredMotion=null;
const refreshSyncStudio=syncStudioUI;
syncStudioUI=function(){
  const layer=activeLayer(),stored=JSON.stringify(layer.motion||null);
  const changed=wobbleMotionOwner!==project||wobbleMotionLayer!==layer.id;
  const restored=stored!==wobbleStoredMotion;
  if(changed){motionPreview=false;motionBoundsCache.clear();renderCache.clear();}
  if(motionScope==='layer'&&(changed||restored))motionDraft=copy(layer.motion||motionDefaults());
  wobbleMotionOwner=project;wobbleMotionLayer=layer.id;wobbleStoredMotion=stored;
  refreshSyncStudio();
};
const scopeSummary=document.createElement('p');scopeSummary.className='muted';scopeSummary.id='wobbleMotionScopeSummary';
$('motionScope').parentElement.after(scopeSummary);
const refreshSyncMotion=syncMotionUI;
syncMotionUI=function(){refreshSyncMotion();const l=activeLayer();scopeSummary.textContent=(motionScope==='layer'?'Editing layer “'+l.name+'”':'Preparing motion for new marks')+(l.clipTo&&l.followMotion!==false?' · Currently follows its base layer. Apply to layer gives it its own motion.':'');};
const clipSelected=document.createElement('button');clipSelected.textContent='Make clip from selection…';clipSelected.onclick=()=>{
  const indices=wobbleSelectedIndices();
  if(indices.at(-1)-indices[0]+1!==indices.length)return toast('Select a continuous frame range to make a clip.');
  batchDialog.close();wobbleAnimationWorkshop();$('clipName').value='';$('clipStart').value=indices[0]+1;$('clipEnd').value=indices.at(-1)+1;
  // Creating from selection always adds a new clip; leave existing named clips intact.
  $('removeAnimationClip').disabled=true;
  const button=$('saveAnimationClip');
  button.onclick=()=>{
    const name=$('clipName').value.trim(),s=+$('clipStart').value-1,e=+$('clipEnd').value-1;
    if(!name||!Number.isInteger(s)||!Number.isInteger(e)||s<0||e<s||e>=project.frames.length||(project.animationClips||[]).length>=12){$('clipStatus').textContent='Give the clip a name and valid range. Keep at most twelve clips.';return;}
    project.animationClips||=[];
    const clip={id:uid(),name:name.slice(0,80),startId:project.frames[s].id,endId:project.frames[e].id};project.animationClips.push(clip);project.activeClip=clip.id;project.current=s;commit('Clip created from selected frames');const d=button.closest('dialog');d.close();d.remove();
  };
};batchActions.append(clipSelected);
const headerSizing=new ResizeObserver(()=>{document.documentElement.style.setProperty('--wobble-header-height',Math.ceil(document.querySelector('header.top').getBoundingClientRect().height)+'px');window.scrollTo(0,0);});headerSizing.observe(document.querySelector('header.top'));
const fitLayout=document.createElement('style');fitLayout.textContent='.app{height:calc(100dvh - var(--wobble-header-height,80px))}.timeline{display:flex;flex-direction:column;min-height:0}.timeline-header,.timeline>.wobble-clip-bar{flex:none}.timeline .frames{min-height:70px;flex:1;align-items:flex-start}.wobble-focus .workspace{min-height:0}';document.head.append(fitLayout);
