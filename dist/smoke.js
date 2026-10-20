'use strict';
// Small, local fluid renderer. No assets, network requests or external runtime.
window.createPortfolioInk = function(canvas) {
  const palette=[[.035,.52,.43],[.27,.12,.58],[.65,.19,.07]];
  function setPalette(colors){colors.forEach((color,i)=>{palette[i]=color.map(v=>v/255);});}
  const colorAt=(phase,amount)=>{
    const index=((phase%3)+3)%3,a=palette[Math.floor(index)],b=palette[(Math.floor(index)+1)%3];
    const t=index%1;
    return a.map((v,i)=>(v*(1-t)+b[i]*t)*amount);
  };
  let mobileQuality=false;
  let gl;
  try{gl=canvas.getContext('webgl2',{alpha:true,antialias:false,depth:false,stencil:false,premultipliedAlpha:false,powerPreference:'low-power'});}catch{}
  if(!gl||!gl.getExtension('EXT_color_buffer_float'))return fallback(canvas,gl);
  const resources=[],programs=[];
  let fields=[],W=1,H=1,velocity,dye,pressure,divergence,curl,queue=[],lastIdle=0,lost=false;
  const vertex=`#version 300 es
    layout(location=0) in vec2 position;
    out vec2 uv;
    void main(){uv=position*.5+.5;gl_Position=vec4(position,0.,1.);}`;
  const header=`#version 300 es
    precision highp float;
    precision highp sampler2D;
    in vec2 uv;
    out vec4 frag;
    uniform vec2 texel;`;
  function shader(type,source){
    const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);
    if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){gl.deleteShader(s);throw new Error('Fluid shader unavailable');}
    resources.push(s);return s;
  }
  function program(source){
    const p=gl.createProgram();gl.attachShader(p,vs);gl.attachShader(p,shader(gl.FRAGMENT_SHADER,header+source));gl.linkProgram(p);
    if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error('Fluid program unavailable');
    const entry={p,locations:new Map()};programs.push(entry);return entry;
  }
  let vs,buffer,advect,splat,makeCurl,vorticity,makeDivergence,jacobi,subtract,display;
  try{
    vs=shader(gl.VERTEX_SHADER,vertex);
    advect=program(`uniform sampler2D flow;uniform sampler2D source;uniform float dt;uniform float decay;
      void main(){vec2 back=uv-dt*texture(flow,uv).xy*texel;frag=texture(source,back)*exp(-decay*dt);}`);
    splat=program(`uniform sampler2D source;uniform vec2 point;uniform vec3 color;uniform float radius;uniform float aspect;
      void main(){vec2 p=uv-point;p.x*=aspect;vec3 ink=color*exp(-dot(p,p)/radius);frag=vec4(texture(source,uv).xyz+ink,1.);}`);
    makeCurl=program(`uniform sampler2D flow;
      void main(){float L=texture(flow,uv-vec2(texel.x,0)).y;float R=texture(flow,uv+vec2(texel.x,0)).y;
      float B=texture(flow,uv-vec2(0,texel.y)).x;float T=texture(flow,uv+vec2(0,texel.y)).x;frag=vec4(.5*(R-L-T+B),0,0,1);}`);
    vorticity=program(`uniform sampler2D flow;uniform sampler2D curls;uniform float dt;
      void main(){float L=texture(curls,uv-vec2(texel.x,0)).x;float R=texture(curls,uv+vec2(texel.x,0)).x;
      float B=texture(curls,uv-vec2(0,texel.y)).x;float T=texture(curls,uv+vec2(0,texel.y)).x;float C=texture(curls,uv).x;
      vec2 force=.5*vec2(abs(T)-abs(B),abs(R)-abs(L));force/=length(force)+.0001;force*=10.*C;force.y*=-1.;
      frag=vec4(clamp(texture(flow,uv).xy+force*dt,vec2(-700),vec2(700)),0,1);}`);
    makeDivergence=program(`uniform sampler2D flow;
      void main(){vec2 C=texture(flow,uv).xy;float L=texture(flow,uv-vec2(texel.x,0)).x;float R=texture(flow,uv+vec2(texel.x,0)).x;
      float B=texture(flow,uv-vec2(0,texel.y)).y;float T=texture(flow,uv+vec2(0,texel.y)).y;
      if(uv.x-texel.x<0.)L=-C.x;if(uv.x+texel.x>1.)R=-C.x;if(uv.y-texel.y<0.)B=-C.y;if(uv.y+texel.y>1.)T=-C.y;
      frag=vec4(.5*(R-L+T-B),0,0,1);}`);
    jacobi=program(`uniform sampler2D pressure;uniform sampler2D divergence;
      void main(){float L=texture(pressure,uv-vec2(texel.x,0)).x;float R=texture(pressure,uv+vec2(texel.x,0)).x;
      float B=texture(pressure,uv-vec2(0,texel.y)).x;float T=texture(pressure,uv+vec2(0,texel.y)).x;
      frag=vec4((L+R+B+T-texture(divergence,uv).x)*.25,0,0,1);}`);
    subtract=program(`uniform sampler2D pressure;uniform sampler2D flow;
      void main(){float L=texture(pressure,uv-vec2(texel.x,0)).x;float R=texture(pressure,uv+vec2(texel.x,0)).x;
      float B=texture(pressure,uv-vec2(0,texel.y)).x;float T=texture(pressure,uv+vec2(0,texel.y)).x;
      frag=vec4(texture(flow,uv).xy-vec2(R-L,T-B),0,1);}`);
    display=program(`uniform sampler2D ink;uniform float time;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      void main(){vec2 d=1.25/vec2(textureSize(ink,0));
      vec3 c=.4*texture(ink,uv).rgb+.15*(texture(ink,uv+vec2(d.x,0)).rgb+texture(ink,uv-vec2(d.x,0)).rgb+texture(ink,uv+vec2(0,d.y)).rgb+texture(ink,uv-vec2(0,d.y)).rgb);
      c=max(c,vec3(0));float density=max(c.r,max(c.g,c.b));
      vec3 pigment=pow(c,vec3(.78));pigment=1.-exp(-pigment*1.7);
      float grain=.965+.035*hash(floor(gl_FragCoord.xy)+mod(floor(time*8.),128.));
      float alpha=clamp((1.-exp(-density*1.65))*.72,0.,.62);
      frag=vec4(pigment*grain,alpha);}`);
    buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
    gl.disable(gl.BLEND);gl.clearColor(0,0,0,0);
  }catch{dispose();return fallback(canvas,gl);}
  function location(p,key){if(!p.locations.has(key))p.locations.set(key,gl.getUniformLocation(p.p,key));return p.locations.get(key);}
  function target(w,h){
    const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA16F,w,h,0,gl.RGBA,gl.HALF_FLOAT,null);
    const fbo=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);
    const item={texture,fbo,w,h};fields.push(item);
    if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error('Fluid framebuffer unavailable');
    gl.viewport(0,0,w,h);gl.clear(gl.COLOR_BUFFER_BIT);return item;
  }
  const pair=(w,h)=>({read:target(w,h),write:target(w,h),swap(){[this.read,this.write]=[this.write,this.read];}});
  function run(p,to,textures={},values={}){
    gl.useProgram(p.p);gl.bindFramebuffer(gl.FRAMEBUFFER,to?to.fbo:null);gl.viewport(0,0,to?to.w:canvas.width,to?to.h:canvas.height);
    Object.entries(textures).forEach(([key,value],i)=>{gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,value.texture);gl.uniform1i(location(p,key),i);});
    Object.entries(values).forEach(([key,value])=>{const loc=location(p,key);if(Array.isArray(value)){if(value.length===2)gl.uniform2fv(loc,value);else gl.uniform3fv(loc,value);}else gl.uniform1f(loc,value);});
    gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
  }
  function releaseFields(){for(const f of fields){gl.deleteTexture(f.texture);gl.deleteFramebuffer(f.fbo);}fields=[];}
  function dispose(){releaseFields();programs.forEach(p=>gl.deleteProgram(p.p));resources.forEach(s=>gl.deleteShader(s));if(buffer)gl.deleteBuffer(buffer);}
  function resize(w,h){
    mobileQuality=matchMedia('(hover: none), (pointer: coarse), (max-width: 760px)').matches;
    W=w;H=h;canvas.width=Math.round(w*Math.min(devicePixelRatio||1,mobileQuality?1:1.25));canvas.height=Math.round(h*Math.min(devicePixelRatio||1,mobileQuality?1:1.25));
    const aspect=w/h;
    const grid=(base,max)=>{const a=aspect>1?[Math.round(base*aspect),base]:[base,Math.round(base/aspect)];const scale=Math.min(1,max/Math.max(...a));return a.map(n=>Math.max(2,Math.round(n*scale)));};
    releaseFields();
    try{const [vw,vh]=grid(mobileQuality?64:96,mobileQuality?144:224),[dw,dh]=grid(mobileQuality?160:320,mobileQuality?384:768);velocity=pair(vw,vh);pressure=pair(vw,vh);curl=target(vw,vh);divergence=target(vw,vh);dye=pair(dw,dh);queue=[];}catch{lost=true;canvas.style.opacity='0';}
  }
  function enqueue(x,y,dx,dy,amount,radius,phase){
    queue.push({x:Math.max(0,Math.min(1,x/W)),y:1-Math.max(0,Math.min(1,y/H)),dx,dy,color:colorAt(phase,amount),radius});
    if(queue.length>24)queue.splice(0,queue.length-24);
  }
  function move(x,y,dx,dy,strength=1){
    const distance=Math.hypot(dx,dy);if(distance<.6)return;
    const steps=Math.min(4,Math.max(1,Math.ceil(distance/28)));
    const phase=performance.now()*.00015+x/W*.8;
    for(let i=1;i<=steps;i++)enqueue(x-dx*(1-i/steps),y-dy*(1-i/steps),Math.max(-240,Math.min(240,dx/W*2400)),Math.max(-240,Math.min(240,-dy/H*2400)),(.27+Math.min(distance,50)*.004)*strength/Math.sqrt(steps),.00125,phase+i*.035);
  }
  function burst(x,y,strength=1){
    const phase=performance.now()*.00015;
    for(let i=0;i<8;i++){const a=i*Math.PI/4;enqueue(x+Math.cos(a)*16,y+Math.sin(a)*16,Math.cos(a)*65-Math.sin(a)*35,Math.sin(a)*-65-Math.cos(a)*35,.25*strength,.0026,phase+i*.16);}
  }
  function clear(){queue=[];if(lost)return;for(const f of fields){gl.bindFramebuffer(gl.FRAMEBUFFER,f.fbo);gl.clear(gl.COLOR_BUFFER_BIT);}gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.clear(gl.COLOR_BUFFER_BIT);}
  function render(now,dt,background){
    if(lost||!velocity)return;
    dt=Math.min(dt,.033)*.65;
    const texel=[1/velocity.read.w,1/velocity.read.h];
    if(background&&now-lastIdle>1600){lastIdle=now;const side=Math.floor(now/1600)%2;enqueue(W*(side ? .88 : .12),H*(.42+.15*Math.sin(now*.00008)),side?-7:7,10,.04,.0035,now*.00012);}
    for(const p of queue.splice(0,8)){
      const values={point:[p.x,p.y],radius:p.radius,aspect:W/H};
      run(splat,velocity.write,{source:velocity.read},{...values,color:[p.dx,p.dy,0]});velocity.swap();
      run(splat,dye.write,{source:dye.read},{...values,color:p.color});dye.swap();
    }
    run(advect,velocity.write,{flow:velocity.read,source:velocity.read},{texel,dt,decay:.9});velocity.swap();
    run(makeCurl,curl,{flow:velocity.read},{texel});
    run(vorticity,velocity.write,{flow:velocity.read,curls:curl},{texel,dt});velocity.swap();
    run(makeDivergence,divergence,{flow:velocity.read},{texel});
    // Start pressure from zero to avoid residual drift when the pointer stops.
    for(const f of [pressure.read,pressure.write]){gl.bindFramebuffer(gl.FRAMEBUFFER,f.fbo);gl.clear(gl.COLOR_BUFFER_BIT);}
    for(let i=0;i<(mobileQuality?7:12);i++){run(jacobi,pressure.write,{pressure:pressure.read,divergence},{texel});pressure.swap();}
    run(subtract,velocity.write,{flow:velocity.read,pressure:pressure.read},{texel});velocity.swap();
    run(advect,dye.write,{flow:velocity.read,source:dye.read},{texel,dt,decay:.95});dye.swap();
    run(display,null,{ink:dye.read},{time:now/1000});
  }
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();lost=true;canvas.style.opacity='0';});
  return {canvas,resize,move,burst,render,clear,setPalette,mode:'fluid'};

  // Graceful Canvas fallback for devices without float render targets.
  function fallback(original,oldGL){
    let field=original;
    if(oldGL){field=original.cloneNode(false);original.replaceWith(field);}
    const context=field.getContext('2d');
    if(!context)return {canvas:field,resize(){},move(){},burst(){},render(){},clear(){},mode:'none'};
    let w=1,h=1,puffs=[];
    const noise=(x,y)=>Math.sin(x*1.7+Math.cos(y*2.1))*Math.sin(y*2.3+Math.cos(x*1.5));
    const makeSprites=()=>palette.map(color=>{
      const tile=document.createElement('canvas');tile.width=tile.height=128;const c=tile.getContext('2d'),data=c.createImageData(128,128);
      for(let y=0;y<128;y++)for(let x=0;x<128;x++){
        const i=(y*128+x)*4,nx=(x-64)/64,ny=(y-64)/64,r=Math.hypot(nx,ny),grain=.65+.2*noise(nx*4,ny*4)+.15*noise(nx*11,ny*11);
        color.forEach((v,k)=>data.data[i+k]=Math.min(255,v*380));data.data[i+3]=Math.max(0,1-r)**2*grain*150;
      }
      c.putImageData(data,0,0);return tile;
    });
    let sprites=makeSprites();
    function puff(x,y,dx,dy,strength,radius=65){puffs.push({x,y,vx:dx*.008,vy:dy*.008,age:0,life:2.5+Math.random(),radius,spin:Math.random()*6.28,color:Math.floor(performance.now()/1600)%3,opacity:strength});if(puffs.length>100)puffs.splice(0,puffs.length-100);}
    return {
      canvas:field,mode:'canvas',
      setPalette(colors){setPalette(colors);sprites=makeSprites();},
      resize(width,height){w=width;h=height;field.width=w;field.height=h;puffs=[];},
      move(x,y,dx,dy,strength=1){if(Math.hypot(dx,dy)>.6)for(let i=0;i<3;i++)puff(x-dx*i/3,y-dy*i/3,dx,dy,strength);},
      burst(x,y,strength=1){for(let i=0;i<12;i++){const a=i*Math.PI/6;puff(x,y,Math.cos(a)*85,Math.sin(a)*85,strength*.65,70);}},
      clear(){puffs=[];context.clearRect(0,0,w,h);},
      render(now,dt,background){
        dt*=.65;
        context.clearRect(0,0,w,h);context.globalCompositeOperation='screen';
        if(background&&Math.random()<dt*.9)puff(w*(Math.random()<.5?.1:.9),h*.5,0,-20,.2,120);
        puffs=puffs.filter(p=>p.age<p.life);
        for(const p of puffs){p.age+=dt;const t=p.age/p.life,flow=Math.sin(p.x*.008+p.y*.005+now*.0004);p.x+=(p.vx+flow*.7)*dt*60;p.y+=(p.vy-.3+Math.cos(p.x*.006-now*.0002)*.5)*dt*60;p.vx*=Math.exp(-dt*.5);p.vy*=Math.exp(-dt*.5);const r=p.radius*(.65+t*2.4);context.save();context.translate(p.x,p.y);context.rotate(p.spin+t);context.globalAlpha=Math.sin(Math.PI*.5*Math.min(1,t*5))*(1-t)*p.opacity*.55;context.drawImage(sprites[p.color],-r,-r,r*2,r*2);context.restore();}
      }
    };
  }
};
