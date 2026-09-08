import React, { useRef, useState, useCallback, memo } from 'react';
import { JoystickConfig } from '../types/game';
import { triggerHaptic } from '../utils/storage';

interface TouchJoystickProps {
  config: JoystickConfig;
  onVectorChange: (vector: { x: number; y: number; magnitude: number }) => void;
  className?: string;
}

export const TouchJoystick: React.FC<TouchJoystickProps> = memo(({
  config,
  onVectorChange,
  className = '',
}) => {
  const baseRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const activePointerId = useRef<number | null>(null);

  const [isActive, setIsActive] = useState(false);
  const [isSprinting, setIsSprinting] = useState(false);
  const isSprintingRef = useRef(false);
  const anchorOffsetRef = useRef({ x: 0, y: 0 });
  const [anchorStyle, setAnchorStyle] = useState({ x: 0, y: 0 });

  // Runtime vector tracking (zero allocation)
  const currentVectorRef = useRef({ x: 0, y: 0, magnitude: 0 });

  const maxRadius = config.radius || 54;
  const deadzoneRadius = Math.max(4, (config.deadzone || 0.12) * maxRadius);

  // Reset input immediately to exact center (0, 0)
  const resetToCenter = useCallback(() => {
    activePointerId.current = null;
    setIsActive(false);
    setIsSprinting(false);
    isSprintingRef.current = false;
    anchorOffsetRef.current = { x: 0, y: 0 };
    setAnchorStyle({ x: 0, y: 0 });

    if (knobRef.current) {
      knobRef.current.style.transform = 'translate3d(0px, 0px, 0)';
    }
    currentVectorRef.current.x = 0;
    currentVectorRef.current.y = 0;
    currentVectorRef.current.magnitude = 0;
    onVectorChange(currentVectorRef.current);
  }, [onVectorChange]);

  // Compute vector from screen touch coordinates relative to base center
  const processTouch = useCallback(
    (clientX: number, clientY: number, customAnchor?: { x: number; y: number }) => {
      if (!baseRef.current) return;
      const rect = baseRef.current.getBoundingClientRect();
      const anchor = customAnchor || anchorOffsetRef.current;
      const centerX = rect.left + rect.width / 2 + anchor.x;
      const centerY = rect.top + rect.height / 2 + anchor.y;

      const dx = clientX - centerX;
      const dy = clientY - centerY;
      const distance = Math.hypot(dx, dy);

      if (distance < deadzoneRadius) {
        // Inside circular dead zone: no accidental drift
        if (isSprintingRef.current) {
          isSprintingRef.current = false;
          setIsSprinting(false);
        }
        if (knobRef.current) {
          knobRef.current.style.transform = 'translate3d(0px, 0px, 0)';
        }
        currentVectorRef.current.x = 0;
        currentVectorRef.current.y = 0;
        currentVectorRef.current.magnitude = 0;
        onVectorChange(currentVectorRef.current);
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

      // Visual knob clamping directly via style transform
      const visualDistance = Math.min(distance, maxRadius);
      const clampedKnobX = dirX * visualDistance;
      const clampedKnobY = dirY * visualDistance;

      if (knobRef.current) {
        knobRef.current.style.transform = `translate3d(${clampedKnobX}px, ${clampedKnobY}px, 0)`;
      }

      // Sprint state threshold check
      const inSprint = finalMagnitude >= (config.sprintThreshold || 0.88);
      if (inSprint !== isSprintingRef.current) {
        isSprintingRef.current = inSprint;
        setIsSprinting(inSprint);
        if (inSprint && config.haptics) {
          triggerHaptic(20);
        }
      }

      currentVectorRef.current.x = normalizedGameX;
      currentVectorRef.current.y = normalizedGameY;
      currentVectorRef.current.magnitude = finalMagnitude;

      onVectorChange(currentVectorRef.current);
    },
    [baseRef, config, deadzoneRadius, maxRadius, onVectorChange]
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

    let initialAnchor = { x: 0, y: 0 };
    if (config.dynamicAnchor && baseRef.current) {
      const rect = baseRef.current.getBoundingClientRect();
      const defaultCenterX = rect.left + rect.width / 2;
      const defaultCenterY = rect.top + rect.height / 2;
      const maxOffset = maxRadius * 0.75;
      const rawOffsetX = e.clientX - defaultCenterX;
      const rawOffsetY = e.clientY - defaultCenterY;
      const offsetDist = Math.hypot(rawOffsetX, rawOffsetY);

      if (offsetDist > 0) {
        const clampedDist = Math.min(maxOffset, offsetDist);
        initialAnchor = {
          x: (rawOffsetX / offsetDist) * clampedDist,
          y: (rawOffsetY / offsetDist) * clampedDist,
        };
      }
    }

    anchorOffsetRef.current = initialAnchor;
    setAnchorStyle(initialAnchor);
    setIsActive(true);
    if (config.haptics) triggerHaptic(12);

    processTouch(e.clientX, e.clientY, initialAnchor);
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
          transform: config.dynamicAnchor && isActive ? `translate3d(${anchorStyle.x}px, ${anchorStyle.y}px, 0)` : 'none',
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
          ref={knobRef}
          className={`absolute rounded-full border-2 flex items-center justify-center pointer-events-none shadow-lg will-change-transform ${
            isSprinting
              ? 'border-amber-300 bg-gradient-to-br from-amber-500 to-amber-700 shadow-[0_0_15px_rgba(245,158,11,0.6)] scale-105'
              : isActive
              ? 'border-cyan-300 bg-gradient-to-br from-cyan-500 to-cyan-700 shadow-[0_0_15px_rgba(34,211,238,0.6)]'
              : 'border-ashen-500 bg-gradient-to-br from-ashen-700 to-ashen-800'
          }`}
          style={{
            width: `${knobDiameter}px`,
            height: `${knobDiameter}px`,
            transform: 'translate3d(0px, 0px, 0)',
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
});
