import React, { useRef } from 'react';
import { JoystickConfig } from '../types/game';

interface CameraTouchZoneProps {
  config: JoystickConfig;
  onCameraRotate: (deltaYaw: number, deltaPitch: number) => void;
  className?: string;
}

export const CameraTouchZone: React.FC<CameraTouchZoneProps> = ({
  config,
  onCameraRotate,
  className = '',
}) => {
  const activePointerId = useRef<number | null>(null);
  const lastPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only capture if primary pointer in this zone
    if (activePointerId.current !== null) return;
    activePointerId.current = e.pointerId;
    lastPos.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== e.pointerId) return;

    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };

    const sensitivity = (config.cameraSensitivity || 1.0) * 0.006;
    const invertFactor = config.cameraInvertY ? -1 : 1;

    onCameraRotate(-dx * sensitivity, dy * sensitivity * invertFactor);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current === e.pointerId) {
      activePointerId.current = null;
    }
  };

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={`touch-none select-none ${className}`}
    />
  );
};
