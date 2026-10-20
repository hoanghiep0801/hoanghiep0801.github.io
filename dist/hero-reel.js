'use strict';
(() => {
  const hero=document.querySelector('.hero'),video=document.getElementById('hero-reel');
  const timeline=window.PortfolioHeroTimeline;if(!hero||!video||!timeline)return;
  const {shots,duration}=timeline,keys=shots.map(s=>s.key);
  const asset=name=>`assets/hero/${name}${timeline.revision?`?v=${encodeURIComponent(timeline.revision)}`:''}`;
  const link=hero.querySelector('.featured-link'),art=hero.querySelector('.hero-art-link');
  const title=document.getElementById('hero-shot-title'),explore=document.getElementById('hero-explore-title');
  const count=document.getElementById('hero-shot-count'),play=document.getElementById('hero-play');
  const scrub=document.getElementById('hero-scrub'),time=document.getElementById('hero-time');
  const chapters=[...hero.querySelectorAll('[data-hero-shot]')];
  const small=matchMedia('(max-width:760px)');
  const reduce=matchMedia('(prefers-reduced-motion:reduce)');
  const poster=hero.querySelector('.hero-art'),posterSource=hero.querySelector('.hero-poster source');
  let active=-1,visible=false,manualPause=false,allowed=true,failed=false,loadedMode='',generation=0,pendingTime=null,seekingTarget=null,frameId=null;
  let playhead=0,scrubbing=false,gesture=null,suppressClickUntil=0;
  const holds=new Set();
  try{allowed=localStorage.getItem('hiep-portfolio-motion')!=='off';}catch{}
  const mode=()=>small.matches?'mobile':'desktop';
  // Important facial/mechanical details in the full-bleed exports. Crop around
  // these details on unusual ratios instead of shrinking the whole artwork.
  const headBounds={
    desktop:{warrior:[70,410],tiger:[90,480],summer:[170,510],angel:[150,310],kshatriya:[115,360],arttoy:[190,540],autumn:[180,470]},
    mobile:{warrior:[90,470],tiger:[140,670],summer:[350,760],angel:[300,600],kshatriya:[120,620],arttoy:[370,780],autumn:[230,650]}
  };
  function frameArtwork(){
    const format=mode(),[sourceWidth,sourceHeight]=format==='mobile'?[1080,1920]:[1920,1080];
    const scale=Math.max(hero.clientWidth/sourceWidth,hero.clientHeight/sourceHeight);
    const overflow=Math.max(0,sourceHeight*scale-hero.clientHeight);
    const [top,bottom]=headBounds[format][keys[Math.max(0,active)]];
    const textTop=hero.querySelector(small.matches?'.hero-intro':'.hero-bottom').offsetTop;
    const safeTop=small.matches?65:48,safeBottom=Math.min(hero.clientHeight*.66,textTop-24);
    const minCrop=Math.max(0,bottom*scale-safeBottom);
    const maxCrop=Math.max(0,Math.min(overflow,top*scale-safeTop));
    // On very short screens preserve the upper facial detail first; the large
    // name may overlap the lower costume rather than pushing the face offscreen.
    const crop=Math.min(overflow,maxCrop,Math.max(minCrop,overflow/2));
    hero.style.setProperty('--hero-crop-y',`${-crop}px`);
  }
  const policyAllows=()=>allowed&&!reduce.matches&&!navigator.connection?.saveData;
  const canPlay=()=>policyAllows()&&!manualPause&&!holds.size&&!scrubbing&&!gesture&&!document.hidden&&visible&&!document.querySelector('dialog[open]')&&!failed;
  function indexAt(t){const i=shots.findIndex(s=>t>=s.cueStart&&t<s.cueEnd);return i<0?0:i;}
  function showShot(index){
    if(index===active)return;
    active=index;const shot=shots[index],key=shot.key,name=projects[key].title;
    hero.dataset.featuredProject=key;title.textContent=name;explore.textContent=name;
    count.textContent=`${String(index+1).padStart(2,'0')} / ${String(keys.length).padStart(2,'0')}`;
    for(const target of [link,art]){target.dataset.project=key;target.href=projectHref(key);target.setAttribute('aria-label',`${target===art?'Explore':'View'} ${name} project`);}
    link.replaceChildren(`VIEW PROJECT / ${name.toUpperCase()} `);
    const arrow=document.createElement('span');arrow.textContent='↗';arrow.setAttribute('aria-hidden','true');link.append(arrow);
    chapters.forEach((button,i)=>button.setAttribute('aria-pressed',String(i===index)));
    posterSource.srcset=asset(`${key}-mobile.webp`);poster.src=asset(`${key}-desktop.webp`);poster.alt=`${name} — 3D artwork by Hoang Hiep`;
    frameArtwork();
    hero.style.setProperty('--hero-ambient-a',shot.color[0]);hero.style.setProperty('--hero-ambient-b',shot.color[1]);
    window.PortfolioHeroTheme={key,colors:shot.color};
    document.dispatchEvent(new CustomEvent('portfolio:heroshot',{detail:window.PortfolioHeroTheme}));
  }
  function updateProgress(t){
    playhead=Math.max(0,Math.min(duration-.001,t));showShot(indexAt(playhead));
    if(!scrubbing)scrub.value=String(playhead);
    scrub.style.setProperty('--reel-progress',`${playhead/duration*100}%`);
    time.textContent=`00:${String(Math.floor(playhead)).padStart(2,'0')} / 00:${duration}`;
    const valueText=`${projects[keys[active]].title}, ${Math.floor(playhead)} of ${duration} seconds`;
    if(scrub.getAttribute('aria-valuetext')!==valueText)scrub.setAttribute('aria-valuetext',valueText);
  }
  function syncShot(){if(pendingTime===null&&seekingTarget===null)updateProgress(video.currentTime||0);}
  function tick(){frameId=null;syncShot();if(!video.paused&&video.requestVideoFrameCallback)frameId=video.requestVideoFrameCallback(tick);}
  function cancelTick(){if(frameId!==null&&video.cancelVideoFrameCallback)video.cancelVideoFrameCallback(frameId);frameId=null;}
  function updateButton(){play.textContent=manualPause||failed?'▶':'Ⅱ';play.setAttribute('aria-label',manualPause||failed?'Play showreel':'Pause showreel');play.hidden=!policyAllows();}
  function applySeek(t){seekingTarget=t;video.currentTime=t;}
  function setSource(){
    const wanted=mode();if(loadedMode===wanted)return;
    pendingTime=playhead;seekingTarget=null;generation++;cancelTick();video.pause();hero.classList.remove('has-reel-frame');loadedMode=wanted;
    video.poster=asset(`${keys[active]}-${wanted}.webp`);
    video.src=asset(`hero-${wanted}.mp4`);video.load();
  }
  function reconcile(){
    updateButton();
    if(!canPlay()){generation++;video.pause();cancelTick();return;}
    setSource();const attempt=++generation;
    video.play().then(()=>{if(attempt!==generation||!canPlay()){if(!canPlay())video.pause();return;}hero.classList.add('has-reel-frame');})
      .catch(error=>{if(attempt!==generation||error.name==='AbortError')return;manualPause=true;hero.classList.remove('has-reel-frame');updateButton();});
  }
  function seek(t){
    const target=Math.max(0,Math.min(duration-.034,t));updateProgress(target);
    if(policyAllows()&&!failed){
      if(!loadedMode){pendingTime=target;setSource();}
      if(video.readyState>=1){pendingTime=null;applySeek(target);}else pendingTime=target;
    }else{pendingTime=target;hero.classList.remove('has-reel-frame');}
  }
  function choose(index){const i=(index+keys.length)%keys.length;seek(shots[i].seek);reconcile();}
  video.addEventListener('loadedmetadata',()=>{if(pendingTime!==null){const t=pendingTime;pendingTime=null;applySeek(t);}});
  video.addEventListener('playing',()=>{if(!canPlay()){video.pause();return;}hero.classList.add('has-reel-frame');cancelTick();tick();});
  video.addEventListener('timeupdate',syncShot);
  video.addEventListener('seeked',()=>{seekingTarget=null;syncShot();if(policyAllows()&&!failed)hero.classList.add('has-reel-frame');});
  video.addEventListener('error',()=>{failed=true;hero.classList.remove('has-reel-frame');video.pause();updateButton();});
  play.addEventListener('click',()=>{manualPause=!manualPause;reconcile();});
  document.getElementById('hero-prev').addEventListener('click',()=>choose(active-1));
  document.getElementById('hero-next').addEventListener('click',()=>choose(active+1));
  chapters.forEach((button,i)=>button.addEventListener('click',()=>choose(i)));
  scrub.max=String(duration);
  scrub.addEventListener('pointerdown',()=>{scrubbing=true;reconcile();});
  scrub.addEventListener('input',()=>seek(Number(scrub.value)));
  const finishScrub=()=>{if(!scrubbing)return;scrubbing=false;updateProgress(playhead);reconcile();};
  scrub.addEventListener('change',finishScrub);scrub.addEventListener('blur',finishScrub);
  window.addEventListener('pointerup',finishScrub);window.addEventListener('pointercancel',finishScrub);
  for(const target of [link,art]){
    target.addEventListener('focus',()=>{if(target.matches(':focus-visible')){holds.add(target);reconcile();}});
    target.addEventListener('blur',()=>{holds.delete(target);reconcile();});
  }
  art.addEventListener('pointermove',event=>{if(event.pointerType==='touch')return;const r=art.getBoundingClientRect();art.style.setProperty('--explore-x',`${Math.max(90,Math.min(r.width-90,event.clientX-r.left))}px`);art.style.setProperty('--explore-y',`${Math.max(32,Math.min(r.height-32,event.clientY-r.top))}px`);});
  art.addEventListener('pointerdown',event=>{
    if(event.pointerType!=='touch'&&!small.matches)return;
    gesture={id:event.pointerId,x:event.clientX,y:event.clientY,dx:0,dy:0};art.setPointerCapture(event.pointerId);reconcile();
  });
  art.addEventListener('pointermove',event=>{if(gesture?.id!==event.pointerId)return;gesture.dx=event.clientX-gesture.x;gesture.dy=event.clientY-gesture.y;});
  function finishGesture(event){
    if(gesture?.id!==event.pointerId)return;
    const g=gesture;gesture=null;
    if(event.type==='pointerup'&&Math.abs(g.dx)>45&&Math.abs(g.dx)>Math.abs(g.dy)*1.35){suppressClickUntil=performance.now()+600;choose(active+(g.dx<0?1:-1));}
    else if(event.type==='pointercancel'||Math.hypot(g.dx,g.dy)>15)suppressClickUntil=performance.now()+600;
    reconcile();
  }
  art.addEventListener('pointerup',finishGesture);art.addEventListener('pointercancel',finishGesture);
  art.addEventListener('lostpointercapture',event=>{if(gesture?.id===event.pointerId){gesture=null;reconcile();}});
  art.addEventListener('click',event=>{if(performance.now()<suppressClickUntil){event.preventDefault();event.stopImmediatePropagation();}},true);
  new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;reconcile();},{threshold:.05}).observe(hero);
  document.addEventListener('visibilitychange',reconcile);document.addEventListener('portfolio:projectchange',reconcile);
  new MutationObserver(reconcile).observe(document.body,{subtree:true,attributes:true,attributeFilter:['open']});
  window.addEventListener('portfolio:motionpreference',event=>{allowed=event.detail.enabled;reconcile();});
  reduce.addEventListener('change',reconcile);navigator.connection?.addEventListener('change',reconcile);
  new ResizeObserver(frameArtwork).observe(hero);
  small.addEventListener('change',()=>{failed=false;frameArtwork();if(policyAllows()&&visible){setSource();reconcile();}});
  showShot(0);updateProgress(0);updateButton();
})();
