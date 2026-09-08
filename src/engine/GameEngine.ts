import * as THREE from 'three';
import { ActionState, EnemyEntity, FloatingText, JoystickConfig, GraphicSettings, PlayerStats, ChapterQuest } from '../types/game';
import { soundManager } from '../utils/audio';
import { triggerHaptic } from '../utils/storage';

export interface GameEngineCallbacks {
  onStatsUpdate: (stats: PlayerStats) => void;
  onFloatingText: (text: FloatingText) => void;
  onQuestUpdate: (quest: ChapterQuest) => void;
  onBossStateChange: (boss: EnemyEntity | null) => void;
  onGameOver: () => void;
  onVictory: () => void;
  onFpsUpdate: (fps: number) => void;
}

export class GameEngine {
  private container: HTMLElement;
  private callbacks: GameEngineCallbacks;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private clock: THREE.Clock;
  private isRunning = false;
  private animationFrameId: number | null = null;

  // Camera Orbit Control state
  public cameraYaw = 0; // Horizontal orbit around player
  public cameraPitch = 0.25; // Vertical angle (radians)
  public cameraDistance = 7.5;
  public targetLockEnemy: EnemyEntity | null = null;

  // Player state
  public playerPosition = new THREE.Vector3(0, 0, 0);
  public playerVelocity = new THREE.Vector3(0, 0, 0);
  public playerRotationY = 0;
  public playerAction: ActionState = 'IDLE';
  public actionTimer = 0;
  public playerVy = 0; // vertical velocity for jump & gravity
  public isGrounded = true;
  public comboStep = 0;
  public comboWindowTimer = 0;
  public parryTimer = 0;

  public stats: PlayerStats = {
    hp: 100,
    maxHp: 100,
    stamina: 100,
    maxStamina: 100,
    runes: 50,
    potions: 4,
    maxPotions: 4,
    potionHealAmount: 45,
    level: 1,
    score: 0,
    comboCount: 0,
    comboMultiplier: 1.0,
    isInvulnerable: false,
    isParrying: false,
    isSprinting: false,
  };

  public currentQuest: ChapterQuest = {
    chapter: 1,
    title: 'The Ruined Bastion',
    subtitle: 'Courtyard of Forgotten Ash',
    objective: 'Purge the Void Thralls invading the courtyard',
    requiredKills: 4,
    currentKills: 0,
    completed: false,
    bossAppeared: false,
  };

  // Joystick Input Vector
  public inputVector = { x: 0, y: 0, magnitude: 0 };
  public sprintToggled = false;

  // 3D Visual Objects
  private playerGroup!: THREE.Group;
  private playerTorso!: THREE.Mesh;
  private playerHead!: THREE.Mesh;
  private playerVisorGlow!: THREE.Mesh;
  private playerSword!: THREE.Group;
  private playerSwordBlade!: THREE.Mesh;
  private playerShield!: THREE.Mesh;
  private playerCape!: THREE.Mesh;
  private playerLeftArm!: THREE.Group;
  private playerRightArm!: THREE.Group;
  private playerLeftLeg!: THREE.Group;
  private playerRightLeg!: THREE.Group;
  private slashTrailMesh!: THREE.Mesh;

  // World objects
  private braziers: { light: THREE.PointLight; mesh: THREE.Group; x: number; z: number }[] = [];
  private enemies: EnemyEntity[] = [];
  private enemyMeshes: Map<string, THREE.Group> = new Map();
  private particles: {
    mesh: THREE.Mesh;
    velocity: THREE.Vector3;
    life: number;
    maxLife: number;
    color: THREE.Color;
    size: number;
  }[] = [];

  // Configs
  public joystickConfig: JoystickConfig;
  public graphicSettings: GraphicSettings;

  // FPS tracking
  private frameCount = 0;
  private lastFpsTime = 0;

  constructor(
    container: HTMLElement,
    callbacks: GameEngineCallbacks,
    joystickConfig: JoystickConfig,
    graphics: GraphicSettings
  ) {
    this.container = container;
    this.callbacks = callbacks;
    this.joystickConfig = joystickConfig;
    this.graphicSettings = graphics;

    // 1. Scene Setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0812);
    this.scene.fog = new THREE.FogExp2(0x0a0812, 0.028);

    // 2. Camera Setup
    const aspect = container.clientWidth / container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(55, aspect, 0.1, 120);
    this.camera.position.set(0, 4, 8);

    // 3. Renderer Setup
    this.renderer = new THREE.WebGLRenderer({
      antialias: graphics.resolutionScale >= 1.0,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, graphics.resolutionScale * 1.5));
    this.renderer.shadowMap.enabled = graphics.shadows !== 'off';
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    // Attach to DOM
    this.container.appendChild(this.renderer.domElement);

    this.clock = new THREE.Clock();

    // 4. Build Environment & Player
    this.buildWorld();
    this.playerGroup = this.buildPlayerModel();
    this.slashTrailMesh = this.buildSlashTrail();
    this.scene.add(this.playerGroup);
    this.scene.add(this.slashTrailMesh);

    // 5. Spawn Chapter 1 Enemies
    this.spawnChapterEnemies(1);

    // 6. Handle Window Resizing
    window.addEventListener('resize', this.onWindowResize);

    // Start ambient background music loop
    soundManager.startAmbientMusic();
  }

  private onWindowResize = () => {
    if (!this.container) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  private buildWorld() {
    // Ambient Light - cool dark cathedral moonlight
    const ambientLight = new THREE.AmbientLight(0x282045, 0.9);
    this.scene.add(ambientLight);

    // Directional Moonlight
    const moonLight = new THREE.DirectionalLight(0x7568a3, 1.2);
    moonLight.position.set(20, 35, 20);
    if (this.graphicSettings.shadows !== 'off') {
      moonLight.castShadow = true;
      moonLight.shadow.mapSize.width = 1024;
      moonLight.shadow.mapSize.height = 1024;
      moonLight.shadow.camera.near = 0.5;
      moonLight.shadow.camera.far = 80;
      moonLight.shadow.camera.left = -25;
      moonLight.shadow.camera.right = 25;
      moonLight.shadow.camera.top = 25;
      moonLight.shadow.camera.bottom = -25;
      moonLight.shadow.bias = -0.0005;
    }
    this.scene.add(moonLight);

    // Ground Floor: Flagstone arena with grid accents
    const groundGeo = new THREE.PlaneGeometry(80, 80, 40, 40);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x14121f,
      roughness: 0.85,
      metalness: 0.15,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = this.graphicSettings.shadows !== 'off';
    this.scene.add(ground);

    // Courtyard stone border tiles and runic circle
    const circleGeo = new THREE.RingGeometry(0.2, 14, 32);
    const circleMat = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.08,
      side: THREE.DoubleSide,
    });
    const ringMesh = new THREE.Mesh(circleGeo, circleMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.y = 0.02;
    this.scene.add(ringMesh);

    // Perimeter Cathedral Pillars & Gothic Buttresses
    const pillarGeo = new THREE.CylinderGeometry(0.7, 0.9, 9, 8);
    const pillarCapGeo = new THREE.BoxGeometry(2.2, 0.6, 2.2);
    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0x1f1a30,
      roughness: 0.9,
      metalness: 0.1,
    });

    const pillarPositions = [
      [-16, -16], [0, -18], [16, -16],
      [-18, 0], [18, 0],
      [-16, 16], [0, 18], [16, 16],
      [-8, -10], [8, -10], [-8, 10], [8, 10]
    ];

    pillarPositions.forEach(([px, pz]) => {
      const pillarGroup = new THREE.Group();
      const pMesh = new THREE.Mesh(pillarGeo, stoneMat);
      pMesh.position.y = 4.5;
      pMesh.castShadow = true;
      pMesh.receiveShadow = true;
      pillarGroup.add(pMesh);

      const cap = new THREE.Mesh(pillarCapGeo, stoneMat);
      cap.position.y = 9;
      cap.castShadow = true;
      pillarGroup.add(cap);

      pillarGroup.position.set(px, 0, pz);
      this.scene.add(pillarGroup);
    });

    // Boundary Ruined Walls
    const wallGeo = new THREE.BoxGeometry(40, 5, 1.5);
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x161324, roughness: 0.95 });

    const wallNorth = new THREE.Mesh(wallGeo, wallMat);
    wallNorth.position.set(0, 2.5, -22);
    wallNorth.castShadow = true;
    this.scene.add(wallNorth);

    const wallSouth = new THREE.Mesh(wallGeo, wallMat);
    wallSouth.position.set(0, 2.5, 22);
    wallSouth.castShadow = true;
    this.scene.add(wallSouth);

    // Braziers with dynamic glowing fire
    const brazierPositions = [
      [-10, -10], [10, -10],
      [-10, 10], [10, 10],
      [0, -14], [0, 14]
    ];

    brazierPositions.forEach(([bx, bz]) => {
      const bGroup = new THREE.Group();
      const standGeo = new THREE.CylinderGeometry(0.35, 0.55, 1.8, 8);
      const standMat = new THREE.MeshStandardMaterial({ color: 0x2b233a, metalness: 0.6, roughness: 0.4 });
      const stand = new THREE.Mesh(standGeo, standMat);
      stand.position.y = 0.9;
      stand.castShadow = true;
      bGroup.add(stand);

      // Bowl
      const bowlGeo = new THREE.CylinderGeometry(0.85, 0.4, 0.5, 8);
      const bowlMat = new THREE.MeshStandardMaterial({ color: 0x1f182c, metalness: 0.8, roughness: 0.3 });
      const bowl = new THREE.Mesh(bowlGeo, bowlMat);
      bowl.position.y = 1.9;
      bGroup.add(bowl);

      // Flame Core
      const flameGeo = new THREE.SphereGeometry(0.4, 8, 8);
      const flameMat = new THREE.MeshBasicMaterial({ color: 0xff7043 });
      const flame = new THREE.Mesh(flameGeo, flameMat);
      flame.position.y = 2.2;
      bGroup.add(flame);

      // Point Light
      const fireLight = new THREE.PointLight(0xff5722, 2.2, 14, 1.5);
      fireLight.position.set(0, 2.3, 0);
      bGroup.add(fireLight);

      bGroup.position.set(bx, 0, bz);
      this.scene.add(bGroup);

      this.braziers.push({ light: fireLight, mesh: bGroup, x: bx, z: bz });
    });
  }

  // Procedural Articulated 3D Player Knight
  private buildPlayerModel(): THREE.Group {
    const group = new THREE.Group();

    // Dark steel & gold trimmed armor materials
    const armorMat = new THREE.MeshStandardMaterial({
      color: 0x221e33,
      metalness: 0.85,
      roughness: 0.25,
    });
    const goldTrimMat = new THREE.MeshStandardMaterial({
      color: 0xdfa038,
      metalness: 0.9,
      roughness: 0.2,
    });
    const jointMat = new THREE.MeshStandardMaterial({
      color: 0x110f1a,
      roughness: 0.8,
    });

    // 1. Torso
    const torsoGeo = new THREE.BoxGeometry(0.85, 1.0, 0.55);
    this.playerTorso = new THREE.Mesh(torsoGeo, armorMat);
    this.playerTorso.position.y = 1.55;
    this.playerTorso.castShadow = true;
    group.add(this.playerTorso);

    // Torso gold trim crest
    const crestGeo = new THREE.BoxGeometry(0.3, 0.5, 0.58);
    const crest = new THREE.Mesh(crestGeo, goldTrimMat);
    this.playerTorso.add(crest);

    // 2. Head / Helmet
    const headGeo = new THREE.BoxGeometry(0.55, 0.55, 0.55);
    this.playerHead = new THREE.Mesh(headGeo, armorMat);
    this.playerHead.position.set(0, 0.8, 0);
    this.playerHead.castShadow = true;
    this.playerTorso.add(this.playerHead);

    // Glowing cyan visor eye-slit
    const visorGeo = new THREE.BoxGeometry(0.42, 0.09, 0.08);
    const visorMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee });
    this.playerVisorGlow = new THREE.Mesh(visorGeo, visorMat);
    this.playerVisorGlow.position.set(0, 0.04, 0.26);
    this.playerHead.add(this.playerVisorGlow);

    // Horns / Helmet Plumes
    const hornGeo = new THREE.ConeGeometry(0.08, 0.45, 5);
    const hornL = new THREE.Mesh(hornGeo, goldTrimMat);
    hornL.rotation.z = 0.5;
    hornL.position.set(-0.3, 0.25, 0);
    this.playerHead.add(hornL);

    const hornR = new THREE.Mesh(hornGeo, goldTrimMat);
    hornR.rotation.z = -0.5;
    hornR.position.set(0.3, 0.25, 0);
    this.playerHead.add(hornR);

    // 3. Pauldrons (Shoulders)
    const pauldronGeo = new THREE.BoxGeometry(0.45, 0.35, 0.45);
    const pauldronL = new THREE.Mesh(pauldronGeo, goldTrimMat);
    pauldronL.position.set(-0.6, 0.35, 0);
    this.playerTorso.add(pauldronL);

    const pauldronR = new THREE.Mesh(pauldronGeo, goldTrimMat);
    pauldronR.position.set(0.6, 0.35, 0);
    this.playerTorso.add(pauldronR);

    // 4. Flowing Cape
    const capeGeo = new THREE.PlaneGeometry(0.8, 1.4, 4, 4);
    const capeMat = new THREE.MeshStandardMaterial({
      color: 0x3b1c4a,
      roughness: 0.9,
      side: THREE.DoubleSide,
    });
    this.playerCape = new THREE.Mesh(capeGeo, capeMat);
    this.playerCape.position.set(0, 0.3, -0.32);
    this.playerCape.rotation.x = 0.15;
    this.playerTorso.add(this.playerCape);

    // 5. Left Arm & Kite Shield
    this.playerLeftArm = new THREE.Group();
    this.playerLeftArm.position.set(-0.55, 0.3, 0);
    const armGeo = new THREE.BoxGeometry(0.24, 0.7, 0.24);
    const armL = new THREE.Mesh(armGeo, armorMat);
    armL.position.y = -0.35;
    this.playerLeftArm.add(armL);

    // Shield
    const shieldGeo = new THREE.BoxGeometry(0.6, 0.9, 0.12);
    const shieldMat = new THREE.MeshStandardMaterial({
      color: 0x1e192c,
      metalness: 0.7,
      roughness: 0.3,
    });
    this.playerShield = new THREE.Mesh(shieldGeo, shieldMat);
    this.playerShield.position.set(-0.15, -0.35, 0.2);
    this.playerShield.castShadow = true;
    const shieldTrim = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.94, 0.05), goldTrimMat);
    this.playerShield.add(shieldTrim);
    this.playerLeftArm.add(this.playerShield);
    this.playerTorso.add(this.playerLeftArm);

    // 6. Right Arm & Runic Greatsword
    this.playerRightArm = new THREE.Group();
    this.playerRightArm.position.set(0.55, 0.3, 0);
    const armR = new THREE.Mesh(armGeo, armorMat);
    armR.position.y = -0.35;
    this.playerRightArm.add(armR);

    // Runic Greatsword
    this.playerSword = new THREE.Group();
    this.playerSword.position.set(0.1, -0.65, 0.2);

    const bladeGeo = new THREE.BoxGeometry(0.16, 1.7, 0.06);
    const bladeMat = new THREE.MeshStandardMaterial({
      color: 0x93c5fd,
      metalness: 0.95,
      roughness: 0.1,
    });
    this.playerSwordBlade = new THREE.Mesh(bladeGeo, bladeMat);
    this.playerSwordBlade.position.y = 0.85;
    this.playerSwordBlade.castShadow = true;
    this.playerSword.add(this.playerSwordBlade);

    // Emissive Cyan Rune Inlay on Sword
    const runeInlay = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 1.3, 0.08),
      new THREE.MeshBasicMaterial({ color: 0x22d3ee })
    );
    runeInlay.position.y = 0.85;
    this.playerSwordBlade.add(runeInlay);

    // Sword Crossguard & Pommel
    const guardMesh = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.08, 0.14), goldTrimMat);
    this.playerSword.add(guardMesh);
    const handleMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.35), jointMat);
    handleMesh.position.y = -0.2;
    this.playerSword.add(handleMesh);
    const pommelMesh = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), goldTrimMat);
    pommelMesh.position.y = -0.4;
    this.playerSword.add(pommelMesh);

    this.playerRightArm.add(this.playerSword);
    this.playerTorso.add(this.playerRightArm);

    // 7. Legs & Boots
    const legGeo = new THREE.BoxGeometry(0.3, 0.85, 0.32);

    this.playerLeftLeg = new THREE.Group();
    this.playerLeftLeg.position.set(-0.25, 0.95, 0);
    const legL = new THREE.Mesh(legGeo, armorMat);
    legL.position.y = -0.42;
    legL.castShadow = true;
    this.playerLeftLeg.add(legL);
    group.add(this.playerLeftLeg);

    this.playerRightLeg = new THREE.Group();
    this.playerRightLeg.position.set(0.25, 0.95, 0);
    const legR = new THREE.Mesh(legGeo, armorMat);
    legR.position.y = -0.42;
    legR.castShadow = true;
    this.playerRightLeg.add(legR);
    group.add(this.playerRightLeg);

    return group;
  }

  // 3D Sword Arc Slash Ribbon
  private buildSlashTrail(): THREE.Mesh {
    const geo = new THREE.RingGeometry(1.2, 2.4, 24, 1, 0, Math.PI * 0.85);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.y = 1.4;
    return mesh;
  }

  // Spawns enemies according to chapter progression
  public spawnChapterEnemies(chapter: number) {
    // Clear old meshes
    this.enemyMeshes.forEach(mesh => this.scene.remove(mesh));
    this.enemyMeshes.clear();
    this.enemies = [];

    if (chapter === 1) {
      this.currentQuest = {
        chapter: 1,
        title: 'The Ruined Bastion',
        subtitle: 'Courtyard of Forgotten Ash',
        objective: 'Purge the Void Thralls invading the courtyard',
        requiredKills: 4,
        currentKills: 0,
        completed: false,
        bossAppeared: false,
      };

      const spawnPoints = [
        { x: -8, z: -8 },
        { x: 8, z: -8 },
        { x: -9, z: 7 },
        { x: 9, z: 8 },
      ];

      spawnPoints.forEach((pos, idx) => {
        const id = `thrall_${idx + 1}`;
        const enemy: EnemyEntity = {
          id,
          type: 'VOID_THRALL',
          name: `Void Thrall #${idx + 1}`,
          x: pos.x,
          y: 0,
          z: pos.z,
          rotationY: Math.random() * Math.PI * 2,
          hp: 45,
          maxHp: 45,
          state: 'IDLE',
          attackTimer: 0,
          staggerTimer: 0,
        };
        this.enemies.push(enemy);
        this.createEnemyMesh(enemy);
      });
    } else if (chapter === 2) {
      this.currentQuest = {
        chapter: 2,
        title: 'The Hall of Cinders',
        subtitle: 'Inner Gate Garrison',
        objective: 'Defeat the Corrupted Ashen Knights guarding the sanctum',
        requiredKills: 3,
        currentKills: 0,
        completed: false,
        bossAppeared: false,
      };

      const guards = [
        { x: -6, z: -10, type: 'CORRUPTED_GUARD' as const, name: 'Ashen Defender Vael' },
        { x: 6, z: -10, type: 'CORRUPTED_GUARD' as const, name: 'Ashen Defender Korin' },
        { x: 0, z: -15, type: 'CORRUPTED_GUARD' as const, name: 'Corrupted Gatekeeper' },
      ];

      guards.forEach((g, idx) => {
        const id = `guard_${idx + 1}`;
        const enemy: EnemyEntity = {
          id,
          type: g.type,
          name: g.name,
          x: g.x,
          y: 0,
          z: g.z,
          rotationY: Math.PI,
          hp: 110,
          maxHp: 110,
          state: 'IDLE',
          attackTimer: 0,
          staggerTimer: 0,
        };
        this.enemies.push(enemy);
        this.createEnemyMesh(enemy);
      });
    } else if (chapter === 3) {
      this.currentQuest = {
        chapter: 3,
        title: 'Throne of the Void Inquisitor',
        subtitle: 'Abyssal Sanctuary',
        objective: 'Slay Inquisitor Malakor, Lord of the Abyss',
        requiredKills: 1,
        currentKills: 0,
        completed: false,
        bossAppeared: true,
      };

      const boss: EnemyEntity = {
        id: 'malakor_boss',
        type: 'MALAKOR_BOSS',
        name: 'Inquisitor Malakor',
        x: 0,
        y: 0,
        z: -12,
        rotationY: Math.PI,
        hp: 350,
        maxHp: 350,
        state: 'IDLE',
        attackTimer: 0,
        staggerTimer: 0,
        phase: 1,
      };
      this.enemies.push(boss);
      this.createEnemyMesh(boss);
      this.callbacks.onBossStateChange(boss);
    }

    this.callbacks.onQuestUpdate(this.currentQuest);
  }

  // Create 3D Meshes for enemies
  private createEnemyMesh(enemy: EnemyEntity) {
    const group = new THREE.Group();

    if (enemy.type === 'VOID_THRALL') {
      // Swarming purple shadow fiend
      const bodyMat = new THREE.MeshStandardMaterial({
        color: 0x180d2b,
        roughness: 0.6,
        metalness: 0.3,
      });
      const purpleGlowMat = new THREE.MeshBasicMaterial({ color: 0xc084fc });

      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.4), bodyMat);
      torso.position.y = 1.1;
      torso.castShadow = true;
      group.add(torso);

      const head = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.45), bodyMat);
      head.position.set(0, 0.65, 0.1);
      torso.add(head);

      // Glowing purple eyes
      const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), purpleGlowMat);
      eyeL.position.set(-0.12, 0.05, 0.24);
      head.add(eyeL);
      const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), purpleGlowMat);
      eyeR.position.set(0.12, 0.05, 0.24);
      head.add(eyeR);

      // Twin claw blades
      const clawMat = new THREE.MeshStandardMaterial({ color: 0x9333ea, metalness: 0.9 });
      const clawL = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.7, 4), clawMat);
      clawL.rotation.x = Math.PI / 2;
      clawL.position.set(-0.45, -0.2, 0.35);
      torso.add(clawL);

      const clawR = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.7, 4), clawMat);
      clawR.rotation.x = Math.PI / 2;
      clawR.position.set(0.45, -0.2, 0.35);
      torso.add(clawR);
    } else if (enemy.type === 'CORRUPTED_GUARD') {
      // Armored Ashen Guard with Spiked Mace
      const armorMat = new THREE.MeshStandardMaterial({ color: 0x24171a, metalness: 0.8, roughness: 0.3 });
      const redGlowMat = new THREE.MeshBasicMaterial({ color: 0xff3b30 });

      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.1, 0.6), armorMat);
      torso.position.y = 1.6;
      torso.castShadow = true;
      group.add(torso);

      const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), armorMat);
      head.position.set(0, 0.85, 0);
      torso.add(head);

      // Red visor slit
      const visor = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, 0.06), redGlowMat);
      visor.position.set(0, 0.05, 0.31);
      head.add(visor);

      // Spiked Mace in Right Hand
      const maceGroup = new THREE.Group();
      maceGroup.position.set(0.7, -0.2, 0.2);
      const maceShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.2), armorMat);
      maceShaft.position.y = 0.5;
      maceGroup.add(maceShaft);
      const maceHead = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22), redGlowMat);
      maceHead.position.y = 1.1;
      maceGroup.add(maceHead);
      torso.add(maceGroup);

      // Iron Tower Shield in Left Hand
      const shield = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.2, 0.1), armorMat);
      shield.position.set(-0.7, -0.1, 0.25);
      torso.add(shield);
    } else if (enemy.type === 'MALAKOR_BOSS') {
      // Giant Abyssal Lord (2.3x scale)
      const bossArmorMat = new THREE.MeshStandardMaterial({
        color: 0x12071f,
        metalness: 0.9,
        roughness: 0.15,
      });
      const bossEmberMat = new THREE.MeshBasicMaterial({ color: 0xff5722 });
      const bossVoidMat = new THREE.MeshBasicMaterial({ color: 0xa855f7 });

      const torso = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.9, 1.0), bossArmorMat);
      torso.position.y = 2.8;
      torso.castShadow = true;
      group.add(torso);

      // Giant Crowned Head
      const head = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.0, 1.0), bossArmorMat);
      head.position.set(0, 1.4, 0);
      torso.add(head);

      // Spiked Abyssal Crown
      [-0.4, -0.2, 0, 0.2, 0.4].forEach(x => {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.6, 4), bossVoidMat);
        spike.position.set(x, 0.7, 0.1);
        head.add(spike);
      });

      // Fiery Eyes & Visor
      const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), bossEmberMat);
      eyeL.position.set(-0.25, 0.1, 0.52);
      head.add(eyeL);
      const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), bossEmberMat);
      eyeR.position.set(0.25, 0.1, 0.52);
      head.add(eyeR);

      // Giant Double Scythe of Embers
      const scythe = new THREE.Group();
      scythe.position.set(1.2, 0, 0.4);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.2), bossArmorMat);
      pole.position.y = 0.8;
      scythe.add(pole);
      const blade = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.08, 6, 12, Math.PI * 0.7), bossEmberMat);
      blade.position.set(0.4, 2.1, 0);
      blade.rotation.z = -0.5;
      scythe.add(blade);
      torso.add(scythe);
    }

    group.position.set(enemy.x, enemy.y, enemy.z);
    group.rotation.y = enemy.rotationY;
    this.scene.add(group);
    this.enemyMeshes.set(enemy.id, group);
  }

  // Combat Input Actions
  public triggerLightAttack() {
    if (this.playerAction !== 'IDLE' && this.playerAction !== 'RUN' && this.playerAction !== 'SPRINT') {
      if (this.comboWindowTimer <= 0) return;
    }
    if (this.stats.stamina < 12) return;

    this.stats.stamina = Math.max(0, this.stats.stamina - 12);
    triggerHaptic(25);

    // Combo Progression (1 -> 2 -> 3 -> 1)
    if (this.comboStep === 0 || this.comboWindowTimer <= 0) {
      this.comboStep = 1;
      this.playerAction = 'ATTACK_1';
      this.actionTimer = 0.32;
      soundManager.playSwing(1.0);
    } else if (this.comboStep === 1) {
      this.comboStep = 2;
      this.playerAction = 'ATTACK_2';
      this.actionTimer = 0.32;
      soundManager.playSwing(1.2);
    } else {
      this.comboStep = 3;
      this.playerAction = 'ATTACK_3';
      this.actionTimer = 0.42;
      soundManager.playSwing(0.85);
    }

    this.comboWindowTimer = 0.65;
    this.performAttackHitCheck(this.comboStep);
  }

  public triggerHeavyCleave() {
    if (this.playerAction !== 'IDLE' && this.playerAction !== 'RUN' && this.playerAction !== 'SPRINT') return;
    if (this.stats.stamina < 28) return;

    this.stats.stamina = Math.max(0, this.stats.stamina - 28);
    this.playerAction = 'HEAVY_CLEAVE';
    this.actionTimer = 0.65;
    triggerHaptic(50);
    soundManager.playHeavyCleave();

    setTimeout(() => {
      this.performAttackHitCheck(4, true);
    }, 220);
  }

  public triggerRuneBurst() {
    if (this.stats.runes < 30) return;
    if (this.playerAction === 'RUNE_BURST' || this.playerAction === 'DEAD') return;

    this.stats.runes -= 30;
    this.playerAction = 'RUNE_BURST';
    this.actionTimer = 0.55;
    triggerHaptic(60);
    soundManager.playRuneBurst();

    // Spawn 3D Radiant Shockwave
    this.spawnRuneBurstParticles(this.playerPosition);

    // Hit all enemies in 6.5 radius
    this.enemies.forEach(enemy => {
      if (enemy.state === 'DEAD') return;
      const dist = this.playerPosition.distanceTo(new THREE.Vector3(enemy.x, enemy.y, enemy.z));
      if (dist <= 6.5) {
        this.damageEnemy(enemy, 55, true, 'RUNE BLAST!');
      }
    });
  }

  public triggerDodgeRoll() {
    if (this.stats.stamina < 20) return;
    if (this.playerAction === 'DODGE_ROLL' || this.playerAction === 'DEAD') return;

    this.stats.stamina = Math.max(0, this.stats.stamina - 20);
    this.playerAction = 'DODGE_ROLL';
    this.actionTimer = 0.42;
    this.stats.isInvulnerable = true;
    triggerHaptic(20);
    soundManager.playDodge();

    // Roll impulse vector
    let moveAngle = this.playerRotationY;
    if (this.inputVector.magnitude > 0.1) {
      moveAngle = Math.atan2(this.inputVector.x, this.inputVector.y) + this.cameraYaw;
    }
    this.playerVelocity.set(
      Math.sin(moveAngle) * 9.5,
      0,
      Math.cos(moveAngle) * 9.5
    );
  }

  public triggerParry() {
    if (this.stats.stamina < 15) return;
    if (this.playerAction === 'PARRY' || this.playerAction === 'DEAD') return;

    this.stats.stamina = Math.max(0, this.stats.stamina - 15);
    this.playerAction = 'PARRY';
    this.actionTimer = 0.45;
    this.parryTimer = 0.35; // active parry frame window
    this.stats.isParrying = true;
    triggerHaptic(30);
  }

  public triggerJump() {
    if (!this.isGrounded || this.playerAction === 'DEAD') return;
    this.playerVy = 7.5;
    this.isGrounded = false;
    triggerHaptic(15);
  }

  public triggerHealPotion() {
    if (this.stats.potions <= 0 || this.stats.hp >= this.stats.maxHp || this.playerAction === 'DEAD') return;

    this.stats.potions -= 1;
    this.stats.hp = Math.min(this.stats.maxHp, this.stats.hp + this.stats.potionHealAmount);
    this.playerAction = 'HEAL';
    this.actionTimer = 0.5;
    triggerHaptic(40);
    soundManager.playPotion();

    this.spawnHealParticles(this.playerPosition);
    this.callbacks.onFloatingText({
      id: Math.random().toString(),
      text: `+${this.stats.potionHealAmount} HP`,
      x: this.playerPosition.x,
      y: this.playerPosition.y + 2.2,
      z: this.playerPosition.z,
      color: '#4ade80',
      createdAt: Date.now(),
      duration: 1200,
      scale: 1.2,
    });
  }

  public toggleSprint() {
    this.sprintToggled = !this.sprintToggled;
    this.stats.isSprinting = this.sprintToggled;
    triggerHaptic(20);
  }

  public toggleLockOn() {
    if (this.targetLockEnemy) {
      this.targetLockEnemy = null;
    } else {
      // Find closest alive enemy within 15 units
      let closest: EnemyEntity | null = null;
      let minDist = 15;
      this.enemies.forEach(e => {
        if (e.state === 'DEAD') return;
        const d = this.playerPosition.distanceTo(new THREE.Vector3(e.x, e.y, e.z));
        if (d < minDist) {
          minDist = d;
          closest = e;
        }
      });
      this.targetLockEnemy = closest;
    }
    triggerHaptic(15);
  }

  public quickTurn180() {
    this.cameraYaw += Math.PI;
    this.playerRotationY += Math.PI;
    triggerHaptic(25);
  }

  // Attack hit registration
  private performAttackHitCheck(comboIndex: number, isHeavy = false) {
    const forward = new THREE.Vector3(
      Math.sin(this.playerRotationY),
      0,
      Math.cos(this.playerRotationY)
    ).normalize();

    const range = isHeavy ? 3.8 : 2.7;
    const baseDamage = isHeavy ? 48 : 20 + comboIndex * 6;

    // Show sword arc slash
    this.slashTrailMesh.position.copy(this.playerPosition);
    this.slashTrailMesh.rotation.z = this.playerRotationY + Math.PI / 2;
    (this.slashTrailMesh.material as THREE.MeshBasicMaterial).opacity = 0.85;

    let hitAny = false;

    this.enemies.forEach(enemy => {
      if (enemy.state === 'DEAD') return;
      const enemyPos = new THREE.Vector3(enemy.x, enemy.y, enemy.z);
      const toEnemy = enemyPos.clone().sub(this.playerPosition);
      const dist = toEnemy.length();

      if (dist <= range) {
        toEnemy.normalize();
        const dot = forward.dot(toEnemy);
        // Hit if enemy is within 120 degree cone in front of player
        if (dot > 0.25 || isHeavy) {
          hitAny = true;
          const isCrit = comboIndex === 3 || isHeavy;
          const dmg = Math.round(baseDamage * (isCrit ? 1.4 : 1.0) * this.stats.comboMultiplier);

          this.damageEnemy(enemy, dmg, isCrit);
          this.spawnHitSparks(enemyPos, isCrit);
        }
      }
    });

    if (hitAny) {
      this.stats.comboCount += 1;
      this.stats.comboMultiplier = Math.min(2.5, 1.0 + this.stats.comboCount * 0.1);
      this.stats.runes = Math.min(100, this.stats.runes + (isHeavy ? 18 : 8));
    }
  }

  private damageEnemy(enemy: EnemyEntity, damage: number, isCrit: boolean, customLabel?: string) {
    enemy.hp = Math.max(0, enemy.hp - damage);
    soundManager.playHit(isCrit);
    triggerHaptic(isCrit ? 40 : 20);

    // Stagger enemy
    enemy.state = 'STAGGER';
    enemy.staggerTimer = isCrit ? 0.6 : 0.35;

    this.callbacks.onFloatingText({
      id: Math.random().toString(),
      text: customLabel ? customLabel : isCrit ? `CRIT ${damage}!` : `${damage}`,
      x: enemy.x + (Math.random() - 0.5) * 0.5,
      y: enemy.y + 1.8 + Math.random() * 0.4,
      z: enemy.z + (Math.random() - 0.5) * 0.5,
      color: customLabel ? '#22d3ee' : isCrit ? '#f59e0b' : '#ffffff',
      createdAt: Date.now(),
      duration: 1000,
      scale: isCrit ? 1.3 : 1.0,
    });

    // Boss Phase 2 Transition Check
    if (enemy.type === 'MALAKOR_BOSS' && enemy.phase === 1 && enemy.hp <= enemy.maxHp * 0.5) {
      enemy.phase = 2;
      enemy.state = 'ENRAGED';
      this.callbacks.onFloatingText({
        id: Math.random().toString(),
        text: 'PHASE 2: ABYSSAL INFERNO!',
        x: enemy.x,
        y: enemy.y + 3.0,
        z: enemy.z,
        color: '#ff3b30',
        createdAt: Date.now(),
        duration: 2000,
        scale: 1.5,
      });
      soundManager.playRuneBurst();
    }

    if (enemy.hp <= 0) {
      enemy.state = 'DEAD';
      this.stats.score += enemy.type === 'MALAKOR_BOSS' ? 1000 : enemy.type === 'CORRUPTED_GUARD' ? 250 : 100;
      this.currentQuest.currentKills += 1;

      // Check Chapter completion
      if (this.currentQuest.currentKills >= this.currentQuest.requiredKills) {
        this.currentQuest.completed = true;
        if (this.currentQuest.chapter === 1) {
          setTimeout(() => this.spawnChapterEnemies(2), 1500);
        } else if (this.currentQuest.chapter === 2) {
          setTimeout(() => this.spawnChapterEnemies(3), 1500);
        } else if (this.currentQuest.chapter === 3) {
          setTimeout(() => this.callbacks.onVictory(), 2000);
        }
      }
      this.callbacks.onQuestUpdate(this.currentQuest);
    }

    if (enemy.type === 'MALAKOR_BOSS') {
      this.callbacks.onBossStateChange(enemy);
    }
  }

  // Damage player from enemy attacks
  private damagePlayer(damage: number, attackerName: string) {
    if (this.stats.isInvulnerable || this.stats.hp <= 0) return;

    // Check Parry Stance
    if (this.stats.isParrying && this.parryTimer > 0) {
      soundManager.playParry();
      triggerHaptic(50);
      this.callbacks.onFloatingText({
        id: Math.random().toString(),
        text: 'PARRY COUNTER!',
        x: this.playerPosition.x,
        y: this.playerPosition.y + 2.0,
        z: this.playerPosition.z,
        color: '#22d3ee',
        createdAt: Date.now(),
        duration: 1200,
        scale: 1.4,
      });
      this.stats.runes = Math.min(100, this.stats.runes + 25);
      return;
    }

    this.stats.hp = Math.max(0, this.stats.hp - damage);
    soundManager.playHurt();
    triggerHaptic(45);
    this.playerAction = 'HURT';
    this.actionTimer = 0.25;

    this.callbacks.onFloatingText({
      id: Math.random().toString(),
      text: `-${damage}`,
      x: this.playerPosition.x,
      y: this.playerPosition.y + 1.8,
      z: this.playerPosition.z,
      color: '#ef4444',
      createdAt: Date.now(),
      duration: 1000,
      scale: 1.1,
    });

    if (this.stats.hp <= 0) {
      this.playerAction = 'DEAD';
      this.callbacks.onGameOver();
    }
  }

  // Particle Emitters
  private spawnHitSparks(pos: THREE.Vector3, isCrit: boolean) {
    const count = isCrit ? 16 : 8;
    const color = isCrit ? new THREE.Color(0xf59e0b) : new THREE.Color(0x67e8f9);
    for (let i = 0; i < count; i++) {
      const pGeo = new THREE.SphereGeometry(0.06, 4, 4);
      const pMat = new THREE.MeshBasicMaterial({ color });
      const p = new THREE.Mesh(pGeo, pMat);
      p.position.set(
        pos.x + (Math.random() - 0.5) * 0.4,
        pos.y + 1.2 + (Math.random() - 0.5) * 0.4,
        pos.z + (Math.random() - 0.5) * 0.4
      );
      this.scene.add(p);

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 6,
        Math.random() * 5 + 2,
        (Math.random() - 0.5) * 6
      );
      this.particles.push({ mesh: p, velocity: vel, life: 0, maxLife: 0.35, color, size: 0.06 });
    }
  }

  private spawnRuneBurstParticles(pos: THREE.Vector3) {
    const ringGeo = new THREE.RingGeometry(0.2, 0.6, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(pos.x, 0.1, pos.z);
    this.scene.add(ring);

    this.particles.push({
      mesh: ring,
      velocity: new THREE.Vector3(0, 0, 0),
      life: 0,
      maxLife: 0.5,
      color: new THREE.Color(0x22d3ee),
      size: 1.0,
    });
  }

  private spawnHealParticles(pos: THREE.Vector3) {
    for (let i = 0; i < 12; i++) {
      const pGeo = new THREE.SphereGeometry(0.08, 4, 4);
      const pMat = new THREE.MeshBasicMaterial({ color: 0x4ade80 });
      const p = new THREE.Mesh(pGeo, pMat);
      const angle = (i / 12) * Math.PI * 2;
      p.position.set(pos.x + Math.cos(angle) * 0.8, 0.2, pos.z + Math.sin(angle) * 0.8);
      this.scene.add(p);
      this.particles.push({
        mesh: p,
        velocity: new THREE.Vector3(Math.cos(angle) * 0.4, 2.5, Math.sin(angle) * 0.4),
        life: 0,
        maxLife: 0.7,
        color: new THREE.Color(0x4ade80),
        size: 0.08,
      });
    }
  }

  // Main Loop Update
  public update(delta: number) {
    const clampedDelta = Math.min(delta, 0.1);

    // FPS calculation
    this.frameCount++;
    const now = performance.now();
    if (now - this.lastFpsTime >= 1000) {
      this.callbacks.onFpsUpdate(Math.round((this.frameCount * 1000) / (now - this.lastFpsTime)));
      this.frameCount = 0;
      this.lastFpsTime = now;
    }

    // 1. Update Stamina & Action timers
    if (this.stats.stamina < this.stats.maxStamina) {
      const regenRate = this.stats.isSprinting ? 0 : 18;
      this.stats.stamina = Math.min(this.stats.maxStamina, this.stats.stamina + regenRate * clampedDelta);
    }

    if (this.actionTimer > 0) {
      this.actionTimer -= clampedDelta;
      if (this.actionTimer <= 0) {
        if (this.playerAction !== 'DEAD') {
          this.playerAction = 'IDLE';
          this.stats.isInvulnerable = false;
          this.stats.isParrying = false;
        }
      }
    }

    if (this.comboWindowTimer > 0) {
      this.comboWindowTimer -= clampedDelta;
      if (this.comboWindowTimer <= 0) {
        this.comboStep = 0;
        this.stats.comboCount = 0;
        this.stats.comboMultiplier = 1.0;
      }
    }

    if (this.parryTimer > 0) {
      this.parryTimer -= clampedDelta;
      if (this.parryTimer <= 0) {
        this.stats.isParrying = false;
      }
    }

    // 2. Player Movement Physics
    const isSprint = (this.sprintToggled || this.inputVector.magnitude >= this.joystickConfig.sprintThreshold) && this.stats.stamina > 5;
    this.stats.isSprinting = isSprint && this.inputVector.magnitude > 0.2;

    if (isSprint && this.stats.isSprinting) {
      this.stats.stamina = Math.max(0, this.stats.stamina - 10 * clampedDelta);
    }

    const moveSpeed = isSprint ? 8.5 : 5.2;

    if (
      this.playerAction === 'IDLE' ||
      this.playerAction === 'RUN' ||
      this.playerAction === 'SPRINT'
    ) {
      if (this.inputVector.magnitude > 0.05) {
        // Calculate movement angle relative to camera yaw
        const stickAngle = Math.atan2(this.inputVector.x, this.inputVector.y);
        const targetRotation = stickAngle + this.cameraYaw;

        // Smooth rotation
        let diff = targetRotation - this.playerRotationY;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        this.playerRotationY += diff * 12.0 * clampedDelta;

        const effectiveMag = Math.min(1.0, this.inputVector.magnitude);
        const speed = effectiveMag * moveSpeed;

        this.playerVelocity.x = Math.sin(this.playerRotationY) * speed;
        this.playerVelocity.z = Math.cos(this.playerRotationY) * speed;
        this.playerAction = isSprint ? 'SPRINT' : 'RUN';
      } else {
        this.playerVelocity.x *= 0.75;
        this.playerVelocity.z *= 0.75;
        this.playerAction = 'IDLE';
      }
    } else if (this.playerAction === 'DODGE_ROLL') {
      // Roll maintains momentum
      this.playerVelocity.x *= 0.94;
      this.playerVelocity.z *= 0.94;
    } else {
      this.playerVelocity.x *= 0.5;
      this.playerVelocity.z *= 0.5;
    }

    // Gravity & Vertical Physics
    if (!this.isGrounded) {
      this.playerVy -= 18.0 * clampedDelta;
      this.playerPosition.y += this.playerVy * clampedDelta;
      if (this.playerPosition.y <= 0) {
        this.playerPosition.y = 0;
        this.playerVy = 0;
        this.isGrounded = true;
      }
    }

    // Apply Velocity to Position with Arena Boundary limits
    this.playerPosition.x += this.playerVelocity.x * clampedDelta;
    this.playerPosition.z += this.playerVelocity.z * clampedDelta;
    this.playerPosition.x = THREE.MathUtils.clamp(this.playerPosition.x, -21, 21);
    this.playerPosition.z = THREE.MathUtils.clamp(this.playerPosition.z, -21, 21);

    // Update Player Model Transform
    this.playerGroup.position.copy(this.playerPosition);
    this.playerGroup.rotation.y = this.playerRotationY;

    // 3. Player Model Procedural Animation
    const animTime = this.clock.getElapsedTime();
    if (this.playerAction === 'RUN' || this.playerAction === 'SPRINT') {
      const strideFreq = this.playerAction === 'SPRINT' ? 14 : 9;
      this.playerLeftLeg.rotation.x = Math.sin(animTime * strideFreq) * 0.65;
      this.playerRightLeg.rotation.x = -Math.sin(animTime * strideFreq) * 0.65;
      this.playerLeftArm.rotation.x = -Math.sin(animTime * strideFreq) * 0.45;
      this.playerRightArm.rotation.x = Math.sin(animTime * strideFreq) * 0.45;
      this.playerCape.rotation.x = 0.4 + Math.sin(animTime * strideFreq) * 0.25;
      this.playerTorso.position.y = 1.55 + Math.abs(Math.sin(animTime * strideFreq)) * 0.08;
    } else if (this.playerAction === 'IDLE') {
      this.playerLeftLeg.rotation.x = 0;
      this.playerRightLeg.rotation.x = 0;
      this.playerLeftArm.rotation.x = 0;
      this.playerRightArm.rotation.x = 0;
      this.playerTorso.position.y = 1.55 + Math.sin(animTime * 2.5) * 0.03;
      this.playerCape.rotation.x = 0.15 + Math.sin(animTime * 2) * 0.05;
    } else if (this.playerAction === 'ATTACK_1') {
      this.playerRightArm.rotation.z = -0.8;
      this.playerRightArm.rotation.y = Math.sin((0.32 - this.actionTimer) * 12) * 1.6;
    } else if (this.playerAction === 'ATTACK_2') {
      this.playerRightArm.rotation.z = 0.8;
      this.playerRightArm.rotation.y = -Math.sin((0.32 - this.actionTimer) * 12) * 1.6;
    } else if (this.playerAction === 'ATTACK_3' || this.playerAction === 'HEAVY_CLEAVE') {
      this.playerRightArm.rotation.x = -Math.PI * 0.7 + (1.0 - this.actionTimer) * Math.PI;
    } else if (this.playerAction === 'PARRY') {
      this.playerLeftArm.position.set(-0.2, 0.4, 0.3);
      this.playerLeftArm.rotation.y = 0.6;
    } else if (this.playerAction === 'DODGE_ROLL') {
      this.playerTorso.rotation.x = (0.42 - this.actionTimer) * Math.PI * 4;
    }

    // Fade out sword arc
    const slashMat = this.slashTrailMesh.material as THREE.MeshBasicMaterial;
    if (slashMat.opacity > 0) {
      slashMat.opacity = Math.max(0, slashMat.opacity - 4.0 * clampedDelta);
    }

    // 4. Enemy AI Update
    this.enemies.forEach(enemy => {
      if (enemy.state === 'DEAD') {
        const mesh = this.enemyMeshes.get(enemy.id);
        if (mesh) {
          mesh.position.y = Math.max(-2, mesh.position.y - 1.5 * clampedDelta);
          mesh.scale.multiplyScalar(0.96);
        }
        return;
      }

      const enemyPos = new THREE.Vector3(enemy.x, enemy.y, enemy.z);
      const toPlayer = this.playerPosition.clone().sub(enemyPos);
      const dist = toPlayer.length();

      // Enemy Stagger Recovery
      if (enemy.state === 'STAGGER') {
        enemy.staggerTimer -= clampedDelta;
        if (enemy.staggerTimer <= 0) enemy.state = 'IDLE';
        return;
      }

      // AI Decision
      if (dist < 18) {
        toPlayer.normalize();
        enemy.rotationY = Math.atan2(toPlayer.x, toPlayer.z);

        const attackRange = enemy.type === 'MALAKOR_BOSS' ? 4.5 : 2.2;

        if (dist > attackRange) {
          // Chase player
          const speed = enemy.type === 'VOID_THRALL' ? 4.0 : enemy.type === 'MALAKOR_BOSS' ? 3.2 : 2.6;
          enemy.x += toPlayer.x * speed * clampedDelta;
          enemy.z += toPlayer.z * speed * clampedDelta;
          enemy.state = 'CHASE';
        } else {
          // Attack windup & attack execution
          enemy.attackTimer += clampedDelta;
          const windupDuration = enemy.type === 'MALAKOR_BOSS' ? 1.4 : 1.1;

          if (enemy.attackTimer >= windupDuration) {
            enemy.attackTimer = 0;
            const enemyDmg = enemy.type === 'MALAKOR_BOSS' ? 32 : enemy.type === 'CORRUPTED_GUARD' ? 22 : 14;
            this.damagePlayer(enemyDmg, enemy.name);
          }
        }
      }

      // Update enemy mesh position & rotation
      const eMesh = this.enemyMeshes.get(enemy.id);
      if (eMesh) {
        eMesh.position.set(enemy.x, enemy.y, enemy.z);
        eMesh.rotation.y = enemy.rotationY;
      }
    });

    // 5. Update Camera Position (Orbit & Target Lock)
    if (this.targetLockEnemy && this.targetLockEnemy.state !== 'DEAD') {
      const enemyPos = new THREE.Vector3(this.targetLockEnemy.x, this.targetLockEnemy.y, this.targetLockEnemy.z);
      const dir = enemyPos.clone().sub(this.playerPosition).normalize();
      this.cameraYaw = Math.atan2(-dir.x, -dir.z);
    }

    const camX = this.playerPosition.x + Math.sin(this.cameraYaw) * Math.cos(this.cameraPitch) * this.cameraDistance;
    const camY = this.playerPosition.y + Math.sin(this.cameraPitch) * this.cameraDistance + 1.8;
    const camZ = this.playerPosition.z + Math.cos(this.cameraYaw) * Math.cos(this.cameraPitch) * this.cameraDistance;

    this.camera.position.set(camX, camY, camZ);
    this.camera.lookAt(this.playerPosition.x, this.playerPosition.y + 1.5, this.playerPosition.z);

    // 6. Flickering Brazier Fire
    this.braziers.forEach((b, i) => {
      b.light.intensity = 1.8 + Math.sin(animTime * 8 + i * 2) * 0.4 + (Math.random() - 0.5) * 0.2;
    });

    // 7. Update Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += clampedDelta;
      if (p.life >= p.maxLife) {
        this.scene.remove(p.mesh);
        this.particles.splice(i, 1);
        continue;
      }

      p.mesh.position.addScaledVector(p.velocity, clampedDelta);
      if (p.mesh.geometry.type === 'RingGeometry') {
        const scale = 1.0 + (p.life / p.maxLife) * 12.0;
        p.mesh.scale.set(scale, scale, 1);
        (p.mesh.material as THREE.MeshBasicMaterial).opacity = 1.0 - p.life / p.maxLife;
      } else {
        p.velocity.y -= 9.8 * clampedDelta;
        const fade = 1.0 - p.life / p.maxLife;
        p.mesh.scale.setScalar(p.size * fade);
      }
    }

    // 8. Render Scene
    this.renderer.render(this.scene, this.camera);
    this.callbacks.onStatsUpdate({ ...this.stats });
  }

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.clock.start();

    const loop = () => {
      if (!this.isRunning) return;
      const delta = this.clock.getDelta();
      this.update(delta);
      this.animationFrameId = requestAnimationFrame(loop);
    };
    loop();
  }

  public stop() {
    this.isRunning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  public destroy() {
    this.stop();
    soundManager.stopAmbientMusic();
    window.removeEventListener('resize', this.onWindowResize);
    if (this.renderer && this.renderer.domElement && this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
    this.renderer.dispose();
  }
}
