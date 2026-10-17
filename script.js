/**
 * Generic progressive binary downloader + magic-byte scanner (Canvas UI).
 * - fetch + ReadableStream progress (direct, no CORS proxy)
 * - scan for OggS / PNG / RIFF / fLaC signatures
 * - lightweight top-down placeholder + touch controls
 */
(function () {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const fpsEl = document.getElementById("fps");
  const statusEl = document.getElementById("status");
  const logEl = document.getElementById("log");
  const urlInput = document.getElementById("bin-url");
  const btnLoad = document.getElementById("btn-load");
  const btnCancel = document.getElementById("btn-cancel");
  const joyBase = document.getElementById("joy-base");
  const joyKnob = document.getElementById("joy-knob");
  const joyZone = document.getElementById("joy-zone");
  const btnA = document.getElementById("btn-a");
  const btnB = document.getElementById("btn-b");

  const JOY_R = 46;
  const DEAD = 0.22;
  const PLAYER_SPEED = 170;
  const PLAYER_R = 14;

  const SIGS = [
    { name: "OggS", bytes: [0x4f, 0x67, 0x67, 0x53] },
    { name: "PNG",  bytes: [0x89, 0x50, 0x4e, 0x47] },
    { name: "RIFF", bytes: [0x52, 0x49, 0x46, 0x46] },
    { name: "fLaC", bytes: [0x66, 0x4c, 0x61, 0x43] },
  ];

  let viewW = 0, viewH = 0, dpr = 1;
  let lastT = 0, fpsAcc = 0, fpsFrames = 0;
  let downloadPct = 0;
  let downloading = false;
  let abortCtrl = null;
  let lastBuffer = null;
  let scanHits = [];

  const input = { x: 0, y: 0, a: false, b: false, keys: Object.create(null) };
  const player = { x: 0, y: 0, facing: 0, pulse: 0 };
  let joyActive = false, joyId = null, ox = 0, oy = 0;

  function log(msg, cls) {
    const line = document.createElement("div");
    if (cls) line.className = cls;
    line.textContent = msg;
    logEl.appendChild(line);
    logEl.scrollTop = logEl.scrollHeight;
    if (cls === "err") console.error(msg);
    else if (cls === "warn") console.warn(msg);
    else console.log(msg);
  }
  function clearLog() { logEl.textContent = ""; }
  function setStatus(t) { statusEl.textContent = t; }

  function cleanUrl(inputUrl) {
    return String(inputUrl || "").trim().replace(/[\r\n\t]+/g, "");
  }

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
      player.y = viewH * 0.55;
    }
  }
  window.addEventListener("resize", resize);

  async function downloadBinary(inputUrl) {
    if (downloading) return;
    clearLog();
    scanHits = [];
    lastBuffer = null;
    downloadPct = 0;
    downloading = true;
    btnLoad.disabled = true;
    btnCancel.disabled = false;
    setStatus("Descargando\u2026");

    const url = cleanUrl(inputUrl);
    if (!url) {
      log("URL vac\u00eda.", "warn");
      downloading = false;
      btnLoad.disabled = false;
      btnCancel.disabled = true;
      setStatus("Error");
      return;
    }
    urlInput.value = url;

    abortCtrl = new AbortController();
    const t0 = performance.now();

    try {
      log("GET " + url, "dim");

      const response = await fetch(url, {
        signal: abortCtrl.signal,
        method: "GET",
        credentials: "omit",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(
          "Error al descargar el archivo (" + response.status + " " + response.statusText + "). " +
          "Comprueba la URL y que el servidor permita CORS desde esta p\u00e1gina."
        );
      }

      const total = Number(response.headers.get("Content-Length")) || 0;
      if (!response.body || !response.body.getReader) {
        log("ReadableStream no disponible; usando arrayBuffer()", "warn");
        const buf = await response.arrayBuffer();
        downloadPct = 1;
        lastBuffer = buf;
        log("Descarga completa: " + formatBytes(buf.byteLength), "ok");
      } else {
        const reader = response.body.getReader();
        const chunks = [];
        let received = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          received += value.byteLength;
          downloadPct = total > 0 ? Math.min(1, received / total) : 0;
          setStatus(total > 0
            ? ("Descarga " + Math.round(downloadPct * 100) + "%")
            : ("Recibidos " + formatBytes(received)));
        }
        const out = new Uint8Array(received);
        let offset = 0;
        for (let i = 0; i < chunks.length; i++) {
          out.set(chunks[i], offset);
          offset += chunks[i].byteLength;
        }
        lastBuffer = out.buffer;
        downloadPct = 1;
        const ms = Math.round(performance.now() - t0);
        log("Descarga completa: " + formatBytes(received) + " en " + ms + " ms", "ok");
        if (total && received !== total) {
          log("Aviso: Content-Length=" + total + " vs recibido=" + received, "warn");
        }
      }

      setStatus("Escaneando\u2026");
      const hits = scanSignatures(lastBuffer);
      scanHits = hits;
      reportHits(hits);
      setStatus("Listo \u00b7 " + hits.length + " firmas");
    } catch (err) {
      if (err && err.name === "AbortError") {
        log("Descarga cancelada", "warn");
        setStatus("Cancelado");
      } else {
        log(String(err && err.message ? err.message : err), "err");
        setStatus("Error");
        log("Si ves un error de red/CORS, el host del archivo debe permitir origen cruzado.", "dim");
      }
      downloadPct = 0;
    } finally {
      downloading = false;
      abortCtrl = null;
      btnLoad.disabled = false;
      btnCancel.disabled = true;
    }
  }

  function formatBytes(n) {
    if (n < 1024) return n + " B";
    if (n < 1048576) return (n / 1024).toFixed(1) + " KB";
    return (n / 1048576).toFixed(2) + " MB";
  }

  function scanSignatures(arrayBuffer) {
    const u8 = new Uint8Array(arrayBuffer);
    const n = u8.length;
    const hits = [];
    const maxHitsPerSig = 200;
    const counts = Object.create(null);
    for (let s = 0; s < SIGS.length; s++) counts[SIGS[s].name] = 0;

    for (let i = 0; i < n; i++) {
      for (let s = 0; s < SIGS.length; s++) {
        const sig = SIGS[s];
        const b = sig.bytes;
        if (i + b.length > n) continue;
        let ok = true;
        for (let k = 0; k < b.length; k++) {
          if (u8[i + k] !== b[k]) { ok = false; break; }
        }
        if (!ok) continue;
        if (counts[sig.name] >= maxHitsPerSig) continue;
        counts[sig.name]++;

        const hit = { name: sig.name, offset: i, sizeHint: -1 };
        if (sig.name === "PNG") hit.sizeHint = peekPngSize(u8, i);
        else if (sig.name === "RIFF" && i + 8 <= n) {
          const sz = u8[i + 4] | (u8[i + 5] << 8) | (u8[i + 6] << 16) | (u8[i + 7] << 24);
          hit.sizeHint = (sz >>> 0) + 8;
        } else if (sig.name === "OggS") hit.sizeHint = peekOggPageSize(u8, i);
        hits.push(hit);
      }
    }
    hits.sort(function (a, b) { return a.offset - b.offset; });
    return hits;
  }

  function peekPngSize(u8, i) {
    if (i + 24 > u8.length) return -1;
    if (u8[i + 12] === 0x49 && u8[i + 13] === 0x48 && u8[i + 14] === 0x44 && u8[i + 15] === 0x52) {
      const w = (u8[i + 16] << 24) | (u8[i + 17] << 16) | (u8[i + 18] << 8) | u8[i + 19];
      const h = (u8[i + 20] << 24) | (u8[i + 21] << 16) | (u8[i + 22] << 8) | u8[i + 23];
      return (w > 0 && h > 0) ? (w * h) : -1;
    }
    return -1;
  }

  function peekOggPageSize(u8, i) {
    if (i + 27 > u8.length) return -1;
    const nseg = u8[i + 26];
    if (i + 27 + nseg > u8.length) return -1;
    let body = 0;
    for (let s = 0; s < nseg; s++) body += u8[i + 27 + s];
    return 27 + nseg + body;
  }

  function reportHits(hits) {
    if (!hits.length) {
      log("No se encontraron firmas conocidas (OggS/PNG/RIFF/fLaC).", "warn");
      return;
    }
    const summary = Object.create(null);
    for (let i = 0; i < hits.length; i++) {
      summary[hits[i].name] = (summary[hits[i].name] || 0) + 1;
    }
    const parts = Object.keys(summary).map(function (k) { return k + "=" + summary[k]; });
    log("Firmas: " + parts.join(", "), "ok");

    const show = Math.min(hits.length, 40);
    for (let i = 0; i < show; i++) {
      const h = hits[i];
      const size = h.sizeHint > 0 ? (" ~" + formatBytes(h.sizeHint)) : "";
      log("  [" + h.name + "] @ 0x" + h.offset.toString(16) + " (" + h.offset + ")" + size);
    }
    if (hits.length > show) log("  \u2026 +" + (hits.length - show) + " m\u00e1s (ver consola)", "dim");
    console.table(hits.slice(0, 100));
  }

  btnLoad.addEventListener("click", function () {
    const url = (urlInput.value || "").trim();
    if (!url) {
      log("Pega la URL del binario (p. ej. GitHub Releases).", "warn");
      return;
    }
    downloadBinary(url);
  });
  btnCancel.addEventListener("click", function () {
    if (abortCtrl) abortCtrl.abort();
  });

  window.addEventListener("keydown", function (e) {
    input.keys[e.code] = true;
    if (e.code === "Space" || e.code === "KeyZ") { e.preventDefault(); input.a = true; }
    if (e.code === "KeyX" || e.code === "KeyE") input.b = true;
  });
  window.addEventListener("keyup", function (e) {
    input.keys[e.code] = false;
    if (e.code === "Space" || e.code === "KeyZ") input.a = false;
    if (e.code === "KeyX" || e.code === "KeyE") input.b = false;
  });

  function setKnob(dx, dy) {
    const len = Math.hypot(dx, dy) || 1;
    const cl = Math.min(len, JOY_R);
    const jx = (dx / len) * cl;
    const jy = (dy / len) * cl;
    joyKnob.style.transform = "translate(" + jx + "px," + jy + "px)";
    const nx = jx / JOY_R, ny = jy / JOY_R;
    const mag = Math.hypot(nx, ny);
    if (mag < DEAD) { input.x = 0; input.y = 0; return; }
    const t = (mag - DEAD) / (1 - DEAD);
    input.x = (nx / mag) * t;
    input.y = (ny / mag) * t;
  }
  function resetJoy() {
    joyActive = false; joyId = null;
    joyKnob.style.transform = "translate(0,0)";
    input.x = 0; input.y = 0;
  }
  joyZone.addEventListener("pointerdown", function (e) {
    e.preventDefault();
    joyZone.setPointerCapture(e.pointerId);
    joyActive = true; joyId = e.pointerId;
    const r = joyBase.getBoundingClientRect();
    ox = r.left + r.width / 2; oy = r.top + r.height / 2;
    setKnob(e.clientX - ox, e.clientY - oy);
  });
  joyZone.addEventListener("pointermove", function (e) {
    if (!joyActive || e.pointerId !== joyId) return;
    e.preventDefault();
    setKnob(e.clientX - ox, e.clientY - oy);
  });
  function endJoy(e) { if (e.pointerId === joyId) resetJoy(); }
  joyZone.addEventListener("pointerup", endJoy);
  joyZone.addEventListener("pointercancel", endJoy);

  function bindHold(el, down, up) {
    let held = false;
    el.addEventListener("pointerdown", function (e) {
      e.preventDefault(); e.stopPropagation();
      if (held) return;
      held = true; el.classList.add("pressed"); down();
    });
    function release() {
      if (!held) return;
      held = false; el.classList.remove("pressed"); up();
    }
    el.addEventListener("pointerup", release);
    el.addEventListener("pointercancel", release);
    el.addEventListener("pointerleave", release);
  }
  bindHold(btnA, function () { input.a = true; }, function () { input.b = false; });
  bindHold(btnB, function () { input.b = true; }, function () { input.b = false; });

  function syncKeys() {
    if (joyActive) return;
    let x = 0, y = 0;
    if (input.keys.KeyW || input.keys.ArrowUp) y -= 1;
    if (input.keys.KeyS || input.keys.ArrowDown) y += 1;
    if (input.keys.KeyA || input.keys.ArrowLeft) x -= 1;
    if (input.keys.KeyD || input.keys.ArrowRight) x += 1;
    const len = Math.hypot(x, y) || 1;
    input.x = x / len; input.y = y / len;
  }

  function update(dt) {
    syncKeys();
    player.x += input.x * PLAYER_SPEED * dt;
    player.y += input.y * PLAYER_SPEED * dt;
    const m = PLAYER_R + 4;
    player.x = Math.max(m, Math.min(viewW - m, player.x));
    player.y = Math.max(m, Math.min(viewH - m, player.y));
    if (input.x || input.y) player.facing = Math.atan2(input.y, input.x);
    if (input.a) player.pulse = 0.2;
    if (player.pulse > 0) player.pulse -= dt;
  }

  function drawProgress() {
    if (!downloading && downloadPct <= 0) return;
    const w = Math.min(viewW - 48, 320);
    const h = 14;
    const x = (viewW - w) / 2;
    const y = viewH * 0.42;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(x - 8, y - 28, w + 16, 56);
    ctx.strokeStyle = "rgba(255,79,154,0.7)";
    ctx.strokeRect(x - 8, y - 28, w + 16, 56);
    ctx.fillStyle = "rgba(0,40,60,0.9)";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "#ff4f9a";
    ctx.shadowColor = "#ff4f9a";
    ctx.shadowBlur = 12;
    ctx.fillRect(x, y, w * downloadPct, h);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#6af0ff";
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText(Math.round(downloadPct * 100) + "%", viewW / 2, y - 10);
  }

  function draw() {
    ctx.fillStyle = "#08081a";
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.strokeStyle = "#12122a";
    ctx.lineWidth = 1;
    for (let x = 0; x < viewW; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, viewH); ctx.stroke();
    }
    for (let y = 0; y < viewH; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(viewW, y); ctx.stroke();
    }

    ctx.fillStyle = player.pulse > 0 ? "#ffffff" : "#ff4f9a";
    ctx.beginPath();
    ctx.arc(player.x, player.y, PLAYER_R, 0, Math.PI * 2);
    ctx.fill();
    const ex = Math.cos(player.facing), ey = Math.sin(player.facing);
    ctx.fillStyle = "#6af0ff";
    ctx.beginPath();
    ctx.arc(player.x + ex * 5 - ey * 4, player.y + ey * 5 + ex * 4, 2.5, 0, Math.PI * 2);
    ctx.arc(player.x + ex * 5 + ey * 4, player.y + ey * 5 - ex * 4, 2.5, 0, Math.PI * 2);
    ctx.fill();

    drawProgress();
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
      fpsEl.textContent = Math.round(fpsFrames / fpsAcc) + " FPS";
      fpsFrames = 0;
      fpsAcc = 0;
    }
    requestAnimationFrame(frame);
  }

  resize();
  setStatus("Listo");
  log("Pega la URL del binario. Fetch directo (sin proxy).", "dim");
  requestAnimationFrame(frame);
})();
