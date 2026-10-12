(async()=>{
const checks=[],check=(name,ok)=>{checks.push({name,ok:!!ok});if(!ok)throw Error(name)},wait=ms=>new Promise(r=>setTimeout(r,ms));
const pixels=c=>new Uint8Array(c.getContext('2d').getImageData(0,0,c.width,c.height).data),equal=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
try{
 await wait(1600);pause();project=fresh(128,96);const id=project.activeLayer;
 const stroke=(tool='pen')=>({kind:'stroke',tool,color:'#257b88',size:8,opacity:.7,pressure:false,animate:true,mirror:false,seed:31,points:[{x:20,y:20,p:.5},{x:60,y:50,p:.5},{x:100,y:30,p:.5}]});
 project.frames[0].contents[id]=Array.from({length:20},(_,i)=>({...stroke(),seed:i,points:[{x:10+i,y:10,p:.5},{x:90,y:60+i,p:.5}]}));
 for(let i=1;i<4;i++){const f=copy(project.frames[0]);f.id=uid();f.hold=i+1;project.frames.push(f)}
 afterRestore();resetHistory();check('Animation workshop visibly reachable',!!$('animationWorkshop')&&!!$('animationClip'));
 JagoWobbleAnimation.open();$('clipName').value='Blink';$('clipStart').value=2;$('clipEnd').value=3;$('saveAnimationClip').click();check('Named clip saved with stable frame identities',project.animationClips[0].startId===project.frames[1].id);
 check('Clip limits playback',frameSequence().join()=== '1,2');check('Beat clock honors holds',frameAtBeat(2.1)===2&&beatForFrame(2)===2);
 project.loop='reverse';invalidate();check('Reverse clip order',frameSequence().join()==='2,1'&&beatForFrame(1)===3);check('Reverse projects reopen',(()=>{validateProject(copy(project));return true})());
 const saved=copy(project);undo();check('Clip creation undo',!project.animationClips);redo();check('Clip redo',project.activeClip===saved.activeClip);
 project.loop='pingpong';project.activeClip=null;invalidate();check('Ping-pong avoids duplicate endpoints',frameSequence().join()==='0,1,2,3,2,1');
 JagoWobbleAnimation.choose(saved.activeClip);project.loop='loop';invalidate();check('GIF range matches authored duration',Math.abs(gifSchedule(3).duration-5/8)<1e-8);check('PNG sequence uses selected range',pngSequenceSchedule(3,24).schedule.every(f=>f.frame===1||f.frame===2));
 const sheet=await JagoWobbleDelivery.sheet(2,64,null,{native:true,scale:2,padding:3});check('Integer sprite dimensions and padding',sheet.canvas.width===524&&sheet.canvas.height===198);check('Sprite range playback manifest',sheet.manifest.frames.length===2&&sheet.manifest.playback.map(f=>f.index).join()==='1,2'&&sheet.manifest.seconds===5/8);
 download(await canvasBlob(sheet.canvas),'integer-sprites.png');chrome.webview.postMessage({type:'jago-suite-test-artifact',name:'sprite-manifest.json',text:JSON.stringify(sheet.manifest)});await wait(300);
 check('Malformed clips rejected',(()=>{try{validateProject({...copy(project),animationClips:[{id:'x',name:'',startId:'a',endId:'b'}]});return false}catch{return true}})());
 project.activeClip=null;project.current=0;project.loop='loop';project.wiggleEnabled=false;invalidate();renderingStill=true;draft=stroke();draft.points=[{x:20,y:70,p:.5},{x:80,y:30,p:.5}];drawing=true;
 for(const style of ['smooth','pixel'])for(const tool of ['pen','eraser']){
 project.renderStyle=style;project.canvasMode=style==='pixel'?'pixel':'smooth';draft.tool=tool;invalidate();layerCacheEnabled=false;const reference=pixels(renderLayer(0,id,0,true,style,4));layerCacheEnabled=true;const cached=pixels(renderLayer(0,id,0,true,style,4));check(style+' '+tool+' cached draft matches original pixels',equal(reference,cached));
 }
 project.renderStyle='smooth';project.canvasMode='smooth';draft.tool='pen';invalidate();let calls=0;const drawBefore=drawOp;drawOp=function(...args){calls++;return drawBefore(...args)};
 renderLayer(0,id,0,true);const first=calls;renderLayer(0,id,0,true);check('Live stroke reuses committed artwork',calls-first===1);drawOp=drawBefore;draft=null;drawing=false;renderingStill=false;
 invalidate();updateUI();const thumb=$('frames').children[0].querySelector('canvas');selectFrame(1);check('Frame navigation reuses thumbnail pixels',$('frames').children[0].querySelector('canvas')===thumb);
 JagoWobbleAnimation.open();$('allFrameHold').value=4;$('setAllFrameHolds').click();$('applyWobbleHolds').click();check('Batch frame holds apply',project.frames.every(f=>f.hold===4));undo();check('Batch timing undo',project.frames[0].hold===1);
 let onionCalls=[];const drawOnionBefore=drawOnion;drawOnion=(i)=>onionCalls.push(i);onionSettings.wrap=true;onionSettings.before=8;onionSettings.after=8;paintOnionFrames(0);check('Wrapped onion skips current and duplicate guides',onionCalls.length===3&&new Set(onionCalls).size===3&&!onionCalls.includes(0));drawOnion=drawOnionBefore;
 project.width=129;project.height=97;resizeBuffers();draft=stroke();draft.tool='eraser';renderingStill=true;invalidate();layerCacheEnabled=false;const oddReference=pixels(renderLayer(0,id,0,true,'pixel',4));layerCacheEnabled=true;const oddCached=pixels(renderLayer(0,id,0,true,'pixel',4));check('Odd canvas edges keep exact pixel rendering',equal(oddReference,oddCached));draft=null;renderingStill=false;project.width=128;project.height=96;resizeBuffers();invalidate();
 const cap=await JagoSession.capture();await JagoSession.restore(cap.document);check('Workspace restoration retains clips',project.animationClips?.[0].name==='Blink');
 let paints=0;const paintBefore=paintCanvas;paintCanvas=function(){paints++;return paintBefore()};await JagoSession.focus(false);renderNeeded=true;await wait(250);check('Inactive Workspace stops canvas painting',paints===0);await JagoSession.focus(true);await wait(250);check('Workspace resumes canvas painting',paints>0);paintCanvas=paintBefore;
 const beforeIdle=copy(project);project=fresh(128,96);resizeBuffers();invalidate();updateUI();paintCanvas();let idlePaints=0;const idlePaintBefore=paintCanvas;paintCanvas=function(){idlePaints++;return idlePaintBefore()};await wait(350);check('Empty page does not redraw for nonexistent motion',idlePaints===0);paintCanvas=idlePaintBefore;project=beforeIdle;afterRestore();
 project.activeClip=project.animationClips[0].id;project.current=1;project.loop='reverse';invalidate();updateUI();
 const transfer=await JagoSuite.adapter.export({target:'dither',scope:'all',separate:false,seconds:1,fps:8,count:8,maxEdge:256,alpha:true,original:true,progress:()=>{}});check('Studio transfer carries editable clip project',transfer.original.data.activeClip===project.activeClip&&transfer.layers[0].frames.length===8);JagoSuite.validate(transfer);chrome.webview.postMessage({type:'jago-suite-test-artifact',name:'wobble-to-dither.json',text:JSON.stringify(transfer)});
 const forest=document.querySelector('header select[aria-label="Application appearance"]');if(forest){forest.value='forest';forest.dispatchEvent(new Event('change',{bubbles:true}))}
 chrome.webview.postMessage({type:'jago-suite-test-preview',name:'forest.png'});await wait(700);JagoWobbleAnimation.open();chrome.webview.postMessage({type:'jago-suite-test-preview',name:'animation-workshop.png'});await wait(700);document.querySelector('dialog:modal').close();
 chrome.webview.postMessage({type:'jago-suite-test-size',width:900,height:720});await wait(600);chrome.webview.postMessage({type:'jago-suite-test-preview',name:'compact.png'});await wait(700);
 check('Compact toolbar stays in window',document.querySelector('header').getBoundingClientRect().right<=innerWidth+1);
 window.suiteTestResult={ok:true,checks};
}catch(e){window.suiteTestResult={ok:false,error:e.stack,checks}}})();