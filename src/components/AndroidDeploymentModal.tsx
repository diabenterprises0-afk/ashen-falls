import React, { useState, useEffect } from 'react';
import { GraphicSettings } from '../types/game';
import { triggerHaptic } from '../utils/storage';
import {
  Smartphone,
  Maximize2,
  Minimize2,
  Download,
  Check,
  X,
  Zap,
  Battery,
  ShieldCheck,
  Cpu,
  Layers,
  Sparkles,
  ExternalLink,
} from 'lucide-react';

interface AndroidDeploymentModalProps {
  graphics: GraphicSettings;
  onSaveGraphics: (graphics: GraphicSettings) => void;
  onClose: () => void;
}

export const AndroidDeploymentModal: React.FC<AndroidDeploymentModalProps> = ({
  graphics: initialGraphics,
  onSaveGraphics,
  onClose,
}) => {
  const [graphics, setGraphics] = useState<GraphicSettings>({ ...initialGraphics });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isPwaInstalled, setIsPwaInstalled] = useState(false);
  const [copiedCommand, setCopiedCommand] = useState(false);

  useEffect(() => {
    // Check fullscreen state
    setIsFullscreen(!!document.fullscreenElement);

    // Listen for PWA install prompt
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsPwaInstalled(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const toggleFullscreen = async () => {
    triggerHaptic(25);
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        // Request landscape orientation lock if supported
        if ((screen.orientation as any)?.lock) {
          try {
            await (screen.orientation as any).lock('landscape');
          } catch (e) {}
        }
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (e) {
      console.warn('Fullscreen toggle failed', e);
    }
  };

  const handleInstallPWA = async () => {
    triggerHaptic(30);
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsPwaInstalled(true);
      }
      setDeferredPrompt(null);
    } else {
      alert(
        'To install on Android: Open in Chrome/Samsung Internet, tap the 3 dots menu (⋮), and select "Add to Home screen" or "Install App".'
      );
    }
  };

  const copyCapacitorCommands = () => {
    triggerHaptic(20);
    const cmd = `npm run build && npx cap sync android && cd android && ./gradlew assembleDebug`;
    navigator.clipboard.writeText(cmd);
    setCopiedCommand(true);
    setTimeout(() => setCopiedCommand(false), 2500);
  };

  const handleSave = () => {
    triggerHaptic(30);
    onSaveGraphics(graphics);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-md">
      <div className="relative w-full max-w-3xl max-h-[90vh] bg-ashen-950/95 border border-ashen-600/60 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-ashen-100 font-sans">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-ashen-800 bg-ashen-900/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400 flex items-center justify-center text-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.3)]">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold font-medieval text-ashen-100 flex items-center gap-2">
                Android Deployment & Performance
              </h2>
              <p className="text-xs text-ashen-400">
                PWA installation, APK compilation pipeline, and mobile graphics optimization
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-ashen-800/60 hover:bg-ashen-700 flex items-center justify-center text-ashen-300 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Section 1: Android Fast Launch & Immersive Mode */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Immersive Landscape Fullscreen */}
            <div className="p-4 rounded-xl bg-ashen-900/50 border border-ashen-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-ashen-200">
                  <Maximize2 className="w-4 h-4 text-cyanGlow-400" />
                  Immersive Landscape Mode
                </div>
                <p className="text-xs text-ashen-400 mt-1">
                  Hides browser URL bars and system navigation pills for edge-to-edge 3D gaming.
                </p>
              </div>
              <button
                onClick={toggleFullscreen}
                className="mt-4 w-full py-2.5 px-4 rounded-xl bg-ashen-800 hover:bg-ashen-700 border border-ashen-600/60 text-xs font-bold text-cyanGlow-300 flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                {isFullscreen ? (
                  <>
                    <Minimize2 className="w-4 h-4" />
                    Exit Immersive Mode
                  </>
                ) : (
                  <>
                    <Maximize2 className="w-4 h-4" />
                    Enter Immersive Landscape
                  </>
                )}
              </button>
            </div>

            {/* Install PWA on Android */}
            <div className="p-4 rounded-xl bg-ashen-900/50 border border-ashen-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-ashen-200">
                  <Download className="w-4 h-4 text-emerald-400" />
                  Android Home Screen App (PWA)
                </div>
                <p className="text-xs text-ashen-400 mt-1">
                  Instant offline installation with standalone APK-like experience and zero app store delays.
                </p>
              </div>
              <button
                onClick={handleInstallPWA}
                disabled={isPwaInstalled}
                className={`mt-4 w-full py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95 ${
                  isPwaInstalled
                    ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 cursor-default'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-ashen-950 shadow-[0_0_15px_rgba(52,211,153,0.3)]'
                }`}
              >
                <Check className="w-4 h-4" />
                {isPwaInstalled ? 'Installed as App' : 'Install to Android Home Screen'}
              </button>
            </div>
          </div>

          {/* Section 2: Mobile Graphics & Battery Profile */}
          <div className="bg-ashen-900/50 border border-ashen-800 rounded-xl p-5 space-y-4">
            <h3 className="text-xs font-bold font-medieval tracking-wider uppercase text-ashen-300 flex items-center gap-2">
              <Battery className="w-4 h-4 text-yellow-400" />
              Mobile Graphics & Performance Tuning
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Target FPS */}
              <div>
                <label className="text-xs font-semibold text-ashen-300 block mb-1.5">
                  Frame Rate Limit
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[30, 60, 120].map(fps => (
                    <button
                      key={fps}
                      onClick={() => setGraphics({ ...graphics, targetFps: fps })}
                      className={`py-1.5 text-xs font-bold rounded-lg border transition-all ${
                        graphics.targetFps === fps
                          ? 'border-cyanGlow-400 bg-cyanGlow-500/20 text-white shadow-[0_0_8px_rgba(34,211,238,0.3)]'
                          : 'border-ashen-700 bg-ashen-950/60 text-ashen-400'
                      }`}
                    >
                      {fps} FPS
                    </button>
                  ))}
                </div>
              </div>

              {/* Resolution Scale */}
              <div>
                <label className="text-xs font-semibold text-ashen-300 block mb-1.5">
                  Resolution Scale
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { label: '0.75x', val: 0.75 },
                    { label: '1.0x', val: 1.0 },
                    { label: '1.25x', val: 1.25 },
                  ].map(res => (
                    <button
                      key={res.val}
                      onClick={() => setGraphics({ ...graphics, resolutionScale: res.val })}
                      className={`py-1.5 text-xs font-bold rounded-lg border transition-all ${
                        graphics.resolutionScale === res.val
                          ? 'border-purple-400 bg-purple-500/20 text-white shadow-[0_0_8px_rgba(168,85,247,0.3)]'
                          : 'border-ashen-700 bg-ashen-950/60 text-ashen-400'
                      }`}
                    >
                      {res.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Shadow Quality */}
              <div>
                <label className="text-xs font-semibold text-ashen-300 block mb-1.5">
                  Dynamic Shadows
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['off', 'low', 'high'] as const).map(shadow => (
                    <button
                      key={shadow}
                      onClick={() => setGraphics({ ...graphics, shadows: shadow })}
                      className={`py-1.5 text-xs font-bold uppercase rounded-lg border transition-all ${
                        graphics.shadows === shadow
                          ? 'border-ember-400 bg-ember-500/20 text-white shadow-[0_0_8px_rgba(255,87,34,0.3)]'
                          : 'border-ashen-700 bg-ashen-950/60 text-ashen-400'
                      }`}
                    >
                      {shadow}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Android APK Standalone Build Pipeline */}
          <div className="bg-ashen-900/50 border border-ashen-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-cyanGlow-400" />
                <h3 className="text-xs font-bold font-medieval tracking-wider uppercase text-ashen-200">
                  Android APK & Capacitor Pipeline
                </h3>
              </div>
              <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                GitHub CI/CD Ready
              </span>
            </div>

            <p className="text-xs text-ashen-400 leading-relaxed">
              This project includes a complete GitHub Actions automated APK build workflow (`.github/workflows/build-apk.yml`) and `capacitor.config.json`. To build an offline standalone `.apk` locally:
            </p>

            <div className="bg-ashen-950/90 border border-ashen-800 p-3 rounded-lg flex items-center justify-between font-mono text-xs text-cyan-300 overflow-x-auto">
              <code>npm run build && npx cap sync android && ./gradlew assembleDebug</code>
              <button
                onClick={copyCapacitorCommands}
                className="ml-3 px-3 py-1 bg-ashen-800 hover:bg-ashen-700 text-white rounded text-[11px] font-sans font-semibold shrink-0 transition-colors"
              >
                {copiedCommand ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-ashen-800 bg-ashen-900/80">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-ashen-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-ashen-950 font-bold text-xs shadow-[0_0_15px_rgba(52,211,153,0.4)] transition-all active:scale-95"
          >
            <Check className="w-4 h-4" />
            Apply Settings
          </button>
        </div>
      </div>
    </div>
  );
};
