/* 100% pixel-art sprites — original neon arcade style */
window.Sprites = (function () {
  "use strict";

  var MASKS = [
    { body: "#e8e0f0", jacket: "#ff286e", eye: "#00f5ff", mask: "#1a1520", accent: "#ff6b9d", shoe: "#0a0a10" },
    { body: "#d8f0f0", jacket: "#00c4d4", eye: "#ff286e", mask: "#102028", accent: "#5ef0ff", shoe: "#0a0a10" },
    { body: "#f0e8d0", jacket: "#e8a020", eye: "#ff4422", mask: "#221810", accent: "#ffcc66", shoe: "#0a0a10" },
    { body: "#d8d8e0", jacket: "#6b2d9b", eye: "#a0ff60", mask: "#120818", accent: "#c080ff", shoe: "#0a0a10" }
  ];

  var WEAPONS = {
    bat:     { name: "BAT",     type: "melee", range: 44, arc: 1.6, cd: 12, color: "#ff286e", len: 7 },
    knife:   { name: "KNIFE",   type: "melee", range: 34, arc: 1.1, cd: 8,  color: "#00f5ff", len: 5 },
    pistol:  { name: "PISTOL",  type: "gun",   range: 320, cd: 14, ammo: 10, color: "#ffcc00", spread: 0.03, spd: 12, len: 5 },
    smg:     { name: "SMG",     type: "gun",   range: 280, cd: 5,  ammo: 28, color: "#b47fff", spread: 0.1,  spd: 11, len: 6 },
    shotgun: { name: "SHOTGUN", type: "gun",   range: 140, cd: 24, ammo: 6,  color: "#ff6622", spread: 0.3,  spd: 10, pellets: 5, len: 7 }
  };

  function drawChar(ctx, x, y, angle, opts) {
    opts = opts || {};
    var col = opts.col || MASKS[0];
    var eye = opts.eye || col.eye;
    var walk = opts.walk || 0;
    var atk = opts.atkT || 0;
    var weapon = opts.weapon;
    var alpha = opts.alpha != null ? opts.alpha : 1;
    var flash = opts.flash || 0;
    var hide = opts.hide || false;
    var s = opts.pixelScale || 2;
    var wp = weapon && WEAPONS[weapon] ? WEAPONS[weapon] : null;

    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate(angle);
    ctx.globalAlpha = alpha * (hide ? 0.45 : 1);

    var jacket = flash > 0 ? "#ffffff" : col.jacket;
    var maskC = flash > 0 ? "#ffffff" : col.mask;
    var body = col.body;
    var phase = walk * 1.2;
    var legL = Math.round(Math.sin(phase) * 2);
    var legR = Math.round(Math.sin(phase + Math.PI) * 2);
    var atkSwing = atk > 0 ? Math.sin((1 - atk / 12) * Math.PI) * 0.9 : 0;

    function pr(px, py, pw, ph, c) {
      ctx.fillStyle = c;
      ctx.fillRect(Math.floor(px) * s, Math.floor(py) * s, Math.floor(pw) * s, Math.floor(ph) * s);
    }

    ctx.globalAlpha = alpha * 0.35 * (hide ? 0.5 : 1);
    pr(-4, 3, 8, 3, "#000000");
    ctx.globalAlpha = alpha * (hide ? 0.45 : 1);

    pr(-3, 2 + legL, 2, 3, "#1a1a24");
    pr(1, 2 + legR, 2, 3, "#1a1a24");
    pr(-3, 4 + legL, 2, 1, col.shoe || "#0a0a10");
    pr(1, 4 + legR, 2, 1, col.shoe || "#0a0a10");

    pr(-4, -2, 8, 5, jacket);
    pr(-5, -1, 2, 2, body);
    pr(3, -1, 2, 2, body);
    pr(-2, -2, 4, 1, col.accent || jacket);

    pr(-3, -5, 6, 4, maskC);
    pr(-3, -5, 6, 1, col.accent || "#333");

    pr(-2, -4, 1, 1, eye);
    pr(1, -4, 1, 1, eye);

    ctx.save();
    ctx.rotate(atkSwing);
    var wlen = wp ? wp.len : 6;
    var wcol = wp ? wp.color : "#ccc";
    if (wp && wp.type === "gun") {
      pr(3, -1, wlen, 2, wcol);
      pr(3 + wlen - 1, -2, 2, 3, wcol);
      pr(3 + wlen - 2, 0, 1, 2, "#222");
    } else {
      pr(3, -1, wlen, 2, wcol);
      pr(3 + wlen, -1, 1, 2, wcol);
    }
    ctx.restore();

    if (atk > 0 && wp && wp.type === "melee") {
      ctx.globalAlpha = alpha * 0.4 * (atk / 12);
      pr(4, -3, 3, 1, "#ff286e");
      pr(5, -1, 3, 1, "#ff286e");
      pr(4, 1, 3, 1, "#ff286e");
    }

    if (hide) {
      ctx.globalAlpha = alpha * 0.2;
      pr(-5, -6, 10, 12, "#00f5ff");
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawWall(ctx, sx, sy, w, h) {
    ctx.fillStyle = "#1a1a28";
    ctx.fillRect(sx, sy, w, h);
    var bs = 8;
    ctx.fillStyle = "#222232";
    for (var by = 0; by < h; by += bs) {
      var off = ((by / bs) | 0) % 2 === 0 ? 0 : bs / 2;
      for (var bx = off; bx < w; bx += bs) {
        ctx.fillRect(sx + bx + 1, sy + by + 1, bs - 2, bs - 2);
      }
    }
    ctx.fillStyle = "#ff286e";
    ctx.fillRect(sx, sy, w, 2);
    ctx.fillRect(sx, sy + h - 2, w, 2);
    ctx.fillRect(sx, sy, 2, h);
    ctx.fillRect(sx + w - 2, sy, 2, h);
  }

  function drawDoor(ctx, sx, sy, w, h, open, canHide) {
    if (open) {
      ctx.fillStyle = "rgba(0,245,255,0.22)";
      ctx.fillRect(sx, sy, w, h);
      ctx.fillStyle = "#00f5ff";
      ctx.fillRect(sx, sy, w, 2);
      ctx.fillRect(sx, sy + h - 2, w, 2);
      ctx.fillRect(sx, sy, 2, h);
      ctx.fillRect(sx + w - 2, sy, 2, h);
      ctx.font = "bold 11px monospace";
      ctx.textAlign = "center";
      ctx.fillText("EXIT", sx + w / 2, sy + h / 2 + 4);
    } else {
      ctx.fillStyle = "#2a1520";
      ctx.fillRect(sx, sy, w, h);
      ctx.fillStyle = "#3a1a28";
      ctx.fillRect(sx + 4, sy + 4, w / 2 - 6, h - 8);
      ctx.fillRect(sx + w / 2 + 2, sy + 4, w / 2 - 6, h - 8);
      ctx.fillStyle = "#ff286e";
      ctx.fillRect(sx, sy, w, 2);
      ctx.fillRect(sx, sy + h - 2, w, 2);
      ctx.fillRect(sx, sy, 2, h);
      ctx.fillRect(sx + w - 2, sy, 2, h);
      if (canHide) {
        ctx.fillStyle = "#00f5ff";
        ctx.font = "bold 9px monospace";
        ctx.textAlign = "center";
        ctx.fillText("HIDE", sx + w / 2, sy + h / 2 + 3);
      }
    }
  }

  return {
    MASKS: MASKS,
    WEAPONS: WEAPONS,
    drawChar: drawChar,
    drawWall: drawWall,
    drawDoor: drawDoor
  };
})();
