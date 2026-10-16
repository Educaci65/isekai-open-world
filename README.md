# Top-Down Engine (HTML5 Canvas)

Plantilla genérica de motor cenital para GitHub Pages.

## Estructura

```
/
  index.html
  style.css
  script.js
  README.md
  assets/
    sprites/   ← PNG opcionales (ej. player.png)
    audio/     ← OGG/MP3 opcionales (ej. hit.ogg)
```

## Controles

| Entrada | Acción |
|---------|--------|
| WASD / Flechas | Mover |
| Espacio / Z / botón A | Atacar |
| X / E / botón B | Acción secundaria |
| Joystick (móvil) | Mover |
| ⏹ | Pantalla completa |

En iPhone/Safari los controles táctiles aparecen solos (`pointer: coarse` / pantallas estrechas).

## Añadir tus sprites

1. Sube `player.png` a `assets/sprites/`.
2. En `script.js`, descomenta en `MANIFEST.sprites`: `"player.png"`.
3. El motor lo dibujará orientado al movimiento; si falta, usa el círculo placeholder.

## GitHub Pages

Activa Pages en **Settings → Pages → Branch: main / root**.
