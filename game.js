(()=>{
'use strict';
const canvas=document.getElementById('c'),ctx=canvas.getContext('2d',{alpha:false});
const mm=document.getElementById('minimap'),mctx=mm.getContext('2d');
let W=0,H=0,dpr=1,frame=0;
const TILE=40,MAP_W=90,MAP_H=70,WORLD_W=MAP_W*TILE,WORLD_H=MAP_H*TILE;
const cam={x:0,y:0,tx:0,ty:0};
const player={x:WORLD_W/2,y:WORLD_H/2,w:24,h:24,vx:0,vy:0,speed:3.15,hp:100,maxHp:100,mana:70,maxMana:70,level:1,xp:0,gold:0,wanted:0,facing:0,inv:0,dashCd:0,dashT:0,mounted:false,mountSpd:5.3,bob:0,atkAnim:0,walkT:0};
const keys={x:0,y:0};
let joyId=null,joyOX=0,joyOY=0;
const buildings=[],obstacles=[],npcs=[],enemies=[],guards=[],carriages=[],projectiles=[],particles=[];
const JOY_R=50;
const ELEMS=[
{id:'fire',name:'Fuego',icon:'🔥',color:'#f97316',glow:'#fdba74',cost:10,speed:9,life:48,dmg:20,size:7,desc:'Proyectil de fuego'},
{id:'water',name:'Agua',icon:'💧',color:'#38bdf8',glow:'#7dd3fc',cost:12,speed:6.5,life:55,dmg:14,size:9,desc:'Chorro perforante',pierce:2},
{id:'wind',name:'Viento',icon:'🌪️',color:'#a3e635',glow:'#d9f99d',cost:9,speed:12,life:40,dmg:12,size:6,desc:'Rapido + empuje',knock:18},
{id:'earth',name:'Tierra',icon:'🪨',color:'#a8a29e',glow:'#d6d3d1',cost:14,speed:5.5,life:35,dmg:28,size:11,desc:'Impacto pesado',aoe:28},
{id:'heal',name:'Curacion',icon:'✨',color:'#4ade80',glow:'#86efac',cost:18,speed:0,life:0,dmg:0,size:0,desc:'Cura HP',heal:32}
];
let curElem=0;
function resize(){dpr=Math.min(window.devicePixelRatio||1,2);W=window.innerWidth;H=window.innerHeight;canvas.width=W*dpr;canvas.height=H*dpr;canvas.style.width=W+'px';canvas.style.height=H+'px';ctx.setTransform(dpr,0,0,dpr,0,0)}
window.addEventListener('resize',resize);resize();
function clamp(v,a,b){return v<a?a:v>b?b:v}
function dist(ax,ay,bx,by){return Math.hypot(ax-bx,ay-by)}
function aabb(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y}
function showMsg(t,ms=2200){const el=document.createElement('div');el.className='log-msg';el.textContent=t;document.getElementById('log').appendChild(el);requestAnimationFrame(()=>el.classList.add('show'));setTimeout(()=>{el.classList.remove('show');setTimeout(()=>el.remove(),350)},ms)}
function updateHUD(){document.getElementById('hpBar').style.width=(player.hp/player.maxHp*100)+'%';document.getElementById('mpBar').style.width=(player.mana/player.maxMana*100)+'%';document.getElementById('lvl').textContent=player.level;document.getElementById('gold').textContent=player.gold;const s=document.getElementById('stars');s.innerHTML='';for(let i=0;i<5;i++){const st=document.createElement('div');st.className='star'+(i<player.wanted?' on':'');s.appendChild(st)}document.querySelectorAll('.elem').forEach((el,i)=>el.classList.toggle('on',i===curElem));const e=ELEMS[curElem];document.getElementById('btnAtk').innerHTML=e.icon+' '+e.name.toUpperCase();document.getElementById('btnAtk').style.background='radial-gradient(circle at 30% 30%,'+e.color+','+e.color+'99)'}
function addBuilding(x,y,w,h,color,name,solid=true){buildings.push({x,y,w,h,color,name});if(solid)obstacles.push({x,y,w,h})}
addBuilding(38*TILE,8*TILE,14*TILE,10*TILE,'#4a5568','Castillo Real');
addBuilding(40*TILE,6*TILE,3*TILE,3*TILE,'#2d3748','Torre N');
addBuilding(47*TILE,6*TILE,3*TILE,3*TILE,'#2d3748','Torre N');
addBuilding(32*TILE,28*TILE,7*TILE,5*TILE,'#8B4513','Taberna');
addBuilding(42*TILE,26*TILE,6*TILE,6*TILE,'#A0522D','Herreria');
addBuilding(28*TILE,34*TILE,5*TILE,4*TILE,'#6B4423','Mercado');
addBuilding(48*TILE,33*TILE,6*TILE,4*TILE,'#7A5230','Templo');
addBuilding(36*TILE,38*TILE,8*TILE,4*TILE,'#5C4033','Ayuntamiento');
addBuilding(24*TILE,20*TILE,15*TILE,TILE,'#555','Muralla N');
addBuilding(42*TILE,20*TILE,17*TILE,TILE,'#555','Muralla N');
addBuilding(24*TILE,20*TILE,TILE,10*TILE,'#555','Muralla O');
addBuilding(24*TILE,33*TILE,TILE,11*TILE,'#555','Muralla O');
addBuilding(59*TILE,20*TILE,TILE,10*TILE,'#555','Muralla E');
addBuilding(59*TILE,33*TILE,TILE,11*TILE,'#555','Muralla E');
addBuilding(24*TILE,43*TILE,15*TILE,TILE,'#555','Muralla S');
addBuilding(42*TILE,43*TILE,17*TILE,TILE,'#555','Muralla S');
addBuilding(8*TILE,12*TILE,5*TILE,4*TILE,'#6B3A2A','Cabana');
addBuilding(70*TILE,14*TILE,5*TILE,4*TILE,'#5A3A2A','Torre Vigia');
addBuilding(10*TILE,50*TILE,6*TILE,4*TILE,'#704214','Granja');
addBuilding(65*TILE,52*TILE,5*TILE,3*TILE,'#4A3020','Ruinas');
addBuilding(55*TILE,8*TILE,4*TILE,3*TILE,'#6B4423','Cabana N');
for(let i=0;i<55;i++){let tx=Math.floor(Math.random()*MAP_W),ty=Math.floor(Math.random()*MAP_H);if(tx>22&&tx<62&&ty>18&&ty<46)continue;obstacles.push({x:tx*TILE+6,y:ty*TILE+6,w:28,h:28,tree:1})}
function isPath(tx,ty){if(ty>=30&&ty<=32&&tx>=6&&tx<=84)return 1;if(tx>=39&&tx<=41&&ty>=8&&ty<=55)return 1;if(tx>=28&&tx<=52&&ty>=26&&ty<=40)return 1;if(tx>=39&&tx<=41&&ty>=19&&ty<=21)return 1;if(tx>=39&&tx<=41&&ty>=42&&ty<=44)return 1;if(tx>=23&&tx<=25&&ty>=30&&ty<=32)return 1;if(tx>=58&&tx<=60&&ty>=30&&ty<=32)return 1;return 0}
function solidAt(x,y,w,h){const r={x,y,w,h};for(const o of obstacles)if(aabb(r,o))return 1;return 0}
function tryMove(e,dx,dy){const nx=e.x+dx,ny=e.y+dy;if(!solidAt(nx,e.y,e.w,e.h))e.x=nx;if(!solidAt(e.x,ny,e.w,e.h))e.y=ny;e.x=clamp(e.x,0,WORLD_W-e.w);e.y=clamp(e.y,0,WORLD_H-e.h)}
const names=['Aldeano','Mercader','Bardo','Cazador','Hechicera','Granjero','Viajero','Aprendiz'];
for(let i=0;i<16;i++){let x,y,t=0;do{x=(12+Math.random()*66)*TILE;y=(14+Math.random()*42)*TILE;t++}while(solidAt(x,y,18,18)&&t<40);npcs.push({x,y,w:18,h:18,vx:0,vy:0,spd:0.55+Math.random()*0.4,timer:0,name:names[i%names.length],gold:8+Math.floor(Math.random()*30),quest:Math.random()>0.68,color:'hsl('+(20+Math.random()*50)+',55%,42%)',bob:Math.random()*10})}
for(let i=0;i<10;i++){let x,y,t=0;do{x=Math.random()*WORLD_W;y=Math.random()*WORLD_H;t++}while((x>22*TILE&&x<60*TILE&&y>18*TILE&&y<45*TILE)||(solidAt(x,y,20,20)&&t<50));const knight=Math.random()>0.5;enemies.push({x,y,w:20,h:20,hp:knight?48:30,maxHp:knight?48:30,spd:knight?1.35:1.8,dmg:knight?15:9,type:knight?'knight':'goblin',color:knight?'#5b21b6':'#166534',px:x,py:y,cd:0,alive:1,hitFlash:0,deathT:0})}
for(let i=0;i<6;i++){guards.push({x:(30+Math.random()*20)*TILE,y:(22+Math.random()*16)*TILE,w:20,h:20,hp:58,maxHp:58,spd:2.15,dmg:16,cd:0,alive:1,aggro:0,hitFlash:0})}
for(let i=0;i<5;i++){carriages.push({x:(18+Math.random()*55)*TILE,y:(16+Math.random()*38)*TILE,w:36,h:22,color:['#92400e','#78350f','#a16207','#713f12','#854d0e'][i],stolen:0})}
const mages=[],eProjectiles=[];
for(let i=0;i<7;i++){let x,y,t=0;do{x=Math.random()*WORLD_W;y=Math.random()*WORLD_H;t++}while((x>24*TILE&&x<58*TILE&&y>20*TILE&&y<44*TILE)||(solidAt(x,y,20,20)&&t<50));mages.push({x,y,w:20,h:22,hp:55,maxHp:55,spd:1.1,dmg:18,cd:0,alive:1,hitFlash:0,castT:0,px:x,py:y,color:'#7c3aed'})}
const dummy={x:50*TILE,y:36*TILE,w:22,h:22,hp:9999,maxHp:9999,alive:1,hitFlash:0};
let godMode=false,cheatBuf='';
const joyBase=document.getElementById('joy-base'),joyKnob=document.getElementById('joy-knob'),zone=document.getElementById('joystick-zone');
function setJoy(dx,dy){const len=Math.hypot(dx,dy)||1,cl=Math.min(len,JOY_R);const jx=(dx/len)*cl,jy=(dy/len)*cl;joyKnob.style.transform='translate(calc(-50% + '+jx+'px), calc(-50% + '+jy+'px))';keys.x=jx/JOY_R;keys.y=jy/JOY_R}
zone.addEventListener('touchstart',e=>{e.preventDefault();const t=e.changedTouches[0];joyId=t.identifier;const r=joyBase.getBoundingClientRect();joyOX=r.left+r.width/2;joyOY=r.top+r.height/2;setJoy(t.clientX-joyOX,t.clientY-joyOY)},{passive:false});
zone.addEventListener('touchmove',e=>{e.preventDefault();for(const t of e.changedTouches)if(t.identifier===joyId){setJoy(t.clientX-joyOX,t.clientY-joyOY);break}},{passive:false});
function endJoy(e){for(const t of e.changedTouches)if(t.identifier===joyId){joyId=null;keys.x=0;keys.y=0;joyKnob.style.transform='translate(-50%,-50%)';break}}
zone.addEventListener('touchend',endJoy,{passive:false});zone.addEventListener('touchcancel',endJoy,{passive:false});
let mouseJoy=0;
zone.addEventListener('mousedown',e=>{mouseJoy=1;const r=joyBase.getBoundingClientRect();joyOX=r.left+r.width/2;joyOY=r.top+r.height/2;setJoy(e.clientX-joyOX,e.clientY-joyOY)});
window.addEventListener('mousemove',e=>{if(mouseJoy)setJoy(e.clientX-joyOX,e.clientY-joyOY)});
window.addEventListener('mouseup',()=>{if(mouseJoy){mouseJoy=0;keys.x=0;keys.y=0;joyKnob.style.transform='translate(-50%,-50%)'}});
window.addEventListener('keydown',e=>{
if(e.code==='KeyW'||e.code==='ArrowUp')keys.y=-1;
if(e.code==='KeyS'||e.code==='ArrowDown')keys.y=1;
if(e.code==='KeyA'||e.code==='ArrowLeft')keys.x=-1;
if(e.code==='KeyD'||e.code==='ArrowRight')keys.x=1;
if(e.code==='KeyE'||e.code==='Space')doInteract();
if(e.code==='KeyF'||e.code==='KeyQ')doAttack();
if(e.code==='ShiftLeft'||e.code==='KeyC')doDash();
if(e.code==='KeyR'||e.code==='Tab'){e.preventDefault();cycleElem()}
if(e.key&&e.key.length===1){cheatBuf=(cheatBuf+e.key.toLowerCase()).slice(-4);if(cheatBuf==='dios'){activateGod();cheatBuf=''}}
if(e.code==='KeyG'&&godMode){player.hp=player.maxHp;player.mana=player.maxMana;updateHUD();showMsg('Dios: HP/Mana full')}
});
window.addEventListener('keyup',e=>{if(e.code==='KeyW'||e.code==='ArrowUp'||e.code==='KeyS'||e.code==='ArrowDown')keys.y=0;if(e.code==='KeyA'||e.code==='ArrowLeft'||e.code==='KeyD'||e.code==='ArrowRight')keys.x=0});
function bindBtn(id,fn){const el=document.getElementById(id);const down=e=>{e.preventDefault();el.classList.add('active');fn()};const up=e=>{e.preventDefault();el.classList.remove('active')};el.addEventListener('touchstart',down,{passive:false});el.addEventListener('touchend',up,{passive:false});el.addEventListener('mousedown',down);el.addEventListener('mouseup',up);el.addEventListener('mouseleave',up)}
bindBtn('btnAtk',doAttack);bindBtn('btnInt',doInteract);bindBtn('btnDash',doDash);bindBtn('btnCycle',cycleElem);
document.querySelectorAll('.elem').forEach(el=>{el.style.pointerEvents='auto';el.addEventListener('click',()=>{curElem=+el.dataset.i;updateHUD();showMsg(ELEMS[curElem].name+': '+ELEMS[curElem].desc,1400)})});
function activateGod(){godMode=true;player.level=99;player.maxHp=9999;player.hp=9999;player.maxMana=9999;player.mana=9999;player.gold=99999;player.wanted=0;player.speed=5.5;player.mountSpd=7;for(const el of ELEMS){el.cost=1;el.dmg=Math.max(el.dmg||0,90);if(el.heal)el.heal=500}showMsg('MODO DIOS ACTIVADO - eres invencible',4000);updateHUD()}
function cycleElem(){curElem=(curElem+1)%ELEMS.length;updateHUD();showMsg(ELEMS[curElem].icon+' '+ELEMS[curElem].name+' — '+ELEMS[curElem].desc,1500)}
function doAttack(){const e=ELEMS[curElem];if(player.mana<e.cost){showMsg('Sin mana!');return}player.mana-=e.cost;player.atkAnim=12;if(e.id==='heal'){const healed=Math.min(e.heal,player.maxHp-player.hp);player.hp+=healed;for(let i=0;i<12;i++)particles.push({x:player.x+12+(Math.random()-0.5)*30,y:player.y+12+(Math.random()-0.5)*30,vx:(Math.random()-0.5)*1.5,vy:-1-Math.random()*2,life:25,color:e.color,size:4,type:'spark'});showMsg(healed>0?'Curacion +'+healed:'HP max');updateHUD();return}let dx=keys.x,dy=keys.y;if(Math.abs(dx)<0.12&&Math.abs(dy)<0.12){if(player.facing===0)dx=1;else if(player.facing===1)dy=1;else if(player.facing===2)dx=-1;else dy=-1}const len=Math.hypot(dx,dy)||1;dx/=len;dy/=len;for(let i=0;i<8;i++)particles.push({x:player.x+12,y:player.y+12,vx:dx*2+(Math.random()-0.5)*2,vy:dy*2+(Math.random()-0.5)*2,life:12,color:e.glow,size:3,type:'spark'});projectiles.push({x:player.x+player.w/2,y:player.y+player.h/2,vx:dx*e.speed,vy:dy*e.speed,life:e.life,dmg:e.dmg+(player.level*3),r:e.size,color:e.color,glow:e.glow,pierce:e.pierce||0,knock:e.knock||0,aoe:e.aoe||0,hits:0});updateHUD()}
function doDash(){if(player.dashCd>0||player.dashT>0)return;let dx=keys.x,dy=keys.y;if(Math.abs(dx)<0.15&&Math.abs(dy)<0.15){if(player.facing===0)dx=1;else if(player.facing===1)dy=1;else if(player.facing===2)dx=-1;else dy=-1}const len=Math.hypot(dx,dy)||1;player.vx=(dx/len)*9.5;player.vy=(dy/len)*9.5;player.dashT=14;player.dashCd=50;player.inv=20;for(let i=0;i<8;i++)particles.push({x:player.x+12,y:player.y+12,vx:(Math.random()-0.5)*2,vy:(Math.random()-0.5)*2,life:18,color:'#67e8f9',size:5,type:'trail'})}
function doInteract(){for(const c of carriages){if(c.stolen)continue;if(dist(player.x+12,player.y+12,c.x+18,c.y+11)<48){c.stolen=1;player.mounted=1;player.wanted=Math.min(5,player.wanted+2);showMsg('Carruaje robado! Wanted +2');updateHUD();return}}for(const n of npcs){if(dist(player.x+12,player.y+12,n.x+9,n.y+9)<40){if(n.quest){n.quest=0;player.gold+=28+Math.floor(Math.random()*22);player.xp+=20;showMsg('Mision de '+n.name);checkLevel()}else{const g=Math.min(n.gold,10+Math.floor(Math.random()*18));n.gold-=g;player.gold+=g;player.wanted=Math.min(5,player.wanted+(g>12?2:1));showMsg('Robaste '+g+' oro');n.vx=(n.x-player.x)*0.14;n.vy=(n.y-player.y)*0.14;n.timer=55;for(const g of guards)if(g.alive&&dist(g.x,g.y,player.x,player.y)<230)g.aggro=1}updateHUD();return}}for(const b of buildings){const cx=b.x+b.w/2,cy=b.y+b.h/2;if(dist(player.x+12,player.y+12,cx,cy)<62){if(b.name==='Taberna'){if(player.gold>=12){player.gold-=12;player.hp=player.maxHp;player.mana=player.maxMana;showMsg('Taberna OK')}else showMsg('Necesitas 12 oro')}else if(b.name==='Templo'){player.mana=player.maxMana;showMsg('Templo: mana OK. Ataca el DUMMY para entrenar!')}else if(b.name==='Castillo Real'){showMsg('Castillo Real');if(player.wanted>0)for(const g of guards)g.aggro=1}else showMsg(b.name);updateHUD();return}}showMsg('Nada cerca')}
function checkLevel(){if(player.xp>=player.level*45){player.xp=0;player.level++;player.maxHp+=18;player.hp=player.maxHp;player.maxMana+=12;player.mana=player.maxMana;showMsg('NIVEL '+player.level+'!')}}
function update(){frame++;let spd=player.mounted?player.mountSpd:player.speed;let moving=0;if(player.dashT>0){player.dashT--;tryMove(player,player.vx,player.vy);moving=1}else if(Math.abs(keys.x)>0.05||Math.abs(keys.y)>0.05){const len=Math.hypot(keys.x,keys.y)||1;tryMove(player,(keys.x/len)*spd,(keys.y/len)*spd);if(Math.abs(keys.x)>Math.abs(keys.y))player.facing=keys.x>0?0:2;else player.facing=keys.y>0?1:3;moving=1}if(moving){player.walkT+=0.35;player.bob=Math.sin(player.walkT)*2.2}else{player.bob*=0.85;player.walkT=0}if(player.dashCd>0)player.dashCd--;if(player.inv>0)player.inv--;if(player.atkAnim>0)player.atkAnim--;if(player.mana<player.maxMana&&Math.random()<0.028){player.mana=Math.min(player.maxMana,player.mana+1);updateHUD()}if(player.wanted>0&&Math.random()<0.0011){player.wanted--;updateHUD()}
for(const n of npcs){n.timer--;n.bob+=0.15;if(n.timer<=0){n.vx=(Math.random()-0.5)*n.spd*2;n.vy=(Math.random()-0.5)*n.spd*2;n.timer=50+Math.random()*90}tryMove(n,n.vx,n.vy)}
for(const e of enemies){if(!e.alive){if(e.deathT>0)e.deathT--;continue}if(e.hitFlash>0)e.hitFlash--;e.cd=Math.max(0,e.cd-1);const d=dist(e.x,e.y,player.x,player.y);if(d<195){const a=Math.atan2(player.y-e.y,player.x-e.x);tryMove(e,Math.cos(a)*e.spd,Math.sin(a)*e.spd);if(d<34&&e.cd<=0&&player.inv<=0){player.hp-=e.dmg;player.inv=32;e.cd=46;showMsg((e.type==='knight'?'Caballero':'Goblin')+' (-'+e.dmg+')');updateHUD();if(player.hp<=0)respawn()}}else{const a=Math.atan2(e.py+Math.sin(Date.now()/900+e.x)*50-e.y,e.px+Math.cos(Date.now()/1100+e.y)*50-e.x);tryMove(e,Math.cos(a)*e.spd*0.45,Math.sin(a)*e.spd*0.45)}}
for(const g of guards){if(!g.alive)continue;if(g.hitFlash>0)g.hitFlash--;g.cd=Math.max(0,g.cd-1);const d=dist(g.x,g.y,player.x,player.y);if(player.wanted>0||g.aggro){g.aggro=1;const a=Math.atan2(player.y-g.y,player.x-g.x);tryMove(g,Math.cos(a)*g.spd,Math.sin(a)*g.spd);if(d<36&&g.cd<=0&&player.inv<=0){player.hp-=g.dmg;player.inv=28;g.cd=38;showMsg('Guardia!');updateHUD();if(player.hp<=0)respawn()}}else{const a=Math.atan2(28*TILE-g.y+(Math.random()-0.5)*80,42*TILE-g.x+(Math.random()-0.5)*80);tryMove(g,Math.cos(a)*0.55,Math.sin(a)*0.55)}}
for(const m of mages){if(!m.alive)continue;if(m.hitFlash>0)m.hitFlash--;m.cd=Math.max(0,m.cd-1);if(m.castT>0)m.castT--;const d=dist(m.x,m.y,player.x,player.y);if(d<260){const a=Math.atan2(player.y-m.y,player.x-m.x);if(d<100)tryMove(m,-Math.cos(a)*m.spd,-Math.sin(a)*m.spd);else if(d>160)tryMove(m,Math.cos(a)*m.spd*0.6,Math.sin(a)*m.spd*0.6);if(m.cd<=0&&d<240){m.cd=70;m.castT=15;const ang=Math.atan2(player.y+12-m.y-11,player.x+12-m.x-10);eProjectiles.push({x:m.x+10,y:m.y+11,vx:Math.cos(ang)*5.5,vy:Math.sin(ang)*5.5,life:55,dmg:m.dmg,r:6,color:'#c084fc',glow:'#e9d5ff'})}}else{const a=Math.atan2(m.py+Math.sin(Date.now()/1000+m.x)*40-m.y,m.px+Math.cos(Date.now()/1200+m.y)*40-m.x);tryMove(m,Math.cos(a)*0.4,Math.sin(a)*0.4)}}
for(let i=eProjectiles.length-1;i>=0;i--){const p=eProjectiles[i];p.x+=p.vx;p.y+=p.vy;p.life--;if(player.inv<=0&&Math.hypot(p.x-(player.x+12),p.y-(player.y+12))<16){player.hp-=p.dmg;player.inv=28;showMsg('Mago te hechizo! (-'+p.dmg+')');updateHUD();if(player.hp<=0)respawn();eProjectiles.splice(i,1);continue}if(p.life<=0)eProjectiles.splice(i,1)}
if(dummy.hitFlash>0)dummy.hitFlash--;
for(let i=projectiles.length-1;i>=0;i--){const p=projectiles[i];p.x+=p.vx;p.y+=p.vy;p.life--;if(frame%2===0)particles.push({x:p.x,y:p.y,vx:-p.vx*0.1,vy:-p.vy*0.1,life:8,color:p.glow,size:p.r*0.5,type:'trail'});let hit=0;const applyHit=(ent)=>{if(!ent.alive)return;if(Math.hypot(p.x-(ent.x+ent.w/2),p.y-(ent.y+ent.h/2))<14+p.r*0.5){ent.hp-=p.dmg;ent.hitFlash=8;hit=1;p.hits++;if(p.knock){const a=Math.atan2(ent.y-p.y,ent.x-p.x);tryMove(ent,Math.cos(a)*p.knock*0.15,Math.sin(a)*p.knock*0.15)}if(p.aoe){for(const o of enemies.concat(guards).concat(mages)){if(!o.alive||o===ent)continue;if(dist(o.x,o.y,ent.x,ent.y)<p.aoe){o.hp-=p.dmg*0.55;o.hitFlash=6}}}else{for(let k=0;k<6;k++)particles.push({x:p.x,y:p.y,vx:(Math.random()-0.5)*4,vy:(Math.random()-0.5)*4,life:14,color:p.color,size:3,type:'spark'})}if(ent.hp<=0){ent.alive=0;ent.deathT=25;player.xp+=ent.type?(ent.type==='knight'?30:15):(ent.color==='#7c3aed'?45:24);player.gold+=ent.type?(ent.type==='knight'?20:9):(ent.color==='#7c3aed'?28:14);showMsg('Derrotado!');checkLevel();updateHUD()}if(p.pierce&&p.hits<=p.pierce)hit=0}};for(const e of enemies)applyHit(e);if(!hit||(p.pierce&&p.hits<=p.pierce))for(const g of guards)applyHit(g);if(!hit||(p.pierce&&p.hits<=p.pierce))for(const m of mages)applyHit(m);if(Math.hypot(p.x-(dummy.x+11),p.y-(dummy.y+11))<18){dummy.hitFlash=8;player.xp+=4;hit=1;if(frame%25===0){showMsg('Entrenamiento +XP');checkLevel()}updateHUD()}if((hit&&!(p.pierce&&p.hits<=p.pierce))||p.life<=0)projectiles.splice(i,1)}
for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.x+=p.vx;p.y+=p.vy;p.life--;if(p.type==='spark')p.vy+=0.08;if(p.life<=0)particles.splice(i,1)}
cam.tx=player.x+player.w/2-W/2;cam.ty=player.y+player.h/2-H/2;cam.x+=(cam.tx-cam.x)*0.11;cam.y+=(cam.ty-cam.y)*0.11;cam.x=clamp(cam.x,0,Math.max(0,WORLD_W-W));cam.y=clamp(cam.y,0,Math.max(0,WORLD_H-H))}
function respawn(){player.hp=0;showMsg('Caido...',2000);setTimeout(()=>{player.hp=player.maxHp;player.mana=player.maxMana;player.x=WORLD_W/2;player.y=WORLD_H/2;player.wanted=Math.max(0,player.wanted-1);player.mounted=0;player.inv=70;for(const c of carriages)c.stolen=0;updateHUD()},1800)}
function draw(){ctx.fillStyle='#2d5a27';ctx.fillRect(0,0,W,H);const stx=Math.floor(cam.x/TILE)-1,sty=Math.floor(cam.y/TILE)-1,etx=Math.ceil((cam.x+W)/TILE)+1,ety=Math.ceil((cam.y+H)/TILE)+1;for(let ty=sty;ty<=ety;ty++){for(let tx=stx;tx<=etx;tx++){if(tx<0||ty<0||tx>=MAP_W||ty>=MAP_H)continue;const sx=tx*TILE-cam.x,sy=ty*TILE-cam.y;if(isPath(tx,ty)){ctx.fillStyle='#6b7280';ctx.fillRect(sx,sy,TILE,TILE);ctx.fillStyle='#9ca3af';ctx.fillRect(sx+5,sy+5,11,11)}else{ctx.fillStyle=((tx*13+ty*29)%7===0)?'#3d8b3a':'#358035';ctx.fillRect(sx,sy,TILE,TILE)}}}
for(const b of buildings){const sx=b.x-cam.x,sy=b.y-cam.y;if(sx+b.w<-30||sy+b.h<-30||sx>W+30||sy>H+30)continue;ctx.fillStyle=b.color;ctx.fillRect(sx,sy,b.w,b.h);ctx.fillStyle='#1c1917';ctx.fillRect(sx,sy,b.w,9);ctx.fillStyle='#f8fafc';ctx.font='11px system-ui';ctx.textAlign='center';ctx.fillText(b.name,sx+b.w/2,sy-4)}
for(const o of obstacles){if(!o.tree)continue;const sx=o.x-cam.x,sy=o.y-cam.y;if(sx<-35||sy<-35||sx>W||sy>H)continue;ctx.fillStyle='#14532d';ctx.beginPath();ctx.arc(sx+14,sy+12,15,0,6.28);ctx.fill();ctx.fillStyle='#3f2a14';ctx.fillRect(sx+11,sy+18,7,14)}
for(const c of carriages){if(c.stolen)continue;const sx=c.x-cam.x,sy=c.y-cam.y;ctx.fillStyle=c.color;ctx.fillRect(sx,sy,c.w,c.h)}
for(const n of npcs){const sx=n.x-cam.x,sy=n.y-cam.y+Math.sin(n.bob)*1.5;if(sx<-20||sy<-20||sx>W||sy>H)continue;ctx.fillStyle=n.color;ctx.fillRect(sx,sy,n.w,n.h);ctx.fillStyle='#f5cba7';ctx.fillRect(sx+4,sy-7,10,9);if(n.quest){ctx.fillStyle='#fbbf24';ctx.beginPath();ctx.arc(sx+9,sy-12,4,0,6.28);ctx.fill()}}
for(const e of enemies){if(!e.alive&&(!e.deathT||e.deathT<=0))continue;const sx=e.x-cam.x,sy=e.y-cam.y;if(sx<-25||sy<-25||sx>W||sy>H)continue;if(!e.alive){ctx.globalAlpha=(e.deathT||0)/25;ctx.fillStyle=e.color;ctx.fillRect(sx,sy,e.w,e.h);ctx.globalAlpha=1;continue}ctx.fillStyle=e.hitFlash>0?'#fff':e.color;ctx.fillRect(sx,sy,e.w,e.h);ctx.fillStyle='#450a0a';ctx.fillRect(sx,sy-7,e.w,4);ctx.fillStyle='#ef4444';ctx.fillRect(sx,sy-7,e.w*(e.hp/e.maxHp),4)}
for(const g of guards){if(!g.alive)continue;const sx=g.x-cam.x,sy=g.y-cam.y;ctx.fillStyle=g.hitFlash>0?'#fff':(g.aggro||player.wanted>0?'#b91c1c':'#1e3a5f');ctx.fillRect(sx,sy,g.w,g.h);ctx.fillStyle='#450a0a';ctx.fillRect(sx,sy-7,g.w,4);ctx.fillStyle='#f87171';ctx.fillRect(sx,sy-7,g.w*(g.hp/g.maxHp),4)}
{const sx=dummy.x-cam.x,sy=dummy.y-cam.y;ctx.fillStyle=dummy.hitFlash>0?'#fff':'#78716c';ctx.fillRect(sx,sy,dummy.w,dummy.h);ctx.fillStyle='#fbbf24';ctx.font='10px system-ui';ctx.textAlign='center';ctx.fillText('DUMMY',sx+11,sy-4);ctx.fillText('ENTRENA',sx+11,sy+dummy.h+12)}
for(const m of mages){if(!m.alive)continue;const sx=m.x-cam.x,sy=m.y-cam.y;if(sx<-25||sy<-25||sx>W||sy>H)continue;ctx.fillStyle=m.hitFlash>0?'#fff':m.color;ctx.fillRect(sx,sy,m.w,m.h);if(m.castT>0){ctx.strokeStyle='#c084fc';ctx.lineWidth=2;ctx.beginPath();ctx.arc(sx+10,sy+11,12,0,6.28);ctx.stroke()}ctx.fillStyle='#450a0a';ctx.fillRect(sx,sy-7,m.w,4);ctx.fillStyle='#a78bfa';ctx.fillRect(sx,sy-7,m.w*(m.hp/m.maxHp),4);ctx.fillStyle='#c084fc';ctx.font='9px system-ui';ctx.textAlign='center';ctx.fillText('MAGO',sx+10,sy-10)}
for(const p of eProjectiles){const sx=p.x-cam.x,sy=p.y-cam.y;ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(sx,sy,p.r,0,6.28);ctx.fill()}
for(const p of projectiles){const sx=p.x-cam.x,sy=p.y-cam.y;ctx.fillStyle=p.glow;ctx.globalAlpha=0.35;ctx.beginPath();ctx.arc(sx,sy,p.r*1.8,0,6.28);ctx.fill();ctx.globalAlpha=1;ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(sx,sy,p.r,0,6.28);ctx.fill()}
for(const p of particles){ctx.globalAlpha=Math.max(0,p.life/22);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x-cam.x,p.y-cam.y,p.size||4,0,6.28);ctx.fill();ctx.globalAlpha=1}
const px=player.x-cam.x,py=player.y-cam.y+player.bob;if(player.inv>0&&(player.inv&3)===0)ctx.globalAlpha=0.4;if(player.atkAnim>0){ctx.strokeStyle=ELEMS[curElem].color;ctx.lineWidth=2;ctx.globalAlpha=player.atkAnim/12;ctx.beginPath();ctx.arc(px+12,py+12,18,0,6.28);ctx.stroke();ctx.globalAlpha=1}ctx.fillStyle=player.mounted?'#c2410c':player.dashT>0?'#22d3ee':'#2563eb';ctx.fillRect(px,py,player.w,player.h);ctx.fillStyle='#f5cba7';ctx.fillRect(px+5,py-9,14,11);ctx.fillStyle=ELEMS[curElem].color;if(player.facing===0)ctx.fillRect(px+player.w,py+7,11,5);else if(player.facing===2)ctx.fillRect(px-11,py+7,11,5);if(player.mounted){ctx.fillStyle='rgba(120,53,15,.75)';ctx.fillRect(px-5,py+player.h-2,player.w+10,11)}ctx.globalAlpha=1;
mctx.fillStyle='#166534';mctx.fillRect(0,0,92,72);const scx=92/WORLD_W,scy=72/WORLD_H;for(const b of buildings){mctx.fillStyle='#a16207';mctx.fillRect(b.x*scx,b.y*scy,Math.max(1.5,b.w*scx),Math.max(1.5,b.h*scy))}mctx.fillStyle='#ef4444';for(const e of enemies)if(e.alive)mctx.fillRect(e.x*scx,e.y*scy,2,2);mctx.fillStyle='#c084fc';for(const m of mages)if(m.alive)mctx.fillRect(m.x*scx,m.y*scy,2.5,2.5);mctx.fillStyle='#fbbf24';mctx.fillRect(player.x*scx-2,player.y*scy-2,5,5)}
function loop(){update();draw();requestAnimationFrame(loop)}
updateHUD();
showMsg('Magos en el mapa. DUMMY en Templo para entrenar. Escribe DIOS = modo dios',4200);
requestAnimationFrame(loop);
})();
