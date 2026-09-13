# Capas fotográficas de la habitación

Generadas con la herramienta integrada de imágenes a partir de `public/images/lysto-home.webp`. Los PNG originales se conservan en `public/images/room-source/`; la web usa WebP con transparencia. La composición animada es 2.5D: imágenes por capas, no un modelo volumétrico ni un reemplazo geométrico posterior a la carga.

## room-architecture

Use case: precise-object-edit. This is the background layer of an animated architectural scene. Edit the reference image with absolute camera, composition and pixel-position fidelity. Remove ONLY (1) the green sofa including all its pillows and throw, (2) the entire round coffee table and objects upon it, (3) the large foreground plant and its white pot at lower left. Reconstruct the visible walls, oak floor and blue circular rug behind those items naturally. KEEP the two walls, window and greenery outside, the air conditioner, wall painting, brass lamp, wooden cabinet and small decor, entire blue rug and floor EXACTLY where they are in the reference. Same beautiful photographic linen/wood/material rendering, same natural warm daylight and contact shadows. Full square canvas 1024x1024 aligned with the reference, same room size and camera, white background. No new objects, no text, no graphic labels. This is a clean architecture plate; high fidelity is essential.

## room-sofa

Use case: background-extraction. Extract ONLY the existing sage green sofa, its blue and cream cushions and cream throw blanket from the reference image, reconstructing no furniture other than what is already part of this sofa. Preserve the beautiful photographic fabric texture, exact geometry, lighting and same isometric camera, not a cartoon. Transparent background with actual alpha; all other objects including wall,floor,rug,plant,table,cabinet removed. CRITICAL REGISTRATION: deliver the entire square 1024x1024 reference canvas with the sofa still occupying exactly its original coordinates and size (approximately x45%-92%, y35%-68%); everything else transparent. Do not enlarge, recenter, rotate or crop the sofa. This is a precisely registered parallax layer for the original image. Include only a subtle small transparent contact shadow below its feet, not a floor surface. No text or labels.

## room-table

Use case: background-extraction. Extract ONLY the round wooden coffee table with its little plant in a white vase, blue book and cream cup/saucer from the reference. Preserve exact photographic wood, delicate leaves and materials, existing lighting and isometric perspective. Remove absolutely everything else including sofa,rug,floor,room,background. Real transparent alpha background. CRITICAL REGISTRATION: deliver the full square1024x1024 original reference canvas, table and its objects remain at their original coordinates and scale (approx x38%-62%, y53%-74%), not centered or enlarged. Nothing cut off, no text. Only a subtle small transparent contact shadow beneath the legs; no blue rug pixels. The intended output is a registered layer for the same room.

## room-plant

Use case: background-extraction. Isolate ONLY the large tropical plant and its rounded ivory pot in the lower-left foreground of the reference image. Keep exactly its broad leaves, stems, soil, pot, photoreal material and daylight lighting; preserve perspective. Completely remove window, cabinet,wall,floor,other objects. True transparent background alpha. CRITICAL REGISTRATION: full square1024x1024 original canvas, the plant must remain exactly at its original position and scale (approx x2%-28%,y35%-67%); do NOT center or enlarge the plant, keep all transparent margin. No text or labels. A very subtle contact shadow under pot is permitted but no floor.


