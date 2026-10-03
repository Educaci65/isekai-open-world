(() => {
  'use strict';

  // ============== CONFIG ==============
  const TILE = 32;
  const MAP_W = 80; // tiles
  const MAP_H = 60;
  const WORLD_W = MAP_W * TILE;
  const WORLD_H = MAP_H * TILE;

  // ============== CANVAS ==============
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0;
  let cameraX = 0, cameraY = 0;

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * devicePixelRatio;
    canvas.height = H * devicePixelRatio;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  // ============== INPUT ==============
  const keys = { up: false, down: false, left: false, right: false };
  let interactPressed = false;
  let attackPressed = false;

  // Keyboard
  window.addEventListener('keydown', e => {
    if (e.code === 'ArrowUp' || e.code === 'KeyW') keys.up = true;
    if (e.code === 'ArrowDown' || e.code === 'KeyS') keys.down = true;
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = true;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = true;
    if (e.code === 'KeyE' || e.code === 'Space') interactPressed = true;
    if (e.code === 'KeyF' || e.code === 'KeyQ') attackPressed = true;
  });
  window.addEventListener('keyup', e => {
    if (e.code === 'ArrowUp' || e.code === 'KeyW') keys.up = false;
    if (e.code === 'ArrowDown' || e.code === 'KeyS') keys.down = false;
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
  });

  // Touch / mouse buttons
  function bindButton(id, onDown, onUp) {
    const el = document.getElementById(id);
    const start = (e) => { e.preventDefault(); onDown(); el.classList.add('active'); };
    const end = (e) => { e.preventDefault(); onUp(); el.classList.remove('active'); };
    el.addEventListener('touchstart', start, { passive: false });
    el.addEventListener('touchend', end, { passive: false });
    el.addEventListener('touchcancel', end, { passive: false });
    el.addEventListener('mousedown', start);
    el.addEventListener('mouseup', end);
    el.addEventListener('mouseleave', end);
  }

  bindButton('up', () => keys.up = true, () => keys.up = false);
  bindButton('down', () => keys.down = true, () => keys.down = false);
  bindButton('left', () => keys.left = true, () => keys.left = false);
  bindButton('right', () => keys.right = true, () => keys.right = false);
  bindButton('interact-btn', () => interactPressed = true, () => {});
  bindButton('attack-btn', () => attackPressed = true, () => {});

  // ============== UTIL ==============
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function rectsCollide(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }
  function showMessage(txt, ms = 1800) {
    const m = document.getElementById('message');
    m.textContent = txt;
    m.classList.add('show');
    clearTimeout(showMessage._t);
    showMessage._t = setTimeout(() => m.classList.remove('show'), ms);
  }

  // ============== MAP & BUILDINGS ==============
  // Simple procedural-ish map: grass base + paths + buildings
  const buildings = [];
  const obstacles = []; // all solid rects

  // Town center buildings
  const townBuildings = [
    { x: 28*TILE, y: 22*TILE, w: 6*TILE, h: 5*TILE, color: '#8B4513', name: 'Posada' },
    { x: 36*TILE, y: 20*TILE, w: 5*TILE, h: 6*TILE, color: '#A0522D', name: 'Herrer\u00eda' },
    { x: 22*TILE, y: 26*TILE, w: 5*TILE, h: 4*TILE, color: '#6B4423', name: 'Tienda' },
    { x: 42*TILE, y: 26*TILE, w: 7*TILE, h: 5*TILE, color: '#7A5230', name: 'Templo' },
    { x: 30*TILE, y: 32*TILE, w: 8*TILE, h: 4*TILE, color: '#5C4033', name: 'Ayuntamiento' },
    // walls around town
    { x: 18*TILE, y: 16*TILE, w: 34*TILE, h: TILE, color: '#555', name: 'Muralla' },
    { x: 18*TILE, y: 16*TILE, w: TILE, h: 24*TILE, color: '#555', name: 'Muralla' },
    { x: 51*TILE, y: 16*TILE, w: TILE, h: 24*TILE, color: '#555', name: 'Muralla' },
    { x: 18*TILE, y: 39*TILE, w: 34*TILE, h: TILE, color: '#555', name: 'Muralla' },
    // gates (no solid)
  ];

  // Outer farmhouses / ruins
  const outer = [
    { x: 8*TILE, y: 8*TILE, w: 4*TILE, h: 3*TILE, color: '#6B3A2A', name: 'Caba\u00f1a' },
    { x: 65*TILE, y: 10*TILE, w: 5*TILE, h: 4*TILE, color: '#5A3A2A', name: 'Torre' },
    { x: 10*TILE, y: 45*TILE, w: 6*TILE, h: 4*TILE, color: '#704214', name: 'Granja' },
    { x: 60*TILE, y: 48*TILE, w: 5*TILE, h: 3*TILE, color: '#4A3020', name: 'Ruinas' },
    { x: 45*TILE, y: 5*TILE, w: 4*TILE, h: 3*TILE, color: '#6B4423', name: 'Caba\u00f1a' },
    { x: 5*TILE, y: 30*TILE, w: 3*TILE, h: 5*TILE, color: '#555', name: 'Torre Vigilancia' },
  ];

  [...townBuildings, ...outer].forEach(b => {
    buildings.push(b);
    obstacles.push({ x: b.x, y: b.y, w: b.w, h: b.h });
  });

  // Paths (visual only)
  function isPath(tx, ty) {
    // main road horizontal
    if (ty >= 28 && ty <= 30 && tx >= 5 && tx <= 75) return true;
    // vertical
    if (tx >= 33 && tx <= 35 && ty >= 10 && ty <= 50) return true;
    // town plaza
    if (tx >= 25 && tx <= 45 && ty >= 24 && ty <= 34) return true;
    return false;
  }

  // Trees / rocks as small obstacles
  for (let i = 0; i < 40; i++) {
    const tx = Math.floor(Math.random() * MAP_W);
    const ty = Math.floor(Math.random() * MAP_H);
    if (isPath(tx, ty) || (tx > 18 && tx < 52 && ty > 16 && ty < 40)) continue;
    const ox = tx * TILE + 4;
    const oy = ty * TILE + 4;
    obstacles.push({ x: ox, y: oy, w: 24, h: 24, tree: true });
  }

  // ============== ENTITIES ==============
  const player = {
    x: 34 * TILE,
    y: 28 * TILE,
    w: 22,
    h: 22,
    speed: 2.8,
    hp: 100,
    maxHp: 100,
    mana: 50,
    maxMana: 50,
    level: 1,
    gold: 0,
    wanted: 0, // 0-5
    xp: 0,
    facing: 0, // 0 right, 1 down, 2 left, 3 up
    invuln: 0,
    mounted: false,
    mountSpeed: 4.5
  };

  const npcs = [];
  const enemies = [];
  const projectiles = [];
  const particles = [];
  const mounts = []; // stealable horses

  // Create NPCs
  const npcNames = ['Aldeano', 'Mercader', 'Guardia', 'Hechicera', 'Granjero', 'Bardo', 'Cazador'];
  for (let i = 0; i < 12; i++) {
    let x, y, tries = 0;
    do {
      x = (10 + Math.random() * 60) * TILE;
      y = (10 + Math.random() * 40) * TILE;
      tries++;
    } while (collidesWithObstacles(x, y, 18, 18) && tries < 30);
    npcs.push({
      x, y, w: 18, h: 18,
      vx: 0, vy: 0,
      speed: 0.6 + Math.random() * 0.4,
      dirTimer: 0,
      name: npcNames[i % npcNames.length],
      gold: 5 + Math.floor(Math.random() * 25),
      color: `hsl(${Math.random()*60+20}, 50%, 45%)`
    });
  }

  // Enemies (goblins & corrupt knights)
  for (let i = 0; i < 8; i++) {
    let x, y, tries = 0;
    do {
      x = Math.random() * WORLD_W;
      y = Math.random() * WORLD_H;
      tries++;
    } while ((x > 20*TILE && x < 50*TILE && y > 18*TILE && y < 38*TILE) || collidesWithObstacles(x, y, 20, 20) && tries < 40);
    const isKnight = Math.random() > 0.55;
    enemies.push({
      x, y, w: 20, h: 20,
      hp: isKnight ? 40 : 25,
      maxHp: isKnight ? 40 : 25,
      speed: isKnight ? 1.4 : 1.8,
      damage: isKnight ? 12 : 8,
      type: isKnight ? 'knight' : 'goblin',
      color: isKnight ? '#4a2060' : '#2d6b2d',
      target: null,
      patrolX: x,
      patrolY: y,
      attackCd: 0
    });
  }

  // Mounts (horses / beasts)
  for (let i = 0; i < 4; i++) {
    let x = (15 + Math.random()*50) * TILE;
    let y = (12 + Math.random()*35) * TILE;
    mounts.push({
      x, y, w: 28, h: 20,
      color: ['#8B4513', '#A0522D', '#5C4033', '#D2691E'][i],
      stolen: false
    });
  }

  function collidesWithObstacles(x, y, w, h) {
    const r = { x, y, w, h };
    for (const o of obstacles) {
      if (rectsCollide(r, o)) return true;
    }
    return false;
  }

  function tryMove(ent, dx, dy) {
    const nx = ent.x + dx;
    const ny = ent.y + dy;
    if (!collidesWithObstacles(nx, ent.y, ent.w, ent.h)) ent.x = nx;
    if (!collidesWithObstacles(ent.x, ny, ent.w, ent.h)) ent.y = ny;
    ent.x = clamp(ent.x, 0, WORLD_W - ent.w);
    ent.y = clamp(ent.y, 0, WORLD_H - ent.h);
  }

  // ============== COMBAT & ACTIONS ==============
  function doInteract() {
    if (!interactPressed) return;
    interactPressed = false;

    // Check mounts first
    for (const m of mounts) {
      if (m.stolen) continue;
      if (dist(player, m) < 40) {
        m.stolen = true;
        player.mounted = true;
        player.wanted = Math.min(5, player.wanted + 1);
        showMessage('\u00a1Montura robada! Velocidad aumentada. Wanted +1');
        updateHUD();
        return;
      }
    }

    // NPCs
    for (const n of npcs) {
      if (dist(player, n) < 36) {
        const stolen = Math.min(n.gold, 8 + Math.floor(Math.random() * 15));
        n.gold -= stolen;
        player.gold += stolen;
        player.wanted = Math.min(5, player.wanted + (stolen > 10 ? 2 : 1));
        showMessage(`\u00a1Robaste ${stolen} oro a ${n.name}! Wanted +`);
        // Scare NPC
        n.vx = (n.x - player.x) * 0.15;
        n.vy = (n.y - player.y) * 0.15;
        n.dirTimer = 40;
        updateHUD();
        return;
      }
    }

    // Buildings interact
    for (const b of buildings) {
      const cx = b.x + b.w/2, cy = b.y + b.h/2;
      if (Math.hypot(player.x + player.w/2 - cx, player.y + player.h/2 - cy) < 55) {
        if (b.name === 'Posada') {
          if (player.gold >= 10) {
            player.gold -= 10;
            player.hp = player.maxHp;
            player.mana = player.maxMana;
            showMessage('Descansaste en la Posada. HP y Mana restaurados (-10 oro)');
          } else showMessage('Necesitas 10 oro para descansar.');
        } else if (b.name === 'Templo') {
          player.mana = player.maxMana;
          showMessage('El Templo restaura tu man\u00e1.');
        } else if (b.name === 'Herrer\u00eda') {
          showMessage('Herrer\u00eda: \u00a1Mejora tu equipo alg\u00fan d\u00eda!');
        } else {
          showMessage(`Entraste a ${b.name}.`);
        }
        updateHUD();
        return;
      }
    }

    showMessage('Nada cerca para interactuar.');
  }

  function doAttack() {
    if (!attackPressed) return;
    attackPressed = false;
    if (player.mana < 8) {
      showMessage('\u00a1Sin man\u00e1 suficiente!');
      return;
    }
    player.mana -= 8;

    // Direction based on facing or last movement
    let dx = 0, dy = 0;
    if (keys.right) dx = 1;
    else if (keys.left) dx = -1;
    if (keys.down) dy = 1;
    else if (keys.up) dy = -1;
    if (dx === 0 && dy === 0) {
      // default based on facing
      if (player.facing === 0) dx = 1;
      else if (player.facing === 1) dy = 1;
      else if (player.facing === 2) dx = -1;
      else dy = -1;
    }
    const len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;

    projectiles.push({
      x: player.x + player.w/2,
      y: player.y + player.h/2,
      vx: dx * 7,
      vy: dy * 7,
      life: 45,
      damage: 15 + player.level * 3,
      color: '#a855f7'
    });
    updateHUD();
  }

  // ============== UPDATE ==============
  function update(dt) {
    // Player movement
    let dx = 0, dy = 0;
    if (keys.up) dy -= 1;
    if (keys.down) dy += 1;
    if (keys.left) dx -= 1;
    if (keys.right) dx += 1;
    if (dx || dy) {
      const len = Math.hypot(dx, dy);
      dx /= len; dy /= len;
      const spd = player.mounted ? player.mountSpeed : player.speed;
      tryMove(player, dx * spd, dy * spd);
      if (Math.abs(dx) > Math.abs(dy)) player.facing = dx > 0 ? 0 : 2;
      else player.facing = dy > 0 ? 1 : 3;
    }

    doInteract();
    doAttack();

    // Invulnerability timer
    if (player.invuln > 0) player.invuln--;

    // Mana regen
    if (player.mana < player.maxMana && Math.random() < 0.02) {
      player.mana = Math.min(player.maxMana, player.mana + 1);
      updateHUD();
    }

    // NPCs wander
    for (const n of npcs) {
      n.dirTimer--;
      if (n.dirTimer <= 0) {
        n.vx = (Math.random() - 0.5) * n.speed * 2;
        n.vy = (Math.random() - 0.5) * n.speed * 2;
        n.dirTimer = 40 + Math.random() * 80;
      }
      tryMove(n, n.vx, n.vy);
    }

    // Enemies AI
    for (const e of enemies) {
      if (e.hp <= 0) continue;
      e.attackCd = Math.max(0, e.attackCd - 1);
      const d = dist(player, e);
      if (d < 180) {
        // Chase
        const ang = Math.atan2(player.y - e.y, player.x - e.x);
        tryMove(e, Math.cos(ang) * e.speed, Math.sin(ang) * e.speed);
        if (d < 32 && e.attackCd <= 0 && player.invuln <= 0) {
          player.hp -= e.damage;
          player.invuln = 40;
          e.attackCd = 50;
          showMessage(`\u00a1${e.type === 'knight' ? 'Caballero corrupto' : 'Goblin'} te golpe\u00f3! -${e.damage} HP`);
          updateHUD();
          if (player.hp <= 0) {
            player.hp = 0;
            showMessage('\u00a1Has muerto! Respawning...', 2500);
            setTimeout(() => {
              player.hp = player.maxHp;
              player.mana = player.maxMana;
              player.x = 34 * TILE;
              player.y = 28 * TILE;
              player.wanted = Math.max(0, player.wanted - 1);
              player.mounted = false;
              updateHUD();
            }, 2000);
          }
        }
      } else {
        // Patrol
        const px = e.patrolX + Math.sin(Date.now()/1000 + e.x) * 40;
        const py = e.patrolY + Math.cos(Date.now()/1200 + e.y) * 40;
        const ang = Math.atan2(py - e.y, px - e.x);
        tryMove(e, Math.cos(ang) * e.speed * 0.5, Math.sin(ang) * e.speed * 0.5);
      }
    }

    // Projectiles
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
      // Hit enemies
      for (const e of enemies) {
        if (e.hp <= 0) continue;
        if (Math.hypot(p.x - (e.x + e.w/2), p.y - (e.y + e.h/2)) < 18) {
          e.hp -= p.damage;
          particles.push({ x: p.x, y: p.y, life: 20, color: '#c084fc' });
          projectiles.splice(i, 1);
          if (e.hp <= 0) {
            player.xp += e.type === 'knight' ? 25 : 12;
            player.gold += e.type === 'knight' ? 15 : 6;
            showMessage(`\u00a1Enemigo derrotado! +XP +Oro`);
            // Level up
            if (player.xp >= player.level * 40) {
              player.xp = 0;
              player.level++;
              player.maxHp += 15;
              player.hp = player.maxHp;
              player.maxMana += 8;
              player.mana = player.maxMana;
              showMessage(`\u00a1SUBISTE AL NIVEL ${player.level}!`);
            }
            updateHUD();
          }
          break;
        }
      }
      if (p.life <= 0) projectiles.splice(i, 1);
    }

    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
      particles[i].life--;
      if (particles[i].life <= 0) particles.splice(i, 1);
    }

    // Wanted decay slowly
    if (player.wanted > 0 && Math.random() < 0.0015) {
      player.wanted--;
      updateHUD();
    }

    // Camera follow
    cameraX = clamp(player.x + player.w/2 - W/2, 0, WORLD_W - W);
    cameraY = clamp(player.y + player.h/2 - H/2, 0, WORLD_H - H);
  }

  function updateHUD() {
    document.getElementById('hp').textContent = Math.max(0, Math.floor(player.hp));
    document.getElementById('mana').textContent = Math.floor(player.mana);
    document.getElementById('level').textContent = player.level;
    document.getElementById('gold').textContent = player.gold;
    const wEl = document.getElementById('wanted');
    const wStat = document.getElementById('wanted-stat');
    if (player.wanted === 0) {
      wEl.textContent = 'Libre';
      wStat.classList.remove('wanted');
    } else {
      wEl.textContent = '\u00a1SE BUSCA! x' + player.wanted;
      wStat.classList.add('wanted');
    }
  }

  // ============== DRAW ==============
  function draw() {
    ctx.clearRect(0, 0, W, H);

    // Background grass
    ctx.fillStyle = '#3a7d34';
    ctx.fillRect(0, 0, W, H);

    // Draw visible tiles
    const startTX = Math.floor(cameraX / TILE);
    const startTY = Math.floor(cameraY / TILE);
    const endTX = Math.ceil((cameraX + W) / TILE);
    const endTY = Math.ceil((cameraY + H) / TILE);

    for (let ty = startTY; ty <= endTY; ty++) {
      for (let tx = startTX; tx <= endTX; tx++) {
        if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) continue;
        const sx = tx * TILE - cameraX;
        const sy = ty * TILE - cameraY;
        if (isPath(tx, ty)) {
          ctx.fillStyle = '#7a7a6a';
          ctx.fillRect(sx, sy, TILE, TILE);
          // stone pattern
          ctx.fillStyle = '#8a8a7a';
          ctx.fillRect(sx + 4, sy + 4, 10, 10);
          ctx.fillRect(sx + 18, sy + 16, 10, 10);
        } else {
          // grass variation
          const g = ((tx * 17 + ty * 31) % 5);
          ctx.fillStyle = g === 0 ? '#3d8a38' : g === 1 ? '#358032' : '#3a7d34';
          ctx.fillRect(sx, sy, TILE, TILE);
        }
      }
    }

    // Buildings
    for (const b of buildings) {
      const sx = b.x - cameraX;
      const sy = b.y - cameraY;
      if (sx + b.w < 0 || sy + b.h < 0 || sx > W || sy > H) continue;
      ctx.fillStyle = b.color;
      ctx.fillRect(sx, sy, b.w, b.h);
      // roof
      ctx.fillStyle = '#3d2914';
      ctx.fillRect(sx, sy, b.w, 8);
      // door
      if (!b.name.includes('Muralla')) {
        ctx.fillStyle = '#2a1a0a';
        ctx.fillRect(sx + b.w/2 - 8, sy + b.h - 18, 16, 18);
      }
      // name
      ctx.fillStyle = '#fff';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(b.name, sx + b.w/2, sy - 4);
    }

    // Trees
    for (const o of obstacles) {
      if (!o.tree) continue;
      const sx = o.x - cameraX;
      const sy = o.y - cameraY;
      if (sx + 30 < 0 || sy + 30 < 0 || sx > W || sy > H) continue;
      ctx.fillStyle = '#2d5a1e';
      ctx.beginPath();
      ctx.arc(sx + 12, sy + 10, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#5c3a1e';
      ctx.fillRect(sx + 9, sy + 16, 6, 12);
    }

    // Mounts
    for (const m of mounts) {
      if (m.stolen) continue;
      const sx = m.x - cameraX;
      const sy = m.y - cameraY;
      ctx.fillStyle = m.color;
      ctx.fillRect(sx, sy, m.w, m.h);
      ctx.fillStyle = '#222';
      ctx.fillRect(sx + 4, sy + 4, 6, 6);
      ctx.fillRect(sx + m.w - 10, sy + 4, 6, 6);
      ctx.fillStyle = '#ffd700';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('\ud83d\udc34', sx + m.w/2, sy - 4);
    }

    // NPCs
    for (const n of npcs) {
      const sx = n.x - cameraX;
      const sy = n.y - cameraY;
      if (sx + 30 < 0 || sy + 30 < 0 || sx > W || sy > H) continue;
      ctx.fillStyle = n.color;
      ctx.fillRect(sx, sy, n.w, n.h);
      // head
      ctx.fillStyle = '#f5cba7';
      ctx.fillRect(sx + 4, sy - 6, 10, 8);
    }

    // Enemies
    for (const e of enemies) {
      if (e.hp <= 0) continue;
      const sx = e.x - cameraX;
      const sy = e.y - cameraY;
      if (sx + 30 < 0 || sy + 30 < 0 || sx > W || sy > H) continue;
      ctx.fillStyle = e.color;
      ctx.fillRect(sx, sy, e.w, e.h);
      // eyes
      ctx.fillStyle = '#ff0';
      ctx.fillRect(sx + 4, sy + 5, 4, 4);
      ctx.fillRect(sx + 12, sy + 5, 4, 4);
      // hp bar
      ctx.fillStyle = '#300';
      ctx.fillRect(sx, sy - 8, e.w, 4);
      ctx.fillStyle = '#e33';
      ctx.fillRect(sx, sy - 8, e.w * (e.hp / e.maxHp), 4);
    }

    // Projectiles
    for (const p of projectiles) {
      const sx = p.x - cameraX;
      const sy = p.y - cameraY;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(sx, sy, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e9d5ff';
      ctx.beginPath();
      ctx.arc(sx, sy, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Particles
    for (const p of particles) {
      const sx = p.x - cameraX;
      const sy = p.y - cameraY;
      ctx.globalAlpha = p.life / 20;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(sx, sy, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Player
    const px = player.x - cameraX;
    const py = player.y - cameraY;
    if (player.invuln > 0 && Math.floor(player.invuln / 4) % 2 === 0) {
      ctx.globalAlpha = 0.5;
    }
    // body
    ctx.fillStyle = player.mounted ? '#c0392b' : '#2980b9';
    ctx.fillRect(px, py, player.w, player.h);
    // head
    ctx.fillStyle = '#f5cba7';
    ctx.fillRect(px + 5, py - 8, 12, 10);
    // hair
    ctx.fillStyle = '#1a5276';
    ctx.fillRect(px + 4, py - 10, 14, 5);
    // weapon indicator
    if (player.facing === 0) {
      ctx.fillStyle = '#9b59b6';
      ctx.fillRect(px + player.w, py + 6, 8, 4);
    } else if (player.facing === 2) {
      ctx.fillStyle = '#9b59b6';
      ctx.fillRect(px - 8, py + 6, 8, 4);
    }
    ctx.globalAlpha = 1;

    // Mount indicator under player
    if (player.mounted) {
      ctx.fillStyle = 'rgba(139,69,19,0.7)';
      ctx.fillRect(px - 4, py + player.h - 4, player.w + 8, 10);
    }
  }

  // ============== LOOP ==============
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(32, now - last);
    last = now;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  // Init
  updateHUD();
  showMessage('\u00a1Bienvenido al mundo isekai! Usa el pad y botones. Roba, pelea, explora.', 3500);
  requestAnimationFrame(loop);
})();
