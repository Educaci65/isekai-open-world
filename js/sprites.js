/* 100% PIXEL ART — original neon arcade */
window.Sprites = (function () {
  "use strict";

  var MASKS = [
    { body: "#e8e0f0", jacket: "#ff286e", eye: "#00f5ff", mask: "#1a1520", accent: "#ff6b9d", shoe: "#0a0a10" },
    { body: "#d8f0f0", jacket: "#00c4d4", eye: "#ff286e", mask: "#102028", accent: "#5ef0ff", shoe: "#0a0a10" },
    { body: "#f0e8d0", jacket: "#e8a020", eye: "#ff4422", mask: "#221810", accent: "#ffcc66", shoe: "#0a0a10" },
    { body: "#d8d8e0", jacket: "#6b2d9b", eye: "#a0ff60", mask: "#120818", accent: "#c080ff", shoe: "#0a0a10" }
  ];

  var WEAPONS = {
    bat:     { name: "BAT",     type: "melee", range: 48, arc: 1.7, cd: 12, color: "#ff286e", len: 9 },
    knife:   { name: "KNIFE",   type: "melee", range: 36, arc: 1.2, cd: 8,  color: "#00f5ff", len: 6 },
    pistol:  { name: "PISTOL",  type: "gun",   range: 320, cd: 14, ammo: 10, color: "#ffcc00", spread: 0.03, spd: 12, len: 6 },
    smg:     { name: "SMG",     type: "gun",   range: 280, cd: 5,  ammo: 28, color: "#b47fff", spread: 0.1,  spd: 11, len: 7 },
    shotgun: { name: "SHOTGUN", type: "gun",   range: 140, cd: 24, ammo: 6,  color: "#ff6622", spread: 0.3,  spd: 10, pellets: 5, len: 8 }
  };

  function pr(ctx, px, py, pw, ph, c, s) {
    s = s || 3;
    ctx.fillStyle = c;
    ctx.fillRect(Math.floor(px) * s, Math.floor(py) * s, Math.max(1, Math.floor(pw) * s), Math.max(1, Math.floor(ph) * s));
  }

  function drawChar(ctx, x, y, angle, opts) {
    opts = opts || {};
    var col = opts.col || MASKS[0];
    var eye = opts.eye || col.eye || "#00f5ff";
    var walk = opts.walk || 0;
    var atk = opts.atkT || 0;
    var weapon = opts.weapon;
    var alpha = opts.alpha != null ? opts.alpha : 1;
    var flash = opts.flash || 0;
    var hide = opts.hide || false;
    var s = opts.pixelScale || 3;
    var wp = weapon && WEAPONS[weapon] ? WEAPONS[weapon] : null;

    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate(angle || 0);
    ctx.globalAlpha = alpha * (hide ? 0.4 : 1);

    var jacket = flash > 0 ? "#ffffff" : (col.jacket || "#ff286e");
    var maskC  = flash > 0 ? "#ffffff" : (col.mask || "#1a1520");
    var body   = col.body || "#e8e0f0";
    var phase  = walk * 1.5;
    var legL   = Math.round(Math.sin(phase) * 2);
    var legR   = Math.round(Math.sin(phase + Math.PI) * 2);
    var atkSwing = atk > 0 ? Math.sin((1 - atk / 12) * Math.PI) * 1.0 : 0;

    ctx.globalAlpha = alpha * 0.35 * (hide ? 0.3 : 1);
    pr(ctx, -5, 4, 10, 3, "#000000", s);
    ctx.globalAlpha = alpha * (hide ? 0.4 : 1);

    pr(ctx, -4, 2 + legL, 3, 4, "#1a1a24", s);
    pr(ctx,  1, 2 + legR, 3, 4, "#1a1a24", s);
    pr(ctx, -4, 5 + legL, 3, 1, col.shoe || "#0a0a10", s);
    pr(ctx,  1, 5 + legR, 3, 1, col.shoe || "#0a0a10", s);

    pr(ctx, -5, -3, 10, 6, jacket, s);
    pr(ctx, -6, -2, 2, 3, body, s);
    pr(ctx,  4, -2, 2, 3, body, s);
    pr(ctx, -3, -3, 6, 1, col.accent || jacket, s);

    pr(ctx, -4, -7, 8, 5, maskC, s);
    pr(ctx, -4, -7, 8, 1, col.accent || "#333", s);

    pr(ctx, -3, -5, 2, 2, eye, s);
    pr(ctx,  1, -5, 2, 2, eye, s);

    ctx.save();
    ctx.rotate(atkSwing);
    var wlen = wp ? wp.len : 7;
    var wcol = wp ? wp.color : "#ccc";
    if (wp && wp.type === "gun") {
      pr(ctx, 4, -1, wlen, 2, wcol, s);
      pr(ctx, 4 + wlen - 1, -2, 2, 3, wcol, s);
    } else {
      pr(ctx, 4, -1, wlen, 2, wcol, s);
      pr(ctx, 4 + wlen, -1, 1, 2, wcol, s);
    }
    ctx.restore();

    if (atk > 0 && wp && wp.type === "melee") {
      ctx.globalAlpha = alpha * 0.5 * (atk / 12);
      pr(ctx, 5, -4, 4, 1, "#ff286e", s);
      pr(ctx, 6, -1, 4, 1, "#ff286e", s);
      pr(ctx, 5,  2, 4, 1, "#ff286e", s);
    }

    if (hide) {
      ctx.globalAlpha = alpha * 0.25;
      pr(ctx, -6, -8, 12, 14, "#00f5ff", s);
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawWall(ctx, sx, sy, w, h) {
    sx = Math.round(sx); sy = Math.round(sy);
    w = Math.round(w); h = Math.round(h);
    ctx.fillStyle = "#1a1a28";
    ctx.fillRect(sx, sy, w, h);
    var bs = 10;
    for (var by = 0; by < h; by += bs) {
      var off = ((by / bs) | 0) % 2 === 0 ? 0 : (bs >> 1);
      for (var bx = off; bx < w; bx += bs) {
        ctx.fillStyle = "#252538";
        ctx.fillRect(sx + bx + 1, sy + by + 1, bs - 2, bs - 2);
      }
    }
    ctx.fillStyle = "#ff286e";
    ctx.fillRect(sx, sy, w, 3);
    ctx.fillRect(sx, sy + h - 3, w, 3);
    ctx.fillRect(sx, sy, 3, h);
    ctx.fillRect(sx + w - 3, sy, 3, h);
  }

  function drawDoor(ctx, sx, sy, w, h, open, canHide) {
    sx = Math.round(sx); sy = Math.round(sy);
    w = Math.round(w); h = Math.round(h);
    if (open) {
      ctx.fillStyle = "rgba(0,245,255,0.25)";
      ctx.fillRect(sx, sy, w, h);
      ctx.fillStyle = "#00f5ff";
      ctx.fillRect(sx, sy, w, 3);
      ctx.fillRect(sx, sy + h - 3, w, 3);
      ctx.fillRect(sx, sy, 3, h);
      ctx.fillRect(sx + w - 3, sy, 3, h);
      ctx.fillStyle = "#00f5ff";
      ctx.font = "bold 14px monospace";
      ctx.textAlign = "center";
      ctx.fillText("EXIT", sx + w / 2, sy + h / 2 + 5);
    } else {
      ctx.fillStyle = "#2a1520";
      ctx.fillRect(sx, sy, w, h);
      ctx.fillStyle = "#3a1a28";
      ctx.fillRect(sx + 5, sy + 5, (w >> 1) - 7, h - 10);
      ctx.fillRect(sx + (w >> 1) + 2, sy + 5, (w >> 1) - 7, h - 10);
      ctx.fillStyle = "#ff286e";
      ctx.fillRect(sx, sy, w, 3);
      ctx.fillRect(sx, sy + h - 3, w, 3);
      ctx.fillRect(sx, sy, 3, h);
      ctx.fillRect(sx + w - 3, sy, 3, h);
      if (canHide) {
        ctx.fillStyle = "rgba(0,245,255,0.3)";
        ctx.fillRect(sx + 8, sy + 8, w - 16, h - 16);
        ctx.fillStyle = "#00f5ff";
        ctx.font = "bold 13px monospace";
        ctx.textAlign = "center";
        ctx.fillText("HIDE", sx + w / 2, sy + h / 2 + 5);
      }
    }
  }

  function drawFloorTile(ctx, sx, sy, size, variant) {
    sx = Math.round(sx); sy = Math.round(sy);
    ctx.fillStyle = variant ? "#14141e" : "#101018";
    ctx.fillRect(sx, sy, size, size);
    ctx.fillStyle = variant ? "#1a1a26" : "#16161e";
    ctx.fillRect(sx + 6, sy + 6, 4, 4);
    ctx.fillRect(sx + size - 12, sy + size - 12, 4, 4);
  }

  return {
    MASKS: MASKS,
    WEAPONS: WEAPONS,
    drawChar: drawChar,
    drawWall: drawWall,
    drawDoor: drawDoor,
    drawFloorTile: drawFloorTile
  };
})();
