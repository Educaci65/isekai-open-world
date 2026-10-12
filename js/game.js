(function () {
  "use strict";
  var canvas = document.getElementById("c");
  var ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  var W = 0, H = 0, dpr = 1, frame = 0;
  var TILE = 48;
  var keys = { x: 0, y: 0 };
  var running = false, dead = false, levelClear = false, shake = 0;
  var score = 0, combo = 1, comboTimer = 0, kills = 0, levelIndex = 0, maskId = 0;
  var walls = [], enemies = [], doors = [], pickups = [], bullets = [], particles = [], blood = [], trails = [], dust = [];
  var player = null;
  var storyMode = false, storyLines = [], storyIdx = 0;
  var activeTouch = null, joyOX = 0, joyOY = 0;

  var MASKS = (window.Sprites && Sprites.MASKS) || [
    { body: "#e8e0f0", jacket: "#ff286e", eye: "#00f5ff", mask: "#1a1520", accent: "#ff6b9d", shoe: "#0a0a10" }
  ];
  var WEAPONS = (window.Sprites && Sprites.WEAPONS) || {
    bat: { name: "BAT", type: "melee", range: 48, arc: 1.7, cd: 12, color: "#ff286e", len: 9 },
    pistol: { name: "PISTOL", type: "gun", range: 320, cd: 14, ammo: 10, color: "#ffcc00", spread: 0.03, spd: 12, len: 6 }
  };

  var STORY = {
    intro: ["DISTRITO NEON", "Un golpe = muerte. Arrastra a la izquierda para moverte."],
    levels: [
      ["SECTOR 01", "Elimina a todos. Busca EXIT."],
      ["SECTOR 02", "Usa puertas HIDE."],
      ["SECTOR 03", "Hay armas."],
      ["SECTOR 04", "Casi al final."],
      ["SECTOR 05", "Ultima planta."]
    ],
    ending: ["EDIFICIO LIMPIO. FIN"]
  };

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth || 360;
    H = window.innerHeight || 640;
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
    var a = document.getElementById("mainMsg");
    var b = document.getElementById("subMsg");
    if (!a || !b) return;
    a.textContent = t || "";
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
    try {
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
    } catch (e) {}
  }

  var LEVELS = [
    { map: ["##############","#P...........#","#..###.......#","#..#.#...E...#","#..#H#.......#","#..#.#####...#","#..........E.#","#...E........#","#......###...#","#..S...#H#...#","#......#.....#","#...E........#","#..........D.#","##############"] },
    { map: ["##################","#P...............#","#.####.####.####.#","#.#..#.#H.#.#..#.#","#.#E.#.#S.#.#E.#.#","#.#..#.#..#.#..#.#","#....E.....E.....#","#.####.####.####.#","#................#","#..E...S...E.....#","#.......H......D.#","##################"] },
    { map: ["####################","#P.................#","#..##..##..##......#","#.......E..........#","#..E.........S.....#","#......####........#","#......#H.#...E....#","#..S...#..#........#","#......####........#","#..............E...#","#..E.....S....H....#","#................D.#","####################"] },
    { map: ["######################","#P....................#","#..##.E.##.E.##.S.....#","#.....................#","#.S...#######...E.....#","#.....#..H..#.........#","#..E..#..S..#.....E...#","#.....#######...S.....#","#.....................#","#..##...##.E.##...H...#","#..##.E.##...##.....D.#","######################"] },
    { map: ["########################","#P......................#","#..##.E.##.E.##.S.##....#","#.......................#","#.S...#########...E.....#","#.....#...H...#.........#","#..E..#...S...#......E..#","#.....#########...S.....#","#.......................#","#..##...##.S.##...##.H..#","#..##.E.##...##.E.##..D.#","########################"] }
  ];

  function makeEnemy(x, y, type) {
    return {
      x: x, y: y, r: 14, type: type || "melee", alive: true,
      speed: type === "shooter" ? 1.4 : 1.9,
      timer: 30 + Math.random() * 40, px: x, py: y, cd: 0,
      weapon: type === "shooter" ? "pistol" : "bat",
      ammo: type === "shooter" ? 12 : 0,
      alert: 0, angle: 0, walk: 0, atkT: 0, hitFlash: 0, deadT: 0
    };
  }

  function buildLevel(idx) {
    walls = []; enemies = []; doors = []; pickups = [];
    bullets = []; particles = []; blood = []; trails = []; dust = [];
    var map = LEVELS[idx % LEVELS.length].map;
    var spawn = { x: TILE * 1.5, y: TILE * 1.5 };
    for (var y = 0; y < map.length; y++) {
      for (var x = 0; x < map[y].length; x++) {
        var c = map[y].charAt(x);
        var wx = x * TILE, wy = y * TILE;
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
      x: spawn.x, y: spawn.y, r: 13, speed: 4.0,
      weapon: "bat", ammo: 0, atkCd: 0, atkT: 0,
      dashCd: 0, dashT: 0, vx: 0, vy: 0,
      alive: true, inv: 0, walk: 0, angle: 0, muzzle: 0,
      hiding: false, hideDoor: null
    };
    dead = false; levelClear = false; combo = 1; comboTimer = 0; shake = 0;
    updateHUD();
  }

  function solidCircle(x, y, r) {
    for (var i = 0; i < walls.length; i++) {
      var o = walls[i];
      var cx = clamp(x, o.x, o.x + o.w);
      var cy = clamp(y, o.y, o.y + o.h);
      if (Math.hypot(x - cx, y - cy) < r) return true;
    }
    if (!levelClear) {
      for (var i = 0; i < doors.length; i++) {
        var o = doors[i];
        if (o.hideSpot) continue;
        var cx = clamp(x, o.x, o.x + o.w);
        var cy = clamp(y, o.y, o.y + o.h);
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
    for (var i = 1; i <= steps; i++) {
      var t = i / steps;
      var x = x1 + (x2 - x1) * t;
      var y = y1 + (y2 - y1) * t;
      for (var j = 0; j < walls.length; j++) {
        var w = walls[j];
        if (x > w.x && x < w.x + w.w && y > w.y && y < w.y + w.h) return true;
      }
    }
    return false;
  }

  function nearestHideDoor() {
    if (!player) return null;
    var best = null, bestD = 42;
    for (var i = 0; i < doors.length; i++) {
      var d = doors[i];
      if (!d.hideSpot) continue;
      var dd = dist(player.x, player.y, d.x + d.w / 2, d.y + d.h / 2);
      if (dd < bestD) { bestD = dd; best = d; }
    }
    return best;
  }

  function toggleHide() {
    if (!player || !player.alive || player.dashT > 0) return;
    if (player.hiding) {
      player.hiding = false;
      player.hideDoor = null;
      player.inv = 12;
      showMsg("SALISTE", "", 800);
      updateHUD();
      return;
    }
    var d = nearestHideDoor();
    if (!d) {
      showMsg("SIN CUBIERTA", "Acercate a una puerta HIDE", 1400);
      return;
    }
    player.hiding = true;
    player.hideDoor = d;
    player.x = d.x + d.w / 2;
    player.y = d.y + d.h / 2;
    player.vx = 0; player.vy = 0;
    showMsg("ESCONDIDO", "HIT para salir", 1400);
    updateHUD();
  }

  function sprayBlood(x, y, n) {
    for (var i = 0; i < (n || 12); i++) {
      var a = Math.random() * 6.28, sp = 1.5 + Math.random() * 5;
      blood.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 30 + Math.random() * 20, s: 2 + Math.random() * 3 });
    }
  }

  function killEnemy(e) {
    if (!e || !e.alive) return;
    e.alive = false;
    e.deadT = 20;
    kills++;
    comboTimer = 90;
    combo = Math.min(combo + 1, 15);
    score += 100 * combo;
    shake = 8;
    sprayBlood(e.x, e.y, 14);
    for (var i = 0; i < 5; i++) {
      particles.push({ x: e.x, y: e.y, vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 6, life: 14, color: "#ff286e", s: 3 });
    }
    if (e.weapon !== "bat") pickups.push({ x: e.x, y: e.y, weapon: e.weapon, ammo: e.ammo || 8 });
    updateHUD();
    var left = 0;
    for (var i = 0; i < enemies.length; i++) if (enemies[i].alive) left++;
    if (left === 0) {
      levelClear = true;
      score += 500;
      showMsg("CLEAR", "Ve a EXIT", 2500);
      updateHUD();
    }
  }

  function doMelee() {
    if (!player || !player.alive || player.atkCd > 0 || player.dashT > 0) return;
    if (player.hiding) { toggleHide(); return; }
    var melee = (WEAPONS[player.weapon] && WEAPONS[player.weapon].type === "melee") ? WEAPONS[player.weapon] : WEAPONS.bat;
    player.atkCd = melee.cd;
    player.atkT = 12;
    var any = false;
    for (var i = 0; i < enemies.length; i++) {
      var e = enemies[i];
      if (!e.alive) continue;
      var d = dist(player.x, player.y, e.x, e.y);
      if (d > melee.range + e.r) continue;
      var diff = Math.atan2(e.y - player.y, e.x - player.x) - player.angle;
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
    if (player.ammo <= 0) { showMsg("SIN BALAS", "", 900); return; }
    player.atkCd = w.cd;
    player.atkT = 6;
    player.ammo--;
    player.muzzle = 5;
    var n = w.pellets || 1;
    for (var i = 0; i < n; i++) {
      var a = player.angle + (Math.random() - 0.5) * (w.spread || 0.04) * 2;
      bullets.push({
        x: player.x + Math.cos(a) * 18, y: player.y + Math.sin(a) * 18,
        vx: Math.cos(a) * w.spd, vy: Math.sin(a) * w.spd,
        life: Math.ceil(w.range / w.spd), from: "player", color: w.color
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
    player.vx = (dx / len) * 12;
    player.vy = (dy / len) * 12;
    player.dashT = 11;
    player.dashCd = 36;
    player.inv = 14;
  }

  var joyKnob = document.getElementById("joyKnob");
  var JOY_R = 60;

  function setKeysFromDelta(dx, dy) {
    var len = Math.hypot(dx, dy) || 1;
    var cl = Math.min(len, JOY_R);
    var jx = (dx / len) * cl;
    var jy = (dy / len) * cl;
    keys.x = jx / JOY_R;
    keys.y = jy / JOY_R;
    if (joyKnob) {
      joyKnob.style.transform = "translate(calc(-50% + " + jx + "px), calc(-50% + " + jy + "px))";
    }
    if (len > 8 && player && !player.hiding) {
      player.angle = Math.atan2(dy, dx);
    }
  }

  function clearKeys() {
    keys.x = 0;
    keys.y = 0;
    activeTouch = null;
    if (joyKnob) joyKnob.style.transform = "translate(-50%,-50%)";
  }

  document.addEventListener("touchstart", function (e) {
    if (storyMode) {
      e.preventDefault();
      advanceStory();
      return;
    }
    for (var i = 0; i < e.changedTouches.length; i++) {
      var t = e.changedTouches[i];
      if (t.clientX > W * 0.58) continue;
      if (activeTouch === null) {
        activeTouch = t.identifier;
        joyOX = t.clientX;
        joyOY = t.clientY;
        setKeysFromDelta(0, 0);
        e.preventDefault();
      }
    }
  }, { passive: false });

  document.addEventListener("touchmove", function (e) {
    if (activeTouch === null || storyMode) return;
    for (var i = 0; i < e.changedTouches.length; i++) {
      var t = e.changedTouches[i];
      if (t.identifier === activeTouch) {
        setKeysFromDelta(t.clientX - joyOX, t.clientY - joyOY);
        e.preventDefault();
        break;
      }
    }
  }, { passive: false });

  function onTouchEnd(e) {
    for (var i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === activeTouch) {
        clearKeys();
        break;
      }
    }
  }
  document.addEventListener("touchend", onTouchEnd, { passive: false });
  document.addEventListener("touchcancel", onTouchEnd, { passive: false });

  function bindBtn(id, fn) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("touchstart", function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (storyMode) { advanceStory(); return; }
      fn();
    }, { passive: false });
    el.addEventListener("mousedown", function (e) {
      e.preventDefault();
      if (storyMode) { advanceStory(); return; }
      fn();
    });
  }
  bindBtn("btnHit", doMelee);
  bindBtn("btnFire", doShoot);
  bindBtn("btnDash", doDash);

  document.querySelectorAll(".mask").forEach(function (el) {
    el.addEventListener("touchstart", function (e) {
      e.preventDefault();
      document.querySelectorAll(".mask").forEach(function (m) { m.classList.remove("on"); });
      el.classList.add("on");
      maskId = +el.getAttribute("data-m") || 0;
    }, { passive: false });
  });

  function startStory(lines, onDone) {
    storyMode = true;
    storyLines = lines || [];
    storyIdx = 0;
    storyMode._onDone = onDone;
    showStoryLine();
  }
  function showStoryLine() {
    if (storyIdx >= storyLines.length) {
      storyMode = false;
      var a = document.getElementById("mainMsg");
      var b = document.getElementById("subMsg");
      if (a) a.classList.remove("show");
      if (b) b.classList.remove("show");
      clearKeys();
      if (storyMode._onDone) storyMode._onDone();
      return;
    }
    var a = document.getElementById("mainMsg");
    var b = document.getElementById("subMsg");
    if (a) { a.textContent = storyLines[storyIdx]; a.classList.add("show"); }
    if (b) {
      b.textContent = storyIdx < storyLines.length - 1 ? "toca para continuar" : "toca para jugar";
      b.classList.add("show");
    }
  }
  function advanceStory() {
    if (!storyMode) return;
    storyIdx++;
    showStoryLine();
  }

  function startGame() {
    var ov = document.getElementById("overlay");
    if (ov) ov.classList.add("hidden");
    levelIndex = 0;
    score = 0;
    kills = 0;
    clearKeys();
    buildLevel(0);
    startStory(STORY.intro, function () {
      running = true;
      clearKeys();
      showMsg("ARRASTRA", "Lado izquierdo de la pantalla", 2200);
    });
  }

  var btnStart = document.getElementById("btnStart");
  if (btnStart) {
    btnStart.addEventListener("touchstart", function (e) {
      e.preventDefault();
      if (storyMode) { advanceStory(); return; }
      startGame();
    }, { passive: false });
    btnStart.addEventListener("click", function () {
      if (storyMode) { advanceStory(); return; }
      if (dead) {
        var ov = document.getElementById("overlay");
        if (ov) ov.classList.add("hidden");
        btnStart.textContent = "JUGAR";
        var h1 = document.querySelector("#overlay h1");
        if (h1) h1.textContent = "NEON RUSH";
        buildLevel(levelIndex);
        running = true;
        dead = false;
        clearKeys();
      } else startGame();
    });
  }

  window.addEventListener("keydown", function (e) {
    if (storyMode) { advanceStory(); return; }
    if (e.key === " " || e.key === "z" || e.key === "Z") { doMelee(); e.preventDefault(); }
    if (e.key === "x" || e.key === "X") { doShoot(); e.preventDefault(); }
    if (e.key === "c" || e.key === "C" || e.key === "Shift") { doDash(); e.preventDefault(); }
    if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") keys.y = -1;
    if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") keys.y = 1;
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") keys.x = -1;
    if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") keys.x = 1;
  });
  window.addEventListener("keyup", function (e) {
    if (e.key === "ArrowUp" || e.key === "w" || e.key === "W" || e.key === "ArrowDown" || e.key === "s" || e.key === "S") keys.y = 0;
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A" || e.key === "ArrowRight" || e.key === "d" || e.key === "D") keys.x = 0;
  });

  function die() {
    if (dead || !player || !player.alive || player.hiding) return;
    player.alive = false;
    dead = true;
    running = false;
    sprayBlood(player.x, player.y, 22);
    shake = 14;
    showMsg("WASTED", "", 1400);
    setTimeout(function () {
      var ov = document.getElementById("overlay");
      if (!ov) return;
      ov.classList.remove("hidden");
      var h1 = ov.querySelector("h1");
      if (h1) h1.textContent = "WASTED";
      var p = ov.querySelector("p");
      if (p) p.innerHTML = "Score " + (score | 0) + " · Kills " + kills + "<br>Usa puertas HIDE";
      if (btnStart) btnStart.textContent = "REINTENTAR";
    }, 700);
  }

  function nextLevel() {
    levelIndex++;
    if (levelIndex >= LEVELS.length) {
      running = false;
      startStory(STORY.ending, function () {
        var ov = document.getElementById("overlay");
        if (!ov) return;
        ov.classList.remove("hidden");
        var h1 = ov.querySelector("h1");
        if (h1) h1.textContent = "COMPLETADO";
        var p = ov.querySelector("p");
        if (p) p.innerHTML = "Score " + (score | 0);
        if (btnStart) btnStart.textContent = "OTRA VEZ";
      });
      return;
    }
    buildLevel(levelIndex);
    startStory(STORY.levels[levelIndex] || ["SECTOR " + (levelIndex + 1)], function () {
      running = true;
      clearKeys();
    });
  }

  function update() {
    if (storyMode || !running || !player || !player.alive) return;
    frame++;
    if (shake > 0) shake *= 0.85;
    if (comboTimer > 0) { comboTimer--; if (comboTimer <= 0) { combo = 1; updateHUD(); } }
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
      tryMove(player, player.vx, 0);
      tryMove(player, 0, player.vy);
      trails.push({ x: player.x, y: player.y, a: player.angle, life: 7, m: maskId });
      if (trails.length > 10) trails.shift();
    } else {
      var mx = keys.x * player.speed;
      var my = keys.y * player.speed;
      if (Math.hypot(mx, my) > 0.08) {
        player.walk += 0.28;
        tryMove(player, mx, 0);
        tryMove(player, 0, my);
      }
    }

    if (levelClear && !player.hiding) {
      for (var i = 0; i < doors.length; i++) {
        var d = doors[i];
        if (d.exit && dist(player.x, player.y, d.x + d.w / 2, d.y + d.h / 2) < 30) {
          nextLevel();
          return;
        }
      }
    }

    for (var i = pickups.length - 1; i >= 0; i--) {
      var p = pickups[i];
      if (dist(player.x, player.y, p.x, p.y) < 24) {
        player.weapon = p.weapon;
        player.ammo = p.ammo || 0;
        showMsg(WEAPONS[p.weapon] ? WEAPONS[p.weapon].name : "ARMA", "", 900);
        pickups.splice(i, 1);
        updateHUD();
      }
    }

    for (var i = 0; i < enemies.length; i++) {
      var e = enemies[i];
      if (!e.alive) { if (e.deadT > 0) e.deadT--; continue; }
      if (e.hitFlash > 0) e.hitFlash--;
      if (e.atkT > 0) e.atkT--;
      if (e.cd > 0) e.cd--;

      var canSee = !player.hiding && dist(e.x, e.y, player.x, player.y) < 230 && !lineBlocked(e.x, e.y, player.x, player.y);
      if (canSee) e.alert = 90;
      if (e.alert > 0) e.alert--;

      if ((e.alert > 0 || canSee) && !player.hiding) {
        var dx = player.x - e.x, dy = player.y - e.y;
        var dlen = Math.hypot(dx, dy) || 1;
        e.angle = Math.atan2(dy, dx);
        if (dlen > 30) {
          tryMove(e, (dx / dlen) * e.speed, 0);
          tryMove(e, 0, (dy / dlen) * e.speed);
          e.walk += 0.2;
        }
        if (e.type === "shooter" && e.cd <= 0 && dlen < 200) {
          e.cd = 42;
          e.atkT = 8;
          var a = e.angle;
          bullets.push({
            x: e.x + Math.cos(a) * 14, y: e.y + Math.sin(a) * 14,
            vx: Math.cos(a) * 7, vy: Math.sin(a) * 7,
            life: 40, from: "enemy", color: "#ff4422"
          });
        } else if (e.type === "melee" && dlen < 28 && e.cd <= 0) {
          e.cd = 26;
          e.atkT = 10;
          if (player.inv <= 0) die();
        }
      } else {
        e.timer--;
        if (e.timer <= 0) {
          e.timer = 40 + Math.random() * 50;
          e.px = e.x + (Math.random() - 0.5) * 90;
          e.py = e.y + (Math.random() - 0.5) * 90;
        }
        var pdx = e.px - e.x, pdy = e.py - e.y;
        var plen = Math.hypot(pdx, pdy);
        if (plen > 6) {
          tryMove(e, (pdx / plen) * e.speed * 0.55, 0);
          tryMove(e, 0, (pdy / plen) * e.speed * 0.55);
          e.angle = Math.atan2(pdy, pdx);
          e.walk += 0.12;
        }
      }
    }

    for (var i = bullets.length - 1; i >= 0; i--) {
      var b = bullets[i];
      b.x += b.vx; b.y += b.vy;
      b.life--;
      if (b.life <= 0 || solidCircle(b.x, b.y, 2)) { bullets.splice(i, 1); continue; }
      if (b.from === "player") {
        for (var j = 0; j < enemies.length; j++) {
          var en = enemies[j];
          if (en.alive && Math.hypot(b.x - en.x, b.y - en.y) < en.r + 3) {
            killEnemy(en);
            en.hitFlash = 6;
            bullets.splice(i, 1);
            break;
          }
        }
      } else if (!player.hiding && player.inv <= 0 && Math.hypot(b.x - player.x, b.y - player.y) < player.r + 3) {
        die();
        bullets.splice(i, 1);
      }
    }

    for (var i = blood.length - 1; i >= 0; i--) {
      var p = blood[i];
      p.x += p.vx; p.y += p.vy; p.vx *= 0.9; p.vy *= 0.9; p.life--;
      if (p.life <= 0) blood.splice(i, 1);
    }
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.x += p.vx; p.y += p.vy; p.life--;
      if (p.life <= 0) particles.splice(i, 1);
    }
    for (var i = trails.length - 1; i >= 0; i--) {
      trails[i].life--;
      if (trails[i].life <= 0) trails.splice(i, 1);
    }
  }

  function getCam() {
    if (!player) return { x: 0, y: 0 };
    var cx = player.x - W / 2;
    var cy = player.y - H / 2;
    if (shake > 0.5) {
      cx += (Math.random() - 0.5) * shake * 2;
      cy += (Math.random() - 0.5) * shake * 2;
    }
    return { x: Math.round(cx), y: Math.round(cy) };
  }

  function draw() {
    var cam = getCam();
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#0a0a12";
    ctx.fillRect(0, 0, W, H);

    var ts = TILE;
    var x0 = Math.floor(cam.x / ts) - 1, y0 = Math.floor(cam.y / ts) - 1;
    var x1 = Math.ceil((cam.x + W) / ts) + 1, y1 = Math.ceil((cam.y + H) / ts) + 1;
    for (var ty = y0; ty <= y1; ty++) {
      for (var tx = x0; tx <= x1; tx++) {
        if (window.Sprites && Sprites.drawFloorTile) {
          Sprites.drawFloorTile(ctx, tx * ts - cam.x, ty * ts - cam.y, ts, (tx + ty) & 1);
        } else {
          ctx.fillStyle = ((tx + ty) & 1) ? "#14141e" : "#101018";
          ctx.fillRect(tx * ts - cam.x, ty * ts - cam.y, ts, ts);
        }
      }
    }

    for (var i = 0; i < blood.length; i++) {
      var p = blood[i];
      ctx.globalAlpha = clamp(p.life / 35, 0.2, 0.75);
      ctx.fillStyle = "#8b0018";
      ctx.fillRect(Math.round(p.x - cam.x), Math.round(p.y - cam.y), Math.max(2, p.s | 0), Math.max(2, p.s | 0));
    }
    ctx.globalAlpha = 1;

    for (var i = 0; i < walls.length; i++) {
      var w = walls[i];
      var sx = w.x - cam.x, sy = w.y - cam.y;
      if (sx + w.w < -8 || sy + w.h < -8 || sx > W + 8 || sy > H + 8) continue;
      if (window.Sprites && Sprites.drawWall) Sprites.drawWall(ctx, sx, sy, w.w, w.h);
      else { ctx.fillStyle = "#1a1a28"; ctx.fillRect(sx, sy, w.w, w.h); }
    }

    for (var i = 0; i < doors.length; i++) {
      var d = doors[i];
      var sx = d.x - cam.x, sy = d.y - cam.y;
      if (window.Sprites && Sprites.drawDoor) {
        if (d.exit) Sprites.drawDoor(ctx, sx, sy, d.w, d.h, levelClear, false);
        else {
          var near = player && dist(player.x, player.y, d.x + d.w / 2, d.y + d.h / 2) < 44;
          Sprites.drawDoor(ctx, sx, sy, d.w, d.h, false, near && player && !player.hiding);
        }
      }
    }

    for (var i = 0; i < pickups.length; i++) {
      var p = pickups[i];
      var sx = Math.round(p.x - cam.x);
      var sy = Math.round(p.y - cam.y + Math.sin(frame * 0.12 + i) * 4);
      ctx.fillStyle = (WEAPONS[p.weapon] && WEAPONS[p.weapon].color) || "#fff";
      ctx.fillRect(sx - 6, sy - 6, 12, 12);
    }

    for (var i = 0; i < trails.length; i++) {
      var t = trails[i];
      if (t.life <= 0) continue;
      if (window.Sprites && Sprites.drawChar) {
        Sprites.drawChar(ctx, t.x - cam.x, t.y - cam.y, t.a, {
          col: MASKS[t.m || 0], alpha: (t.life / 7) * 0.3, pixelScale: 3
        });
      }
    }

    for (var i = 0; i < enemies.length; i++) {
      var e = enemies[i];
      if (!e.alive) {
        if (e.deadT > 0 && window.Sprites && Sprites.drawChar) {
          Sprites.drawChar(ctx, e.x - cam.x, e.y - cam.y, e.angle, {
            col: { body: "#555", jacket: "#333", mask: "#222", accent: "#222", shoe: "#111" },
            eye: "#400", alpha: e.deadT / 20, pixelScale: 3
          });
        }
        continue;
      }
      if (window.Sprites && Sprites.drawChar) {
        Sprites.drawChar(ctx, e.x - cam.x, e.y - cam.y, e.angle, {
          col: { body: "#c8b8b0", jacket: e.type === "shooter" ? "#c04040" : "#a03030", mask: "#1a1010", accent: "#802020", shoe: "#0a0a10" },
          eye: e.alert > 0 ? "#ff286e" : "#ff8866",
          walk: e.walk, atkT: e.atkT, weapon: e.weapon, flash: e.hitFlash, pixelScale: 3
        });
      } else {
        ctx.fillStyle = e.type === "shooter" ? "#c04040" : "#a03030";
        ctx.fillRect(e.x - cam.x - 10, e.y - cam.y - 10, 20, 20);
      }
      if (e.alert > 0 && player && !player.hiding) {
        ctx.fillStyle = "#ff286e";
        ctx.font = "bold 14px monospace";
        ctx.textAlign = "center";
        ctx.fillText("!", e.x - cam.x, e.y - cam.y - 26);
      }
    }

    if (player && player.alive) {
      var alpha = (player.inv > 0 && (player.inv & 2)) ? 0.35 : 1;
      if (window.Sprites && Sprites.drawChar) {
        Sprites.drawChar(ctx, player.x - cam.x, player.y - cam.y, player.angle, {
          col: MASKS[maskId] || MASKS[0],
          eye: (MASKS[maskId] || MASKS[0]).eye,
          walk: player.walk, atkT: player.atkT, weapon: player.weapon,
          alpha: alpha, hide: player.hiding, pixelScale: 3
        });
      } else {
        ctx.fillStyle = "#ff286e";
        ctx.fillRect(player.x - cam.x - 14, player.y - cam.y - 14, 28, 28);
      }
    }

    for (var i = 0; i < bullets.length; i++) {
      var b = bullets[i];
      ctx.fillStyle = b.color || "#fff";
      ctx.fillRect(Math.round(b.x - cam.x - 2), Math.round(b.y - cam.y - 2), 4, 4);
    }
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      ctx.globalAlpha = p.life / 14;
      ctx.fillStyle = p.color || "#ff286e";
      ctx.fillRect(Math.round(p.x - cam.x), Math.round(p.y - cam.y), p.s || 3, p.s || 3);
    }
    ctx.globalAlpha = 1;
  }

  function loop() {
    try { update(); draw(); } catch (err) { console.error(err); }
    requestAnimationFrame(loop);
  }

  buildLevel(0);
  loop();
})();
