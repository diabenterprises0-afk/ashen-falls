import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  ActionState,
  EnemyEntity,
  FloatingText,
  JoystickConfig,
  GraphicSettings,
  PlayerStats,
  ChapterQuest,
  ModelCalibrationConfig,
  CustomModelInfo,
} from '../types/game';
import { soundManager } from '../utils/audio';
import { triggerHaptic } from '../utils/storage';
import { parallelAssetLoader, LoadedGameAssets } from './ParallelAssetLoader';

export interface GameEngineCallbacks {
  onStatsUpdate: (stats: PlayerStats) => void;
  onFloatingText: (text: FloatingText) => void;
  onQuestUpdate: (quest: ChapterQuest) => void;
  onBossStateChange: (boss: EnemyEntity | null) => void;
  onGameOver: () => void;
  onVictory: () => void;
  onFpsUpdate: (fps: number) => void;
  onModelInfoUpdate?: (info: CustomModelInfo) => void;
}

interface PooledParticle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  active: boolean;
  isRing: boolean;
  baseSize: number;
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

  // Ash Animation & State Machine Properties
  public isSwordEquipped = false;
  public swordDrawnMesh: THREE.Object3D | null = null;
  public swordSheathedMesh: THREE.Object3D | null = null;

  public isDead = false;
  public isDodging = false;
  public dodgeTimer = 0;
  public dodgeCooldownTimer = 0;

  public isHitStunned = false;
  public hitStunTimer = 0;

  public isJumping = false;
  public isDoubleJumping = false;
  public doubleJumpAvailable = true;
  public isLanding = false;
  public landingTimer = 0;

  public isAttacking = false;
  public activeAttackClipName = '';
  public attackAnimTime = 0;
  public attackAnimDuration = 0;
  public comboWindowStart = 0;
  public comboWindowEnd = 0;
  public inputBufferAttack = false;
  public comboAdvanced = false;
  public unarmedComboStep = 0;

  public isDrawingSword = false;
  public swordDashCooldownTimer = 0;
  public isSwordDashing = false;

  public isCrawlInputActive = false;
  public currentAshClipName = '';
  public primaryAnimState: string = 'IDLE';

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
  private proceduralKnightGroup!: THREE.Group;
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

  // Lighting References
  private keyLight!: THREE.DirectionalLight;
  private fillLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;
  private groundMesh!: THREE.Mesh;

  // Custom GLB Model & Animations
  public modelConfig: ModelCalibrationConfig;
  public customModelInfo: CustomModelInfo;
  private customModelGroup: THREE.Group | null = null;
  private animationMixer: THREE.AnimationMixer | null = null;
  private animationActions: Map<string, THREE.AnimationAction> = new Map();
  private currentAnimationAction: THREE.AnimationAction | null = null;
  private gltfLoader = new GLTFLoader();

  // Material references for parallel texture streaming
  private groundMat: THREE.MeshStandardMaterial | null = null;
  private wallMat: THREE.MeshStandardMaterial | null = null;
  private stoneMat: THREE.MeshStandardMaterial | null = null;
  private circleMat: THREE.MeshBasicMaterial | null = null;
  private loadedAssets: LoadedGameAssets | null = null;

  // World objects & Obstacles
  private braziers: { light: THREE.PointLight; mesh: THREE.Group; x: number; z: number }[] = [];
  private enemies: EnemyEntity[] = [];
  private enemyMeshes: Map<string, THREE.Group> = new Map();
  private arenaObstacles: { x: number; z: number; radius: number }[] = [];

  // Zero-Allocation Particle Pool
  private particlePool: PooledParticle[] = [];
  private sparkGeo = new THREE.SphereGeometry(0.06, 4, 4);
  private ringGeo = new THREE.RingGeometry(0.2, 0.6, 20);
  private critSparkMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
  private normalSparkMat = new THREE.MeshBasicMaterial({ color: 0x67e8f9 });
  private healSparkMat = new THREE.MeshBasicMaterial({ color: 0x4ade80 });
  private runeRingMat = new THREE.MeshBasicMaterial({
    color: 0x22d3ee,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.9,
  });

  // Shared Brazier Geometries & Materials (Instanced/Reused for zero duplicate allocations)
  private brazierStandGeo = new THREE.CylinderGeometry(0.35, 0.55, 1.8, 6);
  private brazierBowlGeo = new THREE.CylinderGeometry(0.85, 0.4, 0.5, 6);
  private brazierFlameGeo = new THREE.SphereGeometry(0.35, 6, 6);
  private brazierStandMat = new THREE.MeshStandardMaterial({ color: 0x362c4a, metalness: 0.6, roughness: 0.4 });
  private brazierBowlMat = new THREE.MeshStandardMaterial({ color: 0x272036, metalness: 0.8, roughness: 0.3 });
  private brazierFlameMat = new THREE.MeshBasicMaterial({ color: 0xff7043 });

  // Smooth Camera Vectors
  private smoothedCamPos = new THREE.Vector3(0, 4, 8);
  private smoothedCamTarget = new THREE.Vector3(0, 1.5, 0);

  // Throttled Stats Updates to React
  private lastStatsEmitTime = 0;
  private prevHp = -1;
  private prevStamina = -1;
  private prevRunes = -1;
  private prevPotions = -1;
  private prevScore = -1;
  private prevCombo = -1;
  private prevInvuln = false;
  private prevParry = false;
  private prevSprint = false;
  private prevSword = false;
  private prevCanDJ = false;

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
    graphics: GraphicSettings,
    modelConfig: ModelCalibrationConfig = {
      scaleMultiplier: 1.0,
      yOffset: 0.0,
      rotationOffsetY: 0,
      castShadows: true,
      useEmbeddedAnimations: true,
    }
  ) {
    this.container = container;
    this.callbacks = callbacks;
    this.joystickConfig = joystickConfig;
    this.graphicSettings = graphics;
    this.modelConfig = modelConfig;

    this.customModelInfo = {
      isLoaded: false,
      name: 'Ash.glb',
      source: 'static_url',
      hasAnimations: true,
      animationNames: [],
      meshCount: 0,
      vertexCount: 0,
      config: { ...modelConfig },
    };

    // 1. Scene Setup with atmospheric gothic fog
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0e0b16);
    this.scene.fog = new THREE.FogExp2(0x0e0b16, 0.022);

    // 2. Camera Setup
    const aspect = this.container.clientWidth / this.container.clientHeight || 1;
    this.camera = new THREE.PerspectiveCamera(52, aspect, 0.1, 120);
    this.camera.position.set(0, 4.5, 8);

    // 3. WebGL Renderer with High-Performance Settings
    this.renderer = new THREE.WebGLRenderer({
      antialias: graphics.resolutionScale >= 1.0,
      powerPreference: 'high-performance',
      precision: 'mediump',
      stencil: false,
      depth: true,
    });

    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.renderer.setSize(width, height);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Apply Graphics / Shadow Settings
    this.applyGraphicSettings(graphics);

    // Attach to DOM
    this.container.appendChild(this.renderer.domElement);
    this.clock = new THREE.Clock();

    // 4. Initialize Zero-Allocation Particle Pool (64 reusable particles)
    this.initParticlePool(64);

    // 5. Build Environment & Player
    this.buildWorld();
    this.playerGroup = this.buildPlayerModel();
    this.slashTrailMesh = this.buildSlashTrail();
    this.scene.add(this.playerGroup);
    this.scene.add(this.slashTrailMesh);

    // 6. Spawn Chapter 1 Enemies
    this.spawnChapterEnemies(1);

    // 7. Handle Window Resizing
    window.addEventListener('resize', this.onWindowResize);
  }

  // Live graphic settings adjustment without reloading
  public applyGraphicSettings(graphics: GraphicSettings) {
    this.graphicSettings = graphics;

    const dpr = window.devicePixelRatio || 1;
    let targetRatio = 1.0;
    if (graphics.lowEndMode || graphics.resolutionScale <= 0.75) {
      targetRatio = Math.min(dpr * 0.75, 0.85);
    } else if (graphics.resolutionScale >= 1.0) {
      targetRatio = Math.min(dpr, 1.25);
    } else {
      targetRatio = Math.min(dpr, 1.0);
    }
    this.renderer.setPixelRatio(targetRatio);

    if (graphics.shadows === 'off' || graphics.lowEndMode) {
      this.renderer.shadowMap.enabled = false;
      if (this.keyLight) this.keyLight.castShadow = false;
      if (this.groundMesh) this.groundMesh.receiveShadow = false;
    } else if (graphics.shadows === 'low') {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.BasicShadowMap;
      if (this.keyLight) {
        this.keyLight.castShadow = true;
        this.keyLight.shadow.mapSize.set(512, 512);
        this.keyLight.shadow.bias = -0.0001;
        this.keyLight.shadow.normalBias = 0.04;
      }
      if (this.groundMesh) this.groundMesh.receiveShadow = true;
    } else {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      if (this.keyLight) {
        this.keyLight.castShadow = true;
        this.keyLight.shadow.mapSize.set(1024, 1024);
        this.keyLight.shadow.bias = -0.0001;
        this.keyLight.shadow.normalBias = 0.04;
      }
      if (this.groundMesh) this.groundMesh.receiveShadow = true;
    }

    // Toggle point lights for low-end mobile optimization (emissive fire mesh stays visible)
    const enablePointLights = !graphics.lowEndMode && graphics.shadows !== 'off';
    this.braziers.forEach(b => {
      if (b.light) b.light.visible = enablePointLights;
    });
  }

  private onWindowResize = () => {
    if (!this.container) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (width === 0 || height === 0) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  private initParticlePool(capacity: number) {
    const sparkCount = capacity - 8;
    for (let i = 0; i < sparkCount; i++) {
      const mesh = new THREE.Mesh(this.sparkGeo, this.normalSparkMat);
      mesh.visible = false;
      mesh.frustumCulled = false;
      this.scene.add(mesh);
      this.particlePool.push({
        mesh,
        velocity: new THREE.Vector3(),
        life: 0,
        maxLife: 1.0,
        active: false,
        isRing: false,
        baseSize: 0.06,
      });
    }

    for (let i = 0; i < 8; i++) {
      const mesh = new THREE.Mesh(this.ringGeo, this.runeRingMat);
      mesh.visible = false;
      mesh.frustumCulled = false;
      mesh.rotation.x = -Math.PI / 2;
      this.scene.add(mesh);
      this.particlePool.push({
        mesh,
        velocity: new THREE.Vector3(),
        life: 0,
        maxLife: 0.5,
        active: false,
        isRing: true,
        baseSize: 1.0,
      });
    }
  }

  private buildWorld() {
    // 1. Procedural Environment Map for PBR Specular Reflections (avoids black metals)
    try {
      const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
      pmremGenerator.compileEquirectangularShader();
      const envScene = new THREE.Scene();
      envScene.background = new THREE.Color(0x141829);

      const envLight1 = new THREE.DirectionalLight(0xa0c0ff, 2.0);
      envLight1.position.set(1, 2, 1);
      envScene.add(envLight1);

      const envLight2 = new THREE.DirectionalLight(0xffa060, 1.2);
      envLight2.position.set(-1, -1, -1);
      envScene.add(envLight2);

      const envTexture = pmremGenerator.fromScene(envScene, 0.04).texture;
      this.scene.environment = envTexture;
      pmremGenerator.dispose();
    } catch (e) {
      console.warn('Failed to build PMREM environment:', e);
    }

    // 2. Hemisphere Ambient Light - balanced moonlight sky & dark earth ground
    this.hemiLight = new THREE.HemisphereLight(0x9cb4d8, 0x241e34, 1.35);
    this.scene.add(this.hemiLight);

    // 3. Directional Key Light (Moonlight)
    this.keyLight = new THREE.DirectionalLight(0xffeedb, 1.45);
    this.keyLight.position.set(20, 36, 20);
    if (this.graphicSettings.shadows !== 'off') {
      this.keyLight.castShadow = true;
      const mapDim = this.graphicSettings.shadows === 'high' ? 1024 : 512;
      this.keyLight.shadow.mapSize.set(mapDim, mapDim);
      this.keyLight.shadow.camera.near = 1.0;
      this.keyLight.shadow.camera.far = 90;
      this.keyLight.shadow.camera.left = -32;
      this.keyLight.shadow.camera.right = 32;
      this.keyLight.shadow.camera.top = 32;
      this.keyLight.shadow.camera.bottom = -32;
      this.keyLight.shadow.bias = -0.0001;
      this.keyLight.shadow.normalBias = 0.04;
    }
    this.scene.add(this.keyLight);

    // 4. Directional Rim / Fill Light (Soft cool contrast)
    this.fillLight = new THREE.DirectionalLight(0x60a5fa, 0.7);
    this.fillLight.position.set(-18, 22, -18);
    this.scene.add(this.fillLight);

    // 5. Ground Floor: Flagstone arena (low-poly 2x2 subdivision for minimal vertex overhead)
    const groundGeo = new THREE.PlaneGeometry(80, 80, 2, 2);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x23253a,
      roughness: 0.75,
      metalness: 0.2,
    });
    this.groundMat = groundMat;
    this.groundMesh = new THREE.Mesh(groundGeo, groundMat);
    this.groundMesh.rotation.x = -Math.PI / 2;
    this.groundMesh.receiveShadow = this.graphicSettings.shadows !== 'off';
    this.scene.add(this.groundMesh);

    // Courtyard runic rings
    const circleGeo = new THREE.RingGeometry(0.2, 14, 32);
    const circleMat = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
    });
    this.circleMat = circleMat;
    const ringMesh = new THREE.Mesh(circleGeo, circleMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.y = 0.02;
    this.scene.add(ringMesh);

    const outerRingGeo = new THREE.RingGeometry(18.5, 19.2, 32);
    const outerRingMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
    });
    const outerRing = new THREE.Mesh(outerRingGeo, outerRingMat);
    outerRing.rotation.x = -Math.PI / 2;
    outerRing.position.y = 0.02;
    this.scene.add(outerRing);

    // Clear obstacles array
    this.arenaObstacles = [];

    // 6. Perimeter Cathedral Pillars & Gothic Buttresses
    const pillarGeo = new THREE.CylinderGeometry(0.7, 0.9, 9, 6);
    const pillarCapGeo = new THREE.BoxGeometry(2.2, 0.6, 2.2);
    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0x2a243e,
      roughness: 0.85,
      metalness: 0.15,
    });
    this.stoneMat = stoneMat;

    const pillarPositions = [
      [-16, -16], [0, -18], [16, -16],
      [-18, 0], [18, 0],
      [-16, 16], [0, 18], [16, 16],
      [-8, -10], [8, -10], [-8, 10], [8, 10]
    ];

    pillarPositions.forEach(([px, pz]) => {
      const pGroup = new THREE.Group();
      const shaft = new THREE.Mesh(pillarGeo, stoneMat);
      shaft.position.y = 4.5;
      shaft.castShadow = true;
      pGroup.add(shaft);

      const cap = new THREE.Mesh(pillarCapGeo, stoneMat);
      cap.position.y = 9.2;
      pGroup.add(cap);

      pGroup.position.set(px, 0, pz);
      this.scene.add(pGroup);

      // Register collision obstacle (radius 0.85 + player capsule 0.45 = 1.30)
      this.arenaObstacles.push({ x: px, z: pz, radius: 1.30 });
    });

    // 7. Outer Arena Perimeter Walls
    const wallGeoH = new THREE.BoxGeometry(45, 5, 1.2);
    const wallGeoV = new THREE.BoxGeometry(1.2, 5, 45);
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x181524, roughness: 0.9 });
    this.wallMat = wallMat;

    const wallNorth = new THREE.Mesh(wallGeoH, wallMat);
    wallNorth.position.set(0, 2.5, -22);
    wallNorth.castShadow = true;
    this.scene.add(wallNorth);

    const wallSouth = new THREE.Mesh(wallGeoH, wallMat);
    wallSouth.position.set(0, 2.5, 22);
    wallSouth.castShadow = true;
    this.scene.add(wallSouth);

    const wallWest = new THREE.Mesh(wallGeoV, wallMat);
    wallWest.position.set(-22, 2.5, 0);
    wallWest.castShadow = true;
    this.scene.add(wallWest);

    const wallEast = new THREE.Mesh(wallGeoV, wallMat);
    wallEast.position.set(22, 2.5, 0);
    wallEast.castShadow = true;
    this.scene.add(wallEast);

    // 8. Braziers with dynamic glowing fire (reusing shared geometries and materials)
    const brazierPositions = [
      [-10, -10], [10, -10],
      [-10, 10], [10, 10],
      [0, -14], [0, 14]
    ];

    brazierPositions.forEach(([bx, bz]) => {
      const bGroup = new THREE.Group();

      const stand = new THREE.Mesh(this.brazierStandGeo, this.brazierStandMat);
      stand.position.y = 0.9;
      stand.castShadow = true;
      bGroup.add(stand);

      const bowl = new THREE.Mesh(this.brazierBowlGeo, this.brazierBowlMat);
      bowl.position.y = 1.9;
      bGroup.add(bowl);

      const flame = new THREE.Mesh(this.brazierFlameGeo, this.brazierFlameMat);
      flame.position.y = 2.2;
      bGroup.add(flame);

      // Optimized Point Light for smooth mobile 60 FPS performance
      const fireLight = new THREE.PointLight(0xff6838, 1.2, 9, 2.0);
      fireLight.position.set(0, 2.3, 0);
      bGroup.add(fireLight);

      bGroup.position.set(bx, 0, bz);
      this.scene.add(bGroup);

      this.braziers.push({ light: fireLight, mesh: bGroup, x: bx, z: bz });
      this.arenaObstacles.push({ x: bx, z: bz, radius: 1.05 });
    });
  }

  // Procedural Articulated 3D Player Knight
  private buildPlayerModel(): THREE.Group {
    const group = new THREE.Group();
    this.proceduralKnightGroup = new THREE.Group();

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
    this.proceduralKnightGroup.add(this.playerTorso);

    const crestGeo = new THREE.BoxGeometry(0.3, 0.5, 0.58);
    const crest = new THREE.Mesh(crestGeo, goldTrimMat);
    this.playerTorso.add(crest);

    // 2. Head / Helmet
    const headGeo = new THREE.BoxGeometry(0.55, 0.55, 0.55);
    this.playerHead = new THREE.Mesh(headGeo, armorMat);
    this.playerHead.position.set(0, 0.8, 0);
    this.playerHead.castShadow = true;
    this.playerTorso.add(this.playerHead);

    const visorGeo = new THREE.BoxGeometry(0.42, 0.09, 0.08);
    const visorMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee });
    this.playerVisorGlow = new THREE.Mesh(visorGeo, visorMat);
    this.playerVisorGlow.position.set(0, 0.04, 0.26);
    this.playerHead.add(this.playerVisorGlow);

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
    const capeGeo = new THREE.PlaneGeometry(0.8, 1.4, 2, 2);
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

    const runeInlay = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 1.3, 0.08),
      new THREE.MeshBasicMaterial({ color: 0x22d3ee })
    );
    runeInlay.position.y = 0.85;
    this.playerSwordBlade.add(runeInlay);

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
    this.proceduralKnightGroup.add(this.playerLeftLeg);

    this.playerRightLeg = new THREE.Group();
    this.playerRightLeg.position.set(0.25, 0.95, 0);
    const legR = new THREE.Mesh(legGeo, armorMat);
    legR.position.y = -0.42;
    legR.castShadow = true;
    this.playerRightLeg.add(legR);
    this.proceduralKnightGroup.add(this.playerRightLeg);

    group.add(this.proceduralKnightGroup);
    return group;
  }

  private buildSlashTrail(): THREE.Mesh {
    const geo = new THREE.RingGeometry(1.2, 2.4, 20, 1, 0, Math.PI * 0.85);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 1.0;
    return mesh;
  }

  // Concurrent Asset Pipeline
  public async loadGameAssetsInParallel(onProgress?: (pct: number, status: string) => void): Promise<LoadedGameAssets> {
    const assets = await parallelAssetLoader.loadAll(prog => {
      onProgress?.(prog.percent, prog.statusText);
    });
    this.loadedAssets = assets;

    if (this.groundMat && assets.textures.stoneFloorDiffuse) {
      const tex = assets.textures.stoneFloorDiffuse;
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(12, 12);
      this.groundMat.map = tex;
      if (assets.textures.stoneFloorNormal) {
        const normTex = assets.textures.stoneFloorNormal;
        normTex.wrapS = THREE.RepeatWrapping;
        normTex.wrapT = THREE.RepeatWrapping;
        normTex.repeat.set(12, 12);
        this.groundMat.normalMap = normTex;
      }
      this.groundMat.needsUpdate = true;
    }
    if (this.wallMat && assets.textures.wallStoneDiffuse) {
      const tex = assets.textures.wallStoneDiffuse;
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(8, 2);
      this.wallMat.map = tex;
      this.wallMat.needsUpdate = true;
    }

    if (assets.heroGlbBuffer) {
      this.gltfLoader.parse(
        assets.heroGlbBuffer,
        '',
        gltf => {
          this.setupGLTFModel(gltf, 'Ash (Ashen Knight - GLB)');
        },
        err => {
          console.warn('Failed to parse hero GLB buffer:', err);
        }
      );
    }

    return assets;
  }

  public setupGLTFModel(gltf: any, modelName: string) {
    if (this.customModelGroup) {
      this.playerGroup.remove(this.customModelGroup);
      this.customModelGroup = null;
    }
    if (this.animationMixer) {
      this.animationMixer.stopAllAction();
      this.animationMixer = null;
    }

    this.proceduralKnightGroup.visible = false;
    this.customModelGroup = new THREE.Group();
    const model = gltf.scene;

    const bbox = new THREE.Box3().setFromObject(model);
    const size = bbox.getSize(new THREE.Vector3());
    const center = bbox.getCenter(new THREE.Vector3());

    const targetHeight = 1.95;
    const baseScale = size.y > 0.001 ? targetHeight / size.y : 1.0;

    model.position.set(-center.x * baseScale, -bbox.min.y * baseScale, -center.z * baseScale);
    model.scale.set(baseScale, baseScale, baseScale);

    let meshCount = 0;
    let vertexCount = 0;

    let rightHandBone: THREE.Object3D | null = null;
    let hipsBone: THREE.Object3D | null = null;
    let swordHandSocket: THREE.Object3D | null = null;
    let swordSheathSocket: THREE.Object3D | null = null;
    let swordDrawn: THREE.Object3D | null = null;
    let swordSheathed: THREE.Object3D | null = null;

    model.traverse((child: any) => {
      if (child.name === 'RightHand') rightHandBone = child;
      if (child.name === 'Hips') hipsBone = child;
      if (child.name === 'SwordHandSocket') swordHandSocket = child;
      if (child.name === 'SwordSheathSocket') swordSheathSocket = child;
      if (child.name === 'Sword_Drawn') swordDrawn = child;
      if (child.name === 'Sword_Sheathed') swordSheathed = child;

      if (child.isMesh) {
        meshCount++;
        if (child.geometry && child.geometry.attributes && child.geometry.attributes.position) {
          vertexCount += child.geometry.attributes.position.count;
        }
        child.castShadow = this.graphicSettings.shadows !== 'off' && this.modelConfig.castShadows;
        child.receiveShadow = this.graphicSettings.shadows !== 'off';
        child.frustumCulled = true;

        const mats = Array.isArray(child.material) ? child.material : [child.material];
        for (const mat of mats) {
          if (!mat) continue;
          mat.side = THREE.FrontSide;
          if (mat.map) {
            mat.map.colorSpace = THREE.SRGBColorSpace;
          }
          if (mat.emissiveMap) {
            mat.emissiveMap.colorSpace = THREE.SRGBColorSpace;
          }
          if (mat.roughness !== undefined && mat.roughness < 0.2) {
            mat.roughness = 0.3;
          }
          mat.envMapIntensity = this.graphicSettings.lowEndMode ? 0.6 : 1.25;
          mat.needsUpdate = true;
        }
      }
    });

    if (rightHandBone && swordHandSocket) {
      (rightHandBone as THREE.Object3D).add(swordHandSocket);
    }
    if (hipsBone && swordSheathSocket) {
      (hipsBone as THREE.Object3D).add(swordSheathSocket);
    }
    this.swordDrawnMesh = swordDrawn;
    this.swordSheathedMesh = swordSheathed;

    const drawn = this.swordDrawnMesh as any;
    const sheathed = this.swordSheathedMesh as any;
    if (drawn) drawn.visible = this.isSwordEquipped;
    if (sheathed) sheathed.visible = !this.isSwordEquipped;

    const animNames: string[] = [];
    this.animationActions.clear();

    if (gltf.animations && gltf.animations.length > 0) {
      this.animationMixer = new THREE.AnimationMixer(model);

      gltf.animations.forEach((clip: THREE.AnimationClip) => {
        animNames.push(clip.name);
        const action = this.animationMixer!.clipAction(clip);
        this.animationActions.set(clip.name, action);

        if (
          clip.name === 'Idle' ||
          clip.name === 'Walk (mocap)' ||
          clip.name === 'Sprint' ||
          clip.name === 'Crawl Backward'
        ) {
          action.loop = THREE.LoopRepeat;
          action.clampWhenFinished = false;
        } else {
          action.loop = THREE.LoopOnce;
          action.clampWhenFinished = true;
        }

        if (clip.name === 'Idle') action.timeScale = 1.0;
        else if (clip.name === 'Walk (mocap)') action.timeScale = 1.1;
        else if (clip.name === 'Sprint') action.timeScale = 1.15;
        else if (clip.name === 'Jump Start') action.timeScale = 1.8;
        else if (clip.name === 'Jump Land') action.timeScale = 2.2;
        else if (clip.name === 'Ninja Jump Double') action.timeScale = 1.8;
        else if (clip.name === 'Punch (jab)') action.timeScale = 1.8;
        else if (clip.name === 'Punch (cross)') action.timeScale = 1.8;
        else if (clip.name === 'Kick') action.timeScale = 1.8;
        else if (clip.name === 'Jumping spinning kick (c0a12a) (in place)') action.timeScale = 2.4;
        else if (clip.name === 'Sword Enter') action.timeScale = 1.6;
        else if (clip.name === 'Sword Attack') action.timeScale = 2.2;
        else if (clip.name === 'Sword Aerial Combo') action.timeScale = 1.7;
        else if (clip.name === 'Sword Dash Root Motion') action.timeScale = 2.0;
        else if (clip.name === 'Hit Stomach') action.timeScale = 2.0;
        else if (clip.name === 'Death') action.timeScale = 1.5;
        else if (clip.name === 'Crawl Backward') action.timeScale = 1.2;
      });

      this.animationMixer.addEventListener('finished', (e: any) => {
        if (e.action && e.action.getClip()) {
          this.handleAnimationFinished(e.action.getClip().name);
        }
      });

      const idleAction = this.animationActions.get('Idle');
      if (idleAction) {
        idleAction.play();
        this.currentAnimationAction = idleAction;
        this.currentAshClipName = 'Idle';
      }
    }

    this.customModelGroup.add(model);
    this.customModelGroup.scale.set(
      this.modelConfig.scaleMultiplier,
      this.modelConfig.scaleMultiplier,
      this.modelConfig.scaleMultiplier
    );
    this.customModelGroup.position.y = this.modelConfig.yOffset;
    this.customModelGroup.rotation.y = (this.modelConfig.rotationOffsetY * Math.PI) / 180;

    this.playerGroup.add(this.customModelGroup);

    this.customModelInfo = {
      isLoaded: true,
      name: modelName,
      source: 'static_url',
      hasAnimations: animNames.length > 0,
      animationNames: animNames,
      meshCount,
      vertexCount,
      config: { ...this.modelConfig },
    };

    this.callbacks.onModelInfoUpdate?.(this.customModelInfo);

    this.callbacks.onFloatingText({
      id: Math.random().toString(),
      text: 'ASH.GLB ACTIVE',
      x: this.playerPosition.x,
      y: this.playerPosition.y + 2.4,
      z: this.playerPosition.z,
      color: '#22d3ee',
      createdAt: Date.now(),
      duration: 1800,
      scale: 1.25,
    });
  }

  public applyModelCalibration(config: ModelCalibrationConfig) {
    this.modelConfig = { ...config };
    this.customModelInfo.config = { ...config };

    if (this.customModelGroup) {
      this.customModelGroup.scale.set(config.scaleMultiplier, config.scaleMultiplier, config.scaleMultiplier);
      this.customModelGroup.position.y = config.yOffset;
      this.customModelGroup.rotation.y = (config.rotationOffsetY * Math.PI) / 180;
    }
  }

  public resetToDefaultKnight() {
    if (this.customModelGroup) {
      this.playerGroup.remove(this.customModelGroup);
      this.customModelGroup = null;
    }
    this.animationMixer = null;
    this.proceduralKnightGroup.visible = true;

    this.customModelInfo = {
      isLoaded: false,
      name: 'Procedural Ashen Knight',
      source: 'procedural_default',
      hasAnimations: false,
      animationNames: [],
      meshCount: 14,
      vertexCount: 960,
      config: { ...this.modelConfig },
    };

    this.callbacks.onModelInfoUpdate?.(this.customModelInfo);
  }

  public spawnChapterEnemies(chapter: number) {
    // Clear and dispose old enemy meshes
    this.enemyMeshes.forEach(mesh => {
      this.scene.remove(mesh);
      mesh.traverse((child: any) => {
        if (child.isMesh) {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) child.material.forEach((m: any) => m.dispose());
            else child.material.dispose();
          }
        }
      });
    });
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
        z: -8,
        rotationY: Math.PI,
        hp: 350,
        maxHp: 350,
        state: 'CHASE',
        attackTimer: 0,
        staggerTimer: 0,
        phase: 1,
      };
      this.enemies.push(boss);
      this.createEnemyMesh(boss);
      this.callbacks.onBossStateChange({ ...boss });
    }

    this.callbacks.onQuestUpdate(this.currentQuest);
  }

  private createEnemyMesh(enemy: EnemyEntity) {
    const group = new THREE.Group();

    if (enemy.type === 'VOID_THRALL') {
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

      const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.06, 4, 4), purpleGlowMat);
      eyeL.position.set(-0.12, 0.05, 0.24);
      head.add(eyeL);
      const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.06, 4, 4), purpleGlowMat);
      eyeR.position.set(0.12, 0.05, 0.24);
      head.add(eyeR);

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
      const armorMat = new THREE.MeshStandardMaterial({ color: 0x24171a, metalness: 0.8, roughness: 0.3 });
      const redGlowMat = new THREE.MeshBasicMaterial({ color: 0xff3b30 });

      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.1, 0.6), armorMat);
      torso.position.y = 1.6;
      torso.castShadow = true;
      group.add(torso);

      const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), armorMat);
      head.position.set(0, 0.85, 0);
      torso.add(head);

      const visor = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, 0.06), redGlowMat);
      visor.position.set(0, 0.05, 0.31);
      head.add(visor);

      const maceGroup = new THREE.Group();
      maceGroup.position.set(0.7, -0.2, 0.2);
      const maceShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.2, 5), armorMat);
      maceShaft.position.y = 0.5;
      maceGroup.add(maceShaft);
      const maceHead = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22), redGlowMat);
      maceHead.position.y = 1.1;
      maceGroup.add(maceHead);
      torso.add(maceGroup);

      const shield = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.2, 0.1), armorMat);
      shield.position.set(-0.7, -0.1, 0.25);
      torso.add(shield);
    } else if (enemy.type === 'MALAKOR_BOSS') {
      const bossArmorMat = new THREE.MeshStandardMaterial({
        color: 0x281c3e,
        metalness: 0.8,
        roughness: 0.25,
      });
      const bossEmberMat = new THREE.MeshBasicMaterial({ color: 0xff4500 });
      const bossVoidMat = new THREE.MeshBasicMaterial({ color: 0xbf5af2 });
      const bossGoldTrimMat = new THREE.MeshStandardMaterial({
        color: 0xd97706,
        metalness: 0.9,
        roughness: 0.2,
      });

      // Massive Boss Torso
      const torso = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.0, 1.1), bossArmorMat);
      torso.position.y = 2.7;
      torso.castShadow = true;
      group.add(torso);

      // Glowing Abyssal Core Light (casts localized purple radiance around boss)
      const bossCoreLight = new THREE.PointLight(0xa855f7, 2.2, 9, 2.0);
      bossCoreLight.position.set(0, 0.2, 0.4);
      torso.add(bossCoreLight);

      // Glowing Rune Chest Plate
      const chestRune = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.8, 0.08), bossVoidMat);
      chestRune.position.set(0, 0.2, 0.58);
      torso.add(chestRune);

      // Spiked Pauldrons
      const pauldronL = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.8, 4), bossGoldTrimMat);
      pauldronL.position.set(-1.1, 0.8, 0);
      pauldronL.rotation.z = 0.5;
      torso.add(pauldronL);

      const pauldronR = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.8, 4), bossGoldTrimMat);
      pauldronR.position.set(1.1, 0.8, 0);
      pauldronR.rotation.z = -0.5;
      torso.add(pauldronR);

      // Boss Helmet & Crown of Void Spikes
      const head = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.0, 1.0), bossArmorMat);
      head.position.set(0, 1.45, 0);
      torso.add(head);

      [-0.45, -0.22, 0, 0.22, 0.45].forEach((x, idx) => {
        const height = idx === 2 ? 0.9 : 0.65;
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.12, height, 4), bossVoidMat);
        spike.position.set(x, 0.75, 0.1);
        head.add(spike);
      });

      // Menacing Glowing Ember Eyes
      const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.13, 6, 6), bossEmberMat);
      eyeL.position.set(-0.25, 0.1, 0.52);
      head.add(eyeL);
      const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.13, 6, 6), bossEmberMat);
      eyeR.position.set(0.25, 0.1, 0.52);
      head.add(eyeR);

      // Giant Death Scythe
      const scythe = new THREE.Group();
      scythe.name = 'boss_scythe';
      scythe.position.set(1.2, -0.2, 0.4);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.6, 6), bossArmorMat);
      pole.position.y = 1.0;
      scythe.add(pole);

      const blade = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.1, 6, 12, Math.PI * 0.75), bossEmberMat);
      blade.position.set(0.5, 2.4, 0);
      blade.rotation.z = -0.6;
      scythe.add(blade);
      torso.add(scythe);
    }

    group.position.set(enemy.x, enemy.y, enemy.z);
    group.rotation.y = enemy.rotationY;
    this.scene.add(group);
    this.enemyMeshes.set(enemy.id, group);
  }

  // Animation Management
  public playAshAnimation(clipName: string, blendDuration = 0.12, restartIfSame = false) {
    if (!this.animationMixer) return;
    const action = this.animationActions.get(clipName);
    if (!action) return;

    if (this.currentAshClipName === clipName && !restartIfSame) {
      if (!action.isRunning()) {
        action.play();
      }
      return;
    }

    if (this.currentAnimationAction && this.currentAnimationAction !== action) {
      this.currentAnimationAction.fadeOut(blendDuration);
    }

    action.reset().fadeIn(blendDuration).play();
    this.currentAnimationAction = action;
    this.currentAshClipName = clipName;
  }

  public handleAnimationFinished(clipName: string) {
    if (clipName === 'Sword Enter') {
      this.isSwordEquipped = true;
      this.stats.isSwordEquipped = true;
      if (this.swordDrawnMesh) this.swordDrawnMesh.visible = true;
      if (this.swordSheathedMesh) this.swordSheathedMesh.visible = false;
      this.isDrawingSword = false;
      this.isAttacking = false;
      this.activeAttackClipName = '';
    } else if (clipName === 'Jump Land') {
      this.isLanding = false;
    } else if (clipName === 'Ninja Jump Double') {
      if (this.isDodging) {
        this.isDodging = false;
        this.stats.isInvulnerable = false;
        this.dodgeCooldownTimer = 0.25;
        this.stats.dodgeCooldown = 0.25;
      }
      if (this.isDoubleJumping) {
        this.isDoubleJumping = false;
      }
    } else if (clipName === 'Hit Stomach') {
      this.isHitStunned = false;
    } else if (clipName === 'Sword Dash Root Motion') {
      this.isSwordDashing = false;
      this.isAttacking = false;
      this.activeAttackClipName = '';
    }
  }

  // Combat Triggers
  public triggerLightAttack() {
    if (this.isDead || this.isDodging || this.isHitStunned || this.isDrawingSword || this.isSwordDashing) return;

    if (!this.isGrounded) {
      this.triggerAirAttack();
      return;
    }

    if (this.isSwordEquipped) {
      this.triggerSwordAttack();
      return;
    }

    if (this.stats.stamina < 8) return;

    if (!this.isAttacking) {
      this.stats.stamina = Math.max(0, this.stats.stamina - 8);
      this.startUnarmedAttack(1);
    } else {
      if (this.attackAnimTime < this.comboWindowStart) {
        this.inputBufferAttack = true;
      } else if (this.attackAnimTime >= this.comboWindowStart && this.attackAnimTime <= this.comboWindowEnd) {
        this.stats.stamina = Math.max(0, this.stats.stamina - 8);
        this.advanceUnarmedCombo();
      }
    }
  }

  private startUnarmedAttack(step: number) {
    this.isAttacking = true;
    this.unarmedComboStep = step;
    this.attackAnimTime = 0;
    this.inputBufferAttack = false;
    this.comboAdvanced = false;

    if (step === 1) {
      this.activeAttackClipName = 'Punch (jab)';
      this.attackAnimDuration = 0.833 / 1.8;
      this.comboWindowStart = 0.18;
      this.comboWindowEnd = 0.42;
      this.stats.comboCount = 1;
      this.stats.comboMultiplier = 1.0;
      soundManager.playSwing(1.1);
      triggerHaptic(20);
      setTimeout(() => this.performAttackHitCheck(1, false), 180);
    } else if (step === 2) {
      this.activeAttackClipName = 'Punch (cross)';
      this.attackAnimDuration = 0.967 / 1.8;
      this.comboWindowStart = 0.20;
      this.comboWindowEnd = 0.48;
      this.stats.comboCount = 2;
      this.stats.comboMultiplier = 1.25;
      soundManager.playSwing(1.2);
      triggerHaptic(25);
      setTimeout(() => this.performAttackHitCheck(2, false), 200);
    } else if (step === 3) {
      this.activeAttackClipName = 'Kick';
      this.attackAnimDuration = 1.100 / 1.8;
      this.comboWindowStart = 0.24;
      this.comboWindowEnd = 0.55;
      this.stats.comboCount = 3;
      this.stats.comboMultiplier = 1.5;
      soundManager.playSwing(1.3);
      triggerHaptic(30);
      setTimeout(() => this.performAttackHitCheck(3, false), 240);
    } else if (step === 4) {
      this.activeAttackClipName = 'Jumping spinning kick (c0a12a) (in place)';
      this.attackAnimDuration = 3.967 / 2.4;
      this.comboWindowStart = 999;
      this.comboWindowEnd = 999;
      this.stats.comboCount = 4;
      this.stats.comboMultiplier = 2.0;
      soundManager.playSwing(0.9);
      triggerHaptic(45);
      setTimeout(() => this.performAttackHitCheck(4, true), 350);
      setTimeout(() => this.performAttackHitCheck(4, true), 700);
    }

    this.playAshAnimation(this.activeAttackClipName, 0.06, true);
  }

  public advanceUnarmedCombo() {
    if (this.comboAdvanced) return;
    if (this.unarmedComboStep === 1) {
      this.comboAdvanced = true;
      this.startUnarmedAttack(2);
    } else if (this.unarmedComboStep === 2) {
      this.comboAdvanced = true;
      this.startUnarmedAttack(3);
    } else if (this.unarmedComboStep === 3) {
      this.comboAdvanced = true;
      this.startUnarmedAttack(4);
    }
  }

  public triggerSwordAttack() {
    if (!this.isSwordEquipped || this.isDead || this.isDodging || this.isHitStunned || this.isDrawingSword || this.isSwordDashing) return;
    if (this.stats.stamina < 12) return;

    if (!this.isAttacking) {
      this.stats.stamina = Math.max(0, this.stats.stamina - 12);
      this.isAttacking = true;
      this.activeAttackClipName = 'Sword Attack';
      this.attackAnimTime = 0;
      this.attackAnimDuration = 1.533 / 2.2;
      this.comboWindowStart = 0.28;
      this.comboWindowEnd = 0.58;
      this.inputBufferAttack = false;
      this.comboAdvanced = false;
      this.stats.comboCount = (this.stats.comboCount % 3) + 1;
      this.stats.comboMultiplier = 1.0 + this.stats.comboCount * 0.2;

      this.playAshAnimation('Sword Attack', 0.06, true);
      soundManager.playSwing(1.0);
      triggerHaptic(30);
      setTimeout(() => this.performAttackHitCheck(2, false), 220);
    } else if (this.activeAttackClipName === 'Sword Attack') {
      if (this.attackAnimTime < this.comboWindowStart) {
        this.inputBufferAttack = true;
      } else if (this.attackAnimTime >= this.comboWindowStart && this.attackAnimTime <= this.comboWindowEnd && !this.comboAdvanced) {
        this.comboAdvanced = true;
        this.stats.stamina = Math.max(0, this.stats.stamina - 12);
        this.attackAnimTime = 0;
        this.inputBufferAttack = false;
        this.stats.comboCount = (this.stats.comboCount % 3) + 1;
        this.stats.comboMultiplier = 1.0 + this.stats.comboCount * 0.3;
        this.playAshAnimation('Sword Attack', 0.06, true);
        soundManager.playSwing(1.2);
        triggerHaptic(35);
        setTimeout(() => this.performAttackHitCheck(3, true), 220);
      }
    }
  }

  public triggerAirAttack() {
    if (this.isGrounded || this.isDead || this.isDodging || this.isHitStunned) return;
    if (this.stats.stamina < 15) return;
    this.stats.stamina = Math.max(0, this.stats.stamina - 15);

    this.isAttacking = true;
    this.attackAnimTime = 0;
    this.inputBufferAttack = false;

    if (this.isSwordEquipped) {
      this.activeAttackClipName = 'Sword Aerial Combo';
      this.attackAnimDuration = 1.000 / 1.7;
      this.comboWindowStart = 999;
      this.comboWindowEnd = 999;
      soundManager.playSwing(1.2);
      triggerHaptic(30);
      setTimeout(() => this.performAttackHitCheck(3, false), 200);
    } else {
      this.activeAttackClipName = 'Jumping spinning kick (c0a12a) (in place)';
      this.attackAnimDuration = 3.967 / 2.4;
      this.comboWindowStart = 999;
      this.comboWindowEnd = 999;
      soundManager.playSwing(1.0);
      triggerHaptic(35);
      setTimeout(() => this.performAttackHitCheck(3, true), 300);
    }

    this.playAshAnimation(this.activeAttackClipName, 0.06, true);
  }

  public triggerToggleSword() {
    if (this.isDead || this.isDodging || this.isHitStunned || this.isDrawingSword || this.isSwordDashing) return;

    if (!this.isSwordEquipped) {
      this.isAttacking = true;
      this.isDrawingSword = true;
      this.activeAttackClipName = 'Sword Enter';
      this.attackAnimTime = 0;
      this.attackAnimDuration = 1.300 / 1.6;
      this.comboWindowStart = 999;
      this.comboWindowEnd = 999;

      this.playAshAnimation('Sword Enter', 0.06, true);
      soundManager.playSwing(0.8);
      triggerHaptic(30);

      setTimeout(() => {
        if (this.isDead) return;
        this.isSwordEquipped = true;
        this.stats.isSwordEquipped = true;
        if (this.swordDrawnMesh) this.swordDrawnMesh.visible = true;
        if (this.swordSheathedMesh) this.swordSheathedMesh.visible = false;
        soundManager.playSwing(1.3);
      }, 500);

      this.callbacks.onFloatingText({
        id: Math.random().toString(),
        text: 'SWORD DRAWN',
        x: this.playerPosition.x,
        y: this.playerPosition.y + 2.2,
        z: this.playerPosition.z,
        color: '#22d3ee',
        createdAt: Date.now(),
        duration: 1000,
        scale: 1.2,
      });
    } else {
      if (this.isAttacking) return;
      this.isSwordEquipped = false;
      this.stats.isSwordEquipped = false;
      if (this.swordDrawnMesh) this.swordDrawnMesh.visible = false;
      if (this.swordSheathedMesh) this.swordSheathedMesh.visible = true;
      triggerHaptic(20);

      this.callbacks.onFloatingText({
        id: Math.random().toString(),
        text: 'SWORD SHEATHED',
        x: this.playerPosition.x,
        y: this.playerPosition.y + 2.2,
        z: this.playerPosition.z,
        color: '#94a3b8',
        createdAt: Date.now(),
        duration: 1000,
        scale: 1.1,
      });
    }
  }

  public triggerSwordDash() {
    if (!this.isSwordEquipped || this.isDead || this.isDodging || this.isHitStunned || this.swordDashCooldownTimer > 0) return;
    if (this.stats.stamina < 20) return;

    this.stats.stamina = Math.max(0, this.stats.stamina - 20);
    this.isAttacking = true;
    this.isSwordDashing = true;
    this.swordDashCooldownTimer = 1.2;
    this.stats.swordDashCooldown = 1.2;
    this.activeAttackClipName = 'Sword Dash Root Motion';
    this.attackAnimTime = 0;
    this.attackAnimDuration = 1.567 / 2.0;
    this.comboWindowStart = 999;
    this.comboWindowEnd = 999;

    this.playAshAnimation('Sword Dash Root Motion', 0.06, true);
    soundManager.playHeavyCleave();
    triggerHaptic(40);

    const dashAngle = this.inputVector.magnitude > 0.1
      ? Math.atan2(this.inputVector.x, this.inputVector.y) + this.cameraYaw
      : this.playerRotationY;
    this.playerRotationY = dashAngle;
    this.playerVelocity.set(
      Math.sin(dashAngle) * 14.0,
      0,
      Math.cos(dashAngle) * 14.0
    );

    setTimeout(() => {
      this.performAttackHitCheck(4, true);
    }, 250);
  }

  public triggerHeavyCleave() {
    if (this.isSwordEquipped) {
      this.triggerSwordDash();
    } else {
      if (this.stats.stamina < 25) return;
      this.stats.stamina = Math.max(0, this.stats.stamina - 25);
      this.startUnarmedAttack(4);
    }
  }

  public triggerRuneBurst() {
    if (this.stats.runes < 30) return;
    if (this.isDead || this.playerAction === 'DEAD') return;

    this.stats.runes -= 30;
    triggerHaptic(60);
    soundManager.playRuneBurst();

    this.spawnRuneBurstParticles(this.playerPosition.x, this.playerPosition.z);

    const px = this.playerPosition.x;
    const pz = this.playerPosition.z;
    this.enemies.forEach(enemy => {
      if (enemy.state === 'DEAD') return;
      const dx = enemy.x - px;
      const dz = enemy.z - pz;
      const distSq = dx * dx + dz * dz;
      if (distSq <= 6.5 * 6.5) {
        this.damageEnemy(enemy, 55, true, 'RUNE BLAST!');
      }
    });
  }

  public triggerDodgeRoll() {
    if (this.isDead || this.isDodging || this.dodgeCooldownTimer > 0) return;
    if (this.stats.stamina < 18) return;

    this.stats.stamina = Math.max(0, this.stats.stamina - 18);
    this.isAttacking = false;
    this.unarmedComboStep = 0;
    this.activeAttackClipName = '';
    this.isDrawingSword = false;
    this.isSwordDashing = false;

    this.isDodging = true;
    this.dodgeTimer = 0.45;
    this.stats.isInvulnerable = true;
    triggerHaptic(20);
    soundManager.playDodge();

    let moveAngle = this.playerRotationY;
    if (this.inputVector.magnitude > 0.1) {
      moveAngle = Math.atan2(this.inputVector.x, this.inputVector.y) + this.cameraYaw;
      this.playerRotationY = moveAngle;
    }
    this.playerVelocity.set(
      Math.sin(moveAngle) * 11.0,
      0,
      Math.cos(moveAngle) * 11.0
    );

    this.playAshAnimation('Ninja Jump Double', 0.05, true);
  }

  public triggerParry() {
    if (this.stats.stamina < 15 || this.isDead || this.isDodging) return;

    this.stats.stamina = Math.max(0, this.stats.stamina - 15);
    this.parryTimer = 0.35;
    this.stats.isParrying = true;
    triggerHaptic(30);
  }

  public triggerJump() {
    if (this.isDead || this.isDodging || this.isHitStunned) return;

    if (!this.isGrounded) {
      if (this.doubleJumpAvailable && !this.isDoubleJumping) {
        this.triggerDoubleJump();
      }
      return;
    }

    if (this.isAttacking) return;

    this.isGrounded = false;
    this.isJumping = true;
    this.isDoubleJumping = false;
    this.doubleJumpAvailable = true;
    this.isLanding = false;
    this.playerVy = 8.0;
    this.playAshAnimation('Jump Start', 0.06, true);
    soundManager.playSwing(1.3);
    triggerHaptic(15);
  }

  public triggerDoubleJump() {
    if (this.isGrounded || !this.doubleJumpAvailable || this.isDoubleJumping || this.isDead) return;
    this.isDoubleJumping = true;
    this.doubleJumpAvailable = false;
    this.playerVy = 6.8;
    this.playAshAnimation('Ninja Jump Double', 0.06, true);
    soundManager.playSwing(1.6);
    triggerHaptic(30);
  }

  public setCrawlActive(active: boolean) {
    this.isCrawlInputActive = active;
    this.stats.isCrawling = active;
  }

  public toggleCrawl() {
    this.setCrawlActive(!this.isCrawlInputActive);
  }

  public triggerHealPotion() {
    if (this.stats.potions <= 0 || this.stats.hp >= this.stats.maxHp || this.isDead) return;

    this.stats.potions -= 1;
    this.stats.hp = Math.min(this.stats.maxHp, this.stats.hp + this.stats.potionHealAmount);
    triggerHaptic(40);
    soundManager.playPotion();

    this.spawnHealParticles(this.playerPosition.x, this.playerPosition.y, this.playerPosition.z);
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
      let closest: EnemyEntity | null = null;
      let minDistSq = 15 * 15;
      const px = this.playerPosition.x;
      const pz = this.playerPosition.z;

      this.enemies.forEach(e => {
        if (e.state === 'DEAD') return;
        const dx = e.x - px;
        const dz = e.z - pz;
        const dSq = dx * dx + dz * dz;
        if (dSq < minDistSq) {
          minDistSq = dSq;
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

  // Attack hit registration (optimized with scalar geometry)
  private performAttackHitCheck(comboIndex: number, isHeavy = false) {
    const fwdX = Math.sin(this.playerRotationY);
    const fwdZ = Math.cos(this.playerRotationY);

    const range = isHeavy ? 3.8 : 2.7;
    const rangeSq = range * range;
    const baseDamage = isHeavy ? 48 : 20 + comboIndex * 6;

    // Show sword arc slash
    this.slashTrailMesh.position.copy(this.playerPosition);
    this.slashTrailMesh.rotation.z = this.playerRotationY + Math.PI / 2;
    (this.slashTrailMesh.material as THREE.MeshBasicMaterial).opacity = 0.85;

    let hitAny = false;
    const px = this.playerPosition.x;
    const pz = this.playerPosition.z;

    this.enemies.forEach(enemy => {
      if (enemy.state === 'DEAD') return;
      const dx = enemy.x - px;
      const dz = enemy.z - pz;
      const distSq = dx * dx + dz * dz;

      if (distSq <= rangeSq) {
        const dist = Math.sqrt(distSq) || 0.001;
        const toDirX = dx / dist;
        const toDirZ = dz / dist;
        const dot = fwdX * toDirX + fwdZ * toDirZ;

        if (dot > 0.25 || isHeavy) {
          hitAny = true;
          const isCrit = comboIndex === 3 || isHeavy;
          const dmg = Math.round(baseDamage * (isCrit ? 1.4 : 1.0) * this.stats.comboMultiplier);

          this.damageEnemy(enemy, dmg, isCrit);
          this.spawnHitSparks(enemy.x, enemy.y, enemy.z, isCrit);
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
      this.callbacks.onBossStateChange(enemy.state === 'DEAD' ? null : { ...enemy });
    }
  }

  private damagePlayer(damage: number, attackerName: string) {
    if (this.isDead || this.stats.isInvulnerable || this.stats.hp <= 0) return;

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
      this.isDead = true;
      this.stats.hp = 0;
      this.playerAction = 'DEAD';
      this.primaryAnimState = 'DEATH';

      this.isAttacking = false;
      this.isDodging = false;
      this.isHitStunned = false;
      this.isDrawingSword = false;
      this.isSwordDashing = false;
      this.isJumping = false;
      this.isDoubleJumping = false;
      this.playerVelocity.set(0, 0, 0);
      this.playerVy = 0;

      this.playAshAnimation('Death', 0.05, true);
      this.callbacks.onGameOver();
    } else {
      if (!this.isHitStunned && this.hitStunTimer <= 0) {
        this.isHitStunned = true;
        this.hitStunTimer = 0.35;
        this.playerAction = 'HIT_STOMACH';
        this.primaryAnimState = 'HIT_STOMACH';

        this.isAttacking = false;
        this.unarmedComboStep = 0;
        this.activeAttackClipName = '';
        this.isDrawingSword = false;
        this.isSwordDashing = false;

        this.playAshAnimation('Hit Stomach', 0.05, true);
      }
    }
  }

  public respawn() {
    this.isDead = false;
    this.stats.hp = this.stats.maxHp;
    this.stats.stamina = this.stats.maxStamina;
    this.stats.potions = this.stats.maxPotions;
    this.stats.isInvulnerable = false;
    this.stats.isParrying = false;
    this.stats.isSprinting = false;

    this.playerAction = 'IDLE';
    this.primaryAnimState = 'IDLE';
    this.isAttacking = false;
    this.isDodging = false;
    this.isHitStunned = false;
    this.isDrawingSword = false;
    this.isSwordDashing = false;
    this.isJumping = false;
    this.isDoubleJumping = false;
    this.isLanding = false;
    this.unarmedComboStep = 0;
    this.activeAttackClipName = '';

    this.playerPosition.set(0, 0, 0);
    this.playerVelocity.set(0, 0, 0);
    this.playerVy = 0;
    this.isGrounded = true;
    this.cameraYaw = 0;
    this.cameraPitch = 0.28;
    this.smoothedCamPos.set(0, 4, 8);
    this.smoothedCamTarget.set(0, 1.5, 0);

    this.playAshAnimation('Idle', 0.15, true);
    this.spawnChapterEnemies(this.currentQuest.chapter);
  }

  // Zero-Allocation Particle Emitters (Reusing Pool)
  private spawnHitSparks(x: number, y: number, z: number, isCrit: boolean) {
    const count = isCrit ? 12 : 6;
    let spawned = 0;

    for (let i = 0; i < this.particlePool.length && spawned < count; i++) {
      const p = this.particlePool[i];
      if (!p.active && !p.isRing) {
        p.active = true;
        p.life = 0;
        p.maxLife = 0.35;
        p.baseSize = isCrit ? 0.08 : 0.05;
        p.mesh.material = isCrit ? this.critSparkMat : this.normalSparkMat;
        p.mesh.position.set(
          x + (Math.random() - 0.5) * 0.4,
          y + 1.2 + (Math.random() - 0.5) * 0.4,
          z + (Math.random() - 0.5) * 0.4
        );
        p.velocity.set(
          (Math.random() - 0.5) * 6,
          Math.random() * 5 + 2,
          (Math.random() - 0.5) * 6
        );
        p.mesh.scale.setScalar(p.baseSize);
        p.mesh.visible = true;
        spawned++;
      }
    }
  }

  private spawnRuneBurstParticles(x: number, z: number) {
    for (let i = 0; i < this.particlePool.length; i++) {
      const p = this.particlePool[i];
      if (!p.active && p.isRing) {
        p.active = true;
        p.life = 0;
        p.maxLife = 0.5;
        p.baseSize = 1.0;
        p.mesh.position.set(x, 0.1, z);
        p.mesh.scale.set(1, 1, 1);
        (p.mesh.material as THREE.MeshBasicMaterial).opacity = 0.9;
        p.mesh.visible = true;
        break;
      }
    }
  }

  private spawnHealParticles(x: number, y: number, z: number) {
    let spawned = 0;
    for (let i = 0; i < this.particlePool.length && spawned < 10; i++) {
      const p = this.particlePool[i];
      if (!p.active && !p.isRing) {
        p.active = true;
        p.life = 0;
        p.maxLife = 0.65;
        p.baseSize = 0.07;
        p.mesh.material = this.healSparkMat;

        const angle = (spawned / 10) * Math.PI * 2;
        p.mesh.position.set(x + Math.cos(angle) * 0.8, y + 0.2, z + Math.sin(angle) * 0.8);
        p.velocity.set(Math.cos(angle) * 0.4, 2.4, Math.sin(angle) * 0.4);
        p.mesh.scale.setScalar(p.baseSize);
        p.mesh.visible = true;
        spawned++;
      }
    }
  }

  // Unified Authoritative Game Loop
  public update(delta: number) {
    // 1. Clamped delta prevents physics/teleport anomalies during backgrounding or frame drops
    const clampedDelta = Math.min(delta, 0.0333);
    const animTime = this.clock.getElapsedTime();

    // FPS calculation
    this.frameCount++;
    const now = performance.now();
    if (now - this.lastFpsTime >= 1000) {
      this.callbacks.onFpsUpdate(Math.round((this.frameCount * 1000) / (now - this.lastFpsTime)));
      this.frameCount = 0;
      this.lastFpsTime = now;
    }

    // 2. Update Cooldowns, Timers & Stamina
    if (this.stats.stamina < this.stats.maxStamina) {
      const regenRate = this.stats.isSprinting ? 0 : 18;
      this.stats.stamina = Math.min(this.stats.maxStamina, this.stats.stamina + regenRate * clampedDelta);
    }

    this.dodgeCooldownTimer = Math.max(0, this.dodgeCooldownTimer - clampedDelta);
    this.stats.dodgeCooldown = this.dodgeCooldownTimer;
    this.swordDashCooldownTimer = Math.max(0, this.swordDashCooldownTimer - clampedDelta);
    this.stats.swordDashCooldown = this.swordDashCooldownTimer;
    this.stats.isSwordEquipped = this.isSwordEquipped;
    this.stats.isCrawling = this.isCrawlInputActive;
    this.stats.canDoubleJump = !this.isGrounded && this.doubleJumpAvailable && !this.isDoubleJumping;

    if (this.hitStunTimer > 0) {
      this.hitStunTimer -= clampedDelta;
      if (this.hitStunTimer <= 0) {
        this.isHitStunned = false;
      }
    }

    if (this.isDodging) {
      this.dodgeTimer -= clampedDelta;
      if (this.dodgeTimer <= 0) {
        this.isDodging = false;
        this.stats.isInvulnerable = false;
        this.dodgeCooldownTimer = 0.25;
        this.stats.dodgeCooldown = 0.25;
      }
    }

    if (this.parryTimer > 0) {
      this.parryTimer -= clampedDelta;
      if (this.parryTimer <= 0) {
        this.stats.isParrying = false;
      }
    }

    // Attack timer & input buffer execution
    if (this.isAttacking) {
      this.attackAnimTime += clampedDelta;

      if (
        this.inputBufferAttack &&
        !this.comboAdvanced &&
        this.attackAnimTime >= this.comboWindowStart &&
        this.attackAnimTime <= this.comboWindowEnd
      ) {
        if (this.isSwordEquipped) {
          this.triggerSwordAttack();
        } else {
          this.advanceUnarmedCombo();
        }
      }

      if (this.attackAnimTime >= this.attackAnimDuration) {
        this.isAttacking = false;
        this.isDrawingSword = false;
        this.isSwordDashing = false;
        this.activeAttackClipName = '';
        if (this.unarmedComboStep === 4) {
          this.unarmedComboStep = 0;
          this.stats.comboCount = 0;
        }
      }
    }

    if (this.isLanding) {
      this.landingTimer -= clampedDelta;
      if (this.landingTimer <= 0) {
        this.isLanding = false;
      }
    }

    // 3. Locomotion & Direction
    const isSprint = (this.sprintToggled || this.inputVector.magnitude >= this.joystickConfig.sprintThreshold) && this.stats.stamina > 5;
    this.stats.isSprinting = isSprint && this.inputVector.magnitude > 0.2 && !this.isCrawlInputActive;

    if (isSprint && this.stats.isSprinting) {
      this.stats.stamina = Math.max(0, this.stats.stamina - 10 * clampedDelta);
    }

    const moveSpeed = isSprint ? 8.5 : 5.2;

    if (this.isDead) {
      this.playerVelocity.set(0, 0, 0);
    } else if (this.isDodging) {
      this.playerVelocity.x *= 0.94;
      this.playerVelocity.z *= 0.94;
    } else if (this.isHitStunned) {
      this.playerVelocity.x *= 0.6;
      this.playerVelocity.z *= 0.6;
    } else if (this.isSwordDashing) {
      this.playerVelocity.x *= 0.96;
      this.playerVelocity.z *= 0.96;
    } else if (this.isAttacking && this.isGrounded) {
      this.playerVelocity.x *= 0.3;
      this.playerVelocity.z *= 0.3;
    } else if (this.isCrawlInputActive && this.isGrounded) {
      const crawlSpeed = 2.0;
      this.playerVelocity.x = Math.sin(this.playerRotationY) * crawlSpeed;
      this.playerVelocity.z = Math.cos(this.playerRotationY) * crawlSpeed;
    } else {
      if (this.inputVector.magnitude > 0.05) {
        const inX = this.inputVector.x;
        const inY = this.inputVector.y;
        const camYaw = this.cameraYaw;

        const moveDirX = inX * Math.cos(camYaw) - inY * Math.sin(camYaw);
        const moveDirZ = -inX * Math.sin(camYaw) - inY * Math.cos(camYaw);

        const targetRotation = Math.atan2(moveDirX, -moveDirZ);

        let diff = targetRotation - this.playerRotationY;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        this.playerRotationY += diff * 14.0 * clampedDelta;

        const effectiveMag = Math.min(1.0, this.inputVector.magnitude);
        const speed = effectiveMag * moveSpeed;

        this.playerVelocity.x = moveDirX * speed;
        this.playerVelocity.z = moveDirZ * speed;
      } else {
        this.playerVelocity.x *= 0.72;
        this.playerVelocity.z *= 0.72;
      }
    }

    // 4. Gravity & Ground Physics
    if (!this.isGrounded) {
      this.playerVy -= 18.0 * clampedDelta;
      this.playerPosition.y += this.playerVy * clampedDelta;
      if (this.playerPosition.y <= 0) {
        this.playerPosition.y = 0;
        this.playerVy = 0;
        const wasAirborne = !this.isGrounded;
        this.isGrounded = true;
        this.isJumping = false;
        this.isDoubleJumping = false;
        this.doubleJumpAvailable = true;

        if (wasAirborne) {
          if (this.stats.isSprinting && this.inputVector.magnitude > 0.2) {
            this.isLanding = false;
          } else if (!this.isAttacking && !this.isDodging && !this.isHitStunned) {
            this.isLanding = true;
            this.landingTimer = 0.20;
          }
        }
      }
    } else {
      this.playerPosition.y = 0;
      this.playerVy = 0;
    }

    // Apply horizontal velocity
    this.playerPosition.x += this.playerVelocity.x * clampedDelta;
    this.playerPosition.z += this.playerVelocity.z * clampedDelta;

    // Obstacle capsule collision (tangent wall-sliding)
    for (let i = 0; i < this.arenaObstacles.length; i++) {
      const obs = this.arenaObstacles[i];
      const dx = this.playerPosition.x - obs.x;
      const dz = this.playerPosition.z - obs.z;
      const distSq = dx * dx + dz * dz;
      const minD = obs.radius;
      if (distSq < minD * minD && distSq > 0.0001) {
        const dist = Math.sqrt(distSq);
        const nx = dx / dist;
        const nz = dz / dist;
        this.playerPosition.x = obs.x + nx * minD;
        this.playerPosition.z = obs.z + nz * minD;
        const dot = this.playerVelocity.x * nx + this.playerVelocity.z * nz;
        if (dot < 0) {
          this.playerVelocity.x -= dot * nx;
          this.playerVelocity.z -= dot * nz;
        }
      }
    }

    // Arena boundary limits
    const arenaLimit = 20.2;
    if (this.playerPosition.x < -arenaLimit) {
      this.playerPosition.x = -arenaLimit;
      if (this.playerVelocity.x < 0) this.playerVelocity.x = 0;
    } else if (this.playerPosition.x > arenaLimit) {
      this.playerPosition.x = arenaLimit;
      if (this.playerVelocity.x > 0) this.playerVelocity.x = 0;
    }
    if (this.playerPosition.z < -arenaLimit) {
      this.playerPosition.z = -arenaLimit;
      if (this.playerVelocity.z < 0) this.playerVelocity.z = 0;
    } else if (this.playerPosition.z > arenaLimit) {
      this.playerPosition.z = arenaLimit;
      if (this.playerVelocity.z > 0) this.playerVelocity.z = 0;
    }

    // Ground anchor failsafe
    if (this.playerPosition.y < 0) {
      this.playerPosition.y = 0;
      this.playerVy = 0;
      this.isGrounded = true;
    }

    // Update Player Model Transform
    this.playerGroup.position.copy(this.playerPosition);
    this.playerGroup.rotation.y = this.playerRotationY;

    // 5. Priority-Based Skeletal Animation Controller
    let selectedClipName = 'Idle';
    let blendDuration = 0.12;

    if (this.isDead || this.stats.hp <= 0) {
      selectedClipName = 'Death';
      blendDuration = 0.05;
      this.primaryAnimState = 'DEATH';
      this.playerAction = 'DEAD';
    } else if (this.isDodging) {
      selectedClipName = 'Ninja Jump Double';
      blendDuration = 0.05;
      this.primaryAnimState = 'DODGE_ROLL';
      this.playerAction = 'DODGE_ROLL';
    } else if (this.isHitStunned) {
      selectedClipName = 'Hit Stomach';
      blendDuration = 0.05;
      this.primaryAnimState = 'HIT_STOMACH';
      this.playerAction = 'HIT_STOMACH';
    } else if (this.isAttacking && this.activeAttackClipName) {
      selectedClipName = this.activeAttackClipName;
      blendDuration = 0.06;
      this.primaryAnimState = 'ATTACK';
      this.playerAction = 'ATTACK_1';
    } else if (!this.isGrounded || this.isJumping || this.isDoubleJumping || this.isLanding) {
      if (this.isDoubleJumping) {
        selectedClipName = 'Ninja Jump Double';
        blendDuration = 0.06;
      } else if (this.isLanding) {
        selectedClipName = 'Jump Land';
        blendDuration = 0.08;
      } else {
        selectedClipName = 'Jump Start';
        blendDuration = 0.08;
      }
      this.primaryAnimState = 'JUMP';
      this.playerAction = 'JUMP';
    } else if (this.isCrawlInputActive) {
      selectedClipName = 'Crawl Backward';
      blendDuration = 0.12;
      this.primaryAnimState = 'CRAWL_BACKWARD';
      this.playerAction = 'CRAWL_BACKWARD';
    } else if (this.stats.isSprinting && this.inputVector.magnitude > 0.05) {
      selectedClipName = 'Sprint';
      blendDuration = 0.10;
      this.primaryAnimState = 'SPRINT';
      this.playerAction = 'SPRINT';
    } else if (this.inputVector.magnitude > 0.05) {
      selectedClipName = 'Walk (mocap)';
      blendDuration = 0.12;
      this.primaryAnimState = 'WALK';
      this.playerAction = 'RUN';
    } else {
      selectedClipName = 'Idle';
      blendDuration = 0.14;
      this.primaryAnimState = 'IDLE';
      this.playerAction = 'IDLE';
    }

    if (this.animationMixer && this.modelConfig.useEmbeddedAnimations) {
      this.animationMixer.update(clampedDelta);
      this.playAshAnimation(selectedClipName, blendDuration);
    } else if (this.customModelGroup) {
      const baseRotY = (this.modelConfig.rotationOffsetY * Math.PI) / 180;
      const currentAction = this.playerAction as string;

      if (currentAction === 'RUN' || currentAction === 'SPRINT') {
        const strideFreq = currentAction === 'SPRINT' ? 14 : 9;
        this.customModelGroup.rotation.z = Math.sin(animTime * strideFreq) * 0.08;
        this.customModelGroup.rotation.y = baseRotY;
        this.customModelGroup.position.y = this.modelConfig.yOffset + Math.abs(Math.sin(animTime * strideFreq)) * 0.08;
      } else if (currentAction === 'IDLE') {
        this.customModelGroup.rotation.z = 0;
        this.customModelGroup.rotation.x = 0;
        this.customModelGroup.rotation.y = baseRotY;
        this.customModelGroup.position.y = this.modelConfig.yOffset + Math.sin(animTime * 2.5) * 0.03;
      } else if (
        currentAction === 'ATTACK_1' ||
        currentAction === 'ATTACK_2' ||
        currentAction === 'ATTACK_3' ||
        currentAction === 'HEAVY_CLEAVE'
      ) {
        this.customModelGroup.rotation.y = baseRotY + Math.sin((0.32 - this.actionTimer) * 12) * 0.4;
      } else if (currentAction === 'DODGE_ROLL') {
        this.customModelGroup.rotation.x = (0.42 - this.actionTimer) * Math.PI * 4;
      } else {
        this.customModelGroup.rotation.x = 0;
        this.customModelGroup.rotation.z = 0;
        this.customModelGroup.rotation.y = baseRotY;
      }
    } else {
      const currentAction = this.playerAction as string;
      if (currentAction === 'RUN' || currentAction === 'SPRINT') {
        const strideFreq = currentAction === 'SPRINT' ? 14 : 9;
        this.playerLeftLeg.rotation.x = Math.sin(animTime * strideFreq) * 0.65;
        this.playerRightLeg.rotation.x = -Math.sin(animTime * strideFreq) * 0.65;
        this.playerLeftArm.rotation.x = -Math.sin(animTime * strideFreq) * 0.45;
        this.playerRightArm.rotation.x = Math.sin(animTime * strideFreq) * 0.45;
        this.playerCape.rotation.x = 0.4 + Math.sin(animTime * strideFreq) * 0.25;
        this.playerTorso.position.y = 1.55 + Math.abs(Math.sin(animTime * strideFreq)) * 0.08;
      } else if (currentAction === 'IDLE') {
        this.playerLeftLeg.rotation.x = 0;
        this.playerRightLeg.rotation.x = 0;
        this.playerLeftArm.rotation.x = 0;
        this.playerRightArm.rotation.x = 0;
        this.playerTorso.position.y = 1.55 + Math.sin(animTime * 2.5) * 0.03;
        this.playerCape.rotation.x = 0.15 + Math.sin(animTime * 2) * 0.05;
      } else if (currentAction === 'ATTACK_1') {
        this.playerRightArm.rotation.z = -0.8;
        this.playerRightArm.rotation.y = Math.sin((0.32 - this.actionTimer) * 12) * 1.6;
      } else if (currentAction === 'ATTACK_2') {
        this.playerRightArm.rotation.z = 0.8;
        this.playerRightArm.rotation.y = -Math.sin((0.32 - this.actionTimer) * 12) * 1.6;
      } else if (currentAction === 'ATTACK_3' || currentAction === 'HEAVY_CLEAVE') {
        this.playerRightArm.rotation.x = -Math.PI * 0.7 + (1.0 - this.actionTimer) * Math.PI;
      } else if (currentAction === 'PARRY') {
        this.playerLeftArm.position.set(-0.2, 0.4, 0.3);
        this.playerLeftArm.rotation.y = 0.6;
      } else if (currentAction === 'DODGE_ROLL') {
        this.playerTorso.rotation.x = (0.42 - this.actionTimer) * Math.PI * 4;
      }
    }

    // Fade out sword arc
    const slashMat = this.slashTrailMesh.material as THREE.MeshBasicMaterial;
    if (slashMat.opacity > 0) {
      slashMat.opacity = Math.max(0, slashMat.opacity - 4.0 * clampedDelta);
    }

    // 6. Enemy AI Update (optimized zero-allocation vector math)
    const px = this.playerPosition.x;
    const pz = this.playerPosition.z;

    this.enemies.forEach(enemy => {
      if (enemy.state === 'DEAD') {
        const mesh = this.enemyMeshes.get(enemy.id);
        if (mesh) {
          mesh.position.y = Math.max(-2, mesh.position.y - 1.5 * clampedDelta);
          mesh.scale.multiplyScalar(0.96);
        }
        return;
      }

      const dx = px - enemy.x;
      const dz = pz - enemy.z;
      const distSq = dx * dx + dz * dz;

      if (enemy.state === 'STAGGER') {
        enemy.staggerTimer -= clampedDelta;
        if (enemy.staggerTimer <= 0) enemy.state = 'IDLE';
        return;
      }

      // Boss has arena-wide aggro so he never stands lost in the fog
      const aggroRadius = enemy.type === 'MALAKOR_BOSS' ? 50 : 18;

      if (distSq < aggroRadius * aggroRadius) {
        const dist = Math.sqrt(distSq) || 0.001;
        const toDirX = dx / dist;
        const toDirZ = dz / dist;
        enemy.rotationY = Math.atan2(toDirX, toDirZ);

        const attackRange = enemy.type === 'MALAKOR_BOSS' ? 4.5 : 2.2;

        if (dist > attackRange) {
          const speed = enemy.type === 'VOID_THRALL' ? 4.0 : enemy.type === 'MALAKOR_BOSS' ? 3.4 : 2.6;
          enemy.x += toDirX * speed * clampedDelta;
          enemy.z += toDirZ * speed * clampedDelta;
          enemy.state = 'CHASE';
        } else {
          enemy.attackTimer += clampedDelta;
          const windupDuration = enemy.type === 'MALAKOR_BOSS' ? 1.3 : 1.1;

          // Animate boss scythe windup and slash
          if (enemy.type === 'MALAKOR_BOSS') {
            const eMesh = this.enemyMeshes.get(enemy.id);
            if (eMesh) {
              const scythe = eMesh.getObjectByName('boss_scythe');
              if (scythe) {
                const windupProgress = enemy.attackTimer / windupDuration;
                scythe.rotation.x = Math.sin(windupProgress * Math.PI) * 1.8;
                scythe.rotation.z = -Math.sin(windupProgress * Math.PI) * 1.2;
              }
            }
          }

          if (enemy.attackTimer >= windupDuration) {
            enemy.attackTimer = 0;
            const enemyDmg = enemy.type === 'MALAKOR_BOSS' ? (enemy.phase === 2 ? 40 : 30) : enemy.type === 'CORRUPTED_GUARD' ? 22 : 14;
            this.damagePlayer(enemyDmg, enemy.name);
          }
        }
      }

      const eMesh = this.enemyMeshes.get(enemy.id);
      if (eMesh) {
        eMesh.position.set(enemy.x, enemy.y, enemy.z);
        eMesh.rotation.y = enemy.rotationY;
      }
    });

    // 7. Update Camera Position (Zero-allocation scalar math)
    if (this.targetLockEnemy && this.targetLockEnemy.state !== 'DEAD') {
      const ldx = this.targetLockEnemy.x - px;
      const ldz = this.targetLockEnemy.z - pz;
      this.cameraYaw = Math.atan2(-ldx, -ldz);
    }

    this.cameraPitch = THREE.MathUtils.clamp(this.cameraPitch, -0.10, 0.82);

    const targetCamX = px + Math.sin(this.cameraYaw) * Math.cos(this.cameraPitch) * this.cameraDistance;
    const targetCamY = Math.max(0.75, this.playerPosition.y + Math.sin(this.cameraPitch) * this.cameraDistance + 1.8);
    const targetCamZ = pz + Math.cos(this.cameraYaw) * Math.cos(this.cameraPitch) * this.cameraDistance;

    this.smoothedCamPos.x += (targetCamX - this.smoothedCamPos.x) * 0.16;
    this.smoothedCamPos.y += (targetCamY - this.smoothedCamPos.y) * 0.16;
    this.smoothedCamPos.z += (targetCamZ - this.smoothedCamPos.z) * 0.16;

    const targetLookY = this.playerPosition.y + 1.45;
    this.smoothedCamTarget.x += (px - this.smoothedCamTarget.x) * 0.16;
    this.smoothedCamTarget.y += (targetLookY - this.smoothedCamTarget.y) * 0.16;
    this.smoothedCamTarget.z += (pz - this.smoothedCamTarget.z) * 0.16;

    this.camera.position.copy(this.smoothedCamPos);
    this.camera.lookAt(this.smoothedCamTarget);

    // 8. Flickering Brazier Fire (skipped in low-end mode for zero CPU/GPU overhead)
    if (!this.graphicSettings.lowEndMode && this.graphicSettings.shadows !== 'off') {
      this.braziers.forEach((b, i) => {
        if (b.light.visible) {
          b.light.intensity = 1.8 + Math.sin(animTime * 8 + i * 2) * 0.4;
        }
      });
    }

    // 9. Update Reusable Particle Pool
    for (let i = 0; i < this.particlePool.length; i++) {
      const p = this.particlePool[i];
      if (!p.active) continue;

      p.life += clampedDelta;
      if (p.life >= p.maxLife) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }

      if (p.isRing) {
        const progress = p.life / p.maxLife;
        const scale = 1.0 + progress * 12.0;
        p.mesh.scale.set(scale, scale, 1);
        (p.mesh.material as THREE.MeshBasicMaterial).opacity = 1.0 - progress;
      } else {
        p.velocity.y -= 9.8 * clampedDelta;
        p.mesh.position.x += p.velocity.x * clampedDelta;
        p.mesh.position.y += p.velocity.y * clampedDelta;
        p.mesh.position.z += p.velocity.z * clampedDelta;

        const fade = 1.0 - p.life / p.maxLife;
        p.mesh.scale.setScalar(p.baseSize * fade);
      }
    }

    // 10. Render Scene
    this.renderer.render(this.scene, this.camera);

    // 11. Throttled Stats Update to React (emits only on changes, at ~16 Hz max)
    const nowMs = performance.now();
    const statsChanged =
      Math.abs(this.stats.hp - this.prevHp) > 0.4 ||
      Math.abs(this.stats.stamina - this.prevStamina) > 0.8 ||
      Math.abs(this.stats.runes - this.prevRunes) > 0.8 ||
      this.stats.potions !== this.prevPotions ||
      this.stats.score !== this.prevScore ||
      this.stats.comboCount !== this.prevCombo ||
      this.stats.isInvulnerable !== this.prevInvuln ||
      this.stats.isParrying !== this.prevParry ||
      this.stats.isSprinting !== this.prevSprint ||
      this.stats.isSwordEquipped !== this.prevSword ||
      this.stats.canDoubleJump !== this.prevCanDJ;

    if (statsChanged && nowMs - this.lastStatsEmitTime >= 60) {
      this.lastStatsEmitTime = nowMs;
      this.prevHp = this.stats.hp;
      this.prevStamina = this.stats.stamina;
      this.prevRunes = this.stats.runes;
      this.prevPotions = this.stats.potions;
      this.prevScore = this.stats.score;
      this.prevCombo = this.stats.comboCount;
      this.prevInvuln = this.stats.isInvulnerable;
      this.prevParry = this.stats.isParrying;
      this.prevSprint = this.stats.isSprinting;
      this.prevSword = this.stats.isSwordEquipped;
      this.prevCanDJ = this.stats.canDoubleJump;

      this.callbacks.onStatsUpdate({ ...this.stats });
    }
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
    parallelAssetLoader.abort();
    soundManager.stopAmbientMusic();
    window.removeEventListener('resize', this.onWindowResize);

    // Dispose all pooled particle meshes
    this.particlePool.forEach(p => {
      this.scene.remove(p.mesh);
    });
    this.particlePool = [];
    this.sparkGeo.dispose();
    this.ringGeo.dispose();
    this.critSparkMat.dispose();
    this.normalSparkMat.dispose();
    this.healSparkMat.dispose();
    this.runeRingMat.dispose();

    // Dispose Brazier shared geometry
    this.brazierStandGeo.dispose();
    this.brazierBowlGeo.dispose();
    this.brazierFlameGeo.dispose();
    this.brazierStandMat.dispose();
    this.brazierBowlMat.dispose();
    this.brazierFlameMat.dispose();

    if (this.groundMat) this.groundMat.dispose();
    if (this.wallMat) this.wallMat.dispose();
    if (this.stoneMat) this.stoneMat.dispose();
    if (this.circleMat) this.circleMat.dispose();

    if (this.renderer && this.renderer.domElement && this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
    this.renderer.dispose();
  }
}
