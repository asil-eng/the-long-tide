# Project: a story-driven 3D browser game (private fan project)
Single-player, third-person, adapted from the film Interstellar (2014): a farmer-pilot leaves his daughter on a dying, dusty Earth, travels through a wormhole, visits a water planet where 1 hour = 7 years on Earth, enters a black hole, and sends data back to his daughter through her bedroom bookshelf and a watch. Levels this session: 1) The Farm, 2) The Water Planet, 3) The Tesseract, then the Ending. Other levels are text cards for now. The full story is in STORY.md; read the relevant section before building each level.

## Tech
- Vite + Three.js (latest), plain JavaScript ES modules. Rapier (@dimforge/rapier3d-compat) for physics and the drivable truck. pmndrs postprocessing (with N8AO) for post effects.
- Folders: /src/core (renderer, loop, input, scenes), /src/systems (dialogue, cutscenes, time counter, audio, save), /src/levels/<level>, /src/assets (code-built assets), /public/models (.glb), /public/textures, /public/hdri, /public/audio, /src/story.js (all dialogue lines in one editable file).
- Everything must run at 60 fps on an ordinary laptop. Add a Low/High graphics toggle.

## Art direction: the most important part
Goal: a realistic, cinematic, lived-in look matching the film, with rich color. NOT generic "AI demo" graphics. Rules:
- Use the downloaded .glb models in /public/models, and Poly Haven HDRIs and PBR textures. No raw primitive cubes or spheres in the final game.
- Every level has a strict palette:
  - Farm: hazy golden hour. Warm amber and orange light, cool blue-teal shadows, pale gold corn, a weathered white house, a faded dusty truck, a dusty peach-brown sky.
  - Water Planet: bright and vast. Pale aqua water, a pearl-white sky, silver light, a huge black hole in the sky with a glowing gold ring.
  - Tesseract: deep indigo and violet, warm gold glowing threads, amber bookshelf light.
- Lighting carries the look: HDRI environment lighting, one strong sun with soft shadows, height fog tinted with the palette.
- Post-processing on High: ACES tone mapping, N8AO ambient occlusion, bloom on bright things only, a subtle vignette, color grading per level, SMAA.
- Motion everywhere: corn and grass sway in the wind (vertex shader), dust drifts, water moves, clouds move. A still world looks fake.
- Dust on everything on Earth: lighter, faded top surfaces, dirt on lower parts.
- Sound is part of the look: ambient wind, footsteps, engine and music per level.

## Assets
- Prefer the downloaded models in /public/models. Terrain, corn, grass, roads, sky, fog, dust, particles and water are built in code.
- Log every asset in CREDITS.md. Never print or commit the SKETCHFAB_TOKEN in .env.

## Quality checks
After every visual change, run the game, take a screenshot with Playwright from the player's view, critique it honestly against this art direction like a senior art director, and fix what looks cheap (flat lighting, empty areas, wrong colors, bad scale) before telling me it's done.

## Story rules
All dialogue is original (don't quote the film's script). Lines live in /src/story.js. Characters: Cooper (player), Murph (daughter, 10, later adult), Tom (son), Donald (grandfather), Professor Brand, Amelia Brand, Romilly, Doyle, Dr. Mann.

## Working style
Work on one level at a time. Initialize a git repo and commit after each working step. Don't ask me questions unless you're truly blocked; make sensible choices and tell me what you chose.
