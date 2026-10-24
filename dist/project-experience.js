'use strict';
(() => {
  const themes={
    warrior:{base:'12,21,18',colors:[[58,130,106],[189,135,74]],accent:'203,164,105'},
    summer:{base:'18,14,25',colors:[[132,77,181],[59,151,172]],accent:'191,152,225'},
    tiger:{base:'25,12,15',colors:[[166,47,63],[87,111,129]],accent:'225,138,125'},
    kshatriya:{base:'12,21,23',colors:[[64,128,102],[58,128,165]],accent:'143,194,165'},
    arttoy:{base:'24,13,26',colors:[[171,71,143],[104,77,184]],accent:'230,160,204'},
    autumn:{base:'23,19,15',colors:[[176,112,45],[55,99,142]],accent:'224,180,105'},
    angel:{base:'22,22,18',colors:[[169,159,124],[176,139,64]],accent:'223,207,158'},
    relics:{base:'13,23,29',colors:[[49,143,160],[202,97,40]],accent:'127,211,206'},
    snake:{base:'11,20,25',colors:[[45,137,153],[111,75,165]],accent:'117,201,211'},
    mavia:{base:'16,23,18',colors:[[64,130,98],[171,143,60]],accent:'171,202,131'},
    maviamini:{base:'12,23,24',colors:[[47,155,171],[114,157,66]],accent:'130,212,202'},
    blockclans:{base:'24,18,14',colors:[[174,103,48],[65,112,150]],accent:'225,168,106'}
  };
  const panel=document.getElementById('project-dialog'),bar=panel.querySelector('.dialog-bar');
  const reduce=matchMedia('(prefers-reduced-motion:reduce)'),mobile=matchMedia('(max-width:760px),(pointer:coarse)');
  const assets=window.PortfolioNavigationAssets;
  const mood=document.createElement('div');mood.className='project-mood';mood.setAttribute('aria-hidden','true');
  const canvas=document.createElement('canvas');canvas.className='project-mood-canvas';mood.append(canvas);panel.prepend(mood);
  const ctx=canvas.getContext('2d');
  const rail=document.createElement('nav');rail.className='project-filmstrip';rail.setAttribute('aria-label','Project media shortcuts');
  const railHeading=document.createElement('div');railHeading.className='filmstrip-heading';
  const label=document.createElement('span');label.textContent='EXPLORE THIS PROJECT';
  const position=document.createElement('span');position.className='filmstrip-position';railHeading.append(label,position);
  const track=document.createElement('div');track.className='filmstrip-track';rail.append(railHeading,track);bar.after(rail);
  let entries=[],selected=-1,key=null,scrollFrame=0,frame=0,last=0,width=1,height=1,enabled=true,sprites=[],oldSprites=[],changedAt=0;
  try{enabled=localStorage.getItem('hiep-portfolio-motion')!=='off';}catch{}
  const clouds=[{x:.04,y:.25,r:.7,s:1},{x:.94,y:.63,r:.72,s:-1},{x:.42,y:.92,r:.48,s:1}];
  function smokeSprite(color){
    const sprite=document.createElement('canvas');sprite.width=sprite.height=128;
    const c=sprite.getContext('2d'),data=c.createImageData(128,128);
    for(let y=0;y<128;y++)for(let x=0;x<128;x++){
      const nx=(x-64)/64,ny=(y-64)/64,r=Math.hypot(nx,ny),i=(y*128+x)*4;
      const grain=.63+.22*Math.sin(nx*8+Math.cos(ny*9))+.15*Math.sin(ny*17+nx*12);
      color.forEach((v,k)=>data.data[i+k]=v);data.data[i+3]=Math.max(0,1-r)**2*grain*170;
    }
    c.putImageData(data,0,0);return sprite;
  }
  function measure(){
    const box=panel.getBoundingClientRect();if(box.width<1)return;
    width=Math.round(panel.clientWidth);height=Math.round(panel.clientHeight);
    canvas.width=width;canvas.height=height;canvas.style.height=`${height}px`;
    panel.style.setProperty('--project-bar-height',`${bar.offsetHeight}px`);
    panel.style.setProperty('--project-rail-height',`${rail.offsetHeight}px`);
  }
  const sizes=new ResizeObserver(()=>{measure();scheduleSelection();});sizes.observe(panel);sizes.observe(bar);sizes.observe(rail);
  function canAnimate(){return !!ctx&&panel.open&&enabled&&!reduce.matches&&!document.hidden&&!document.getElementById('image-viewer').open&&!document.getElementById('video-viewer').open&&entries[selected]?.kind!=='scene';}
  function draw(now){
    if(!canAnimate()){frame=0;return;}
    frame=requestAnimationFrame(draw);if(now-last<(mobile.matches?50:33))return;last=now;
    ctx.clearRect(0,0,width,height);ctx.globalCompositeOperation='screen';
    const mix=Math.min(1,(now-changedAt)/1200);
    clouds.forEach((cloud,index)=>{
      const x=width*cloud.x+Math.sin(now*.0001+index)*width*.05,y=height*cloud.y+Math.cos(now*.00008+index)*height*.07;
      const radius=Math.max(width,height)*cloud.r;
      ctx.save();ctx.translate(x,y);ctx.rotate(cloud.s*(now*.000025+index));
      if(oldSprites.length&&mix<1){ctx.globalAlpha=(1-mix)*.37;ctx.drawImage(oldSprites[index%oldSprites.length],-radius,-radius,radius*2,radius*2);}
      if(sprites.length){ctx.globalAlpha=mix*.37;ctx.drawImage(sprites[index%sprites.length],-radius,-radius,radius*2,radius*2);}
      ctx.restore();
    });
    if(mix===1)oldSprites=[];
  }
  function sync(){
    if(canAnimate()){if(!frame){last=0;frame=requestAnimationFrame(draw);}}
    else{cancelAnimationFrame(frame);frame=0;if(ctx)ctx.clearRect(0,0,width,height);}
  }
  function select(index){
    if(index<0||index===selected)return;
    selected=index;
    entries.forEach((entry,i)=>{if(i===index)entry.button.setAttribute('aria-current','true');else entry.button.removeAttribute('aria-current');});
    const entry=entries[index];position.textContent=entry.caption;
    const b=entry.button,edge=b.offsetLeft+b.offsetWidth;
    if(b.offsetLeft<track.scrollLeft||edge>track.scrollLeft+track.clientWidth){
      track.scrollTo({left:Math.max(0,b.offsetLeft-track.clientWidth/2+b.offsetWidth/2),behavior:reduce.matches?'instant':'smooth'});
    }
    sync();
  }
  function updateSelection(){
    scrollFrame=0;if(!panel.open||!entries.length)return;
    const rect=panel.getBoundingClientRect();
    const line=rect.top+bar.offsetHeight+rail.offsetHeight+Math.max(30,(panel.clientHeight-bar.offsetHeight-rail.offsetHeight)*.28);
    let best=0,distance=Infinity;
    entries.forEach((entry,i)=>{
      const r=entry.target.getBoundingClientRect();
      const d=line<r.top?r.top-line:line>r.bottom?line-r.bottom:0;
      if(d<distance){best=i;distance=d;}
    });
    select(best);
  }
  function scheduleSelection(){if(!scrollFrame)scrollFrame=requestAnimationFrame(updateSelection);}
  panel.addEventListener('scroll',scheduleSelection,{passive:true});
  function addEntry(target,kind,index,src,caption,accessible){
    const button=document.createElement('button');button.type='button';button.className='filmstrip-item';button.setAttribute('aria-label',accessible);
    const img=document.createElement('img');img.src=assets.thumbs[src]||src;img.alt='';img.width=80;img.height=56;img.decoding='async';
    const badge=document.createElement('span');badge.className='filmstrip-badge';badge.textContent=kind==='image'?String(index+1).padStart(2,'0'):kind==='video'?`▶ ${String(index+1).padStart(2,'0')}`:'3D';
    button.append(img,badge);track.append(button);
    const entry={target,kind,button,caption};entries.push(entry);
    button.addEventListener('click',()=>{
      const top=target.getBoundingClientRect().top-panel.getBoundingClientRect().top+panel.scrollTop-bar.offsetHeight-rail.offsetHeight-12;
      panel.scrollTo({top:Math.max(0,top),behavior:reduce.matches?'instant':'smooth'});
    });
  }
  function navigationCard(link,projectKey,direction){
    link.classList.add('project-route-card');link.setAttribute('aria-label',`${direction==='previous'?'Previous':'Next'} project: ${projects[projectKey].title}`);
    const img=document.createElement('img');img.src=assets.covers[projectKey];img.alt='';img.width=640;img.height=400;img.loading='lazy';img.decoding='async';
    const content=document.createElement('span');content.className='route-card-content';
    const eyebrow=document.createElement('span');eyebrow.className='route-card-eyebrow';eyebrow.textContent=direction==='previous'?'← PREVIOUS PROJECT':'NEXT PROJECT →';
    const title=document.createElement('span');title.className='route-card-title';title.textContent=projects[projectKey].title;
    content.append(eyebrow,title);link.replaceChildren(img,content);
  }
  function update(projectKey,{previous,next}){
    key=projectKey;entries=[];selected=-1;track.replaceChildren();track.scrollLeft=0;
    const project=projects[key],theme=themes[key];panel.dataset.projectTheme=key;
    panel.style.setProperty('--project-base',theme.base);panel.style.setProperty('--project-primary',theme.colors[0].join(','));panel.style.setProperty('--project-secondary',theme.colors[1].join(','));panel.style.setProperty('--project-accent',theme.accent);
    oldSprites=sprites;sprites=theme.colors.map(smokeSprite);changedAt=performance.now();
    panel.querySelectorAll('#dialog-images > .artwork-frame').forEach((target,i)=>addEntry(target,'image',i,imagePath(project.images[i]),`IMAGE ${String(i+1).padStart(2,'0')} / ${String(project.images.length).padStart(2,'0')}`,`Jump to image ${i+1} — ${project.title}`));
    panel.querySelectorAll('.project-motion figure').forEach((target,i)=>addEntry(target,'video',i,`assets/${project.videos[i].poster}`,`VIDEO ${String(i+1).padStart(2,'0')} / ${String(project.videos.length).padStart(2,'0')}`,`Jump to video ${i+1} — ${project.videos[i].label}`));
    const scene=panel.querySelector('.project-scene');if(scene)addEntry(scene,'scene',0,imagePath(project.images[0]),'INTERACTIVE 3D',`Jump to interactive 3D — ${project.title}`);
    const links=panel.querySelectorAll('.project-pagination > a');navigationCard(links[0],previous,'previous');navigationCard(links[1],next,'next');
    select(0);requestAnimationFrame(()=>{measure();scheduleSelection();sync();});
  }
  function dispose(){cancelAnimationFrame(frame);frame=0;cancelAnimationFrame(scrollFrame);scrollFrame=0;if(ctx)ctx.clearRect(0,0,width,height);}
  document.addEventListener('visibilitychange',sync);reduce.addEventListener('change',sync);
  window.addEventListener('portfolio:motionpreference',event=>{enabled=event.detail.enabled;sync();});
  document.querySelectorAll('dialog').forEach(el=>{el.addEventListener('focusin',sync);el.addEventListener('close',sync);});
  window.PortfolioProjectExperience={update,dispose};
})();
