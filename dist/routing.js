'use strict';
const projectSlugs={warrior:'viking-lord',summer:'bloom-in-the-dark',tiger:'iron-tiger',kshatriya:'nz-666-kshatriya',arttoy:'arttoy-valentine',autumn:'happy-mid-autumn-festival',angel:'male-angel',snake:'snake-sword',relics:'elemental-relics',mavia:'heroes-of-mavia',maviamini:'mavia-mini',blockclans:'block-clans'};
const portfolioBase=new URL('.',document.baseURI);
// Freeze the asset base before history changes the address to a project URL.
document.querySelector('base').href=portfolioBase.href;
const homeTitle='Hoang Hiep — 3D Character Artist';
const homeDescription='Do Hoang Hiep — 3D Character Artist based in Hanoi. Selected realistic and stylized character art, sculpting, and game production work.';
let routeClosing=false;
function projectHref(key){
  if(location.protocol==='file:'){
    const url=new URL('index.html',portfolioBase);url.hash=`project/${projectSlugs[key]}`;return url.href;
  }
  return new URL(`work/${projectSlugs[key]}/`,portfolioBase).href;
}
function projectFromLocation(){
  const slug=location.hash.startsWith('#project/')?location.hash.slice(9):location.pathname.match(/\/work\/([^/]+)(?:\/index\.html)?\/?$/)?.[1];
  return Object.keys(projectSlugs).find(key=>projectSlugs[key]===slug);
}
function isPlainProjectClick(event){return event.button===0&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&!event.altKey;}
function updateProjectMeta(key){
  document.title=key?`${projects[key].title} — Hoang Hiep`:homeTitle;
  document.querySelector('meta[name="description"]').content=key?projects[key].description:homeDescription;
  document.querySelector('.project-share-fallback').hidden=true;
}
function writeRoute(url,state,replace=false){
  try{history[replace?'replaceState':'pushState'](state,'',url);return true;}
  catch{location.assign(url);return false;}
}
function openProject(key,trigger){
  if(!projects[key]||routeClosing)return;
  if(projectFromLocation()!==key){
    const state=history.state;
    const fromProject=!!projectFromLocation();
    const next={portfolioProject:key,portfolioDepth:fromProject?(state?.portfolioDepth||0)+1:1,portfolioHome:fromProject?(state?.portfolioHome||new URL('#work',portfolioBase).href):location.href};
    if(!writeRoute(projectHref(key),next))return;
  }
  updateProjectMeta(key);showProject(key,trigger);
}
function dismissNestedViewers(){
  ['image-viewer','video-viewer'].forEach(id=>{const nested=document.getElementById(id);if(nested.open)nested.close();});
}
function closeProject(){
  if(!dialog.open||routeClosing)return;
  dismissNestedViewers();
  const depth=history.state?.portfolioDepth||0;
  if(depth>0){routeClosing=true;history.go(-depth);return;}
  if(!writeRoute(new URL('#work',portfolioBase).href,{},true))return;
  updateProjectMeta();hideProject({reveal:true});
}
window.addEventListener('popstate',()=>{
  routeClosing=false;dismissNestedViewers();
  const key=projectFromLocation();updateProjectMeta(key);
  if(key){if(!dialog.open||currentProject!==key)showProject(key);}
  else if(dialog.open)hideProject();
});
document.getElementById('copy-project-link').addEventListener('click',async()=>{
  const url=projectHref(currentProject);
  try{
    await navigator.clipboard.writeText(url);
    const button=document.getElementById('copy-project-link');button.textContent='Copied ✓';
    setTimeout(()=>{button.textContent='Copy link ↗';},2200);
    const toast=document.getElementById('toast');toast.textContent='Project link copied';toast.classList.add('visible');
    clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>toast.classList.remove('visible'),2500);
  }catch{
    const fallback=document.querySelector('.project-share-fallback'),input=document.getElementById('project-url');
    fallback.hidden=false;input.value=url;input.focus();input.select();
  }
});
document.addEventListener('DOMContentLoaded',()=>{
  document.querySelectorAll('a[data-project]').forEach(link=>link.href=projectHref(link.dataset.project));
  document.querySelectorAll('a[href^="#"]').forEach(link=>link.href=new URL(link.getAttribute('href'),portfolioBase).href);
  const key=projectFromLocation();
  if(key){
    if(!history.state?.portfolioProject)history.replaceState({portfolioProject:key,portfolioDepth:0,portfolioHome:new URL('#work',portfolioBase).href},'',location.href);
    updateProjectMeta(key);
    // Direct entry has no source thumbnail on screen, so open without a shared transition.
    renderProject(key,document.querySelector(`.project-image[data-project="${key}"]`));
  }
},{once:true});
