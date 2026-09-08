import React, { useState } from 'react';
import { JoystickConfig } from '../types/game';
import { JOYSTICK_PRESETS, triggerHaptic } from '../utils/storage';
import {
  Sliders,
  RotateCcw,
  Check,
  X,
  Smartphone,
  Vibrate,
  Move,
  Gauge,
  Eye,
  Crosshair,
  Sparkles,
} from 'lucide-react';

interface JoystickCalibrationModalProps {
  config: JoystickConfig;
  onSave: (config: JoystickConfig) => void;
  onClose: () => void;
}

export const JoystickCalibrationModal: React.FC<JoystickCalibrationModalProps> = ({
  config: initialConfig,
  onSave,
  onClose,
}) => {
  const [config, setConfig] = useState<JoystickConfig>({ ...initialConfig });
  const [testVector, setTestVector] = useState({ x: 0, y: 0, magnitude: 0, rawDist: 0 });
  const [isDraggingTest, setIsDraggingTest] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string>('balanced');

  const testRadius = 60;

  // Interactive Test Pad Logic
  const handleTestPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const dx = e.clientX - rect.left - centerX;
    const dy = e.clientY - rect.top - centerY;

    const distance = Math.sqrt(dx * dx + dy * dy);
    const maxRadius = testRadius;
    const deadzonePixels = config.deadzone * maxRadius;

    if (distance < deadzonePixels) {
      setTestVector({ x: 0, y: 0, magnitude: 0, rawDist: distance });
      return;
    }

    const normalizedRaw = Math.min(1.0, (distance - deadzonePixels) / (maxRadius - deadzonePixels));
    let curvedMag = normalizedRaw;
    if (config.responseCurve === 'smooth') {
      curvedMag = Math.pow(normalizedRaw, 1.5);
    } else if (config.responseCurve === 'aggressive') {
      curvedMag = Math.pow(normalizedRaw, 0.75);
    }
    const finalMag = Math.min(1.0, curvedMag * config.sensitivity);
    const angle = Math.atan2(dx, -dy);
    const outX = Math.sin(angle) * finalMag;
    const outY = Math.cos(angle) * finalMag;

    setTestVector({ x: outX, y: outY, magnitude: finalMag, rawDist: distance });
  };

  const applyPreset = (key: string) => {
    const preset = JOYSTICK_PRESETS[key];
    if (preset) {
      setSelectedPreset(key);
      setConfig(prev => ({ ...prev, ...preset.config }));
      triggerHaptic(30);
    }
  };

  const handleSave = () => {
    triggerHaptic(40);
    onSave(config);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-ashen-950/95 border border-ashen-600/60 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-ashen-100 font-sans">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-ashen-800 bg-ashen-900/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyanGlow-500/20 border border-cyanGlow-400 flex items-center justify-center text-cyanGlow-300 shadow-[0_0_12px_rgba(34,211,238,0.3)]">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold font-medieval text-ashen-100 flex items-center gap-2">
                Joystick & Control Calibration
              </h2>
              <p className="text-xs text-ashen-400">
                Calibrate deadzone, response curves, and touch zones for seamless Android gameplay
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
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Calibration Sliders & Settings (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Presets Row */}
            <div>
              <label className="text-xs font-semibold tracking-wider text-ashen-400 uppercase flex items-center gap-1.5 mb-2.5">
                <Sparkles className="w-3.5 h-3.5 text-cyanGlow-400" />
                Calibration Presets
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Object.entries(JOYSTICK_PRESETS).map(([key, item]) => (
                  <button
                    key={key}
                    onClick={() => applyPreset(key)}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      selectedPreset === key
                        ? 'border-cyanGlow-400 bg-cyanGlow-500/20 text-white shadow-[0_0_10px_rgba(34,211,238,0.25)]'
                        : 'border-ashen-700/60 bg-ashen-900/40 text-ashen-300 hover:border-ashen-600'
                    }`}
                  >
                    <div className="text-xs font-bold truncate">{item.name}</div>
                    <div className="text-[10px] text-ashen-400 line-clamp-2 mt-0.5">{item.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Granular Sliders */}
            <div className="bg-ashen-900/50 border border-ashen-800/80 rounded-xl p-4 space-y-4">
              {/* Deadzone Slider */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-ashen-300 flex items-center gap-1.5 font-medium">
                    <Crosshair className="w-3.5 h-3.5 text-cyanGlow-400" />
                    Inner Deadzone Radius
                  </span>
                  <span className="font-mono text-cyanGlow-300 font-bold">
                    {Math.round(config.deadzone * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.04"
                  max="0.35"
                  step="0.01"
                  value={config.deadzone}
                  onChange={e => {
                    setConfig({ ...config, deadzone: parseFloat(e.target.value) });
                    setSelectedPreset('custom');
                  }}
                  className="w-full accent-cyan-400 h-1.5 bg-ashen-800 rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-ashen-500 mt-1">
                  <span>Ultra Tight (4%)</span>
                  <span>Recommended (12%)</span>
                  <span>Wide (35%)</span>
                </div>
              </div>

              {/* Sensitivity Multiplier Slider */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-ashen-300 flex items-center gap-1.5 font-medium">
                    <Gauge className="w-3.5 h-3.5 text-ember-400" />
                    Movement Sensitivity
                  </span>
                  <span className="font-mono text-ember-300 font-bold">
                    {config.sensitivity.toFixed(2)}x
                  </span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2.2"
                  step="0.05"
                  value={config.sensitivity}
                  onChange={e => {
                    setConfig({ ...config, sensitivity: parseFloat(e.target.value) });
                    setSelectedPreset('custom');
                  }}
                  className="w-full accent-ember-500 h-1.5 bg-ashen-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Joystick Size / Radius */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-ashen-300 flex items-center gap-1.5 font-medium">
                    <Move className="w-3.5 h-3.5 text-purple-400" />
                    Stick Physical Radius
                  </span>
                  <span className="font-mono text-purple-300 font-bold">{config.radius}px</span>
                </div>
                <input
                  type="range"
                  min="48"
                  max="88"
                  step="2"
                  value={config.radius}
                  onChange={e => {
                    setConfig({ ...config, radius: parseInt(e.target.value) });
                    setSelectedPreset('custom');
                  }}
                  className="w-full accent-purple-400 h-1.5 bg-ashen-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Sprint Trigger Threshold */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-ashen-300 flex items-center gap-1.5 font-medium">
                    <Smartphone className="w-3.5 h-3.5 text-yellow-400" />
                    Sprint Edge Threshold
                  </span>
                  <span className="font-mono text-yellow-300 font-bold">
                    {Math.round(config.sprintThreshold * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.70"
                  max="0.95"
                  step="0.02"
                  value={config.sprintThreshold}
                  onChange={e => {
                    setConfig({ ...config, sprintThreshold: parseFloat(e.target.value) });
                    setSelectedPreset('custom');
                  }}
                  className="w-full accent-yellow-400 h-1.5 bg-ashen-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Opacity Slider */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-ashen-300 flex items-center gap-1.5 font-medium">
                    <Eye className="w-3.5 h-3.5 text-cyan-300" />
                    On-Screen Opacity
                  </span>
                  <span className="font-mono text-cyan-300 font-bold">
                    {Math.round(config.opacity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.30"
                  max="1.0"
                  step="0.05"
                  value={config.opacity}
                  onChange={e => {
                    setConfig({ ...config, opacity: parseFloat(e.target.value) });
                  }}
                  className="w-full accent-cyan-400 h-1.5 bg-ashen-800 rounded-lg cursor-pointer"
                />
              </div>
            </div>

            {/* Toggle Switches */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Dynamic Anchor Toggle */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-ashen-900/40 border border-ashen-800">
                <div>
                  <div className="text-xs font-semibold text-ashen-200">Dynamic Thumb Anchor</div>
                  <div className="text-[10px] text-ashen-400">Spawns base wherever touched</div>
                </div>
                <button
                  onClick={() => setConfig({ ...config, dynamicAnchor: !config.dynamicAnchor })}
                  className={`w-12 h-6 rounded-full transition-colors relative flex items-center px-1 ${
                    config.dynamicAnchor ? 'bg-cyanGlow-500' : 'bg-ashen-700'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      config.dynamicAnchor ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Haptic Vibration */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-ashen-900/40 border border-ashen-800">
                <div className="flex items-center gap-2">
                  <Vibrate className="w-4 h-4 text-emerald-400" />
                  <div>
                    <div className="text-xs font-semibold text-ashen-200">Haptic Feedback</div>
                    <div className="text-[10px] text-ashen-400">Android vibration pulses</div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    const next = !config.haptics;
                    setConfig({ ...config, haptics: next });
                    if (next) triggerHaptic(30);
                  }}
                  className={`w-12 h-6 rounded-full transition-colors relative flex items-center px-1 ${
                    config.haptics ? 'bg-emerald-500' : 'bg-ashen-700'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      config.haptics ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Left-Handed Layout */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-ashen-900/40 border border-ashen-800">
                <div>
                  <div className="text-xs font-semibold text-ashen-200">Left-Handed Mode</div>
                  <div className="text-[10px] text-ashen-400">Swaps stick & buttons</div>
                </div>
                <button
                  onClick={() => setConfig({ ...config, leftHanded: !config.leftHanded })}
                  className={`w-12 h-6 rounded-full transition-colors relative flex items-center px-1 ${
                    config.leftHanded ? 'bg-purple-500' : 'bg-ashen-700'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      config.leftHanded ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Camera Sensitivity */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-ashen-900/40 border border-ashen-800">
                <div>
                  <div className="text-xs font-semibold text-ashen-200">Camera Orbit Look</div>
                  <div className="text-[10px] text-ashen-400">
                    Sensitivity ({config.cameraSensitivity.toFixed(1)}x)
                  </div>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2.5"
                  step="0.1"
                  value={config.cameraSensitivity}
                  onChange={e => setConfig({ ...config, cameraSensitivity: parseFloat(e.target.value) })}
                  className="w-20 accent-cyan-400 h-1.5 bg-ashen-800 rounded cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Right Column: Live Interactive Calibration Visualizer Pad (5 cols) */}
          <div className="lg:col-span-5 flex flex-col items-center justify-between bg-ashen-900/60 border border-ashen-800 rounded-xl p-5">
            <div className="w-full text-center">
              <span className="text-xs font-bold font-medieval tracking-widest uppercase text-cyanGlow-300">
                Live Calibration Visualizer
              </span>
              <p className="text-[11px] text-ashen-400 mt-0.5">
                Touch and drag inside the test ring to test deadzone & sprint response
              </p>
            </div>

            {/* Interactive Test Pad Ring */}
            <div
              onPointerDown={e => {
                setIsDraggingTest(true);
                handleTestPointer(e);
                (e.target as HTMLElement).setPointerCapture(e.pointerId);
              }}
              onPointerMove={e => {
                if (isDraggingTest) handleTestPointer(e);
              }}
              onPointerUp={() => {
                setIsDraggingTest(false);
                setTestVector({ x: 0, y: 0, magnitude: 0, rawDist: 0 });
              }}
              onPointerCancel={() => {
                setIsDraggingTest(false);
                setTestVector({ x: 0, y: 0, magnitude: 0, rawDist: 0 });
              }}
              className="relative my-4 rounded-full border-2 border-cyanGlow-500/50 bg-ashen-950/80 shadow-[0_0_25px_rgba(34,211,238,0.2)] flex items-center justify-center cursor-crosshair touch-none select-none"
              style={{
                width: `${testRadius * 2}px`,
                height: `${testRadius * 2}px`,
              }}
            >
              {/* Deadzone Inner Visualizer Ring */}
              <div
                className="absolute rounded-full border border-dashed border-red-400/60 bg-red-500/10 pointer-events-none flex items-center justify-center"
                style={{
                  width: `${config.deadzone * testRadius * 2}px`,
                  height: `${config.deadzone * testRadius * 2}px`,
                }}
              >
                <span className="text-[8px] text-red-300/80 font-mono">DEAD</span>
              </div>

              {/* Sprint Threshold Ring */}
              <div
                className="absolute rounded-full border border-dotted border-amber-400/50 pointer-events-none"
                style={{
                  width: `${config.sprintThreshold * testRadius * 2}px`,
                  height: `${config.sprintThreshold * testRadius * 2}px`,
                }}
              />

              {/* Active Knob Indicator */}
              <div
                className="absolute w-8 h-8 rounded-full pointer-events-none transition-transform flex items-center justify-center"
                style={{
                  transform: `translate(${testVector.x * testRadius * 0.8}px, ${-testVector.y * testRadius * 0.8}px)`,
                  background:
                    testVector.magnitude >= config.sprintThreshold
                      ? 'radial-gradient(circle, #ff5722 0%, #b71c1c 100%)'
                      : testVector.magnitude > 0
                      ? 'radial-gradient(circle, #22d3ee 0%, #1e1b4b 100%)'
                      : 'radial-gradient(circle, #4e4572 0%, #0d0b14 100%)',
                  boxShadow:
                    testVector.magnitude >= config.sprintThreshold
                      ? '0 0 14px rgba(255,87,34,0.8)'
                      : '0 0 10px rgba(34,211,238,0.6)',
                }}
              >
                <div className="w-2 h-2 rounded-full bg-white" />
              </div>
            </div>

            {/* Real-time Telemetry Readout */}
            <div className="w-full grid grid-cols-3 gap-2 text-center bg-ashen-950/80 p-3 rounded-xl border border-ashen-800">
              <div>
                <div className="text-[10px] text-ashen-400 uppercase font-mono">Vector X</div>
                <div className="text-xs font-bold font-mono text-cyanGlow-300">
                  {testVector.x.toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-ashen-400 uppercase font-mono">Vector Y</div>
                <div className="text-xs font-bold font-mono text-cyanGlow-300">
                  {testVector.y.toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-ashen-400 uppercase font-mono">Magnitude</div>
                <div
                  className={`text-xs font-bold font-mono ${
                    testVector.magnitude >= config.sprintThreshold
                      ? 'text-ember-400 font-extrabold animate-pulse'
                      : 'text-emerald-300'
                  }`}
                >
                  {Math.round(testVector.magnitude * 100)}%
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-ashen-800 bg-ashen-900/80">
          <button
            onClick={() => {
              applyPreset('balanced');
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-ashen-700 bg-ashen-800/60 text-ashen-300 hover:text-white transition-colors text-xs font-semibold"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset to Default
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-ashen-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-cyanGlow-500 hover:bg-cyanGlow-400 text-ashen-950 font-bold text-xs shadow-[0_0_15px_rgba(34,211,238,0.4)] transition-all active:scale-95"
            >
              <Check className="w-4 h-4" />
              Apply & Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
