import React, { useState, useRef } from 'react';
import { CustomModelInfo, ModelCalibrationConfig } from '../types/game';
import { triggerHaptic } from '../utils/storage';
import {
  Upload,
  FolderPlus,
  RefreshCw,
  User,
  Sliders,
  CheckCircle2,
  AlertCircle,
  X,
  Sparkles,
  RotateCw,
  Layers,
  Film,
  Maximize2,
  Trash2,
} from 'lucide-react';

interface CharacterUploadModalProps {
  modelInfo: CustomModelInfo;
  onUploadFile: (file: File) => Promise<boolean>;
  onReloadFromFolder: () => Promise<boolean>;
  onSaveCalibration: (config: ModelCalibrationConfig) => void;
  onResetToDefault: () => void;
  onClose: () => void;
}

export const CharacterUploadModal: React.FC<CharacterUploadModalProps> = ({
  modelInfo,
  onUploadFile,
  onReloadFromFolder,
  onSaveCalibration,
  onResetToDefault,
  onClose,
}) => {
  const [config, setConfig] = useState<ModelCalibrationConfig>({ ...modelInfo.config });
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      await processSelectedFile(file);
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      await processSelectedFile(file);
    }
  };

  const processSelectedFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.glb') && !file.name.toLowerCase().endsWith('.gltf')) {
      setStatusMessage({
        type: 'error',
        text: 'Please upload a .glb (Binary glTF) or .gltf 3D character file.',
      });
      return;
    }

    setIsLoading(true);
    setStatusMessage({ type: 'info', text: `Loading and rigging ${file.name}...` });
    triggerHaptic(25);

    try {
      const success = await onUploadFile(file);
      if (success) {
        setStatusMessage({
          type: 'success',
          text: `Successfully loaded character "${file.name}" into the 3D world!`,
        });
      } else {
        setStatusMessage({
          type: 'error',
          text: 'Failed to parse .glb model. Please check that the file is a valid 3D model.',
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Error processing 3D character file.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckFolder = async () => {
    setIsLoading(true);
    setStatusMessage({ type: 'info', text: 'Scanning /assets/characters/player.glb and candidate folders...' });
    triggerHaptic(20);

    try {
      const found = await onReloadFromFolder();
      if (found) {
        setStatusMessage({
          type: 'success',
          text: 'Found and loaded custom 3D character model!',
        });
      } else {
        setStatusMessage({
          type: 'error',
          text: 'No file detected at /assets/characters/player.glb or /public/assets/characters/player.glb yet. Upload one below or place your .glb in either folder.',
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: 'Could not load from folder: ' + (err?.message || 'File not found'),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfigChange = (newConfig: ModelCalibrationConfig) => {
    setConfig(newConfig);
    onSaveCalibration(newConfig);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-2xl max-h-[92vh] bg-ashen-950/95 border border-cyanGlow-600/40 rounded-2xl shadow-[0_0_50px_rgba(34,211,238,0.25)] flex flex-col overflow-hidden text-ashen-100 font-sans">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-ashen-800 bg-ashen-900/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyanGlow-500/20 border border-cyanGlow-400 flex items-center justify-center text-cyanGlow-300 shadow-[0_0_15px_rgba(34,211,238,0.3)]">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold font-medieval text-ashen-100 flex items-center gap-2">
                Custom 3D Main Character (.glb)
              </h2>
              <p className="text-xs text-ashen-400">
                Upload or link your custom rigged hero model with automatic scaling & animations
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Status Message Banner */}
          {statusMessage && (
            <div
              className={`p-3.5 rounded-xl border flex items-start gap-2.5 text-xs font-medium animate-fade-in ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
                  : statusMessage.type === 'error'
                  ? 'bg-red-950/60 border-red-500/50 text-red-300'
                  : 'bg-cyan-950/60 border-cyan-500/50 text-cyan-300'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
              ) : statusMessage.type === 'error' ? (
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
              ) : (
                <Sparkles className="w-4 h-4 shrink-0 text-cyan-400 mt-0.5" />
              )}
              <div className="flex-1">{statusMessage.text}</div>
            </div>
          )}

          {/* Specified Folder Path Banner */}
          <div className="p-4 rounded-xl bg-ashen-900/60 border border-ashen-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-ashen-200">
                <FolderPlus className="w-4 h-4 text-cyanGlow-400" />
                Target Folder Path
              </div>
              <p className="text-[11px] text-ashen-400">
                Active main hero loaded from <code className="text-cyan-300 font-mono font-bold">/models/Ash.glb</code>. You can also place custom models in <code className="text-cyan-300 font-mono font-bold">/public/models/</code> or <code className="text-cyan-300 font-mono font-bold">/assets/characters/</code>.
              </p>
            </div>
            <button
              onClick={handleCheckFolder}
              disabled={isLoading}
              className="px-4 py-2 rounded-xl bg-ashen-800 hover:bg-ashen-700 border border-ashen-600 text-xs font-bold text-cyanGlow-300 flex items-center justify-center gap-2 transition-all active:scale-95 shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Scan & Reload Folder
            </button>
          </div>

          {/* Drag & Drop / File Browser Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-cyanGlow-400 bg-cyanGlow-500/15 scale-[1.01]'
                : 'border-ashen-700/80 bg-ashen-900/40 hover:bg-ashen-900/70 hover:border-ashen-500'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".glb,.gltf"
              onChange={handleFileInputChange}
              className="hidden"
            />
            <div className="w-14 h-14 rounded-2xl bg-cyanGlow-500/20 border border-cyanGlow-400 flex items-center justify-center text-cyanGlow-300 mb-3 shadow-[0_0_15px_rgba(34,211,238,0.3)]">
              <Upload className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-ashen-100 font-medieval">
              Upload Your 3D Character Model
            </h3>
            <p className="text-xs text-ashen-400 mt-1 max-w-sm">
              Click to browse or drag & drop your <span className="text-cyanGlow-300 font-semibold">.glb</span> character file directly here for instant live 3D play.
            </p>
            <span className="mt-3 text-[10px] font-mono text-ashen-400 bg-ashen-800/60 px-3 py-1 rounded-full border border-ashen-700">
              Supports Skeletal Animations & Static Meshes
            </span>
          </div>

          {/* Active Model Status & Metadata */}
          <div className="bg-ashen-900/50 border border-ashen-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold font-medieval uppercase text-ashen-300">
                <Layers className="w-4 h-4 text-emerald-400" />
                Active Character Status
              </div>
              <span
                className={`text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${
                  modelInfo.isLoaded
                    ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                    : 'bg-ashen-800/80 border-ashen-700 text-ashen-400'
                }`}
              >
                {modelInfo.isLoaded ? `Active: ${modelInfo.name}` : 'Procedural Ashen Knight'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-ashen-950/70 border border-ashen-800">
                <span className="text-[10px] text-ashen-400 block">Source</span>
                <span className="font-semibold text-cyan-300 capitalize">
                  {modelInfo.source.replace('_', ' ')}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-ashen-950/70 border border-ashen-800">
                <span className="text-[10px] text-ashen-400 block">Meshes</span>
                <span className="font-semibold text-ashen-200">{modelInfo.meshCount} parts</span>
              </div>
              <div className="p-2.5 rounded-lg bg-ashen-950/70 border border-ashen-800">
                <span className="text-[10px] text-ashen-400 block">Rigged Animations</span>
                <span className="font-semibold text-ashen-200">
                  {modelInfo.hasAnimations ? `${modelInfo.animationNames.length} clips` : 'Procedural'}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-ashen-950/70 border border-ashen-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-ashen-400 block">Reset Model</span>
                  <span className="font-semibold text-red-300 text-[11px]">Default Knight</span>
                </div>
                <button
                  onClick={() => {
                    triggerHaptic(25);
                    onResetToDefault();
                    setStatusMessage({
                      type: 'info',
                      text: 'Switched back to Default Procedural Knight.',
                    });
                  }}
                  className="w-7 h-7 rounded-lg bg-red-950/60 hover:bg-red-900 border border-red-700 text-red-400 hover:text-white flex items-center justify-center transition-colors"
                  title="Reset to default knight"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Animation Clips list if available */}
            {modelInfo.hasAnimations && modelInfo.animationNames.length > 0 && (
              <div className="pt-2 border-t border-ashen-800">
                <span className="text-[10px] font-semibold text-ashen-400 block mb-1.5 flex items-center gap-1.5">
                  <Film className="w-3.5 h-3.5 text-purple-400" />
                  Detected Animation Clips in Model:
                </span>
                <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                  {modelInfo.animationNames.map((anim, i) => (
                    <span
                      key={i}
                      className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-950/50 border border-purple-800/60 text-purple-300"
                    >
                      {anim}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Model Calibration & Alignment Controls */}
          <div className="bg-ashen-900/50 border border-ashen-800 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold font-medieval uppercase text-ashen-300">
                <Sliders className="w-4 h-4 text-cyanGlow-400" />
                Model Scaling & Alignment Fine-Tuning
              </div>
              <span className="text-[10px] text-cyan-400 font-mono">Live Sync</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Scale Multiplier */}
              <div>
                <div className="flex justify-between text-xs font-semibold text-ashen-300 mb-1">
                  <span>Scale Multiplier</span>
                  <span className="font-mono text-cyan-300">{config.scaleMultiplier.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="3.0"
                  step="0.05"
                  value={config.scaleMultiplier}
                  onChange={e =>
                    handleConfigChange({ ...config, scaleMultiplier: parseFloat(e.target.value) })
                  }
                  className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-ashen-950 rounded-lg"
                />
                <div className="flex justify-between text-[10px] text-ashen-500 mt-1">
                  <button
                    onClick={() => handleConfigChange({ ...config, scaleMultiplier: 0.5 })}
                    className="hover:text-cyan-300"
                  >
                    0.5x
                  </button>
                  <button
                    onClick={() => handleConfigChange({ ...config, scaleMultiplier: 1.0 })}
                    className="hover:text-cyan-300 font-bold text-ashen-300"
                  >
                    1.0x (Default)
                  </button>
                  <button
                    onClick={() => handleConfigChange({ ...config, scaleMultiplier: 1.5 })}
                    className="hover:text-cyan-300"
                  >
                    1.5x
                  </button>
                </div>
              </div>

              {/* Y-Offset / Height Grounding */}
              <div>
                <div className="flex justify-between text-xs font-semibold text-ashen-300 mb-1">
                  <span>Ground Height (Y-Offset)</span>
                  <span className="font-mono text-amber-300">{config.yOffset.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="-1.5"
                  max="1.5"
                  step="0.05"
                  value={config.yOffset}
                  onChange={e =>
                    handleConfigChange({ ...config, yOffset: parseFloat(e.target.value) })
                  }
                  className="w-full accent-amber-400 cursor-pointer h-1.5 bg-ashen-950 rounded-lg"
                />
                <div className="flex justify-between text-[10px] text-ashen-500 mt-1">
                  <button
                    onClick={() => handleConfigChange({ ...config, yOffset: -0.5 })}
                    className="hover:text-amber-300"
                  >
                    Lower (-0.5)
                  </button>
                  <button
                    onClick={() => handleConfigChange({ ...config, yOffset: 0.0 })}
                    className="hover:text-amber-300 font-bold text-ashen-300"
                  >
                    0.0 (Auto Ground)
                  </button>
                  <button
                    onClick={() => handleConfigChange({ ...config, yOffset: 0.5 })}
                    className="hover:text-amber-300"
                  >
                    Raise (+0.5)
                  </button>
                </div>
              </div>

              {/* Facing Rotation Offset */}
              <div>
                <div className="flex justify-between text-xs font-semibold text-ashen-300 mb-1">
                  <span>Facing Direction</span>
                  <span className="font-mono text-purple-300">{config.rotationOffsetY}°</span>
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {[0, 90, 180, 270].map(deg => (
                    <button
                      key={deg}
                      onClick={() => handleConfigChange({ ...config, rotationOffsetY: deg })}
                      className={`py-1.5 text-xs font-bold rounded-lg border transition-all ${
                        config.rotationOffsetY === deg
                          ? 'border-purple-400 bg-purple-500/25 text-white shadow-[0_0_8px_rgba(168,85,247,0.3)]'
                          : 'border-ashen-700 bg-ashen-950/60 text-ashen-400'
                      }`}
                    >
                      {deg}°
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-ashen-800 bg-ashen-900/80">
          <div className="text-[11px] text-ashen-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-cyanGlow-400" />
            Animations automatically cross-fade during combat & movement
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-cyanGlow-500 hover:bg-cyanGlow-400 text-ashen-950 font-bold text-xs shadow-[0_0_15px_rgba(34,211,238,0.4)] transition-all active:scale-95"
          >
            Done & Return to Game
          </button>
        </div>
      </div>
    </div>
  );
};
