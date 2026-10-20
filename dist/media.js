'use strict';
(() => {
  const reduce=matchMedia('(prefers-reduced-motion: reduce)');
  const fine=matchMedia('(hover:hover) and (pointer:fine)');
  const mobile=matchMedia('(hover:none), (pointer:coarse), (max-width:760px)');
  const large=document.getElementById('video-viewer');
  const player=document.getElementById('full-video');
  let playingPreview=null,videoTrigger=null,scene=null,sceneObserver=null,sceneGeneration=0,enginePromise=null;
  let effectsAllowed=true,previewFrame=0,blockedPreviews=new WeakSet();
  try{effectsAllowed=localStorage.getItem('hiep-portfolio-motion')!=='off';}catch{}
  const previewEntries=new Map();
  const pausePreviews=()=>{document.querySelectorAll('.motion-preview').forEach(v=>{v.pause();v.parentElement.classList.remove('is-playing');});playingPreview=null;};
  function playPreview(video){
    if(playingPreview===video&&!video.paused)return;
    pausePreviews();playingPreview=video;
    video.play().then(()=>{
      if(playingPreview===video&&!document.hidden)video.parentElement.classList.add('is-playing');
      else video.pause();
    }).catch(error=>{if(error.name!=='AbortError')blockedPreviews.add(video);if(playingPreview===video)playingPreview=null;});
  }
  function chooseMobilePreview(){
    previewFrame=0;
    if(!mobile.matches)return;
    if(reduce.matches||!effectsAllowed||document.hidden||large.open||document.getElementById('image-viewer').open||navigator.connection?.saveData){pausePreviews();return;}
    const projectOpen=document.getElementById('project-dialog').open;
    let best=null,bestDistance=Infinity;
    for(const [video,ratio] of previewEntries){
      if(!video.isConnected||ratio<.55||blockedPreviews.has(video)||!!video.closest('#project-dialog')!==projectOpen)continue;
      const box=video.getBoundingClientRect();
      if(box.width<1||box.bottom<0||box.top>innerHeight)continue;
      const distance=Math.abs((box.top+box.bottom)/2-innerHeight*.5);
      if(distance<bestDistance){best=video;bestDistance=distance;}
    }
    if(best)playPreview(best);else pausePreviews();
  }
  function scheduleMobilePreview(){
    if(!previewFrame)previewFrame=requestAnimationFrame(chooseMobilePreview);
  }
  const visible=new IntersectionObserver(entries=>{
    entries.forEach(({target,isIntersecting,intersectionRatio})=>{
      previewEntries.set(target,isIntersecting?intersectionRatio:0);
      if(!isIntersecting){target.pause();target.parentElement.classList.remove('is-playing');if(playingPreview===target)playingPreview=null;}
    });
    scheduleMobilePreview();
  },{threshold:[0,.15,.55,.75,1]});
  function bindPreview(host,clip){
    const video=document.createElement('video');
    video.className='motion-preview';video.muted=true;video.loop=true;video.playsInline=true;video.preload='none';
    video.setAttribute('muted','');video.setAttribute('playsinline','');
    video.src=`assets/${clip.src}`;video.poster=`assets/${clip.poster}`;
    video.width=clip.width;video.height=clip.height;video.setAttribute('aria-hidden','true');
    host.append(video);
    const start=()=>{
      if(reduce.matches||!effectsAllowed||mobile.matches||!fine.matches||large.open)return;
      playPreview(video);
    };
    const stop=()=>{if(mobile.matches){scheduleMobilePreview();return;}video.pause();host.classList.remove('is-playing');if(playingPreview===video)playingPreview=null;};
    host.addEventListener('pointerenter',start);host.addEventListener('pointerleave',stop);
    host.addEventListener('focus',start);host.addEventListener('blur',stop);
    visible.observe(video);
    return video;
  }
  function makePreview(clip){
    const figure=document.createElement('figure');
    const button=document.createElement('button');button.type='button';button.className='video-preview';button.setAttribute('aria-label',`Play ${clip.label} in a larger viewer`);
    bindPreview(button,clip);
    const hint=document.createElement('span');hint.className='video-hint';hint.textContent='↗ WATCH FILM';button.append(hint);
    button.addEventListener('click',()=>{
      pausePreviews();videoTrigger=button;
      document.getElementById('video-caption').textContent=clip.label;
      player.src=`assets/${clip.src}`;player.poster=`assets/${clip.poster}`;player.muted=false;
      large.showModal();player.play().catch(()=>{});document.querySelector('.video-close').focus({preventScroll:true});
    });
    const caption=document.createElement('figcaption');caption.textContent=clip.label;
    figure.append(button,caption);return figure;
  }
  document.querySelector('.video-close').addEventListener('click',()=>large.close());
  large.addEventListener('close',()=>{player.pause();player.removeAttribute('src');player.load();videoTrigger?.focus({preventScroll:true});scheduleMobilePreview();});
  document.getElementById('image-viewer').addEventListener('close',scheduleMobilePreview);
  document.addEventListener('visibilitychange',()=>{if(document.hidden){pausePreviews();player.pause();}else scheduleMobilePreview();});
  reduce.addEventListener('change',()=>{pausePreviews();scheduleMobilePreview();});
  mobile.addEventListener('change',()=>{pausePreviews();scheduleMobilePreview();});
  window.addEventListener('scroll',scheduleMobilePreview,{passive:true});
  document.getElementById('project-dialog').addEventListener('scroll',scheduleMobilePreview,{passive:true});
  document.addEventListener('portfolio:projectchange',scheduleMobilePreview);
  window.addEventListener('resize',scheduleMobilePreview,{passive:true});
  window.addEventListener('portfolio:motionpreference',event=>{effectsAllowed=event.detail.enabled;pausePreviews();scheduleMobilePreview();});
  document.addEventListener('pointerdown',()=>{blockedPreviews=new WeakSet();scheduleMobilePreview();},{passive:true});
  // The artist's local clips become quiet, on-demand previews on the work grid.
  document.querySelectorAll('.project-image[data-project]').forEach(card=>{
    const clip=projects[card.dataset.project]?.videos?.[0];
    if(clip){card.classList.add('has-motion');bindPreview(card,clip);}
  });
  function loadEngine(){
    if(window.marmoset)return Promise.resolve(window.marmoset);
    if(enginePromise)return enginePromise;
    enginePromise=new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      // Official documented embed: model files stay on this website's own host.
      script.src='https://viewer.marmoset.co/main/marmoset.js';script.async=true;
      script.onload=()=>window.marmoset?resolve(window.marmoset):reject(new Error('Viewer unavailable'));
      script.onerror=()=>{script.remove();enginePromise=null;reject(new Error('Viewer unavailable'));};
      document.head.append(script);
    });
    return enginePromise;
  }
  function disposeScene(){
    sceneGeneration++;sceneObserver?.disconnect();sceneObserver=null;
    scene?.unload();scene=null;
    document.querySelectorAll('.project-motion .motion-preview').forEach(v=>{visible.unobserve(v);previewEntries.delete(v);});
  }
  function makeScene(project){
    const section=document.createElement('section');section.className='project-scene';section.setAttribute('aria-label',`${project.title} interactive 3D model`);
    const header=document.createElement('div');header.className='scene-heading';
    const title=document.createElement('h3');title.textContent='EXPLORE IN 3D';
    const help=document.createElement('p');help.textContent='DRAG TO ROTATE · SCROLL TO ZOOM';header.append(title,help);
    const stage=document.createElement('div');stage.className='scene-stage';
    const poster=document.createElement('img');poster.src=imagePath(project.images[0]);poster.alt='';poster.loading='lazy';stage.append(poster);
    const mount=document.createElement('div');mount.className='scene-mount';stage.append(mount);
    const button=document.createElement('button');button.type='button';button.className='scene-start';button.textContent='↗ LOAD INTERACTIVE MODEL';stage.append(button);
    const status=document.createElement('p');status.className='scene-status';status.setAttribute('role','status');
    button.addEventListener('click',async()=>{
      if(location.protocol==='file:'){
        const link=document.createElement('a');link.href='http://127.0.0.1:8787/';link.textContent='OPEN LOCAL PREVIEW ↗';link.className='text-link';
        status.replaceChildren('Start MO-WEBSITE in the portfolio folder, then ',link);
        return;
      }
      const generation=++sceneGeneration;
      button.disabled=true;button.textContent='LOADING 3D…';status.textContent='Loading the interactive model…';pausePreviews();
      try{
        const engine=await loadEngine();
        if(generation!==sceneGeneration||!section.isConnected)return;
        const box=stage.getBoundingClientRect();
        scene=new engine.WebViewer(Math.round(box.width),Math.round(box.height),`assets/${project.viewer.path}`);
        const instance=scene;
        let lastWidth=Math.round(box.width),lastHeight=Math.round(box.height);
        mount.append(instance.domRoot);
        instance.onLoad=()=>{
          if(generation!==sceneGeneration)return;
          stage.classList.add('is-loaded');button.hidden=true;status.textContent='Model ready. Drag to rotate, scroll or pinch to zoom.';
          sceneObserver=new ResizeObserver(()=>{
            if(generation!==sceneGeneration||document.fullscreenElement)return;
            const rect=stage.getBoundingClientRect(),width=Math.round(rect.width),height=Math.round(rect.height);
            if(width===lastWidth&&height===lastHeight)return;
            lastWidth=width;lastHeight=height;instance.resize(width,height);
          });
          sceneObserver.observe(stage);
        };
        instance.loadScene();
      }catch{
        if(generation!==sceneGeneration)return;
        status.textContent='The 3D viewer could not load. Check your connection and try again.';button.disabled=false;button.textContent='↻ TRY AGAIN';
      }
    });
    section.append(header,stage,status);return section;
  }
  window.PortfolioMedia={makePreview,makeScene,pausePreviews,disposeScene};
})();
