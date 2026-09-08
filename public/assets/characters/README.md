# Character 3D Assets Directory

Place your custom 3D main character model in this directory!

## File Name and Format
- **Recommended File Name**: `player.glb` (or `character.glb`)
- **Format**: Binary glTF (`.glb`) or standard `.gltf` with embedded textures.
- **Path**: `/public/assets/characters/player.glb`

## Features Supported
1. **Automatic Detection**: The game automatically looks for `player.glb` at boot.
2. **Skeletal Animations**: If your model has embedded animations (Idle, Walk, Run, Attack, Dodge/Roll, Death), the game's AnimationMixer will automatically cross-fade between them according to your combat actions.
3. **Procedural Fallback Animation**: If your model is a static mesh without bones/rigging, the engine will automatically apply dynamic combat tilts, running strides, and weapon arcs.
4. **Auto Bounding-Box Normalization**: The engine automatically normalizes your character height to ~1.95 units and grounds the feet to `y = 0`.
5. **In-Game Model Calibrator**: You can also fine-tune scale, rotation offset (e.g. 180° flip), and height offset via the in-game "Character Model" menu at any time.
