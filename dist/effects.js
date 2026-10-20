'use strict';
(() => {
  const finePointer=matchMedia('(hover: hover) and (pointer: fine) and (min-width: 761px)');
  const touchLayout=matchMedia('(hover: none), (pointer: coarse), (max-width: 760px)');
  let mobileMode=touchLayout.matches;
  const reduce=matchMedia('(prefers-reduced-motion: reduce)');
  const hero=document.querySelector('.hero');
  const canvas=document.createElement('canvas');
  canvas.className='ambient-field';
  canvas.setAttribute('aria-hidden','true');
  const ctx=canvas.getContext('2d');
  if(!ctx||!hero)return;
  const inkCanvas=document.createElement('canvas');
  inkCanvas.className='ink-field';inkCanvas.setAttribute('aria-hidden','true');
  let ink;
  const ring=document.createElement('div');
  ring.className='pointer-ring';ring.setAttribute('aria-hidden','true');
  const light=document.createElement('div');
  light.className='hero-atmosphere';light.setAttribute('aria-hidden','true');
  document.querySelector('.hero-shade').after(light);
  const toggle=document.createElement('button');
  toggle.type='button';toggle.className='motion-toggle';toggle.hidden=true;
  toggle.title='Toggle background, smoke and video preview effects';
  document.body.prepend(canvas);
  document.body.append(inkCanvas);
  document.body.append(ring);
  document.querySelector('.site-header').append(toggle);
  const magnetic=[...document.querySelectorAll('.text-link,.header-cv,.featured-link,.contact-arrow')];
  magnetic.forEach(el=>el.classList.add('magnetic-target'));
  const cards=[...document.querySelectorAll('.project-image')];
  let allowed=true;
  try{allowed=localStorage.getItem('hiep-portfolio-motion')!=='off';}catch{}
  let running=false,frame=0,width=0,height=0,particles=[],ripples=[],last=0,scrollWind=0,lastScroll=scrollY,lastWindSplat=0;
  let pointer={x:innerWidth/2,y:innerHeight/2,active:false};
  let trail={x:pointer.x,y:pointer.y};
  let heroShift={x:0,y:0},heroTarget={x:0,y:0};
  let activeCard=null,activeMagnet=null,cardBox=null,magnetBox=null;
  let heroBox,heroVisible=true;
  let inkTheme='',cloudColors=[[24,116,126],[96,48,142],[157,68,32]];
  const defaultColors=[[24,116,126],[96,48,142],[157,68,32]];
  function heroColors(){
    const theme=window.PortfolioHeroTheme;
    if(!heroVisible||!theme)return defaultColors;
    const colors=theme.colors.map(hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)));
    return [colors[0],colors[1],colors[0].map((v,i)=>Math.round((v+colors[1][i])/2))];
  }
  const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
  function measure(){
    width=innerWidth;height=innerHeight;
    const dpr=Math.min(devicePixelRatio||1,mobileMode?1:1.5);
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    particles=Array.from({length:Math.min(mobileMode?18:65,Math.floor(width*height/(mobileMode?24000:18000)))},()=>({
      x:Math.random()*width,y:Math.random()*height,vx:(Math.random()-.5)*.14,vy:-.08-Math.random()*.15,r:.7+Math.random()*1.1,phase:Math.random()*6.28,tail:[]
    }));
    if(!ink&&window.createPortfolioInk){ink=window.createPortfolioInk(inkCanvas);ink.canvas.dataset.renderer=ink.mode;}
    ink?.resize(width,height);
    updateBounds();
  }
  function updateBounds(){
    heroBox=hero.getBoundingClientRect();
    heroVisible=heroBox.bottom>0&&heroBox.top<height;
    if(activeCard)cardBox=activeCard.getBoundingClientRect();
    if(activeMagnet)magnetBox=activeMagnet.getBoundingClientRect();
  }
  function clearTargets(){
    if(activeCard){['--tilt-x','--tilt-y','--shine-opacity'].forEach(key=>activeCard.style.removeProperty(key));activeCard=null;}
    if(activeMagnet){activeMagnet.style.removeProperty('--magnet-x');activeMagnet.style.removeProperty('--magnet-y');activeMagnet=null;}
    heroTarget={x:0,y:0};
    ring.classList.remove('is-visible','is-art','is-link','is-pressed');ring.textContent='';
  }
  function draw(now){
    if(!running)return;
    if(mobileMode&&now-last<32){frame=requestAnimationFrame(draw);return;}
    const dt=Math.min((now-last)/16.667||1,2);last=now;
    const easing=1-Math.pow(.88,dt);
    trail.x+=(pointer.x-trail.x)*easing;trail.y+=(pointer.y-trail.y)*easing;
    ring.style.transform=`translate3d(${trail.x}px,${trail.y}px,0)`;
    heroShift.x+=(heroTarget.x-heroShift.x)*easing;
    heroShift.y+=(heroTarget.y-heroShift.y)*easing;
    if(heroVisible){hero.style.setProperty('--hero-x',`${heroShift.x.toFixed(2)}px`);hero.style.setProperty('--hero-y',`${heroShift.y.toFixed(2)}px`);}
    ctx.clearRect(0,0,width,height);
    scrollWind*=Math.pow(.93,dt);
    // Broad color clouds live below the content; the fluid itself is a separate screen-blended layer.
    const targetColors=heroColors(),themeKey=heroVisible?(window.PortfolioHeroTheme?.key||'default'):'default';
    if(inkTheme!==themeKey){ink?.setPalette?.(targetColors);inkTheme=themeKey;}
    cloudColors=cloudColors.map((color,i)=>color.map((v,j)=>v+(targetColors[i][j]-v)*Math.min(1,dt*.025)));
    const clouds=[{x:.12,y:.24,r:.48},{x:.86,y:.60,r:.43},{x:.60,y:.95,r:.35}].map((cloud,i)=>({...cloud,c:cloudColors[i].map(Math.round).join(',')}));
    for(let i=0;i<clouds.length;i++){
      const c=clouds[i],x=c.x*width+Math.sin(now*.000075+i*2)*50+(trail.x-width/2)*.04;
      const y=c.y*height+Math.cos(now*.000065+i)*35-scrollWind*4,r=Math.max(width,height)*c.r;
      const cloud=ctx.createRadialGradient(x,y,0,x,y,r);cloud.addColorStop(0,`rgba(${c.c},.12)`);cloud.addColorStop(.5,`rgba(${c.c},.04)`);cloud.addColorStop(1,`rgba(${c.c},0)`);ctx.fillStyle=cloud;ctx.fillRect(0,0,width,height);
    }
    if(pointer.active){
      const glow=ctx.createRadialGradient(trail.x,trail.y,0,trail.x,trail.y,310);
      glow.addColorStop(0,'rgba(72,145,157,.1)');glow.addColorStop(1,'rgba(55,133,130,0)');
      ctx.fillStyle=glow;ctx.fillRect(0,0,width,height);
    }
    for(const p of particles){
      let dx=p.x-pointer.x,dy=p.y-pointer.y,d=Math.hypot(dx,dy);
      p.vx=p.vx*Math.pow(.985,dt)+Math.sin(p.y*.009+now*.00015)*.012*dt;
      p.vy=p.vy*Math.pow(.985,dt)+Math.cos(p.x*.007-now*.00013)*.012*dt;
      if(pointer.active&&d<230){const force=(1-d/230)*.07*dt;p.vx+=(-dy+dx*.3)/Math.max(d,1)*force;p.vy+=(dx+dy*.3)/Math.max(d,1)*force;}
      for(const ripple of ripples){const rx=p.x-ripple.x,ry=p.y-ripple.y,rd=Math.hypot(rx,ry),age=(now-ripple.time)/1900;if(rd<250&&age<1){const force=(1-rd/250)*(1-age)*.07*dt;p.vx+=(-ry+rx*.4)/Math.max(rd,1)*force;p.vy+=(rx+ry*.4)/Math.max(rd,1)*force;}}
      p.vx=clamp(p.vx,-2.5,2.5);p.vy=clamp(p.vy,-2.5,2.5);
      p.x+=p.vx*dt*.65;p.y+=(p.vy-scrollWind*.035)*dt*.65;
      let wrapped=false;
      if(p.y< -8){p.y=height+8;wrapped=true;}if(p.y>height+8){p.y=-8;wrapped=true;}if(p.x< -8){p.x=width+8;wrapped=true;}if(p.x>width+8){p.x=-8;wrapped=true;}
      if(wrapped)p.tail=[];p.tail.push({x:p.x,y:p.y});if(p.tail.length>9)p.tail.shift();
      if(p.tail.length>1){ctx.beginPath();ctx.moveTo(p.tail[0].x,p.tail[0].y);for(const t of p.tail)ctx.lineTo(t.x,t.y);ctx.strokeStyle='rgba(114,163,184,.12)';ctx.lineWidth=.7;ctx.stroke();}
      const near=pointer.active?Math.max(0,1-d/200):0;
      ctx.beginPath();ctx.arc(p.x,p.y,p.r+near*.4,0,Math.PI*2);
      ctx.fillStyle=`rgba(${near>.2?'244,145,103':'116,159,155'},${.16+near*.22+.06*Math.sin(now*.0004+p.phase)})`;ctx.fill();
    }
    if(!mobileMode)for(let i=0;i<particles.length;i++)for(let j=i+1;j<particles.length;j++){
      const a=particles[i],b=particles[j],d=Math.hypot(a.x-b.x,a.y-b.y);
      if(d<115){ctx.strokeStyle=`rgba(89,136,133,${(1-d/115)*.1})`;ctx.lineWidth=.6;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}
    }
    ripples=ripples.filter(r=>now-r.time<1900);
    for(const r of ripples){const age=(now-r.time)/1900,radius=20+age*180;const bloom=ctx.createRadialGradient(r.x,r.y,radius*.3,r.x,r.y,radius);bloom.addColorStop(0,'rgba(132,71,159,0)');bloom.addColorStop(.65,`rgba(94,133,173,${(1-age)*.09})`);bloom.addColorStop(1,'rgba(94,133,173,0)');ctx.fillStyle=bloom;ctx.fillRect(r.x-radius,r.y-radius,radius*2,radius*2);}
    ink?.render(now,dt/60,mobileMode||heroBox.bottom<height*.25);
    frame=requestAnimationFrame(draw);
  }
  function sync(){
    mobileMode=touchLayout.matches;
    document.body.classList.toggle('motion-mobile',mobileMode);
    const toggleParent=mobileMode?document.body:document.querySelector('.site-header');
    if(toggle.parentElement!==toggleParent)toggleParent.append(toggle);
    const capable=!reduce.matches;
    const enabled=capable&&allowed;
    toggle.hidden=!capable;
    toggle.textContent=allowed?'MOTION ON':'MOTION OFF';
    toggle.setAttribute('aria-pressed',String(allowed));
    toggle.setAttribute('aria-label',allowed?'Turn off visual effects':'Turn on visual effects');
    document.body.classList.toggle('motion-enabled',enabled);
    const shouldRun=enabled&&!document.hidden&&!document.body.classList.contains('project-dialog-open');
    if(shouldRun===running)return;
    running=shouldRun;
    cancelAnimationFrame(frame);
    if(running){measure();last=performance.now();frame=requestAnimationFrame(draw);}
    else{clearTargets();pointer.active=false;ripples=[];ink?.clear();ctx.clearRect(0,0,width,height);heroShift={x:0,y:0};hero.style.removeProperty('--hero-x');hero.style.removeProperty('--hero-y');}
  }
  toggle.addEventListener('click',()=>{allowed=!allowed;try{localStorage.setItem('hiep-portfolio-motion',allowed?'on':'off');}catch{}sync();window.dispatchEvent(new CustomEvent('portfolio:motionpreference',{detail:{enabled:allowed}}));});
  cards.forEach(card=>{
    card.addEventListener('pointerenter',event=>{if(!running||mobileMode||event.pointerType==='touch')return;activeCard=card;cardBox=card.getBoundingClientRect();});
    card.addEventListener('pointerleave',()=>{['--tilt-x','--tilt-y','--shine-opacity'].forEach(key=>card.style.removeProperty(key));if(activeCard===card)activeCard=null;});
  });
  magnetic.forEach(el=>{
    el.addEventListener('pointerenter',event=>{if(!running||mobileMode||event.pointerType==='touch')return;activeMagnet=el;magnetBox=el.getBoundingClientRect();});
    el.addEventListener('pointerleave',()=>{el.style.removeProperty('--magnet-x');el.style.removeProperty('--magnet-y');if(activeMagnet===el)activeMagnet=null;});
  });
  document.addEventListener('pointermove',event=>{
    if(!running)return;
    if(mobileMode){
      if(event.isPrimary===false)return;
      if(!(event.buttons||event.pointerType==='touch')||!pointer.active)return;
      const previous=pointer;
      pointer={x:event.clientX,y:event.clientY,active:true};
      if(!event.target.closest('.project-image,a,button,dialog,input,textarea')){
        ink?.move(pointer.x,pointer.y,pointer.x-previous.x,pointer.y-previous.y,.32);
        light.style.setProperty('--light-x',`${pointer.x/width*100}%`);
        light.style.setProperty('--light-y',`${pointer.y/height*100}%`);
      }
      return;
    }
    if(event.pointerType==='touch')return;
    const previous=pointer;
    pointer={x:event.clientX,y:event.clientY,active:true};
    // Dialogs use the native cursor and keep their focus/controls unobstructed.
    const inDialog=event.target.closest('dialog');
    pointer.active=!inDialog;
    if(!inDialog&&previous.active){
      const strength=event.target.closest('.project-image') ? 0 : event.target.closest('a,button,h1,h2,h3,p') ? .45 : .8;
      if(strength>0)ink?.move(event.clientX,event.clientY,event.clientX-previous.x,event.clientY-previous.y,strength);
    }
    ring.classList.toggle('is-visible',!inDialog);
    const art=event.target.closest('.project-image');
    const link=event.target.closest('a,button');
    ring.classList.toggle('is-art',!!art);ring.classList.toggle('is-link',!!link&&!art);ring.textContent=art?'VIEW ↗':'';
    if(heroVisible&&!inDialog){
      const nx=clamp((event.clientX-heroBox.left)/heroBox.width,0,1),ny=clamp((event.clientY-heroBox.top)/heroBox.height,0,1);
      heroTarget={x:(nx-.5)*-18,y:(ny-.5)*-12};
      light.style.setProperty('--light-x',`${nx*100}%`);light.style.setProperty('--light-y',`${ny*100}%`);
    }
    if(activeCard&&cardBox){
      const x=clamp((event.clientX-cardBox.left)/cardBox.width,0,1),y=clamp((event.clientY-cardBox.top)/cardBox.height,0,1);
      activeCard.style.setProperty('--tilt-x',`${(y-.5)*-4}deg`);activeCard.style.setProperty('--tilt-y',`${(x-.5)*5}deg`);
      activeCard.style.setProperty('--shine-x',`${x*100}%`);activeCard.style.setProperty('--shine-y',`${y*100}%`);activeCard.style.setProperty('--shine-opacity','1');
    }
    if(activeMagnet&&magnetBox){activeMagnet.style.setProperty('--magnet-x',`${clamp((event.clientX-magnetBox.left-magnetBox.width/2)*.13,-8,8)}px`);activeMagnet.style.setProperty('--magnet-y',`${clamp((event.clientY-magnetBox.top-magnetBox.height/2)*.2,-6,6)}px`);}
  },{passive:true});
  document.addEventListener('pointerdown',event=>{
    if(!running)return;
    if(mobileMode){
      if(event.isPrimary===false||event.target.closest('.project-image,a,button,dialog,input,textarea'))return;
      pointer={x:event.clientX,y:event.clientY,active:true};
      ripples.push({x:pointer.x,y:pointer.y,time:performance.now()});ripples=ripples.slice(-3);
      ink?.burst(pointer.x,pointer.y,.5);
      light.style.setProperty('--light-x',`${pointer.x/width*100}%`);
      light.style.setProperty('--light-y',`${pointer.y/height*100}%`);
      return;
    }
    if(event.pointerType==='touch')return;
    ring.classList.add('is-pressed');
    if(!event.target.closest('a,button,dialog')){ripples.push({x:event.clientX,y:event.clientY,time:performance.now()});ripples=ripples.slice(-5);ink?.burst(event.clientX,event.clientY);}
  },{passive:true});
  const endContact=()=>{ring.classList.remove('is-pressed');if(mobileMode)pointer.active=false;};
  document.addEventListener('pointerup',endContact,{passive:true});
  document.addEventListener('pointercancel',endContact,{passive:true});
  document.documentElement.addEventListener('pointerleave',()=>{pointer.active=false;clearTargets();});
  window.addEventListener('blur',()=>{pointer.active=false;clearTargets();});
  document.querySelectorAll('dialog').forEach(el=>{el.addEventListener('close',clearTargets);el.addEventListener('focusin',()=>{clearTargets();pointer.active=false;ink?.clear();});});
  window.addEventListener('resize',()=>{if(running)measure();},{passive:true});
  window.addEventListener('scroll',()=>{
    const delta=scrollY-lastScroll;lastScroll=scrollY;
    if(running){
      scrollWind=clamp(scrollWind+delta*.012,-8,8);updateBounds();
      const now=performance.now();
      if(mobileMode&&heroVisible)heroTarget.y=clamp(-heroBox.top*.015,-8,8);
      if((mobileMode||heroBox.bottom<height*.25)&&Math.abs(delta)>8&&now-lastWindSplat>(mobileMode?240:120)){lastWindSplat=now;ink?.move(width*(Math.floor(now/500)%2 ? .1 : .9),height*.6,0,clamp(-delta*.25,-50,50),mobileMode?.14:.18);}
    }
  },{passive:true});
  document.addEventListener('visibilitychange',sync);
  document.addEventListener('portfolio:projectchange',sync);
  touchLayout.addEventListener('change',()=>{clearTargets();sync();if(running)measure();});
  finePointer.addEventListener('change',sync);reduce.addEventListener('change',sync);
  sync();
})();
