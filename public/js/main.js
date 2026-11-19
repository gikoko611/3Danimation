import * as THREE from 'three';
import { buildScene } from './visuals-gta6.js';
const TL=new URLSearchParams(location.search).get('t')||'gta6-timeline.json';
const W=480,H=854,FPS=24,SCENE_SECONDS=10;
const canvas=document.getElementById('c'),subtitleEl=document.getElementById('subtitle'),sceneNoEl=document.getElementById('sceneNo'),sceneNameEl=document.getElementById('sceneName'),fadeEl=document.getElementById('fade'),timecodeEl=document.getElementById('timecode'),progressEl=document.getElementById('progress'),stageEl=document.getElementById('stage');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
renderer.setPixelRatio(1);renderer.setSize(W,H,false);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(43,W/H,.1,1500);
let timeline,currentIndex=-1,currentBuilt=null;
const clamp=v=>Math.max(0,Math.min(1,v));
function dispose(){if(!currentBuilt)return;currentBuilt.group.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material){if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material.dispose();}});scene.remove(currentBuilt.group);currentBuilt=null;}
function ensure(idx){if(idx===currentIndex)return;dispose();const s=timeline.scenes[idx];currentIndex=idx;currentBuilt=buildScene(s.action,s.palette,idx*137+19);scene.add(currentBuilt.group);stageEl.style.background='radial-gradient(circle at 50% 40%,'+s.palette[2]+' 0%,'+s.palette[1]+' 35%,'+s.palette[0]+' 100%)';scene.fog=new THREE.Fog(new THREE.Color(s.palette[0]),42,180);sceneNoEl.textContent=String(idx+1).padStart(2,'0');sceneNameEl.textContent=s.action.toUpperCase();subtitleEl.textContent=s.mm;}
function cameraFor(cam,t){const a=t*.12;switch(cam){case'crane':camera.position.set(0,9,24);camera.lookAt(0,3,0);break;case'orbit':camera.position.set(Math.sin(a)*18,7,Math.cos(a)*22);camera.lookAt(0,2,0);break;default:camera.position.set(Math.sin(a)*5,5,23);camera.lookAt(0,2.4,0);}camera.updateProjectionMatrix();}
function setTime(t){const idx=Math.min(timeline.scenes.length-1,Math.floor(t/SCENE_SECONDS)),tl=t-idx*SCENE_SECONDS;ensure(idx);const s=timeline.scenes[idx];if(currentBuilt.update)currentBuilt.update(tl);cameraFor(s.cam,tl);renderer.render(scene,camera);const fadeIn=clamp((.32-tl)/.32),fadeOut=clamp((tl-9.72)/.28);fadeEl.style.opacity=String(Math.max(fadeIn,fadeOut)*.9);subtitleEl.style.opacity=String(Math.min(clamp((tl-.35)/.4),clamp((9.5-tl)/.35)));timecodeEl.textContent=String(Math.floor(t/60)).padStart(2,'0')+':'+String(Math.floor(t%60)).padStart(2,'0');progressEl.style.width=(t/300*100)+'%';}
async function boot(){timeline=await(await fetch('/'+TL)).json();await document.fonts.ready;await document.fonts.load('400 20px MM');await document.fonts.load('700 15px MM');setTime(0);window.setTime=t=>{setTime(t);return true;};window.__meta={fps:FPS,width:W,height:H,duration:timeline.scenes.length*SCENE_SECONDS,sceneCount:timeline.scenes.length};window.__ready=true;}
boot();
