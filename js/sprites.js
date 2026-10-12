/* 100% PIXEL ART — original neon arcade (no smooth, integer pixels only) */
window.Sprites = (function () {
  "use strict";

  var MASKS = [
    { body: "#e8e0f0", jacket: "#ff286e", eye: "#00f5ff", mask: "#1a1520", accent: "#ff6b9d", shoe: "#0a0a10" },
    { body: "#d8f0f0", jacket: "#00c4d4", eye: "#ff286e", mask: "#102028", accent: "#5ef0ff", shoe: "#0a0a10" },
    { body: "#f0e8d0", jacket: "#e8a020", eye: "#ff4422", mask: "#221810", accent: "#ffcc66", shoe: "#0a0a10" },
    { body: "#d8d8e0", jacket: "#6b2d9b", eye: "#a0ff60", mask: "#120818", accent: "#c080ff", shoe: "#0a0a10" }
  ];

  var WEAPONS = {
    bat:     { name: "BAT",     type: "melee", range: 44, arc: 1.6, cd: 12, color: "#ff286e", len: 8 },
    knife:   { name: "KNIFE",   type: "melee", range: 34, arc: 1.1, cd: 8,  color: "#00f5ff", len: 6 },
    pistol:  { name: "PISTOL",  type: "gun",   range: 320, cd: 14, ammo: 10, color: "#ffcc00", spread: 0.03, spd: 12, len: 6 },
    smg:     { name: "SMG",     type: "gun",   range: 280, cd: 5,  ammo: 28, color: "#b47fff", spread: 0.1,  spd: 11, len: 7 },
    shotgun: { name: "SHOTGUN", type: "gun",   range: 140, cd: 24, ammo: 6,  color: "#ff6622", spread: 0.3,  spd: 10, pellets: 5, len: 8 }
  };

  /* pure pixel rect helper — always integer */
  function pr(ctx, px, py, pw, ph, c, s) {
    s = s || 2;
    ctx.fillStyle = c;
    ctx.fillRect(Math.floor(px) * s, Math.floor(py) * s, Math.floor(pw) * s, Math.floor(ph) * s);
  }

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
    ctx.globalAlpha = alpha * (hide ? 0.42 : 1);

    var jacket = flash > 0 ? "#ffffff" : col.jacket;
    var maskC  = flash > 0 ? "#ffffff" : col.mask;
    var body   = col.body;
    var phase  = walk * 1.4;
    var legL   = Math.round(Math.sin(phase) * 2);
    var legR   = Math.round(Math.sin(phase + Math.PI) * 2);
    var atkSwing = atk > 0 ? Math.sin((1 - atk / 12) * Math.PI) * 0.95 : 0;

    /* shadow */
    ctx.globalAlpha = alpha * 0.32 * (hide ? 0.4 : 1);
    pr(ctx, -4, 3, 8, 3, "#000000", s);
    ctx.globalAlpha = alpha * (hide ? 0.42 : 1);

    /* legs + shoes */
    pr(ctx, -3, 2 + legL, 2, 3, "#1a1a24", s);
    pr(ctx,  1, 2 + legR, 2, 3, "#1a1a24", s);
    pr(ctx, -3, 4 + legL, 2, 1, col.shoe || "#0a0a10", s);
    pr(ctx,  1, 4 + legR, 2, 1, col.shoe || "#0a0a10", s);

    /* torso / jacket */
    pr(ctx, -4, -2, 8, 5, jacket, s);
    /* arms */
    pr(ctx, -5, -1, 2, 2, body, s);
    pr(ctx,  3, -1, 2, 2, body, s);
    /* jacket accent stripe */
    pr(ctx, -2, -2, 4, 1, col.accent || jacket, s);

    /* mask / head */
    pr(ctx, -3, -5, 6, 4, maskC, s);
    pr(ctx, -3, -5, 6, 1, col.accent || "#333", s);

    /* eyes */
    pr(ctx, -2, -4, 1, 1, eye, s);
    pr(ctx,  1, -4, 1, 1, eye, s);

    /* weapon */
    ctx.save();
    ctx.rotate(atkSwing);
    var wlen = wp ? wp.len : 6;
    var wcol = wp ? wp.color : "#ccc";
    if (wp && wp.type === "gun") {
      pr(ctx, 3, -1, wlen, 2, wcol, s);
      pr(ctx, 3 + wlen - 1, -2, 2, 3, wcol, s);
      pr(ctx, 3 + wlen - 2, 0, 1, 2, "#222", s);
    } else {
      pr(ctx, 3, -1, wlen, 2, wcol, s);
      pr(ctx, 3 + wlen, -1, 1, 2, wcol, s);
    }
    ctx.restore();

    /* melee swing arc */
    if (atk > 0 && wp && wp.type === "melee") {
      ctx.globalAlpha = alpha * 0.45 * (atk / 12);
      pr(ctx, 4, -3, 3, 1, "#ff286e", s);
      pr(ctx, 5, -1, 3, 1, "#ff286e", s);
      pr(ctx, 4,  1, 3, 1, "#ff286e", s);
    }

    /* hide overlay */
    if (hide) {
      ctx.globalAlpha = alpha * 0.22;
      pr(ctx, -5, -6, 10, 12, "#00f5ff", s);
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  }

  /* brick wall — pure pixel */
  function drawWall(ctx, sx, sy, w, h) {
    var bs = 8;
    ctx.fillStyle = "#161622";
    ctx.fillRect(Math.round(sx), Math.round(sy), Math.round(w), Math.round(h));

    for (var by = 0; by < h; by += bs) {
      var off = ((by / bs) | 0) % 2 === 0 ? 0 : (bs >> 1);
      for (var bx = off; bx < w; bx += bs) {
        ctx.fillStyle = "#222232";
        ctx.fillRect(Math.round(sx + bx + 1), Math.round(sy + by + 1), bs - 2, bs - 2);
        /* highlight pixel */
        ctx.fillStyle = "#2c2c40";
        ctx.fillRect(Math.round(sx + bx + 1), Math.round(sy + by + 1), 2, 1);
      }
    }
    /* neon border */
    ctx.fillStyle = "#ff286e";
    ctx.fillRect(Math.round(sx), Math.round(sy), Math.round(w), 2);
    ctx.fillRect(Math.round(sx), Math.round(sy + h - 2), Math.round(w), 2);
    ctx.fillRect(Math.round(sx), Math.round(sy), 2, Math.round(h));
    ctx.fillRect(Math.round(sx + w - 2), Math.round(sy), 2, Math.round(h));
  }

  /* door — pure pixel + pixel labels */
  function drawDoor(ctx, sx, sy, w, h, open, canHide) {
    sx = Math.round(sx); sy = Math.round(sy);
    w = Math.round(w); h = Math.round(h);

    if (open) {
      /* EXIT door open */
      ctx.fillStyle = "rgba(0,245,255,0.18)";
      ctx.fillRect(sx, sy, w, h);
      ctx.fillStyle = "#00f5ff";
      ctx.fillRect(sx, sy, w, 2);
      ctx.fillRect(sx, sy + h - 2, w, 2);
      ctx.fillRect(sx, sy, 2, h);
      ctx.fillRect(sx + w - 2, sy, 2, h);
      /* pixel text EXIT */
      drawPixelText(ctx, "EXIT", sx + (w >> 1), sy + (h >> 1), "#00f5ff");
    } else {
      /* closed door */
      ctx.fillStyle = "#241018";
      ctx.fillRect(sx, sy, w, h);
      /* door panels */
      ctx.fillStyle = "#321420";
      ctx.fillRect(sx + 4, sy + 4, (w >> 1) - 6, h - 8);
      ctx.fillRect(sx + (w >> 1) + 2, sy + 4, (w >> 1) - 6, h - 8);
      /* handle pixels */
      ctx.fillStyle = "#ff286e";
      ctx.fillRect(sx + (w >> 1) - 1, sy + (h >> 1) - 2, 2, 4);

      /* border */
      ctx.fillStyle = "#ff286e";
      ctx.fillRect(sx, sy, w, 2);
      ctx.fillRect(sx, sy + h - 2, w, 2);
      ctx.fillRect(sx, sy, 2, h);
      ctx.fillRect(sx + w - 2, sy, 2, h);

      if (canHide) {
        /* glowing HIDE indicator */
        ctx.fillStyle = "rgba(0,245,255,0.25)";
        ctx.fillRect(sx + 6, sy + 6, w - 12, h - 12);
        drawPixelText(ctx, "HIDE", sx + (w >> 1), sy + (h >> 1), "#00f5ff");
      }
    }
  }

  /* tiny 3x5 pixel font for HIDE / EXIT */
  var FONT = {
    H: [[1,0,1],[1,0,1],[1,1,1],[1,0,1],[1,0,1]],
    I: [[1,1,1],[0,1,0],[0,1,0],[0,1,0],[1,1,1]],
    D: [[1,1,0],[1,0,1],[1,0,1],[1,0,1],[1,1,0]],
    E: [[1,1,1],[1,0,0],[1,1,0],[1,0,0],[1,1,1]],
    X: [[1,0,1],[1,0,1],[0,1,0],[1,0,1],[1,0,1]],
    T: [[1,1,1],[0,1,0],[0,1,0],[0,1,0],[0,1,0]]
  };

  function drawPixelText(ctx, str, cx, cy, color) {
    var scale = 2;
    var charW = 3 * scale + 2;
    var totalW = str.length * charW - 2;
    var startX = Math.round(cx - totalW / 2);
    var startY = Math.round(cy - 5);
    ctx.fillStyle = color;
    for (var i = 0; i < str.length; i++) {
      var ch = FONT[str[i]];
      if (!ch) continue;
      for (var row = 0; row < 5; row++) {
        for (var col = 0; col < 3; col++) {
          if (ch[row][col]) {
            ctx.fillRect(startX + i * charW + col * scale, startY + row * scale, scale, scale);
          }
        }
      }
    }
  }

  /* checker + pixel detail floor tile */
  function drawFloorTile(ctx, sx, sy, size, variant) {
    sx = Math.round(sx); sy = Math.round(sy);
    var base = variant ? "#12121c" : "#0e0e16";
    var dot  = variant ? "#181822" : "#14141c";
    ctx.fillStyle = base;
    ctx.fillRect(sx, sy, size, size);
    /* subtle pixel dots */
    ctx.fillStyle = dot;
    ctx.fillRect(sx + 4, sy + 4, 2, 2);
    ctx.fillRect(sx + size - 8, sy + size - 8, 2, 2);
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
