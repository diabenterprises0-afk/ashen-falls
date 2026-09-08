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
  const containerRef = useRef<HTMLDivElement>(null);
  const activePointerId = useRef<number | null>(null);

  // Joystick Base Position
  const [basePos, setBasePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  // Knob relative offset from base
  const [knobPos, setKnobPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isActive, setIsActive] = useState(false);
  const [isSprinting, setIsSprinting] = useState(false);

  // Set default fixed base position inside the container
  const updateDefaultBase = useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const defaultX = config.leftHanded ? rect.width - config.radius - 30 : config.radius + 30;
      const defaultY = rect.height - config.radius - 35;
      setBasePos({ x: defaultX, y: defaultY });
    }
  }, [config.leftHanded, config.radius]);

  useEffect(() => {
    updateDefaultBase();
    window.addEventListener('resize', updateDefaultBase);
    return () => window.removeEventListener('resize', updateDefaultBase);
  }, [updateDefaultBase]);

  // Compute processed input vector from raw dx, dy
  const processVector = useCallback(
    (dx: number, dy: number) => {
      const distance = Math.sqrt(dx * dx + dy * dy);
      const maxRadius = config.radius;
      const deadzonePixels = config.deadzone * maxRadius;

      if (distance < deadzonePixels) {
        setIsSprinting(false);
        onVectorChange({ x: 0, y: 0, magnitude: 0 });
        return { knobX: dx, knobY: dy };
      }

      // Re-map normalized magnitude smoothly from 0.0 at deadzone edge to 1.0 at max radius
      const normalizedRaw = Math.min(1.0, (distance - deadzonePixels) / (maxRadius - deadzonePixels));

      // Apply response curve
      let curvedMag = normalizedRaw;
      if (config.responseCurve === 'smooth') {
        curvedMag = Math.pow(normalizedRaw, 1.5);
      } else if (config.responseCurve === 'aggressive') {
        curvedMag = Math.pow(normalizedRaw, 0.75);
      }

      // Apply sensitivity multiplier
      const finalMagnitude = Math.min(1.0, curvedMag * config.sensitivity);

      // Unit direction
      const angle = Math.atan2(dx, -dy); // 0 is forward/up
      const outX = Math.sin(angle) * finalMagnitude;
      const outY = Math.cos(angle) * finalMagnitude;

      // Check sprint threshold
      const inSprint = finalMagnitude >= config.sprintThreshold;
      if (inSprint !== isSprinting) {
        setIsSprinting(inSprint);
        if (inSprint && config.haptics) {
          triggerHaptic(20);
        }
      }

      onVectorChange({ x: outX, y: outY, magnitude: finalMagnitude });

      // Clamp knob visual position within max radius
      const clampedDist = Math.min(distance, maxRadius);
      const knobX = (dx / (distance || 1)) * clampedDist;
      const knobY = (dy / (distance || 1)) * clampedDist;

      return { knobX, knobY };
    },
    [config, onVectorChange, isSprinting]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== null) return;
    activePointerId.current = e.pointerId;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const touchX = e.clientX - rect.left;
    const touchY = e.clientY - rect.top;

    let currentBase = basePos;
    if (config.dynamicAnchor) {
      currentBase = { x: touchX, y: touchY };
      setBasePos(currentBase);
    }

    setIsActive(true);
    if (config.haptics) triggerHaptic(15);

    const dx = touchX - currentBase.x;
    const dy = touchY - currentBase.y;
    const { knobX, knobY } = processVector(dx, dy);
    setKnobPos({ x: knobX, y: knobY });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== e.pointerId) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const touchX = e.clientX - rect.left;
    const touchY = e.clientY - rect.top;

    const dx = touchX - basePos.x;
    const dy = touchY - basePos.y;

    const { knobX, knobY } = processVector(dx, dy);
    setKnobPos({ x: knobX, y: knobY });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== e.pointerId) return;
    activePointerId.current = null;
    setIsActive(false);
    setIsSprinting(false);
    setKnobPos({ x: 0, y: 0 });
    onVectorChange({ x: 0, y: 0, magnitude: 0 });

    if (config.dynamicAnchor) {
      updateDefaultBase();
    }
  };

  const radius = config.radius;
  const deadzoneRadius = config.deadzone * radius;
  const sprintRadius = config.sprintThreshold * radius;

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={`relative select-none pointer-events-auto touch-none ${className}`}
      style={{
        opacity: config.opacity,
      }}
    >
      {/* Joystick Base Outer Container */}
      <div
        className="absolute rounded-full pointer-events-none transition-transform duration-75"
        style={{
          left: `${basePos.x - radius}px`,
          top: `${basePos.y - radius}px`,
          width: `${radius * 2}px`,
          height: `${radius * 2}px`,
        }}
      >
        {/* Outer Ring with Dark Fantasy Glass Backing */}
        <div
          className={`w-full h-full rounded-full border-2 transition-all duration-200 flex items-center justify-center relative ${
            isSprinting
              ? 'border-ember-500 bg-ashen-900/60 shadow-[0_0_20px_rgba(255,87,34,0.4)]'
              : isActive
              ? 'border-cyanGlow-400 bg-ashen-900/40 shadow-[0_0_15px_rgba(34,211,238,0.3)]'
              : 'border-ashen-600/60 bg-ashen-950/30'
          }`}
        >
          {/* 4 Cardinal Runic Ticks */}
          <div className="absolute top-1 w-1 h-2 bg-ashen-400/70 rounded-full" />
          <div className="absolute bottom-1 w-1 h-2 bg-ashen-400/70 rounded-full" />
          <div className="absolute left-1 w-2 h-1 bg-ashen-400/70 rounded-full" />
          <div className="absolute right-1 w-2 h-1 bg-ashen-400/70 rounded-full" />

          {/* Deadzone Boundary Indicator Circle */}
          <div
            className="absolute rounded-full border border-dashed border-ashen-500/30 pointer-events-none"
            style={{
              width: `${deadzoneRadius * 2}px`,
              height: `${deadzoneRadius * 2}px`,
            }}
          />

          {/* Sprint Threshold Outer Circle */}
          <div
            className={`absolute rounded-full border border-dotted transition-colors duration-150 pointer-events-none ${
              isSprinting ? 'border-ember-400/80 scale-105' : 'border-ashen-600/30'
            }`}
            style={{
              width: `${sprintRadius * 2}px`,
              height: `${sprintRadius * 2}px`,
            }}
          />

          {/* Sprint Mode Label */}
          {isSprinting && (
            <span className="absolute -top-6 text-[10px] font-bold tracking-widest uppercase text-ember-400 animate-pulse bg-ashen-950/80 px-2 py-0.5 rounded border border-ember-500/40">
              SPRINT
            </span>
          )}

          {/* Interactive Thumb Knob */}
          <div
            className={`absolute rounded-full shadow-lg flex items-center justify-center transition-transform ${
              isActive ? 'scale-110' : 'scale-100'
            }`}
            style={{
              width: `${radius * 0.72}px`,
              height: `${radius * 0.72}px`,
              transform: `translate(${knobPos.x}px, ${knobPos.y}px)`,
              background: isSprinting
                ? 'radial-gradient(circle, #ff7043 0%, #b71c1c 90%)'
                : isActive
                ? 'radial-gradient(circle, #22d3ee 0%, #1e1b4b 90%)'
                : 'radial-gradient(circle, #4e4572 0%, #0d0b14 90%)',
              border: isSprinting
                ? '2px solid #ffcc80'
                : isActive
                ? '2px solid #a5f3fc'
                : '1.5px solid #7568a3',
              boxShadow: isSprinting
                ? '0 0 16px rgba(255,112,67,0.7)'
                : isActive
                ? '0 0 14px rgba(34,211,238,0.6)'
                : '0 4px 8px rgba(0,0,0,0.6)',
            }}
          >
            {/* Inner Runic Emblem */}
            <div
              className={`w-2.5 h-2.5 rounded-full transition-colors ${
                isSprinting ? 'bg-white' : isActive ? 'bg-cyan-200' : 'bg-ashen-400'
              }`}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
