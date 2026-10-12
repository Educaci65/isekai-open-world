(function () {
  "use strict";
  var canvas = document.getElementById("c");
  var ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  var W = 0, H = 0, dpr = 1, frame = 0;
  var TILE = 48;
  var keys = { x: 0, y: 0 };
  var joyId = null, joyOX = 0, joyOY = 0;
  var running = false, dead = false, levelClear = false, shake = 0;
  var score = 0, combo = 1, comboTimer = 0, kills = 0, levelIndex = 0, maskId = 0;
  var walls = [], enemies = [], doors = [], pickups = [], bullets = [], particles = [], blood = [], trails = [], dust = [];
  var player = null;
  var storyMode = false, storyLines = [], storyIdx = 0;
  var MASKS = Sprites.MASKS;
  var WEAPONS = Sprites.WEAPONS;

  var STORY = {
    intro: [
      "NOCHE 1 — DISTRITO NEON",
      "Te despertaste sin memoria.",
      "Solo una mascara... y una mision.",
      "Limpia el edificio. No dejes testigos.",
      "Escondete en las puertas si te descubren."
    ],
    levels: [
      ["SECTOR 01 — LOBBY", "La recepcion esta vigilada.", "Entra. Elimina. Avanza."],
      ["SECTOR 02 — PASILLOS", "Escuchas radios de guardias.", "Usa las puertas para ocultarte."],
      ["SECTOR 03 — ALMACEN", "Armas escondidas entre cajas.", "No dispares a ciegas."],
      ["SECTOR 04 — CLUB", "Musica, luces, sangre.", "El jefe esta cerca."],
      ["SECTOR 05 — FINAL", "Ultima planta.", "Termina lo que empezaste."]
    ],
    ending: [
      "EDIFICIO LIMPIO.",
      "La mascara sigue ahi.",
      "Manana... otro distrito.",
      "NEON RUSH — FIN"
    ]
  };

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
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
      var tag = w ? (w.name + (w.type === "gun" ? " · " + player.ammo : "")) : "BAT";
      if (player.hiding) tag = "HIDDEN";
      document.getElementById("weaponTag").textContent = tag;
    }
  }

  var LEVELS = [
    { name: "LOBBY", map: ["##############","#P...........#","#..###.......#","#..#.#...E...#","#..#H#.......#","#..#.#####...#","#..........E.#","#...E........#","#......###...#","#..S...#H#...#","#......#.....#","#...E........#","#..........D.#","##############"]},
    { name: "HALLS", map: ["##################","#P...............#","#.####.####.####.#","#.#..#.#H.#.#..#.#","#.#E.#.#S.#.#E.#.#","#.#..#.#..#.#..#.#","#....E.....E.....#","#.####.####.####.#","#................#","#..E...S...E.....#","#.......H......D.#","##################"]},
    { name: "STORAGE", map: ["####################","#P.................#","#..##..##..##......#","#..##..##..##......#","#.......E..........#","#..E.........S.....#","#......####........#","#......#H.#...E....#","#..S...#..#........#","#......####........#","#..............E...#","#..E.....S....H....#","#................D.#","####################"]},
    { name: "CLUB", map: ["######################","#P....................#","#..##.E.##.E.##.S.....#","#..##...##...##.......#","#.....................#","#.S...#######...E.....#","#.....#..H..#.........#","#..E..#..S..#.....E...#","#.....#.....#.........#","#.....#######...S.....#","#.....................#","#..##...##.E.##...H...#","#..##.E.##...##.....D.#","######################"]},
    { name: "FINALE", map: ["########################","#P......................#","#..##.E.##.E.##.S.##....#","#..##...##...##...##....#","#.......................#","#.S...#########...E.....#","#.....#...H...#.........#","#..E..#...S...#......E..#","#.....#.......#.........#","#.....#########...S.....#","#.......................#","#..##...##.S.##...##.H..#","#..##.E.##...##.E.##..D.#","########################"]}
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
        else if (c === "D") doors.push({ x: wx, y: wy, w: TILE, h: TILE, exit: true, hideSpot: false });
        else if (c === "H") doors.push({ x: wx, y: wy, w: TILE, h: TILE, exit: false, hideSpot: true });
      }
    }
    if (idx >= 1) pickups.push({ x: spawn.x + TILE * 2, y: spawn.y, weapon: "pistol", ammo: 10 });
    player = {
      x: spawn.x, y: spawn.y, r: 14, speed: 3.6,
      weapon: "bat", ammo: 0, atkCd: 0, atkT: 0,
      dashCd: 0, dashT: 0, vx: 0, vy: 0,
      alive: true, inv: 0, walk: 0, angle: 0, muzzle: 0,
      hiding: false, hideDoor: null
    };
    dead = false; levelClear = false; combo = 1; comboTimer = 0; shake = 0;
    updateHUD();
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
        if (o.hideSpot) continue;
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

  function nearestHideDoor() {
    if (!player) return null;
    var best = null, bestD = 36, i, d, dd;
    for (i = 0; i < doors.length; i++) {
      d = doors[i];
      if (!d.hideSpot) continue;
      dd = dist(player.x, player.y, d.x + d.w / 2, d.y + d.h / 2);
      if (dd < bestD) { bestD = dd; best = d; }
    }
    return best;
  }

  function toggleHide() {
    if (!player || !player.alive || player.dashT > 0) return;
    if (player.hiding) {
      player.hiding = false;
      player.hideDoor = null;
      player.inv = 8;
      showMsg("SALISTE", "", 800);
      updateHUD();
      return;
    }
    var d = nearestHideDoor();
    if (!d) {
      showMsg("SIN CUBIERTA", "Acercate a una puerta HIDE", 1200);
      return;
    }
    player.hiding = true;
    player.hideDoor = d;
    player.x = d.x + d.w / 2;
    player.y = d.y + d.h / 2;
    player.vx = 0; player.vy = 0;
    showMsg("ESCONDIDO", "Toca HIT para salir", 1200);
    updateHUD();
  }

  function sprayBlood(x, y, n) {
    var i, a, sp;
    for (i = 0; i < (n || 14); i++) {
      a = Math.random() * 6.28;
      sp = 1.5 + Math.random() * 5;
      blood.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 35 + Math.random() * 25, s: 2 + Math.random() * 3 });
    }
  }

  function spawnDust(x, y) {
    dust.push({ x: x + (Math.random() - 0.5) * 8, y: y + (Math.random() - 0.5) * 8, life: 12 + Math.random() * 8, s: 2 + Math.random() * 2 });
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
    sprayBlood(e.x, e.y, 16);
    var i;
    for (i = 0; i < 6; i++) {
      particles.push({ x: e.x, y: e.y, vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 6, life: 16, color: "#ff286e", s: 2 });
    }
    if (e.weapon !== "bat") pickups.push({ x: e.x, y: e.y, weapon: e.weapon, ammo: e.ammo || 8 });
    updateHUD();
    var left = 0;
    for (i = 0; i < enemies.length; i++) if (enemies[i].alive) left++;
    if (left === 0) {
      levelClear = true;
      score += 500;
      showMsg("CLEAR", "Ve a la puerta EXIT", 2500);
      updateHUD();
    }
  }

  function doMelee() {
    if (!player || !player.alive || player.atkCd > 0 || player.dashT > 0) return;
    if (player.hiding) { toggleHide(); return; }
    var melee = WEAPONS[player.weapon] && WEAPONS[player.weapon].type === "melee" ? WEAPONS[player.weapon] : WEAPONS.bat;
    player.atkCd = melee.cd;
    player.atkT = 12;
    var i, e, d, diff, any = false;
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
        any = true;
      }
    }
    if (!any) {
      var hd = nearestHideDoor();
      if (hd) toggleHide();
    }
  }

  function doShoot() {
    if (!player || !player.alive || player.atkCd > 0 || player.dashT > 0 || player.hiding) return;
    var w = WEAPONS[player.weapon];
    if (!w || w.type !== "gun") { doMelee(); return; }
    if (player.ammo <= 0) { showMsg("SIN BALAS", "", 1000); return; }
    player.atkCd = w.cd;
    player.atkT = 6;
    player.ammo--;
    player.muzzle = 5;
    var n = w.pellets || 1, i, a;
    for (i = 0; i < n; i++) {
      a = player.angle + (Math.random() - 0.5) * (w.spread || 0.04) * 2;
      bullets.push({
        x: player.x + Math.cos(a) * 16,
        y: player.y + Math.sin(a) * 16,
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
    if (!player || !player.alive || player.dashCd > 0 || player.dashT > 0 || player.hiding) return;
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
    if (len > 8 && player && !player.hiding) player.angle = Math.atan2(dy, dx);
  }

  joyZone.addEventListener("touchstart", function (e) {
    e.preventDefault();
    if (storyMode) { advanceStory(); return; }
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
    el.addEventListener("touchstart", function (e) {
      e.preventDefault();
      if (storyMode) { advanceStory(); return; }
      fn();
    }, { passive: false });
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

  function startStory(lines, onDone) {
    storyMode = true;
    storyLines = lines;
    storyIdx = 0;
    storyMode._onDone = onDone;
    showStoryLine();
  }

  function showStoryLine() {
    if (storyIdx >= storyLines.length) {
      storyMode = false;
      document.getElementById("mainMsg").classList.remove("show");
      document.getElementById("subMsg").classList.remove("show");
      if (storyMode._onDone) storyMode._onDone();
      return;
    }
    var line = storyLines[storyIdx];
    var a = document.getElementById("mainMsg");
    var b = document.getElementById("subMsg");
    a.textContent = line;
    b.textContent = storyIdx < storyLines.length - 1 ? "toca para continuar" : "toca para empezar";
    a.classList.add("show");
    b.classList.add("show");
  }

  function advanceStory() {
    if (!storyMode) return;
    storyIdx++;
    showStoryLine();
  }

  function startGame() {
    document.getElementById("overlay").classList.add("hidden");
    levelIndex = 0;
    score = 0;
    kills = 0;
    startStory(STORY.intro, function () {
      buildLevel(0);
      startStory(STORY.levels[0], function () {
        running = true;
      });
    });
  }

  document.getElementById("btnStart").addEventListener("touchstart", function (e) {
    e.preventDefault();
    if (storyMode) { advanceStory(); return; }
    startGame();
  }, { passive: false });

  document.getElementById("btnStart").addEventListener("click", function () {
    if (storyMode) { advanceStory(); return; }
    if (dead) {
      document.getElementById("overlay").classList.add("hidden");
      document.getElementById("btnStart").textContent = "JUGAR";
      document.querySelector("#overlay h1").textContent = "NEON RUSH";
      buildLevel(levelIndex);
      running = true;
      dead = false;
    } else startGame();
  });

  canvas.addEventListener("touchstart", function (e) {
    if (storyMode) {
      e.preventDefault();
      advanceStory();
    }
  }, { passive: false });

  function die() {
    if (dead || !player || !player.alive) return;
    if (player.hiding) return;
    player.alive = false;
    dead = true;
    running = false;
    sprayBlood(player.x, player.y, 24);
    shake = 14;
    showMsg("WASTED", "", 1500);
    setTimeout(function () {
      var ov = document.getElementById("overlay");
      ov.classList.remove("hidden");
      ov.querySelector("h1").textContent = "WASTED";
      ov.querySelector(".tag").textContent = "SECTOR " + String(levelIndex + 1).padStart(2, "0");
      ov.querySelector("p").innerHTML = "Score " + (score | 0) + " · Kills " + kills + "<br>Las puertas HIDE te protegen";
      document.getElementById("btnStart").textContent = "REINTENTAR";
    }, 600);
  }

  function nextLevel() {
    levelIndex++;
    if (levelIndex >= LEVELS.length) {
      running = false;
      startStory(STORY.ending, function () {
        var ov = document.getElementById("overlay");
        ov.classList.remove("hidden");
        ov.querySelector("h1").textContent = "COMPLETADO";
        ov.querySelector("p").innerHTML = "Score " + (score | 0);
        document.getElementById("btnStart").textContent = "OTRA VEZ";
      });
      return;
    }
    buildLevel(levelIndex);
    startStory(STORY.levels[levelIndex] || ["SECTOR " + (levelIndex + 1)], function () {
      running = true;
    });
  }

  function update() {
    if (storyMode || !running || !player || !player.alive) return;
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

    if (player.hiding) {
      if (player.hideDoor) {
        player.x = player.hideDoor.x + player.hideDoor.w / 2;
        player.y = player.hideDoor.y + player.hideDoor.h / 2;
      }
    } else if (player.dashT > 0) {
      player.dashT--;
      tryMove(player, player.vx, player.vy);
      player.walk += 0.55;
      trails.push({ x: player.x, y: player.y, a: player.angle, life: 8, m: maskId });
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
    if (trails.length > 14) trails.shift();

    var i, p, e, d, a, canSee, j, b, w;
    for (i = trails.length - 1; i >= 0; i--) {
      trails[i].life--;
      if (trails[i].life <= 0) trails.splice(i, 1);
    }
    for (i = dust.length - 1; i >= 0; i--) {
      dust[i].life--;
      if (dust[i].life <= 0) dust.splice(i, 1);
    }

    if (!player.hiding) {
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
    }

    if (levelClear && !player.hiding) {
      for (i = 0; i < doors.length; i++) {
        if (!doors[i].exit) continue;
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
      canSee = !player.hiding && d < 220 && !lineBlocked(e.x, e.y, player.x, player.y);
      if (canSee) e.alert = 120;
      if (e.alert > 0) e.alert--;

      if ((e.alert > 0 || canSee) && !player.hiding) {
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
      } else if (!player.hiding && player.inv <= 0 && Math.hypot(b.x - player.x, b.y - player.y) < player.r + 2) {
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
    return { x: Math.round(cx), y: Math.round(cy) };
  }

  function draw() {
    var cam = getCam();
    var i, sx, sy, e, b, p, d, t, m;

    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#0a0a12";
    ctx.fillRect(0, 0, W, H);

    var ts = TILE, tx, ty;
    var x0 = Math.floor(cam.x / ts) - 1, y0 = Math.floor(cam.y / ts) - 1;
    var x1 = Math.ceil((cam.x + W) / ts) + 1, y1 = Math.ceil((cam.y + H) / ts) + 1;
    for (ty = y0; ty <= y1; ty++) {
      for (tx = x0; tx <= x1; tx++) {
        ctx.fillStyle = ((tx + ty) & 1) ? "#12121c" : "#0e0e16";
        ctx.fillRect(tx * ts - cam.x, ty * ts - cam.y, ts, ts);
      }
    }

    for (i = 0; i < dust.length; i++) {
      p = dust[i];
      ctx.globalAlpha = (p.life / 16) * 0.3;
      ctx.fillStyle = "#666";
      ctx.fillRect(Math.round(p.x - cam.x), Math.round(p.y - cam.y), 2, 2);
    }
    for (i = 0; i < blood.length; i++) {
      p = blood[i];
      ctx.globalAlpha = clamp(p.life / 40, 0.15, 0.7);
      ctx.fillStyle = "#8b0018";
      ctx.fillRect(Math.round(p.x - cam.x), Math.round(p.y - cam.y), Math.max(2, p.s | 0), Math.max(2, p.s | 0));
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
      sx = d.x - cam.x;
      sy = d.y - cam.y;
      if (d.exit) {
        Sprites.drawDoor(ctx, sx, sy, d.w, d.h, levelClear, false);
      } else {
        var near = player && dist(player.x, player.y, d.x + d.w / 2, d.y + d.h / 2) < 40;
        Sprites.drawDoor(ctx, sx, sy, d.w, d.h, false, near && !player.hiding);
      }
    }

    for (i = 0; i < pickups.length; i++) {
      p = pickups[i];
      sx = Math.round(p.x - cam.x);
      sy = Math.round(p.y - cam.y + Math.sin(frame * 0.12 + i) * 3);
      ctx.fillStyle = WEAPONS[p.weapon] ? WEAPONS[p.weapon].color : "#fff";
      ctx.fillRect(sx - 5, sy - 5, 10, 10);
      ctx.fillStyle = "#0a0a12";
      ctx.fillRect(sx - 3, sy - 3, 6, 6);
    }

    for (i = 0; i < trails.length; i++) {
      t = trails[i];
      if (t.life <= 0) continue;
      m = MASKS[t.m || 0];
      Sprites.drawChar(ctx, t.x - cam.x, t.y - cam.y, t.a, {
        col: m, eye: m.eye, walk: 0, atkT: 0, weapon: null,
        alpha: (t.life / 8) * 0.25, pixelScale: 2
      });
    }

    for (i = 0; i < enemies.length; i++) {
      e = enemies[i];
      if (!e.alive) {
        if (e.deadT > 0) {
          Sprites.drawChar(ctx, e.x - cam.x, e.y - cam.y, e.angle, {
            col: { body: "#555", jacket: "#333", mask: "#222", accent: "#222", shoe: "#111" },
            eye: "#400", walk: 0, weapon: null, alpha: e.deadT / 22, pixelScale: 2
          });
        }
        continue;
      }
      Sprites.drawChar(ctx, e.x - cam.x, e.y - cam.y, e.angle, {
        col: {
          body: "#c8a090",
          jacket: e.type === "shooter" ? "#a02028" : "#701818",
          mask: "#1a1010",
          accent: "#c04040",
          shoe: "#0a0a10"
        },
        eye: e.alert > 0 ? "#ff286e" : "#ff8866",
        walk: e.walk, atkT: e.atkT, weapon: e.weapon, flash: e.hitFlash, pixelScale: 2
      });
      if (e.alert > 0 && !player.hiding) {
        ctx.fillStyle = "#ff286e";
        ctx.font = "bold 14px monospace";
        ctx.textAlign = "center";
        ctx.fillText("!", Math.round(e.x - cam.x), Math.round(e.y - cam.y - 20));
      }
    }

    if (player && player.alive) {
      m = MASKS[maskId];
      var alpha = (player.inv > 0 && (player.inv & 2)) ? 0.35 : 1;
      Sprites.drawChar(ctx, player.x - cam.x, player.y - cam.y, player.angle, {
        col: m, eye: m.eye, walk: player.walk, atkT: player.atkT,
        weapon: player.weapon, alpha: alpha, hide: player.hiding, pixelScale: 2
      });
      if (player.muzzle > 0 && !player.hiding) {
        var mx = Math.round(player.x - cam.x + Math.cos(player.angle) * 28);
        var my = Math.round(player.y - cam.y + Math.sin(player.angle) * 28);
        ctx.fillStyle = "#fff8a0";
        ctx.fillRect(mx - 3, my - 3, 6, 6);
      }
    }

    for (i = 0; i < bullets.length; i++) {
      b = bullets[i];
      ctx.fillStyle = b.color;
      ctx.fillRect(Math.round(b.x - cam.x) - 2, Math.round(b.y - cam.y) - 2, 4, 4);
    }

    for (i = 0; i < particles.length; i++) {
      p = particles[i];
      ctx.globalAlpha = p.life / 16;
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x - cam.x), Math.round(p.y - cam.y), 2, 2);
    }
    ctx.globalAlpha = 1;

    if (storyMode) {
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(0, 0, W, H);
    }
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
