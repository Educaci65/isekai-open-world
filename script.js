/**
 * Generic top-down Canvas engine template
 * - Asset loader for /assets/sprites and /assets/audio
 * - Fullscreen game loop
 * - iOS Safari-friendly virtual joystick + action buttons
 * Placeholders only (no copyrighted assets)
 */
(function () {
  "use strict";

  // ---------- Config ----------
  const CONFIG = {
    playerSpeed: 180,       // px/s
    playerRadius: 14,
    worldColor: "#12121a",
    gridColor: "#1c1c28",
    playerColor: "#ff5080",
    playerEye: "#40d4e8",
    attackColor: "#ffd040",
    deadzone: 0.22,
    joyRadius: 48,
  };

  // Manifest: list files you put in assets/ (empty = pure geometry demo)
  const MANIFEST = {
    sprites: [
      // "player.png",
      // "enemy.png",
    ],
    audio: [
      // "hit.ogg",
      // "step.mp3",
    ],
  };

  // ---------- DOM ----------
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const fpsEl = document.getElementById("fps");
  const statusEl = document.getElementById("status");
  const joyBase = document.getElementById("joy-base");
  const joyKnob = document.getElementById("joy-knob");
  const joyZone = document.getElementById("joy-zone");
  const btnA = document.getElementById("btn-a");
  const btnB = document.getElementById("btn-b");
  const btnFs = document.getElementById("btn-fs");

  // ---------- State ----------
  const assets = { images: {}, sounds: {}, ready: false };
  const input = {
    moveX: 0,
    moveY: 0,
    actionA: false,
    actionB: false,
    keys: Object.create(null),
  };
  const player = {
    x: 0,
    y: 0,
    facing: 0,
    attacking: 0,
  };

  let dpr = 1;
  let viewW = 0;
  let viewH = 0;
  let lastT = 0;
  let fpsAcc = 0;
  let fpsFrames = 0;

  // ---------- Asset loader ----------
  function loadImage(path) {
    return new Promise(function (resolve, reject) {
      const img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error("Image failed: " + path)); };
      img.src = path;
    });
  }

  function loadAudio(path) {
    return new Promise(function (resolve) {
      const a = new Audio();
      a.preload = "auto";
      let done = false;
      function finish() {
        if (done) return;
        done = true;
        resolve(a);
      }
      a.addEventListener("canplaythrough", finish, { once: true });
      a.addEventListener("error", finish, { once: true });
      a.src = path;
      // Fallback timeout so a missing file does not block forever
      setTimeout(finish, 4000);
    });
  }

  async function loadAssets() {
    statusEl.textContent = "Cargando…";
    const tasks = [];

    MANIFEST.sprites.forEach(function (name) {
      const path = "assets/sprites/" + name;
      tasks.push(
        loadImage(path)
          .then(function (img) { assets.images[name] = img; })
          .catch(function () { /* optional: missing file ok */ })
      );
    });

    MANIFEST.audio.forEach(function (name) {
      const path = "assets/audio/" + name;
      tasks.push(
        loadAudio(path).then(function (a) { assets.sounds[name] = a; })
      );
    });

    await Promise.all(tasks);
    assets.ready = true;
    statusEl.textContent = "Listo";
  }

  function playSound(name, volume) {
    const src = assets.sounds[name];
    if (!src) return;
    try {
      const s = src.cloneNode();
      s.volume = volume == null ? 0.6 : volume;
      s.play().catch(function () {});
    } catch (e) {}
  }

  // ---------- Resize ----------
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    viewW = window.innerWidth;
    viewH = window.innerHeight;
    canvas.width = Math.floor(viewW * dpr);
    canvas.height = Math.floor(viewH * dpr);
    canvas.style.width = viewW + "px";
    canvas.style.height = viewH + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (!player.x && !player.y) {
      player.x = viewW * 0.5;
      player.y = viewH * 0.5;
    }
  }

  // ---------- Input: keyboard ----------
  window.addEventListener("keydown", function (e) {
    input.keys[e.code] = true;
    if (e.code === "Space" || e.code === "KeyZ") {
      e.preventDefault();
      input.actionA = true;
    }
    if (e.code === "KeyX" || e.code === "KeyE") {
      input.actionB = true;
    }
  });
  window.addEventListener("keyup", function (e) {
    input.keys[e.code] = false;
    if (e.code === "Space" || e.code === "KeyZ") input.actionA = false;
    if (e.code === "KeyX" || e.code === "KeyE") input.actionB = false;
  });

  function syncKeyboardMove() {
    let x = 0, y = 0;
    if (input.keys.KeyW || input.keys.ArrowUp) y -= 1;
    if (input.keys.KeyS || input.keys.ArrowDown) y += 1;
    if (input.keys.KeyA || input.keys.ArrowLeft) x -= 1;
    if (input.keys.KeyD || input.keys.ArrowRight) x += 1;
    // Joystick has priority when active
    if (joyActive) return;
    const len = Math.hypot(x, y) || 1;
    input.moveX = x / len;
    input.moveY = y / len;
  }

  // ---------- Input: virtual joystick (Pointer Events) ----------
  let joyActive = false;
  let joyPointerId = null;
  let originX = 0;
  let originY = 0;

  function setKnob(dx, dy) {
    const len = Math.hypot(dx, dy) || 1;
    const cl = Math.min(len, CONFIG.joyRadius);
    const jx = (dx / len) * cl;
    const jy = (dy / len) * cl;
    joyKnob.style.transform = "translate(" + jx + "px," + jy + "px)";
    const nx = jx / CONFIG.joyRadius;
    const ny = jy / CONFIG.joyRadius;
    const mag = Math.hypot(nx, ny);
    if (mag < CONFIG.deadzone) {
      input.moveX = 0;
      input.moveY = 0;
    } else {
      const t = (mag - CONFIG.deadzone) / (1 - CONFIG.deadzone);
      input.moveX = (nx / mag) * t;
      input.moveY = (ny / mag) * t;
    }
  }

  function resetJoy() {
    joyActive = false;
    joyPointerId = null;
    joyKnob.style.transform = "translate(0,0)";
    input.moveX = 0;
    input.moveY = 0;
  }

  joyZone.addEventListener("pointerdown", function (e) {
    e.preventDefault();
    joyZone.setPointerCapture(e.pointerId);
    joyActive = true;
    joyPointerId = e.pointerId;
    const r = joyBase.getBoundingClientRect();
    originX = r.left + r.width / 2;
    originY = r.top + r.height / 2;
    setKnob(e.clientX - originX, e.clientY - originY);
  });

  joyZone.addEventListener("pointermove", function (e) {
    if (!joyActive || e.pointerId !== joyPointerId) return;
    e.preventDefault();
    setKnob(e.clientX - originX, e.clientY - originY);
  });

  function endJoy(e) {
    if (e.pointerId !== joyPointerId) return;
    resetJoy();
  }
  joyZone.addEventListener("pointerup", endJoy);
  joyZone.addEventListener("pointercancel", endJoy);

  // ---------- Action buttons ----------
  function bindHold(el, onDown, onUp) {
    if (!el) return;
    let held = false;
    function down(e) {
      e.preventDefault();
      e.stopPropagation();
      if (held) return;
      held = true;
      el.classList.add("pressed");
      onDown();
    }
    function up(e) {
      if (!held) return;
      held = false;
      el.classList.remove("pressed");
      onUp();
    }
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("pointerleave", up);
  }

  bindHold(btnA, function () { input.actionA = true; }, function () { input.actionA = false; });
  bindHold(btnB, function () { input.actionB = true; }, function () { input.actionB = false; });

  // Fullscreen
  btnFs.addEventListener("click", function () {
    const el = document.documentElement;
    if (!document.fullscreenElement && el.requestFullscreen) {
      el.requestFullscreen().catch(function () {});
    } else if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  });

  // ---------- Update / Draw ----------
  function update(dt) {
    syncKeyboardMove();

    player.x += input.moveX * CONFIG.playerSpeed * dt;
    player.y += input.moveY * CONFIG.playerSpeed * dt;

    // Clamp to view
    const m = CONFIG.playerRadius + 4;
    player.x = Math.max(m, Math.min(viewW - m, player.x));
    player.y = Math.max(m, Math.min(viewH - m, player.y));

    if (input.moveX || input.moveY) {
      player.facing = Math.atan2(input.moveY, input.moveX);
    }

    if (input.actionA) {
      if (player.attacking <= 0) {
        player.attacking = 0.18;
        playSound("hit.ogg");
      }
    }
    if (player.attacking > 0) player.attacking -= dt;
  }

  function drawGrid() {
    ctx.strokeStyle = CONFIG.gridColor;
    ctx.lineWidth = 1;
    const step = 40;
    for (let x = 0; x < viewW; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, viewH);
      ctx.stroke();
    }
    for (let y = 0; y < viewH; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(viewW, y);
      ctx.stroke();
    }
  }

  function drawPlayer() {
    const img = assets.images["player.png"];
    if (img) {
      const s = CONFIG.playerRadius * 2.4;
      ctx.save();
      ctx.translate(player.x, player.y);
      ctx.rotate(player.facing);
      ctx.drawImage(img, -s / 2, -s / 2, s, s);
      ctx.restore();
    } else {
      // Placeholder: circle + eyes
      ctx.fillStyle = player.attacking > 0 ? "#fff" : CONFIG.playerColor;
      ctx.beginPath();
      ctx.arc(player.x, player.y, CONFIG.playerRadius, 0, Math.PI * 2);
      ctx.fill();

      const ex = Math.cos(player.facing);
      const ey = Math.sin(player.facing);
      ctx.fillStyle = CONFIG.playerEye;
      ctx.beginPath();
      ctx.arc(player.x + ex * 5 - ey * 4, player.y + ey * 5 + ex * 4, 2.5, 0, Math.PI * 2);
      ctx.arc(player.x + ex * 5 + ey * 4, player.y + ey * 5 - ex * 4, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Attack arc (placeholder)
    if (player.attacking > 0) {
      ctx.strokeStyle = CONFIG.attackColor;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(player.x, player.y, CONFIG.playerRadius + 12, player.facing - 0.9, player.facing + 0.9);
      ctx.stroke();
    }
  }

  function draw() {
    ctx.fillStyle = CONFIG.worldColor;
    ctx.fillRect(0, 0, viewW, viewH);
    drawGrid();
    drawPlayer();
  }

  function frame(t) {
    if (!lastT) lastT = t;
    const dt = Math.min(0.05, (t - lastT) / 1000);
    lastT = t;

    update(dt);
    draw();

    fpsFrames++;
    fpsAcc += dt;
    if (fpsAcc >= 0.5) {
      const fps = Math.round(fpsFrames / fpsAcc);
      fpsEl.textContent = fps + " FPS";
      fpsFrames = 0;
      fpsAcc = 0;
    }

    requestAnimationFrame(frame);
  }

  // ---------- Boot ----------
  window.addEventListener("resize", resize);
  resize();
  loadAssets().then(function () {
    requestAnimationFrame(frame);
  });
})();
