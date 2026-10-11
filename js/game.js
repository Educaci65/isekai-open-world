(function () {
  "use strict";
  var canvas = document.getElementById("c");
  var ctx = canvas.getContext("2d");
  var W = 0, H = 0, dpr = 1, frame = 0;
  var TILE = 48;
  var keys = { x: 0, y: 0 };
  var joyId = null, joyOX = 0, joyOY = 0;
  var running = false, dead = false, levelClear = false, shake = 0;
  var score = 0, combo = 1, comboTimer = 0, kills = 0, levelIndex = 0, maskId = 0;
  var walls = [], enemies = [], doors = [], pickups = [], bullets = [], particles = [], blood = [], trails = [], dust = [];
  var player = null;
  var MASKS = Sprites.MASKS;
  var WEAPONS = Sprites.WEAPONS;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener("resize", resize);
  resize();

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }

  function showMsg(t, sub, ms) {
    ms = ms || 1500;
    var a = document.getElementById("mainMsg"), b = document.getElementById("subMsg");
    a.textContent = t;
    b.textContent = sub || "";
    a.classList.add("show");
    b.classList.add("show");
    clearTimeout(showMsg._t);
    showMsg._t = setTimeout(function () {
      a.classList.remove("show");
      b.classList.remove("show");
    }, ms);
  }

  function updateHUD() {
    document.getElementById("score").textContent = String(score | 0);
    document.getElementById("comboEl").textContent = "x" + combo;
    document.getElementById("kills").textContent = String(kills);
    document.getElementById("secN").textContent = String(levelIndex + 1);
    document.getElementById("levelTag").textContent = "SECTOR " + String(levelIndex + 1).padStart(2, "0");
    if (player) {
      var w = WEAPONS[player.weapon];
      document.getElementById("weaponTag").textContent = w ? (w.name + (w.type === "gun" ? " · " + player.ammo : "")) : "BAT";
    }
  }

  var LEVELS = [
    { name: "LOBBY", map: ["##############","#P...........#","#..###.......#","#..#.#...E...#","#..#.#.......#","#..#.#####...#","#..........E.#","#...E........#","#......###...#","#..S...#.#...#","#......#.....#","#...E........#","#..........D.#","##############"]},
    { name: "HALLS", map: ["##################","#P...............#","#.####.####.####.#","#.#..#.#..#.#..#.#","#.#E.#.#S.#.#E.#.#","#.#..#.#..#.#..#.#","#....E.....E.....#","#.####.####.####.#","#................#","#..E...S...E.....#","#..............D.#","##################"]},
    { name: "STORAGE", map: ["####################","#P.................#","#..##..##..##......#","#..##..##..##......#","#.......E..........#","#..E.........S.....#","#......####........#","#......#..#...E....#","#..S...#..#........#","#......####........#","#..............E...#","#..E.....S.........#","#................D.#","####################"]},
    { name: "CLUB", map: ["######################","#P....................#","#..##.E.##.E.##.S.....#","#..##...##...##.......#","#.....................#","#.S...#######...E.....#","#.....#.....#.........#","#..E..#..S..#.....E...#","#.....#.....#.........#","#.....#######...S.....#","#.....................#","#..##...##.E.##.......#","#..##.E.##...##.....D.#","######################"]},
    { name: "FINALE", map: ["########################","#P......................#","#..##.E.##.E.##.S.##....#","#..##...##...##...##....#","#.......................#","#.S...#########...E.....#","#.....#.......#.........#","#..E..#...S...#......E..#","#.....#.......#.........#","#.....#########...S.....#","#.......................#","#..##...##.S.##...##....#","#..##.E.##...##.E.##..D.#","########################"]}
  ];

  function makeEnemy(x, y, type) {
    return {
      x: x, y: y, r: 14, type: type, alive: true,
      speed: type === "shooter" ? 1.4 : 1.85,
      timer: 30 + Math.random() * 40, px: x, py: y, cd: 0,
      weapon: type === "shooter" ? "pistol" : "bat",
      ammo: type === "shooter" ? 12 : 0,
      alert: 0, angle: 0, walk: 0, atkT: 0, hitFlash: 0, deadT: 0
    };
  }

  function buildLevel(idx) {
    walls = []; enemies = []; doors = []; pickups = [];
    bullets = []; particles = []; blood = []; trails = []; dust = [];
    var L = LEVELS[idx % LEVELS.length];
    var map = L.map;
    var spawn = { x: TILE * 1.5, y: TILE * 1.5 };
    var y, x, c, wx, wy;
    for (y = 0; y < map.length; y++) {
      for (x = 0; x < map[y].length; x++) {
        c = map[y].charAt(x);
        wx = x * TILE; wy = y * TILE;
        if (c === "#") walls.push({ x: wx, y: wy, w: TILE, h: TILE });
        else if (c === "P") { spawn.x = wx + TILE / 2; spawn.y = wy + TILE / 2; }
        else if (c === "E") enemies.push(makeEnemy(wx + TILE / 2, wy + TILE / 2, "melee"));
        else if (c === "S") enemies.push(makeEnemy(wx + TILE / 2, wy + TILE / 2, "shooter"));
        else if (c === "D") doors.push({ x: wx, y: wy, w: TILE, h: TILE });
      }
    }
    if (idx >= 1) pickups.push({ x: spawn.x + TILE * 2, y: spawn.y, weapon: "pistol", ammo: 10 });
    player = {
      x: spawn.x, y: spawn.y, r: 15, speed: 3.8,
      weapon: "bat", ammo: 0, atkCd: 0, atkT: 0,
      dashCd: 0, dashT: 0, vx: 0, vy: 0,
      alive: true, inv: 0, walk: 0, angle: 0, muzzle: 0
    };
    dead = false; levelClear = false; combo = 1; comboTimer = 0; shake = 0;
    updateHUD();
    showMsg(L.name, "ELIMINA A TODOS", 2000);
  }

  function solidCircle(x, y, r) {
    var i, o, cx, cy;
    for (i = 0; i < walls.length; i++) {
      o = walls[i];
      cx = clamp(x, o.x, o.x + o.w);
      cy = clamp(y, o.y, o.y + o.h);
      if (Math.hypot(x - cx, y - cy) < r) return true;
    }
    if (!levelClear) {
      for (i = 0; i < doors.length; i++) {
        o = doors[i];
        cx = clamp(x, o.x, o.x + o.w);
        cy = clamp(y, o.y, o.y + o.h);
        if (Math.hypot(x - cx, y - cy) < r) return true;
      }
    }
    return false;
  }

  function tryMove(e, dx, dy) {
    if (!solidCircle(e.x + dx, e.y, e.r)) e.x += dx;
    if (!solidCircle(e.x, e.y + dy, e.r)) e.y += dy;
  }

  function lineBlocked(x1, y1, x2, y2) {
    var steps = Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 8) | 0;
    var i, t, x, y, j, w;
    for (i = 1; i <= steps; i++) {
      t = i / steps;
      x = x1 + (x2 - x1) * t;
      y = y1 + (y2 - y1) * t;
      for (j = 0; j < walls.length; j++) {
        w = walls[j];
        if (x > w.x && x < w.x + w.w && y > w.y && y < w.y + w.h) return true;
      }
    }
    return false;
  }

  function sprayBlood(x, y, n) {
    var i, a, sp;
    for (i = 0; i < (n || 14); i++) {
      a = Math.random() * 6.28;
      sp = 1.5 + Math.random() * 5;
      blood.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 35 + Math.random() * 25, s: 2 + Math.random() * 4 });
    }
  }

  function spawnDust(x, y) {
    dust.push({ x: x + (Math.random() - 0.5) * 8, y: y + (Math.random() - 0.5) * 8, life: 12 + Math.random() * 8, s: 2 + Math.random() * 3 });
  }

  function killEnemy(e) {
    if (!e.alive) return;
    e.alive = false;
    e.deadT = 22;
    kills++;
    comboTimer = 90;
    combo = Math.min(combo + 1, 15);
    score += 100 * combo;
    shake = 8;
    sprayBlood(e.x, e.y, 18);
    var i;
    for (i = 0; i < 8; i++) {
      particles.push({ x: e.x, y: e.y, vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 6, life: 18, color: "#ff286e", s: 3 });
    }
    if (e.weapon !== "bat") pickups.push({ x: e.x, y: e.y, weapon: e.weapon, ammo: e.ammo || 8 });
    updateHUD();
    var left = 0;
    for (i = 0; i < enemies.length; i++) if (enemies[i].alive) left++;
    if (left === 0) {
      levelClear = true;
      score += 500;
      showMsg("CLEAR", "TOCA LA PUERTA EXIT", 2500);
      updateHUD();
    }
  }

  function doMelee() {
    if (!player || !player.alive || player.atkCd > 0 || player.dashT > 0) return;
    var melee = WEAPONS[player.weapon] && WEAPONS[player.weapon].type === "melee" ? WEAPONS[player.weapon] : WEAPONS.bat;
    player.atkCd = melee.cd;
    player.atkT = 12;
    var i, e, d, diff;
    for (i = 0; i < enemies.length; i++) {
      e = enemies[i];
      if (!e.alive) continue;
      d = dist(player.x, player.y, e.x, e.y);
      if (d > melee.range + e.r) continue;
      diff = Math.atan2(e.y - player.y, e.x - player.x) - player.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) < melee.arc) {
        killEnemy(e);
        e.hitFlash = 8;
      }
    }
  }

  function doShoot() {
    if (!player || !player.alive || player.atkCd > 0 || player.dashT > 0) return;
    var w = WEAPONS[player.weapon];
    if (!w || w.type !== "gun") { doMelee(); return; }
    if (player.ammo <= 0) { showMsg("SIN BALAS", "", 1000); return; }
    player.atkCd = w.cd;
    player.atkT = 6;
    player.ammo--;
    player.muzzle = 6;
    var n = w.pellets || 1, i, a;
    for (i = 0; i < n; i++) {
      a = player.angle + (Math.random() - 0.5) * (w.spread || 0.04) * 2;
      bullets.push({
        x: player.x + Math.cos(a) * 18,
        y: player.y + Math.sin(a) * 18,
        vx: Math.cos(a) * w.spd,
        vy: Math.sin(a) * w.spd,
        life: Math.ceil(w.range / w.spd),
        from: "player",
        color: w.color
      });
    }
    shake = 4;
    updateHUD();
  }

  function doDash() {
    if (!player || !player.alive || player.dashCd > 0 || player.dashT > 0) return;
    var dx = keys.x, dy = keys.y;
    if (Math.hypot(dx, dy) < 0.15) {
      dx = Math.cos(player.angle);
      dy = Math.sin(player.angle);
    }
    var len = Math.hypot(dx, dy) || 1;
    player.vx = (dx / len) * 10;
    player.vy = (dy / len) * 10;
    player.dashT = 11;
    player.dashCd = 38;
    player.inv = 12;
  }

  var joyBase = document.getElementById("joyBase");
  var joyKnob = document.getElementById("joyKnob");
  var joyZone = document.getElementById("joyZone");
  var JOY_R = 48;

  function setJoy(dx, dy) {
    var len = Math.hypot(dx, dy) || 1;
    var cl = Math.min(len, JOY_R);
    var jx = (dx / len) * cl;
    var jy = (dy / len) * cl;
    joyKnob.style.transform = "translate(calc(-50% + " + jx + "px), calc(-50% + " + jy + "px))";
    keys.x = jx / JOY_R;
    keys.y = jy / JOY_R;
    if (len > 8 && player) player.angle = Math.atan2(dy, dx);
  }

  joyZone.addEventListener("touchstart", function (e) {
    e.preventDefault();
    var t = e.changedTouches[0];
    joyId = t.identifier;
    var r = joyBase.getBoundingClientRect();
    joyOX = r.left + r.width / 2;
    joyOY = r.top + r.height / 2;
    setJoy(t.clientX - joyOX, t.clientY - joyOY);
  }, { passive: false });

  joyZone.addEventListener("touchmove", function (e) {
    e.preventDefault();
    var i, t;
    for (i = 0; i < e.changedTouches.length; i++) {
      t = e.changedTouches[i];
      if (t.identifier === joyId) {
        setJoy(t.clientX - joyOX, t.clientY - joyOY);
        break;
      }
    }
  }, { passive: false });

  function endJoy(e) {
    var i;
    for (i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === joyId) {
        joyId = null;
        keys.x = 0;
        keys.y = 0;
        joyKnob.style.transform = "translate(-50%,-50%)";
      }
    }
  }
  joyZone.addEventListener("touchend", endJoy, { passive: false });
  joyZone.addEventListener("touchcancel", endJoy, { passive: false });

  function bindBtn(id, fn) {
    var el = document.getElementById(id);
    el.addEventListener("touchstart", function (e) { e.preventDefault(); fn(); }, { passive: false });
  }
  bindBtn("btnHit", doMelee);
  bindBtn("btnFire", doShoot);
  bindBtn("btnDash", doDash);

  document.querySelectorAll(".mask").forEach(function (el) {
    el.addEventListener("touchstart", function (e) {
      e.preventDefault();
      document.querySelectorAll(".mask").forEach(function (m) { m.classList.remove("on"); });
      el.classList.add("on");
      maskId = +el.getAttribute("data-m");
    }, { passive: false });
  });

  function startGame() {
    document.getElementById("overlay").classList.add("hidden");
    levelIndex = 0;
    score = 0;
    kills = 0;
    buildLevel(0);
    running = true;
  }

  document.getElementById("btnStart").addEventListener("touchstart", function (e) {
    e.preventDefault();
    startGame();
  }, { passive: false });

  document.getElementById("btnStart").addEventListener("click", function () {
    if (dead) {
      document.getElementById("overlay").classList.add("hidden");
      document.getElementById("btnStart").textContent = "JUGAR";
      document.querySelector("#overlay h1").textContent = "NEON RUSH";
      buildLevel(levelIndex);
      running = true;
      dead = false;
    } else startGame();
  });

  function die() {
    if (dead || !player || !player.alive) return;
    player.alive = false;
    dead = true;
    running = false;
    sprayBlood(player.x, player.y, 28);
    shake = 14;
    showMsg("WASTED", "", 1500);
    setTimeout(function () {
      var ov = document.getElementById("overlay");
      ov.classList.remove("hidden");
      ov.querySelector("h1").textContent = "WASTED";
      ov.querySelector(".tag").textContent = "SECTOR " + String(levelIndex + 1).padStart(2, "0");
      ov.querySelector("p").innerHTML = "Score " + (score | 0) + " · Kills " + kills;
      document.getElementById("btnStart").textContent = "REINTENTAR";
    }, 600);
  }

  function nextLevel() {
    levelIndex++;
    if (levelIndex >= LEVELS.length) {
      running = false;
      var ov = document.getElementById("overlay");
      ov.classList.remove("hidden");
      ov.querySelector("h1").textContent = "COMPLETADO";
      ov.querySelector("p").innerHTML = "Score " + (score | 0);
      document.getElementById("btnStart").textContent = "OTRA VEZ";
      return;
    }
    buildLevel(levelIndex);
  }

  function update() {
    if (!running || !player || !player.alive) return;
    frame++;
    if (shake > 0) shake *= 0.85;
    if (comboTimer > 0) {
      comboTimer--;
      if (comboTimer <= 0) { combo = 1; updateHUD(); }
    }
    if (player.atkCd > 0) player.atkCd--;
    if (player.atkT > 0) player.atkT--;
    if (player.dashCd > 0) player.dashCd--;
    if (player.inv > 0) player.inv--;
    if (player.muzzle > 0) player.muzzle--;

    if (player.dashT > 0) {
      player.dashT--;
      tryMove(player, player.vx, player.vy);
      player.walk += 0.55;
      trails.push({ x: player.x, y: player.y, a: player.angle, life: 10, m: maskId });
      spawnDust(player.x, player.y);
    } else {
      var mx = keys.x, my = keys.y, len = Math.hypot(mx, my);
      if (len > 0.08) {
        mx /= len; my /= len;
        tryMove(player, mx * player.speed, my * player.speed);
        player.angle = Math.atan2(my, mx);
        player.walk += 0.38;
        if (frame % 6 === 0) spawnDust(player.x, player.y);
      } else {
        player.walk *= 0.9;
      }
    }
    if (trails.length > 16) trails.shift();

    var i, p, e, d, a, canSee, j, b, w;
    for (i = trails.length - 1; i >= 0; i--) {
      trails[i].life--;
      if (trails[i].life <= 0) trails.splice(i, 1);
    }
    for (i = dust.length - 1; i >= 0; i--) {
      dust[i].life--;
      if (dust[i].life <= 0) dust.splice(i, 1);
    }

    for (i = pickups.length - 1; i >= 0; i--) {
      p = pickups[i];
      if (dist(player.x, player.y, p.x, p.y) < 26) {
        player.weapon = p.weapon;
        player.ammo = p.ammo || WEAPONS[p.weapon].ammo || 0;
        pickups.splice(i, 1);
        showMsg(WEAPONS[p.weapon].name, "", 900);
        updateHUD();
      }
    }

    if (levelClear) {
      for (i = 0; i < doors.length; i++) {
        if (dist(player.x, player.y, doors[i].x + doors[i].w / 2, doors[i].y + doors[i].h / 2) < 40) {
          nextLevel();
          return;
        }
      }
    }

    for (i = 0; i < enemies.length; i++) {
      e = enemies[i];
      if (!e.alive) {
        if (e.deadT > 0) e.deadT--;
        continue;
      }
      if (e.hitFlash > 0) e.hitFlash--;
      if (e.atkT > 0) e.atkT--;
      e.cd = Math.max(0, e.cd - 1);
      e.timer--;
      d = dist(e.x, e.y, player.x, player.y);
      canSee = d < 220 && !lineBlocked(e.x, e.y, player.x, player.y);
      if (canSee) e.alert = 120;
      if (e.alert > 0) e.alert--;
      if (e.alert > 0 || canSee) {
        a = Math.atan2(player.y - e.y, player.x - e.x);
        e.angle = a;
        if (e.type === "shooter" && d < 90) tryMove(e, -Math.cos(a) * e.speed, -Math.sin(a) * e.speed);
        else tryMove(e, Math.cos(a) * e.speed, Math.sin(a) * e.speed);
        e.walk += 0.32;
        if (e.type === "melee" && d < e.r + player.r + 3 && e.cd <= 0 && player.inv <= 0) {
          e.cd = 40;
          e.atkT = 10;
          die();
          return;
        }
        if (e.type === "shooter" && d < 200 && e.cd <= 0 && canSee) {
          e.cd = 45;
          e.atkT = 6;
          a = Math.atan2(player.y - e.y, player.x - e.x) + (Math.random() - 0.5) * 0.1;
          bullets.push({
            x: e.x + Math.cos(a) * 14,
            y: e.y + Math.sin(a) * 14,
            vx: Math.cos(a) * 7,
            vy: Math.sin(a) * 7,
            life: 40,
            from: "enemy",
            color: "#ff4466"
          });
        }
      } else {
        if (e.timer <= 0) {
          e.px = e.x + (Math.random() - 0.5) * 80;
          e.py = e.y + (Math.random() - 0.5) * 80;
          e.timer = 40 + Math.random() * 50;
        }
        a = Math.atan2(e.py - e.y, e.px - e.x);
        e.angle = a;
        tryMove(e, Math.cos(a) * e.speed * 0.4, Math.sin(a) * e.speed * 0.4);
        e.walk += 0.12;
      }
    }

    for (i = bullets.length - 1; i >= 0; i--) {
      b = bullets[i];
      b.x += b.vx;
      b.y += b.vy;
      b.life--;
      var hitW = false;
      for (j = 0; j < walls.length; j++) {
        w = walls[j];
        if (b.x > w.x && b.x < w.x + w.w && b.y > w.y && b.y < w.y + w.h) {
          hitW = true;
          break;
        }
      }
      if (hitW || b.life <= 0) {
        bullets.splice(i, 1);
        continue;
      }
      if (b.from === "player") {
        for (j = 0; j < enemies.length; j++) {
          e = enemies[j];
          if (!e.alive) continue;
          if (Math.hypot(b.x - e.x, b.y - e.y) < e.r + 2) {
            killEnemy(e);
            e.hitFlash = 8;
            bullets.splice(i, 1);
            break;
          }
        }
      } else if (player.inv <= 0 && Math.hypot(b.x - player.x, b.y - player.y) < player.r + 2) {
        bullets.splice(i, 1);
        die();
        return;
      }
    }

    for (i = blood.length - 1; i >= 0; i--) {
      p = blood[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.88;
      p.vy *= 0.88;
      p.life--;
      if (p.life <= 0) blood.splice(i, 1);
    }
    for (i = particles.length - 1; i >= 0; i--) {
      p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function getCam() {
    if (!player) return { x: 0, y: 0 };
    var cx = player.x - W / 2;
    var cy = player.y - H / 2;
    if (shake > 0) {
      cx += (Math.random() - 0.5) * shake * 2;
      cy += (Math.random() - 0.5) * shake * 2;
    }
    return { x: cx, y: cy };
  }

  function draw() {
    var cam = getCam();
    var i, sx, sy, e, b, p, d, t, m;

    ctx.fillStyle = "#0a0a12";
    ctx.fillRect(0, 0, W, H);

    var ts = TILE, tx, ty;
    var x0 = Math.floor(cam.x / ts) - 1, y0 = Math.floor(cam.y / ts) - 1;
    var x1 = Math.ceil((cam.x + W) / ts) + 1, y1 = Math.ceil((cam.y + H) / ts) + 1;
    for (ty = y0; ty <= y1; ty++) {
      for (tx = x0; tx <= x1; tx++) {
        ctx.fillStyle = ((tx + ty) & 1) ? "#14141e" : "#101018";
        ctx.fillRect(tx * ts - cam.x, ty * ts - cam.y, ts, ts);
      }
    }

    for (i = 0; i < dust.length; i++) {
      p = dust[i];
      ctx.globalAlpha = (p.life / 16) * 0.35;
      ctx.fillStyle = "#888";
      ctx.beginPath();
      ctx.arc(p.x - cam.x, p.y - cam.y, p.s, 0, Math.PI * 2);
      ctx.fill();
    }
    for (i = 0; i < blood.length; i++) {
      p = blood[i];
      ctx.globalAlpha = clamp(p.life / 40, 0.15, 0.75);
      ctx.fillStyle = "#8b0018";
      ctx.beginPath();
      ctx.arc(p.x - cam.x, p.y - cam.y, p.s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    for (i = 0; i < walls.length; i++) {
      var w = walls[i];
      sx = w.x - cam.x;
      sy = w.y - cam.y;
      if (sx + w.w < -8 || sy + w.h < -8 || sx > W + 8 || sy > H + 8) continue;
      Sprites.drawWall(ctx, sx, sy, w.w, w.h);
    }

    for (i = 0; i < doors.length; i++) {
      d = doors[i];
      Sprites.drawDoor(ctx, d.x - cam.x, d.y - cam.y, d.w, d.h, levelClear);
    }

    for (i = 0; i < pickups.length; i++) {
      p = pickups[i];
      sx = p.x - cam.x;
      sy = p.y - cam.y + Math.sin(frame * 0.15 + i) * 4;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(frame * 0.06);
      ctx.fillStyle = WEAPONS[p.weapon] ? WEAPONS[p.weapon].color : "#fff";
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 10;
      ctx.fillRect(-7, -7, 14, 14);
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    for (i = 0; i < trails.length; i++) {
      t = trails[i];
      if (t.life <= 0) continue;
      m = MASKS[t.m || 0];
      Sprites.drawChar(ctx, t.x - cam.x, t.y - cam.y, t.a, {
        col: m, eye: m.eye, walk: 0, atkT: 0, weapon: null,
        alpha: (t.life / 10) * 0.3, scale: 0.95
      });
    }

    for (i = 0; i < enemies.length; i++) {
      e = enemies[i];
      if (!e.alive) {
        if (e.deadT > 0) {
          Sprites.drawChar(ctx, e.x - cam.x, e.y - cam.y, e.angle, {
            col: { body: "#666", jacket: "#444", mask: "#222", accent: "#333" },
            eye: "#400", walk: 0, weapon: null, alpha: e.deadT / 22, scale: 1
          });
        }
        continue;
      }
      Sprites.drawChar(ctx, e.x - cam.x, e.y - cam.y, e.angle, {
        col: {
          body: "#d0a090",
          jacket: e.type === "shooter" ? "#a02028" : "#701818",
          mask: "#1a1010",
          accent: "#c04040"
        },
        eye: e.alert > 0 ? "#ff286e" : "#ff8866",
        walk: e.walk, atkT: e.atkT, weapon: e.weapon, flash: e.hitFlash
      });
      if (e.alert > 0) {
        ctx.fillStyle = "#ff286e";
        ctx.font = "bold 16px system-ui";
        ctx.textAlign = "center";
        ctx.shadowColor = "#ff286e";
        ctx.shadowBlur = 8;
        ctx.fillText("!", e.x - cam.x, e.y - cam.y - 24);
        ctx.shadowBlur = 0;
      }
    }

    if (player && player.alive) {
      m = MASKS[maskId];
      var alpha = (player.inv > 0 && (player.inv & 2)) ? 0.35 : 1;
      Sprites.drawChar(ctx, player.x - cam.x, player.y - cam.y, player.angle, {
        col: m, eye: m.eye, walk: player.walk, atkT: player.atkT,
        weapon: player.weapon, alpha: alpha
      });
      if (player.muzzle > 0) {
        var mx = player.x - cam.x + Math.cos(player.angle) * 30;
        var my = player.y - cam.y + Math.sin(player.angle) * 30;
        ctx.fillStyle = "#fff8a0";
        ctx.shadowColor = "#ffaa00";
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(mx, my, 4 + player.muzzle, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      ctx.strokeStyle = "rgba(0,245,255,0.35)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(player.x - cam.x + Math.cos(player.angle) * 20, player.y - cam.y + Math.sin(player.angle) * 20);
      ctx.lineTo(player.x - cam.x + Math.cos(player.angle) * 40, player.y - cam.y + Math.sin(player.angle) * 40);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    for (i = 0; i < bullets.length; i++) {
      b = bullets[i];
      ctx.fillStyle = b.color;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(b.x - cam.x, b.y - cam.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      ctx.arc(b.x - cam.x - b.vx * 0.8, b.y - cam.y - b.vy * 0.8, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    }

    for (i = 0; i < particles.length; i++) {
      p = particles[i];
      ctx.globalAlpha = p.life / 18;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - cam.x, p.y - cam.y, p.s, p.s);
    }
    ctx.globalAlpha = 1;
  }

  function loop() {
    try {
      update();
      draw();
    } catch (err) {
      console.error(err);
    }
    requestAnimationFrame(loop);
  }
  loop();
})();
