import React, { useRef, useState, useEffect, useCallback } from 'react';
import { JoystickConfig } from '../types/game';
import { triggerHaptic } from '../utils/storage';

interface TouchJoystickProps {
  config: JoystickConfig;
  onVectorChange: (vector: { x: number; y: number; magnitude: number }) => void;
  className?: string;
}

export const TouchJoystick: React.FC<TouchJoystickProps> = ({
  config,
  onVectorChange,
  className = '',
}) => {
  const baseRef = useRef<HTMLDivElement>(null);
  const activePointerId = useRef<number | null>(null);

  // Knob relative offset from center of base in pixels (starts exactly at 0, 0)
  const [knobPos, setKnobPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isActive, setIsActive] = useState(false);
  const [isSprinting, setIsSprinting] = useState(false);

  // Smoothed vector refs to eliminate jitter without latency
  const currentVectorRef = useRef({ x: 0, y: 0, magnitude: 0 });
  const animFrameRef = useRef<number | null>(null);

  const maxRadius = config.radius || 54;
  const deadzoneRadius = Math.max(4, (config.deadzone || 0.12) * maxRadius);

  // Reset input immediately to exact center (0, 0)
  const resetToCenter = useCallback(() => {
    activePointerId.current = null;
    setIsActive(false);
    setIsSprinting(false);
    setKnobPos({ x: 0, y: 0 });
    currentVectorRef.current = { x: 0, y: 0, magnitude: 0 };
    onVectorChange({ x: 0, y: 0, magnitude: 0 });
  }, [onVectorChange]);

  // Compute vector from screen touch coordinates relative to base center
  const processTouch = useCallback(
    (clientX: number, clientY: number) => {
      if (!baseRef.current) return;
      const rect = baseRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const dx = clientX - centerX;
      const dy = clientY - centerY;
      const distance = Math.hypot(dx, dy);

      if (distance < deadzoneRadius) {
        // Inside circular dead zone: no accidental drift
        setIsSprinting(false);
        setKnobPos({ x: 0, y: 0 });
        currentVectorRef.current = { x: 0, y: 0, magnitude: 0 };
        onVectorChange({ x: 0, y: 0, magnitude: 0 });
        return;
      }

      // Smooth normalized magnitude [0.0, 1.0] outside dead zone
      const rawNormalized = Math.min(1.0, (distance - deadzoneRadius) / (maxRadius - deadzoneRadius));

      // Optional response curves
      let curveMag = rawNormalized;
      if (config.responseCurve === 'smooth') {
        curveMag = Math.pow(rawNormalized, 1.3);
      } else if (config.responseCurve === 'aggressive') {
        curveMag = Math.pow(rawNormalized, 0.8);
      }

      const finalMagnitude = Math.min(1.0, curveMag * (config.sensitivity || 1.0));

      // Unit vector: screen Y is downward, so game Y (forward) is -dy
      const dirX = dx / (distance || 1);
      const dirY = dy / (distance || 1);

      // Game coordinates: +X = Right, -X = Left, +Y = Forward (Up), -Y = Backward (Down)
      const gameX = dirX * finalMagnitude;
      const gameY = -dirY * finalMagnitude;

      // Ensure diagonal magnitude is exactly normalized (never exceeds 1.0)
      const clampedMag = Math.min(1.0, Math.hypot(gameX, gameY));
      const normalizedGameX = clampedMag > 0 ? (gameX / clampedMag) * finalMagnitude : 0;
      const normalizedGameY = clampedMag > 0 ? (gameY / clampedMag) * finalMagnitude : 0;

      // Visual knob clamping
      const visualDistance = Math.min(distance, maxRadius);
      const clampedKnobX = dirX * visualDistance;
      const clampedKnobY = dirY * visualDistance;

      setKnobPos({ x: clampedKnobX, y: clampedKnobY });

      // Sprint state threshold check
      const inSprint = finalMagnitude >= (config.sprintThreshold || 0.88);
      if (inSprint !== isSprinting) {
        setIsSprinting(inSprint);
        if (inSprint && config.haptics) {
          triggerHaptic(20);
        }
      }

      currentVectorRef.current = {
        x: normalizedGameX,
        y: normalizedGameY,
        magnitude: finalMagnitude,
      };

      onVectorChange({
        x: normalizedGameX,
        y: normalizedGameY,
        magnitude: finalMagnitude,
      });
    },
    [baseRef, config, deadzoneRadius, maxRadius, isSprinting, onVectorChange]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Multi-touch isolation: only track one pointer for this joystick
    if (activePointerId.current !== null) return;
    activePointerId.current = e.pointerId;

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (err) {
      // safe fallback
    }

    setIsActive(true);
    if (config.haptics) triggerHaptic(12);

    processTouch(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== e.pointerId) return;
    processTouch(e.clientX, e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== e.pointerId) return;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch (err) {
      // safe fallback
    }
    resetToCenter();
  };

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const baseDiameter = maxRadius * 2;
  const knobDiameter = maxRadius * 0.85;

  return (
    <div
      className={`relative select-none pointer-events-auto touch-none flex items-center justify-center p-3 ${className}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{ opacity: config.opacity || 0.85 }}
    >
      {/* Joystick Base Outer Enclosure */}
      <div
        ref={baseRef}
        className={`relative rounded-full border-2 transition-colors duration-150 flex items-center justify-center shadow-2xl ${
          isSprinting
            ? 'border-amber-400 bg-ashen-950/80 shadow-[0_0_25px_rgba(245,158,11,0.4)]'
            : isActive
            ? 'border-cyan-400/80 bg-ashen-950/75 shadow-[0_0_20px_rgba(34,211,238,0.35)]'
            : 'border-ashen-700/60 bg-ashen-950/60'
        }`}
        style={{
          width: `${baseDiameter}px`,
          height: `${baseDiameter}px`,
        }}
      >
        {/* Cardinal Direction Notches */}
        <div className="absolute top-1.5 w-1 h-2 bg-ashen-600/50 rounded-full" />
        <div className="absolute bottom-1.5 w-1 h-2 bg-ashen-600/50 rounded-full" />
        <div className="absolute left-1.5 h-1 w-2 bg-ashen-600/50 rounded-full" />
        <div className="absolute right-1.5 h-1 w-2 bg-ashen-600/50 rounded-full" />

        {/* Deadzone Ring Visual Indicator */}
        <div
          className="absolute rounded-full border border-dashed border-ashen-700/40 pointer-events-none"
          style={{
            width: `${deadzoneRadius * 2}px`,
            height: `${deadzoneRadius * 2}px`,
          }}
        />

        {/* Sprint Ring Visual Indicator */}
        <div
          className={`absolute rounded-full border pointer-events-none transition-colors duration-150 ${
            isSprinting ? 'border-amber-500/60' : 'border-cyan-500/20'
          }`}
          style={{
            width: `${(config.sprintThreshold || 0.88) * baseDiameter}px`,
            height: `${(config.sprintThreshold || 0.88) * baseDiameter}px`,
          }}
        />

        {/* Dynamic Glowing Thumb Knob */}
        <div
          className={`absolute rounded-full border-2 flex items-center justify-center pointer-events-none transition-transform duration-75 shadow-lg ${
            isSprinting
              ? 'border-amber-300 bg-gradient-to-br from-amber-500 to-amber-700 shadow-[0_0_15px_rgba(245,158,11,0.6)] scale-105'
              : isActive
              ? 'border-cyan-300 bg-gradient-to-br from-cyan-500 to-cyan-700 shadow-[0_0_15px_rgba(34,211,238,0.6)]'
              : 'border-ashen-500 bg-gradient-to-br from-ashen-700 to-ashen-800'
          }`}
          style={{
            width: `${knobDiameter}px`,
            height: `${knobDiameter}px`,
            transform: `translate(${knobPos.x}px, ${knobPos.y}px)`,
          }}
        >
          {/* Thumb Inner Core Pip */}
          <div
            className={`w-3 h-3 rounded-full ${
              isSprinting
                ? 'bg-amber-100 shadow-[0_0_6px_#fef08a]'
                : isActive
                ? 'bg-cyan-100 shadow-[0_0_6px_#cffafe]'
                : 'bg-ashen-400'
            }`}
          />
        </div>
      </div>
    </div>
  );
};
