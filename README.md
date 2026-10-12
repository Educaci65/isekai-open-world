# NEON RUSH

**100% Pixel-Art** top-down action (estilo Hotline Miami).

Sprites originales dibujados con rectángulos enteros. Sin suavizado.

**Jugar:** https://educaci65.github.io/isekai-open-world/

## Controles (móvil)
- **Joystick** — mover
- **HIT** — atacar / esconderse en puerta HIDE / salir del escondite
- **FIRE** — disparar
- **DASH** — esquivar (invulnerabilidad breve)

## Mecánicas
- Un golpe = muerte
- **Puertas HIDE**: acércate y pulsa **HIT** para esconderte. Los enemigos no te ven ni te disparan mientras estás oculto.
- **Historia** al inicio del juego y de cada sector (toca la pantalla para avanzar)
- Combos, score local, máscaras, armas (bate, cuchillo, pistola, SMG, escopeta)
- Salida por puertas EXIT cuando limpias el sector

## Estructura
```
index.html
css/style.css
js/sprites.js   ← pixel art (drawChar, drawWall, drawDoor, drawFloorTile)
js/game.js      ← motor + IA + story + hide
```

## Notas
- imageSmoothingEnabled = false + image-rendering: pixelated
- Todos los sprites usan coordenadas enteras y fillRect a escala 2
- Texto HIDE / EXIT dibujado con fuente pixel 3x5 propia
