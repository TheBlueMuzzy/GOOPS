import React from 'react';

interface ArcadeButtonProps {
  x: number;
  y: number;
  colorBody: string;
  colorTop: string;
  isPressed: boolean;
  onPress: () => void;
  onRelease: () => void;
}

/**
 * Arcade-style push button SVG component.
 * Has pressed (down) and unpressed (up) states with different SVG paths.
 */
export const ArcadeButton: React.FC<ArcadeButtonProps> = ({
  x,
  y,
  colorBody,
  colorTop,
  isPressed,
  onPress,
  onRelease,
}) => {
  // Up Paths (from Btn_*-Up.svg)
  const upBase = "M42.31,73.62C18.58,73.62,0,59.79,0,42.13S18.58,10.65,42.31,10.65s42.31,13.83,42.31,31.48-18.59,31.48-42.31,31.48Z";
  const upBody = "M74.5,41.03c0,11.84-14.45,21.44-32.27,21.44S9.97,52.87,9.97,41.03c0-8.74.25-20.68.25-20.68h64.43s-.15,13.21-.15,20.68Z";
  const upTopCy = 21.44;

  // Down Paths (from Btn_*-Down.svg)
  const downBase = "M42.31,62.97C18.58,62.97,0,49.14,0,31.48S18.58,0,42.31,0s42.31,13.83,42.31,31.48-18.59,31.48-42.31,31.48Z";
  const downBody = "M74.5,30.38c0,11.84-14.45,21.44-32.27,21.44S9.97,42.22,9.97,30.38c0-8.74.25-8.47.25-8.47h64.43s-.15.99-.15,8.47Z";
  const downTopCy = 23.01;

  // Shift Down state to align bases (Up base starts at y=10.65, Down base starts at y=0)
  const shiftY = 10.65;

  return (
    <g
      transform={`translate(${x}, ${y})`}
      style={{ cursor: 'pointer' }}
      onMouseDown={(e) => { e.stopPropagation(); onPress(); }}
      onMouseUp={(e) => { e.stopPropagation(); onRelease(); }}
      onMouseLeave={() => { if (isPressed) onRelease(); }}
      onTouchStart={(e) => { e.stopPropagation(); onPress(); }}
      onTouchEnd={(e) => { e.stopPropagation(); onRelease(); }}
    >
      {isPressed ? (
        <g transform={`translate(0, ${shiftY})`}>
          <path fill="#0d1a19" d={downBase} />
          <path fill={colorBody} fillRule="evenodd" d={downBody} />
          <ellipse fill={colorTop} cx="42.31" cy={downTopCy} rx="32.27" ry="21.44" />
        </g>
      ) : (
        <g>
          <path fill="#0d1a19" d={upBase} />
          <path fill={colorBody} fillRule="evenodd" d={upBody} />
          <ellipse fill={colorTop} cx="42.31" cy={upTopCy} rx="32.27" ry="21.44" />
        </g>
      )}
    </g>
  );
};
