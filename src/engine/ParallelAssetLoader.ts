import * as THREE from 'three';

export interface AssetLoadingProgress {
  percent: number;
  statusText: string;
  bytesLoaded: number;
  totalBytes: number;
  speedMBps?: number;
}

export interface LoadedGameAssets {
  heroGlbBuffer: ArrayBuffer | null;
  textures: {
    stoneFloorDiffuse: THREE.CanvasTexture;
    stoneFloorNormal: THREE.CanvasTexture;
    wallStoneDiffuse: THREE.CanvasTexture;
    pillarStoneDiffuse: THREE.CanvasTexture;
    runicGlyphs: THREE.CanvasTexture;
    particleSpark: THREE.CanvasTexture;
    slashTrail: THREE.CanvasTexture;
    ashenCrest?: THREE.Texture;
  };
  fromCache: boolean;
}

const CACHE_NAME = 'ashen-realm-assets-v1';
const HERO_CACHE_KEY = '/models/Ash.glb';

export class ParallelAssetLoader {
  private abortController: AbortController | null = null;

  /**
   * Loads all required 3D models and textures concurrently in parallel,
   * significantly reducing loading screen duration and warm-up time.
   */
  public async loadAll(
    onProgress?: (progress: AssetLoadingProgress) => void
  ): Promise<LoadedGameAssets> {
    this.abortController = new AbortController();

    let glbLoadedBytes = 0;
    let glbTotalBytes = 19 * 1024 * 1024; // ~19MB default estimate
    let textureLoadedCount = 0;
    const totalTextureTasks = 8;
    let isFromCache = false;
    const startTime = performance.now();

    const notifyProgress = (statusText: string) => {
      if (!onProgress) return;
      const elapsedSec = Math.max(0.1, (performance.now() - startTime) / 1000);
      const glbRatio = glbTotalBytes > 0 ? Math.min(1.0, glbLoadedBytes / glbTotalBytes) : 0;
      const texRatio = textureLoadedCount / totalTextureTasks;
      
      // Weight: GLB download 75%, Textures 25%
      const overallPercent = Math.min(99, Math.round(glbRatio * 75 + texRatio * 25));
      const speedMBps = Number(((glbLoadedBytes / (1024 * 1024)) / elapsedSec).toFixed(2));

      onProgress({
        percent: overallPercent,
        statusText,
        bytesLoaded: glbLoadedBytes,
        totalBytes: glbTotalBytes,
        speedMBps,
      });
    };

    // Run GLB Download and Texture Generation in parallel
    const [glbResult, texturesResult] = await Promise.all([
      // Task 1: Parallel GLB Downloader with CacheStorage
      this.downloadHeroGLBParallel(
        (loaded, total, status, fromCache) => {
          glbLoadedBytes = loaded;
          if (total > 0) glbTotalBytes = total;
          if (fromCache) isFromCache = true;
          notifyProgress(status);
        },
        this.abortController.signal
      ),

      // Task 2: Parallel Texture Loader & Procedural PBR Generators
      this.loadTexturesParallel(status => {
        textureLoadedCount = Math.min(totalTextureTasks, textureLoadedCount + 1);
        notifyProgress(status);
      }),
    ]);

    // Final 100% completion notice
    if (onProgress) {
      onProgress({
        percent: 100,
        statusText: isFromCache ? 'Assets loaded from local cache' : 'All assets loaded successfully',
        bytesLoaded: glbTotalBytes,
        totalBytes: glbTotalBytes,
        speedMBps: 0,
      });
    }

    return {
      heroGlbBuffer: glbResult,
      textures: texturesResult,
      fromCache: isFromCache,
    };
  }

  /**
   * Downloads the hero GLB model concurrently with stream progress and persistent caching.
   */
  private async downloadHeroGLBParallel(
    onProgress: (loaded: number, total: number, status: string, fromCache: boolean) => void,
    signal: AbortSignal
  ): Promise<ArrayBuffer | null> {
    // 1. Check browser/Capacitor CacheStorage for instantaneous loading
    try {
      if (typeof window !== 'undefined' && 'caches' in window) {
        const cache = await window.caches.open(CACHE_NAME);
        const cachedResponse = await cache.match(HERO_CACHE_KEY);
        if (cachedResponse) {
          onProgress(100, 100, 'Hero 3D assets loaded from instant cache', true);
          const buffer = await cachedResponse.arrayBuffer();
          if (buffer && buffer.byteLength > 1000) {
            return buffer;
          }
        }
      }
    } catch (e) {
      console.warn('CacheStorage check skipped:', e);
    }

    // 2. Candidate paths in prioritized order
    const candidateUrls = [
      '/models/Ash.glb',
      '/assets/characters/player.glb',
      '/public/models/Ash.glb',
      '/assets/characters/Ash.glb',
    ];

    // Try primary path first
    for (const url of candidateUrls) {
      try {
        const response = await fetch(url, { signal });
        if (!response.ok) continue;

        const contentLength = response.headers.get('content-length');
        const total = contentLength ? parseInt(contentLength, 10) : 19 * 1024 * 1024;
        const totalMB = (total / (1024 * 1024)).toFixed(1);

        // Try streaming with ReadableStream for smooth progress
        if (response.body && typeof response.body.getReader === 'function') {
          const reader = response.body.getReader();
          const chunks: Uint8Array[] = [];
          let loaded = 0;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
              chunks.push(value);
              loaded += value.length;
              const loadedMB = (loaded / (1024 * 1024)).toFixed(1);
              onProgress(
                loaded,
                total,
                `Streaming Hero 3D Model (${loadedMB} MB / ${totalMB} MB)...`,
                false
              );
            }
          }

          // Concatenate Uint8Array chunks into single ArrayBuffer
          const fullArray = new Uint8Array(loaded);
          let offset = 0;
          for (const chunk of chunks) {
            fullArray.set(chunk, offset);
            offset += chunk.length;
          }

          // Save to CacheStorage in the background for future instantaneous loads
          this.cacheGLBBuffer(HERO_CACHE_KEY, fullArray.buffer);

          return fullArray.buffer;
        } else {
          // Fallback arrayBuffer
          const buffer = await response.arrayBuffer();
          onProgress(buffer.byteLength, buffer.byteLength, 'Hero 3D assets downloaded', false);
          this.cacheGLBBuffer(HERO_CACHE_KEY, buffer);
          return buffer;
        }
      } catch (e: any) {
        if (e.name === 'AbortError') throw e;
        // Try next candidate url
      }
    }

    console.warn('No candidate GLB URL responded; falling back to procedural knight.');
    return null;
  }

  /**
   * Persists the downloaded GLB ArrayBuffer into CacheStorage.
   */
  private async cacheGLBBuffer(key: string, buffer: ArrayBuffer) {
    try {
      if (typeof window !== 'undefined' && 'caches' in window) {
        const cache = await window.caches.open(CACHE_NAME);
        const response = new Response(buffer.slice(0), {
          headers: {
            'Content-Type': 'model/gltf-binary',
            'Content-Length': buffer.byteLength.toString(),
          },
        });
        await cache.put(key, response);
      }
    } catch (e) {
      console.warn('Failed to store GLB in CacheStorage:', e);
    }
  }

  /**
   * Loads and generates all game textures concurrently.
   */
  private async loadTexturesParallel(
    onStep: (status: string) => void
  ): Promise<LoadedGameAssets['textures']> {
    const [
      stoneFloorDiffuse,
      stoneFloorNormal,
      wallStoneDiffuse,
      pillarStoneDiffuse,
      runicGlyphs,
      particleSpark,
      slashTrail,
      ashenCrest,
    ] = await Promise.all([
      this.generateStoneFloorDiffuse().then(t => {
        onStep('Compiled Cathedral Flagstone Diffuse Texture');
        return t;
      }),
      this.generateStoneFloorNormal().then(t => {
        onStep('Generated Flagstone Normal/Bump Map');
        return t;
      }),
      this.generateWallStoneDiffuse().then(t => {
        onStep('Constructed Ruined Gothic Masonry Textures');
        return t;
      }),
      this.generatePillarStoneDiffuse().then(t => {
        onStep('Constructed Pillar Stone Textures');
        return t;
      }),
      this.generateRunicGlyphs().then(t => {
        onStep('Inscribed Arcane Summoning Ring Decal');
        return t;
      }),
      this.generateParticleSpark().then(t => {
        onStep('Prepared Radiant Rune Spark Sprites');
        return t;
      }),
      this.generateSlashTrail().then(t => {
        onStep('Prepared Sword Arc Slash Trail Textures');
        return t;
      }),
      this.loadAshenCrestTexture().then(t => {
        onStep('Loaded Royal Aethelgard Crest Vector');
        return t;
      }),
    ]);

    return {
      stoneFloorDiffuse,
      stoneFloorNormal,
      wallStoneDiffuse,
      pillarStoneDiffuse,
      runicGlyphs,
      particleSpark,
      slashTrail,
      ashenCrest,
    };
  }

  // 1. Procedural High-Detail Flagstone Floor Tile (Diffuse)
  private async generateStoneFloorDiffuse(): Promise<THREE.CanvasTexture> {
    return new Promise(resolve => {
      const size = 512;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;

      // Dark gothic base slate
      ctx.fillStyle = '#1c1b29';
      ctx.fillRect(0, 0, size, size);

      // Flagstone grid with stone slabs
      const cols = 8;
      const rows = 8;
      const cellW = size / cols;
      const cellH = size / rows;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = c * cellW;
          const y = r * cellH;
          const toneVar = Math.floor((Math.sin(r * 3.7 + c * 5.3) + 1) * 15);
          const rCol = 28 + toneVar;
          const gCol = 27 + toneVar;
          const bCol = 42 + toneVar;

          ctx.fillStyle = `rgb(${rCol},${gCol},${bCol})`;
          ctx.fillRect(x + 2, y + 2, cellW - 4, cellH - 4);

          // Subtle stone noise flecks
          ctx.fillStyle = 'rgba(255,255,255,0.035)';
          for (let n = 0; n < 12; n++) {
            const nx = x + 3 + ((n * 17) % (cellW - 6));
            const ny = y + 3 + ((n * 29) % (cellH - 6));
            ctx.fillRect(nx, ny, 2, 2);
          }

          // Subtle inner shadow
          ctx.strokeStyle = 'rgba(10,8,18,0.7)';
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 1, y + 1, cellW - 2, cellH - 2);
        }
      }

      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(10, 10);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.needsUpdate = true;
      resolve(texture);
    });
  }

  // 2. Procedural Flagstone Normal / Bump Map
  private async generateStoneFloorNormal(): Promise<THREE.CanvasTexture> {
    return new Promise(resolve => {
      const size = 512;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;

      // Neutral normal map color: RGB(128, 128, 255)
      ctx.fillStyle = '#8080ff';
      ctx.fillRect(0, 0, size, size);

      const cols = 8;
      const rows = 8;
      const cellW = size / cols;
      const cellH = size / rows;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = c * cellW;
          const y = r * cellH;

          // Beveled edges for normal map
          ctx.fillStyle = '#6060ff'; // Left shadow bevel
          ctx.fillRect(x, y, 3, cellH);
          ctx.fillStyle = '#a0a0ff'; // Right highlight bevel
          ctx.fillRect(x + cellW - 3, y, 3, cellH);

          ctx.fillStyle = '#6060ff'; // Top shadow
          ctx.fillRect(x, y, cellW, 3);
          ctx.fillStyle = '#a0a0ff'; // Bottom highlight
          ctx.fillRect(x, y + cellH - 3, cellW, 3);
        }
      }

      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(10, 10);
      texture.colorSpace = THREE.NoColorSpace;
      texture.needsUpdate = true;
      resolve(texture);
    });
  }

  // 3. Procedural Cathedral Masonry Wall Texture
  private async generateWallStoneDiffuse(): Promise<THREE.CanvasTexture> {
    return new Promise(resolve => {
      const size = 512;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;

      ctx.fillStyle = '#181524';
      ctx.fillRect(0, 0, size, size);

      const brickRows = 16;
      const brickHeight = size / brickRows;
      const brickWidth = size / 8;

      for (let r = 0; r < brickRows; r++) {
        const offset = (r % 2) * (brickWidth / 2);
        for (let c = -1; c < 9; c++) {
          const x = c * brickWidth + offset;
          const y = r * brickHeight;
          const tone = 26 + Math.floor((Math.sin(r * 4 + c * 7) + 1) * 10);
          ctx.fillStyle = `rgb(${tone}, ${tone - 2}, ${tone + 12})`;
          ctx.fillRect(x + 1, y + 1, brickWidth - 2, brickHeight - 2);

          ctx.strokeStyle = '#0e0b16';
          ctx.lineWidth = 2;
          ctx.strokeRect(x, y, brickWidth, brickHeight);
        }
      }

      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(6, 2);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.needsUpdate = true;
      resolve(texture);
    });
  }

  // 4. Procedural Pillar Stone Texture
  private async generatePillarStoneDiffuse(): Promise<THREE.CanvasTexture> {
    return new Promise(resolve => {
      const size = 256;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;

      // Vertical fluted stone gradient
      const grad = ctx.createLinearGradient(0, 0, size, 0);
      grad.addColorStop(0, '#262038');
      grad.addColorStop(0.25, '#352d4e');
      grad.addColorStop(0.5, '#221c32');
      grad.addColorStop(0.75, '#352d4e');
      grad.addColorStop(1, '#262038');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);

      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(3, 4);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.needsUpdate = true;
      resolve(texture);
    });
  }

  // 5. Arcane Runic Summoning Ring Decal
  private async generateRunicGlyphs(): Promise<THREE.CanvasTexture> {
    return new Promise(resolve => {
      const size = 512;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      const center = size / 2;

      ctx.clearRect(0, 0, size, size);

      // Concentric cyan magical rings
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 4;
      ctx.shadowColor = '#06b6d4';
      ctx.shadowBlur = 12;

      ctx.beginPath();
      ctx.arc(center, center, 230, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(center, center, 200, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(center, center, 90, 0, Math.PI * 2);
      ctx.stroke();

      // Rune glyph spokes
      const spokes = 12;
      for (let i = 0; i < spokes; i++) {
        const angle = (i * Math.PI * 2) / spokes;
        const x1 = center + Math.cos(angle) * 90;
        const y1 = center + Math.sin(angle) * 90;
        const x2 = center + Math.cos(angle) * 200;
        const y2 = center + Math.sin(angle) * 200;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        // Rune circles
        const rx = center + Math.cos(angle) * 215;
        const ry = center + Math.sin(angle) * 215;
        ctx.beginPath();
        ctx.arc(rx, ry, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#38bdf8';
        ctx.fill();
      }

      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.needsUpdate = true;
      resolve(texture);
    });
  }

  // 6. Radiant Rune Spark / Particle Sprite
  private async generateParticleSpark(): Promise<THREE.CanvasTexture> {
    return new Promise(resolve => {
      const size = 128;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      const center = size / 2;

      ctx.clearRect(0, 0, size, size);

      const radGrad = ctx.createRadialGradient(center, center, 0, center, center, size / 2);
      radGrad.addColorStop(0, 'rgba(255,255,255,1)');
      radGrad.addColorStop(0.2, 'rgba(34,211,238,0.9)');
      radGrad.addColorStop(0.5, 'rgba(6,182,212,0.4)');
      radGrad.addColorStop(1, 'rgba(0,0,0,0)');

      ctx.fillStyle = radGrad;
      ctx.beginPath();
      ctx.arc(center, center, size / 2, 0, Math.PI * 2);
      ctx.fill();

      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.needsUpdate = true;
      resolve(texture);
    });
  }

  // 7. Arcane Slash Blade Trail Texture
  private async generateSlashTrail(): Promise<THREE.CanvasTexture> {
    return new Promise(resolve => {
      const w = 256;
      const h = 64;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;

      ctx.clearRect(0, 0, w, h);

      const grad = ctx.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, 'rgba(34,211,238,0)');
      grad.addColorStop(0.4, 'rgba(34,211,238,0.7)');
      grad.addColorStop(0.85, 'rgba(255,255,255,0.95)');
      grad.addColorStop(1, 'rgba(34,211,238,0.2)');

      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.needsUpdate = true;
      resolve(texture);
    });
  }

  // 8. Load Ashen Crest SVG Vector as Three.js Texture
  private async loadAshenCrestTexture(): Promise<THREE.Texture | undefined> {
    return new Promise(resolve => {
      const loader = new THREE.TextureLoader();
      loader.load(
        '/ashen-crest.svg',
        tex => {
          tex.colorSpace = THREE.SRGBColorSpace;
          resolve(tex);
        },
        undefined,
        () => resolve(undefined)
      );
    });
  }

  public abort() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }
}

export const parallelAssetLoader = new ParallelAssetLoader();
