/* Original pixel-style sprites — Hotline-inspired aesthetic (not official assets) */
window.Sprites = (function () {
  "use strict";

  var MASKS = [
    { body: "#f0eef5", jacket: "#ff286e", eye: "#00f5ff", mask: "#1a1520", accent: "#ff6b9d" },
    { body: "#e8f4f5", jacket: "#00c4d4", eye: "#ff286e", mask: "#102028", accent: "#5ef0ff" },
    { body: "#f5f0e0", jacket: "#e8a020", eye: "#ff4422", mask: "#221810", accent: "#ffcc66" },
    { body: "#e0e0e8", jacket: "#6b2d9b", eye: "#a0ff60", mask: "#120818", accent: "#c080ff" }
  ];

  var WEAPONS = {
    bat:     { name: "BAT",     type: "melee", range: 44, arc: 1.6, cd: 12, color: "#ff286e", len: 26 },
    knife:   { name: "KNIFE",   type: "melee", range: 34, arc: 1.1, cd: 8,  color: "#00f5ff", len: 20 },
    pistol:  { name: "PISTOL",  type: "gun",   range: 320, cd: 14, ammo: 10, color: "#ffcc00", spread: 0.03, spd: 12, len: 18 },
    smg:     { name: "SMG",     type: "gun",   range: 280, cd: 5,  ammo: 28, color: "#b47fff", spread: 0.1,  spd: 11, len: 22 },
    shotgun: { name: "SHOTGUN", type: "gun",   range: 140, cd: 24, ammo: 6,  color: "#ff6622", spread: 0.3,  spd: 10, pellets: 5, len: 24 }
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
    var scale = opts.scale || 1;
    var wp = weapon && WEAPONS[weapon] ? WEAPONS[weapon] : null;
    var wlen = wp ? wp.len : 22;
    var wcol = wp ? wp.color : "#ccc";

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(scale, scale);
    ctx.globalAlpha = alpha;

    ctx.fillStyle = "rgba(0,0,0,0.42)";
    ctx.save();
    ctx.translate(1, 5);
    ctx.scale(1, 0.5);
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    var phase = walk * 1.15;
    var Lleg = Math.sin(phase) * 6;
    var Rleg = Math.sin(phase + Math.PI) * 6;
    var Lkick = Math.cos(phase) * 3.2;
    var Rkick = Math.cos(phase + Math.PI) * 3.2;

    ctx.fillStyle = "#1a1a24";
    ctx.beginPath();
    ctx.moveTo(-5, 2);
    ctx.lineTo(-7.5 + Lkick, 11 + Lleg);
    ctx.lineTo(-1.5 + Lkick, 11 + Lleg);
    ctx.lineTo(-1, 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(1, 2);
    ctx.lineTo(1.5 + Rkick, 11 + Rleg);
    ctx.lineTo(7.5 + Rkick, 11 + Rleg);
    ctx.lineTo(5, 2);
    ctx.fill();

    ctx.fillStyle = "#0a0a12";
    ctx.fillRect(-8.5 + Lkick, 10 + Lleg, 7, 3.5);
    ctx.fillRect(1.5 + Rkick, 10 + Rleg, 7, 3.5);

    ctx.fillStyle = flash > 0 ? "#ffffff" : col.jacket;
    ctx.beginPath();
    ctx.moveTo(-12, -2);
    ctx.quadraticCurveTo(-13, 7, -9, 11);
    ctx.lineTo(9, 11);
    ctx.quadraticCurveTo(13, 7, 12, -2);
    ctx.quadraticCurveTo(9, -9, 0, -10);
    ctx.quadraticCurveTo(-9, -9, -12, -2);
    ctx.fill();

    ctx.fillStyle = col.accent || col.jacket;
    ctx.globalAlpha = alpha * 0.55;
    ctx.beginPath();
    ctx.moveTo(-6.5, -6.5);
    ctx.lineTo(0, -9);
    ctx.lineTo(6.5, -6.5);
    ctx.lineTo(4.5, -3);
    ctx.lineTo(-4.5, -3);
    ctx.fill();
    ctx.globalAlpha = alpha;

    var armSwing = Math.sin(phase) * 4.5;
    var atkSwing = atk > 0 ? Math.sin((1 - atk / 12) * Math.PI) * 1.15 : 0;
    ctx.fillStyle = col.body;
    ctx.beginPath();
    ctx.arc(-11, -1 + armSwing * 0.35, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(11, -1 - armSwing * 0.35, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = flash > 0 ? "#ffffff" : col.mask;
    ctx.beginPath();
    ctx.arc(0, -3.5, 10.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = col.accent || "#333";
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.arc(0, -3.5, 10.2, 0.25, Math.PI - 0.25);
    ctx.stroke();

    ctx.fillStyle = eye;
    ctx.shadowColor = eye;
    ctx.shadowBlur = 9;
    ctx.beginPath();
    ctx.arc(-3.8, -4, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(3.8, -4, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = "#0a0a12";
    ctx.beginPath();
    ctx.arc(-3.8, -4, 1.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(3.8, -4, 1.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(-4.4, -4.6, 0.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(3.2, -4.6, 0.9, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.rotate(atkSwing);
    ctx.strokeStyle = wcol;
    ctx.lineWidth = 3.8;
    ctx.lineCap = "round";
    ctx.shadowColor = wcol;
    ctx.shadowBlur = 7;
    ctx.beginPath();
    ctx.moveTo(9, 0);
    ctx.lineTo(9 + wlen, 0);
    ctx.stroke();
    ctx.shadowBlur = 0;

    if (wp && wp.type === "gun") {
      ctx.fillStyle = wcol;
      ctx.fillRect(9 + wlen - 8, -4, 10, 8);
      ctx.fillStyle = "#1a1a22";
      ctx.fillRect(9 + wlen - 11, -1.5, 5.5, 5.5);
    } else {
      ctx.fillStyle = wcol;
      ctx.beginPath();
      ctx.moveTo(9 + wlen, 0);
      ctx.lineTo(9 + wlen + 5, -3.5);
      ctx.lineTo(9 + wlen + 5, 3.5);
      ctx.fill();
    }
    ctx.restore();

    if (atk > 0 && wp && wp.type === "melee") {
      var arcA = atk / 12;
      ctx.strokeStyle = "rgba(255,40,110," + (0.55 * arcA) + ")";
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.arc(0, 0, 19 + wlen * 0.5, -1 + atkSwing * 0.3, 1 + atkSwing * 0.3);
      ctx.stroke();
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawWall(ctx, sx, sy, w, h) {
    ctx.fillStyle = "#1a1a28";
    ctx.fillRect(sx, sy, w, h);
    ctx.fillStyle = "#222232";
    var bs = 12;
    for (var by = 0; by < h; by += bs) {
      for (var bx = ((by / bs) | 0) % 2 === 0 ? 0 : bs / 2; bx < w; bx += bs) {
        ctx.fillRect(sx + bx + 1, sy + by + 1, bs - 2, bs - 2);
      }
    }
    ctx.strokeStyle = "#ff286e";
    ctx.lineWidth = 2.5;
    ctx.strokeRect(sx + 1.5, sy + 1.5, w - 3, h - 3);
  }

  function drawDoor(ctx, sx, sy, w, h, open) {
    if (open) {
      ctx.fillStyle = "rgba(0,245,255,0.25)";
      ctx.fillRect(sx, sy, w, h);
      ctx.strokeStyle = "#00f5ff";
      ctx.lineWidth = 3;
      ctx.strokeRect(sx + 2, sy + 2, w - 4, h - 4);
      ctx.fillStyle = "#00f5ff";
      ctx.font = "bold 12px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("EXIT", sx + w / 2, sy + h / 2 + 4);
    } else {
      ctx.fillStyle = "#3a1520";
      ctx.fillRect(sx, sy, w, h);
      ctx.strokeStyle = "#ff286e";
      ctx.lineWidth = 2;
      ctx.strokeRect(sx + 2, sy + 2, w - 4, h - 4);
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
