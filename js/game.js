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

  var MASKS = (window.Sprites && Sprites.MASKS) || [
    { body: "#e8e0f0", jacket: "#ff286e", eye: "#00f5ff", mask: "#1a1520", accent: "#ff6b9d", shoe: "#0a0a10" }
  ];
  var WEAPONS = (window.Sprites && Sprites.WEAPONS) || {
    bat: { name: "BAT", type: "melee", range: 48, arc: 1.7, cd: 12, color: "#ff286e", len: 9 }
  };

  var STORY = {
    intro: [
      "NOCHE 1 — DISTRITO NEON",
      "Te despertaste sin memoria.",
      "Solo una mascara... y una mision.",
      "Limpia el edificio. No dejes testigos.",
      "Escondete en las puertas HIDE si te descubren."
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
    { name: "LOBBY", map: [
      "##############",
      "#P...........#",
      "#..###.......#",
      "#..#.#...E...#",
      "#..#H#.......#",
      "#..#.#####...#",
      "#..........E.#",
      "#...E........#",
      "#......###...#",
      "#..S...#H#...#",
      "#......#.....#",
      "#...E........#",
      "#..........D.#",
      "##############"
    ]},
    { name: "HALLS", map: [
      "##################",
      "#P...............#",
      "#.####.####.####.#",
      "#.#..#.#H.#.#..#.#",
      "#.#E.#.#S.#.#E.#.#",
      "#.#..#.#..#.#..#.#",
      "#....E.....E.....#",
      "#.####.####.####.#",
      "#................#",
      "#..E...S...E.....#",
      "#.......H......D.#",
      "##################"
    ]},
    { name: "STORAGE", map: [
      "####################",
      "#P.................#",
      "#..##..##..##......#",
      "#..##..##..##......#",
      "#.......E..........#",
      "#..E.........S.....#",
      "#......####........#",
      "#......#H.#...E....#",
      "#..S...#..#........#",
      "#......####........#",
      "#..............E...#",
      "#..E.....S....H....#",
      "#................D.#",
      "####################"
    ]},
    { name: "CLUB", map: [
      "######################",
      "#P....................#",
      "#..##.E.##.E.##.S.....#",
      "#..##...##...##.......#",
      "#.....................#",
      "#.S...#######...E.....#",
      "#.....#..H..#.........#",
      "#..E..#..S..#.....E...#",
      "#.....#.....#.........#",
      "#.....#######...S.....#",
      "#.....................#",
      "#..##...##.E.##...H...#",
      "#..##.E.##...##.....D.#",
      "######################"
    ]},
    { name: "FINALE", map: [
      "########################",
      "#P......................#",
      "#..##.E.##.E.##.S.##....#",
      "#..##...##...##...##....#",
      "#.......................#",
      "#.S...#########...E.....#",
      "#.....#...H...#.........#",
      "#..E..#...S...#......E..#",
      "#.....#.......#.........#",
      "#.....#########...S.....#",
      "#.......................#",
      "#..##...##.S.##...##.H..#",
      "#..##.E.##...##.E.##..D.#",
      "########################"
    ]}
  ];

  function makeEnemy(x, y, type) {
    return {
      x: x, y: y, r: 14, type: type || "melee", alive: true,
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
    var best = null, bestD = 40, i, d, dd;
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
      player.inv = 10;
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
    showMsg("ESCONDIDO", "Toca HIT para salir", 1400);
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

  function killEnemy(e) {
    if (!e || !e.alive) return;
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
      particles.push({ x: e.x, y: e.y, vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 6, life: 16, color: "#ff286e", s: 3 });
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
    var melee = (WEAPONS[player.weapon] && WEAPONS[player.weapon].type === "melee") ? WEAPONS[player.weapon] : WEAPONS.bat;
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
    if (!player || !player.alive || player.dashCd > 0 || player.dashT > 0 || player.hiding) return;
    var dx = keys.x, dy = keys.y;
    if (Math.hypot(dx, dy) < 0.15) {
      dx = Math.cos(player.angle);
      dy = Math.sin(player.angle);
    }
    var len = Math.hypot(dx, dy) || 1;
    player.vx = (dx / len) * 11;
    player.vy = (dy / len) * 11;
    player.dashT = 11;
    player.dashCd = 38;
    player.inv = 14;
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
    if (joyKnob) joyKnob.style.transform = "translate(calc(-50% + " + jx + "px), calc(-50% + " + jy + "px))";
    keys.x = jx / JOY_R;
    keys.y = jy / JOY_R;
    if (len > 8 && player && !player.hiding) player.angle = Math.atan2(dy, dx);
  }

  if (joyZone) {
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
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        if (t.identifier === joyId) {
          setJoy(t.clientX - joyOX, t.clientY - joyOY);
          break;
        }
      }
    }, { passive: false });
    function endJoy(e) {
      for (var i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === joyId) {
          joyId = null;
          keys.x = 0; keys.y = 0;
          if (joyKnob) joyKnob.style.transform = "translate(-50%,-50%)";
        }
      }
    }
    joyZone.addEventListener("touchend", endJoy, { passive: false });
    joyZone.addEventListener("touchcancel", endJoy, { passive: false });
  }

  function bindBtn(id, fn) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("touchstart", function (e) {
      e.preventDefault();
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
      if (storyMode._onDone) storyMode._onDone();
      return;
    }
    var line = storyLines[storyIdx];
    var a = document.getElementById("mainMsg");
    var b = document.getElementById("subMsg");
    if (a) { a.textContent = line; a.classList.add("show"); }
    if (b) {
      b.textContent = storyIdx < storyLines.length - 1 ? "toca para continuar" : "toca para empezar";
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
    startStory(STORY.intro, function () {
      buildLevel(0);
      startStory(STORY.levels[0], function () {
        running = true;
      });
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
      } else {
        startGame();
      }
    });
  }

  canvas.addEventListener("touchstart", function (e) {
    if (storyMode) { e.preventDefault(); advanceStory(); }
  }, { passive: false });

  window.addEventListener("keydown", function (e) {
    if (storyMode) { advanceStory(); return; }
    if (e.key === " " || e.key === "z" || e.key === "Z") doMelee();
    if (e.key === "x" || e.key === "X") doShoot();
    if (e.key === "c" || e.key === "C" || e.key === "Shift") doDash();
    if (e.key === "ArrowUp" || e.key === "w") keys.y = -1;
    if (e.key === "ArrowDown" || e.key === "s") keys.y = 1;
    if (e.key === "ArrowLeft" || e.key === "a") keys.x = -1;
    if (e.key === "ArrowRight" || e.key === "d") keys.x = 1;
  });
  window.addEventListener("keyup", function (e) {
    if (e.key === "ArrowUp" || e.key === "w" || e.key === "ArrowDown" || e.key === "s") keys.y = 0;
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "ArrowRight" || e.key === "d") keys.x = 0;
  });

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
      if (!ov) return;
      ov.classList.remove("hidden");
      var h1 = ov.querySelector("h1");
      if (h1) h1.textContent = "WASTED";
      var tag = ov.querySelector(".tag");
      if (tag) tag.textContent = "SECTOR " + String(levelIndex + 1).padStart(2, "0");
      var p = ov.querySelector("p");
      if (p) p.innerHTML = "Score " + (score | 0) + " · Kills " + kills + "<br>Las puertas HIDE te protegen";
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
      player.vx = 0; player.vy = 0;
    } else {
      if (player.dashT > 0) {
        player.dashT--;
        tryMove(player, player.vx, 0);
        tryMove(player, 0, player.vy);
        trails.push({ x: player.x, y: player.y, a: player.angle, life: 8, m: maskId });
        if (trails.length > 12) trails.shift();
      } else {
        var mx = keys.x * player.speed;
        var my = keys.y * player.speed;
        if (Math.hypot(mx, my) > 0.1) {
          player.walk += 0.25;
          tryMove(player, mx, 0);
          tryMove(player, 0, my);
          if (Math.random() < 0.15) dust.push({ x: player.x, y: player.y + 10, life: 12, s: 2 });
        }
      }
    }

    if (levelClear && !player.hiding) {
      for (var i = 0; i < doors.length; i++) {
        var d = doors[i];
        if (d.exit && dist(player.x, player.y, d.x + d.w / 2, d.y + d.h / 2) < 28) {
          nextLevel();
          return;
        }
      }
    }

    for (var i = pickups.length - 1; i >= 0; i--) {
      var p = pickups[i];
      if (dist(player.x, player.y, p.x, p.y) < 22) {
        player.weapon = p.weapon;
        player.ammo = p.ammo || 0;
        showMsg(WEAPONS[p.weapon] ? WEAPONS[p.weapon].name : "ARMA", "", 900);
        pickups.splice(i, 1);
        updateHUD();
      }
    }

    for (var i = 0; i < enemies.length; i++) {
      var e = enemies[i];
      if (!e.alive) {
        if (e.deadT > 0) e.deadT--;
        continue;
      }
      if (e.hitFlash > 0) e.hitFlash--;
      if (e.atkT > 0) e.atkT--;
      if (e.cd > 0) e.cd--;

      var canSee = !player.hiding && dist(e.x, e.y, player.x, player.y) < 220 && !lineBlocked(e.x, e.y, player.x, player.y);
      if (canSee) e.alert = 90;
      if (e.alert > 0) e.alert--;

      if ((e.alert > 0 || canSee) && !player.hiding) {
        var dx = player.x - e.x;
        var dy = player.y - e.y;
        var dlen = Math.hypot(dx, dy) || 1;
        e.angle = Math.atan2(dy, dx);
        if (dlen > 28) {
          tryMove(e, (dx / dlen) * e.speed, 0);
          tryMove(e, 0, (dy / dlen) * e.speed);
          e.walk += 0.2;
        }
        if (e.type === "shooter" && e.cd <= 0 && dlen < 200) {
          e.cd = 40;
          e.atkT = 8;
          var a = e.angle;
          bullets.push({
            x: e.x + Math.cos(a) * 14, y: e.y + Math.sin(a) * 14,
            vx: Math.cos(a) * 7, vy: Math.sin(a) * 7,
            life: 40, from: "enemy", color: "#ff4422"
          });
        } else if (e.type === "melee" && dlen < 30 && e.cd <= 0) {
          e.cd = 28;
          e.atkT = 10;
          if (player.inv <= 0) die();
        }
      } else {
        e.timer--;
        if (e.timer <= 0) {
          e.timer = 40 + Math.random() * 50;
          e.px = e.x + (Math.random() - 0.5) * 80;
          e.py = e.y + (Math.random() - 0.5) * 80;
        }
        var pdx = e.px - e.x, pdy = e.py - e.y;
        var plen = Math.hypot(pdx, pdy);
        if (plen > 6) {
          tryMove(e, (pdx / plen) * e.speed * 0.6, 0);
          tryMove(e, 0, (pdy / plen) * e.speed * 0.6);
          e.angle = Math.atan2(pdy, pdx);
          e.walk += 0.12;
        }
      }
    }

    for (var i = bullets.length - 1; i >= 0; i--) {
      var b = bullets[i];
      b.x += b.vx; b.y += b.vy;
      b.life--;
      if (b.life <= 0 || solidCircle(b.x, b.y, 2)) {
        bullets.splice(i, 1);
        continue;
      }
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
      p.x += p.vx; p.y += p.vy;
      p.vx *= 0.92; p.vy *= 0.92;
      p.life--;
      if (p.life <= 0) blood.splice(i, 1);
    }
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.x += p.vx; p.y += p.vy;
      p.life--;
      if (p.life <= 0) particles.splice(i, 1);
    }
    for (var i = dust.length - 1; i >= 0; i--) {
      dust[i].life--;
      if (dust[i].life <= 0) dust.splice(i, 1);
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
    var i, sx, sy, e, b, p, d, t;

    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#0a0a12";
    ctx.fillRect(0, 0, W, H);

    var ts = TILE;
    var x0 = Math.floor(cam.x / ts) - 1;
    var y0 = Math.floor(cam.y / ts) - 1;
    var x1 = Math.ceil((cam.x + W) / ts) + 1;
    var y1 = Math.ceil((cam.y + H) / ts) + 1;
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

    for (i = 0; i < dust.length; i++) {
      p = dust[i];
      ctx.globalAlpha = (p.life / 16) * 0.35;
      ctx.fillStyle = "#666";
      ctx.fillRect(Math.round(p.x - cam.x), Math.round(p.y - cam.y), 3, 3);
    }
    for (i = 0; i < blood.length; i++) {
      p = blood[i];
      ctx.globalAlpha = clamp(p.life / 40, 0.2, 0.8);
      ctx.fillStyle = "#8b0018";
      ctx.fillRect(Math.round(p.x - cam.x), Math.round(p.y - cam.y), Math.max(2, p.s | 0), Math.max(2, p.s | 0));
    }
    ctx.globalAlpha = 1;

    for (i = 0; i < walls.length; i++) {
      var w = walls[i];
      sx = w.x - cam.x;
      sy = w.y - cam.y;
      if (sx + w.w < -10 || sy + w.h < -10 || sx > W + 10 || sy > H + 10) continue;
      if (window.Sprites && Sprites.drawWall) {
        Sprites.drawWall(ctx, sx, sy, w.w, w.h);
      } else {
        ctx.fillStyle = "#1a1a28";
        ctx.fillRect(sx, sy, w.w, w.h);
        ctx.fillStyle = "#ff286e";
        ctx.fillRect(sx, sy, w.w, 2);
      }
    }

    for (i = 0; i < doors.length; i++) {
      d = doors[i];
      sx = d.x - cam.x;
      sy = d.y - cam.y;
      if (window.Sprites && Sprites.drawDoor) {
        if (d.exit) {
          Sprites.drawDoor(ctx, sx, sy, d.w, d.h, levelClear, false);
        } else {
          var near = player && dist(player.x, player.y, d.x + d.w / 2, d.y + d.h / 2) < 42;
          Sprites.drawDoor(ctx, sx, sy, d.w, d.h, false, near && player && !player.hiding);
        }
      }
    }

    for (i = 0; i < pickups.length; i++) {
      p = pickups[i];
      sx = Math.round(p.x - cam.x);
      sy = Math.round(p.y - cam.y + Math.sin(frame * 0.12 + i) * 4);
      ctx.fillStyle = (WEAPONS[p.weapon] && WEAPONS[p.weapon].color) || "#fff";
      ctx.fillRect(sx - 6, sy - 6, 12, 12);
      ctx.fillStyle = "#0a0a12";
      ctx.fillRect(sx - 3, sy - 3, 6, 6);
    }

    for (i = 0; i < trails.length; i++) {
      t = trails[i];
      if (t.life <= 0) continue;
      if (window.Sprites && Sprites.drawChar) {
        Sprites.drawChar(ctx, t.x - cam.x, t.y - cam.y, t.a, {
          col: MASKS[t.m || 0], alpha: (t.life / 8) * 0.3, pixelScale: 3
        });
      }
    }

    for (i = 0; i < enemies.length; i++) {
      e = enemies[i];
      if (!e.alive) {
        if (e.deadT > 0 && window.Sprites && Sprites.drawChar) {
          Sprites.drawChar(ctx, e.x - cam.x, e.y - cam.y, e.angle, {
            col: { body: "#555", jacket: "#333", mask: "#222", accent: "#222", shoe: "#111" },
            eye: "#400", alpha: e.deadT / 22, pixelScale: 3
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

    // PLAYER — always visible
    if (player && player.alive) {
      var alpha = (player.inv > 0 && (player.inv & 2)) ? 0.35 : 1;
      if (window.Sprites && Sprites.drawChar) {
        Sprites.drawChar(ctx, player.x - cam.x, player.y - cam.y, player.angle, {
          col: MASKS[maskId] || MASKS[0],
          eye: (MASKS[maskId] || MASKS[0]).eye,
          walk: player.walk,
          atkT: player.atkT,
          weapon: player.weapon,
          alpha: alpha,
          hide: player.hiding,
          pixelScale: 3
        });
      } else {
        ctx.fillStyle = "#ff286e";
        ctx.fillRect(player.x - cam.x - 14, player.y - cam.y - 14, 28, 28);
        ctx.fillStyle = "#00f5ff";
        ctx.fillRect(player.x - cam.x - 7, player.y - cam.y - 9, 6, 6);
        ctx.fillRect(player.x - cam.x + 2, player.y - cam.y - 9, 6, 6);
      }
      if (player.muzzle > 0 && !player.hiding) {
        ctx.fillStyle = "#ffcc00";
        ctx.globalAlpha = player.muzzle / 5;
        var mx = player.x + Math.cos(player.angle) * 22 - cam.x;
        var my = player.y + Math.sin(player.angle) * 22 - cam.y;
        ctx.fillRect(Math.round(mx - 3), Math.round(my - 3), 6, 6);
        ctx.globalAlpha = 1;
      }
    }

    for (i = 0; i < bullets.length; i++) {
      b = bullets[i];
      ctx.fillStyle = b.color || "#fff";
      ctx.fillRect(Math.round(b.x - cam.x - 2), Math.round(b.y - cam.y - 2), 4, 4);
    }

    for (i = 0; i < particles.length; i++) {
      p = particles[i];
      ctx.globalAlpha = p.life / 16;
      ctx.fillStyle = p.color || "#ff286e";
      ctx.fillRect(Math.round(p.x - cam.x), Math.round(p.y - cam.y), p.s | 0 || 3, p.s | 0 || 3);
    }
    ctx.globalAlpha = 1;
  }

  function loop() {
    try {
      update();
      draw();
    } catch (err) {
      console.error("Game error:", err);
    }
    requestAnimationFrame(loop);
  }

  // Pre-build level so player + walls exist from the first frame
  buildLevel(0);
  loop();
})();
