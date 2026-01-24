import React, { useState, useCallback } from 'react';

interface ActiveAbilityCircleProps {
  upgradeId: string;
  name: string;
  charge: number; // 0-100
  isReady: boolean; // charge >= 100
  x: number;
  y: number;
  size: number;
  onClick?: () => void;
}

// Icon mapping for active abilities (first letter as fallback)
const getAbilityIcon = (id: string): string => {
  switch (id) {
    case 'COOLDOWN_BOOSTER': return 'CB';
    case 'GOOP_DUMP': return 'GD';
    case 'GOOP_COLORIZER': return 'GC';
    case 'CRACK_DOWN': return 'CD';
    default: return id.charAt(0);
  }
};

// Color mapping for active abilities
const getAbilityColor = (id: string): string => {
  switch (id) {
    case 'COOLDOWN_BOOSTER': return '#5bbc70'; // Green
    case 'GOOP_DUMP': return '#f97316'; // Orange
    case 'GOOP_COLORIZER': return '#a855f7'; // Purple
    case 'CRACK_DOWN': return '#ef4444'; // Red
    default: return '#6acbda'; // Cyan default
  }
};

export const ActiveAbilityCircle: React.FC<ActiveAbilityCircleProps> = ({
  upgradeId,
  name,
  charge,
  isReady,
  x,
  y,
  size,
  onClick
}) => {
  const [isShaking, setIsShaking] = useState(false);

  // Stop all pointer events to prevent click passing through to game board rotation
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (isReady) {
      onClick?.();
    } else {
      // Shake feedback when not ready (same as goops)
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 300);
    }
  }, [isReady, onClick]);

  const color = getAbilityColor(upgradeId);
  const icon = getAbilityIcon(upgradeId);
  const radius = size / 2;
  const strokeWidth = 2;

  // Fill from bottom to top like goops
  // Circle is centered at (0,0), so top is -radius, bottom is +radius
  const fillProgress = charge / 100;
  const circleHeight = radius * 2;
  const fillHeight = fillProgress * circleHeight;
  const fillTop = radius - fillHeight; // Y position where fill starts (from top of circle)

  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* Outer group for positioning, inner group for shake animation */}
      <g
        className={isShaking ? "shake-anim" : ""}
        style={{ cursor: 'pointer' }}
        onPointerDown={handlePointerDown}
      >
        {/* Clip path for the circle */}
        <defs>
          <clipPath id={`clip-${upgradeId}`}>
            <circle cx={0} cy={0} r={radius - strokeWidth} />
          </clipPath>
        </defs>

        {/* Background circle (dim) */}
        <circle
          cx={0}
          cy={0}
          r={radius - strokeWidth}
          fill={color}
          fillOpacity={0.25}
        />

        {/* Fill portion (brighter, fills from bottom to top) */}
        {!isReady && (
          <rect
            x={-(radius - strokeWidth)}
            y={fillTop}
            width={(radius - strokeWidth) * 2}
            height={fillHeight}
            fill={color}
            fillOpacity={0.75}
            clipPath={`url(#clip-${upgradeId})`}
          />
        )}

        {/* Full bright when ready */}
        {isReady && (
          <circle
            cx={0}
            cy={0}
            r={radius - strokeWidth}
            fill={color}
            fillOpacity={0.85}
          />
        )}

        {/* Border stroke */}
        <circle
          cx={0}
          cy={0}
          r={radius - strokeWidth}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
        />

        {/* Glow effect when ready */}
        {isReady && (
          <circle
            cx={0}
            cy={0}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={2}
            opacity={0.5}
            className="animate-pulse"
          />
        )}

        {/* Icon text - always on top */}
        <text
          x={0}
          y={0}
          textAnchor="middle"
          dominantBaseline="central"
          fill={isReady ? 'white' : '#e2e8f0'}
          fontSize={size * 0.3}
          fontWeight="bold"
          fontFamily="monospace"
        >
          {icon}
        </text>
      </g>
    </g>
  );
};
