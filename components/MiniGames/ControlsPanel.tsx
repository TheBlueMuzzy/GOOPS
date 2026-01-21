import React, { useRef } from 'react';
import { CornerIndex, MinigameTextState } from '../../types/minigames';

// Dial coordinate constants (in SVG space)
const DIAL_CENTER_X = 194.32;
const DIAL_CENTER_Y = 1586.66;

interface ControlsPanelProps {
  localDialRotation: number;
  isDialDragging: boolean;
  dialShaking: boolean;
  dialPressed: boolean;
  onDialStart: (clientX: number, clientY: number) => void;
  onDialPress: () => void;
  getControlsCornerLightColor: (cornerIndex: CornerIndex) => string;
  textState: MinigameTextState;
  isDialAligned: boolean;
  isComplicationActive: boolean;
}

/**
 * Reset Controls panel SVG component.
 * Renders the dial alignment puzzle with:
 * - Rotatable dial
 * - 4 corner indicator lights
 * - PRESS prompt when aligned
 */
export const ControlsPanel: React.FC<ControlsPanelProps> = ({
  localDialRotation,
  isDialDragging,
  dialShaking,
  dialPressed,
  onDialStart,
  onDialPress,
  getControlsCornerLightColor,
  textState,
  isDialAligned,
  isComplicationActive,
}) => {
  // Ref to track if we just finished dragging (to ignore click after drag)
  const justDraggedRef = useRef(false);

  const handleDialClick = () => {
    // Ignore click if we just finished dragging
    if (justDraggedRef.current) {
      justDraggedRef.current = false;
      return;
    }
    onDialPress();
  };

  // When drag ends (isDialDragging goes from true to false), mark as just dragged
  // to prevent the subsequent click event from firing
  const wasDraggingRef = useRef(false);
  if (isDialDragging && !wasDraggingRef.current) {
    wasDraggingRef.current = true;
  }
  if (!isDialDragging && wasDraggingRef.current) {
    wasDraggingRef.current = false;
    justDraggedRef.current = true;
    // Reset after a short delay to allow normal clicks later
    setTimeout(() => { justDraggedRef.current = false; }, 100);
  }

  return (
    <g id="Reset_Controls">
      {/* Dial Base Panel - Corrected Shape */}
      <path fill="#45486c" d="M290.21,1663.73c10.78-17.3,17.01-37.73,17.01-59.61,0-23.97-7.48-46.2-20.22-64.48,7.77-.06,15.53-3.05,21.46-8.98,11.98-11.98,11.98-31.4,0-43.37-1.9-1.9-3.99-3.5-6.21-4.8-.5-17.51-14.85-31.56-32.48-31.56H121.34c-17.78,0-32.22,14.28-32.49,32-1.95,1.22-3.81,2.66-5.5,4.36-11.98,11.98-11.98,31.4,0,43.37,5.16,5.16,11.69,8.09,18.42,8.8-12.82,18.31-20.34,40.6-20.34,64.65,0,22.08,6.34,42.67,17.3,60.07-5.63,1.18-11,3.95-15.38,8.32-11.98,11.98-11.98,31.4,0,43.37,11.98,11.98,31.4,11.98,43.37,0,4.44-4.44,7.23-9.91,8.38-15.64,17.22,10.63,37.5,16.77,59.22,16.77,22.93,0,44.26-6.84,62.07-18.59.88,6.39,3.78,12.55,8.69,17.46,11.98,11.98,31.4,11.98,43.37,0,11.98-11.98,11.98-31.4,0-43.37-5.11-5.11-11.58-8.03-18.24-8.78Z"/>

      {/* Shadow Circle under Dial */}
      <circle fill="#0d1a19" cx="194.32" cy="1604.12" r="97.6" opacity="0.3"/>

      {/* Corner Light Indicators - TR=45°, TL=315°, BL=225°, BR=135° */}
      {/* Top-Left Light (315°) */}
      <g>
        <path fill={getControlsCornerLightColor(1)} d="M103.94,1519.68c-6.36,0-11.53-5.17-11.53-11.53s5.17-11.54,11.53-11.54,11.53,5.17,11.53,11.53-5.17,11.54-11.53,11.54Z"/>
        <path fill="#1f1f38" d="M103.94,1498.11c5.54,0,10.03,4.49,10.03,10.03h0c0,5.55-4.49,10.04-10.03,10.04h0c-5.54,0-10.03-4.49-10.03-10.03h0c0-5.55,4.49-10.04,10.03-10.04h0M103.94,1495.11c-7.19,0-13.03,5.85-13.03,13.03s5.85,13.04,13.03,13.04,13.03-5.85,13.03-13.03-5.85-13.04-13.03-13.03h0Z"/>
      </g>
      {/* Top-Right Light (45°) */}
      <g>
        <path fill={getControlsCornerLightColor(0)} d="M288.3,1519.68c-6.36,0-11.53-5.17-11.53-11.53s5.17-11.54,11.53-11.54,11.53,5.17,11.53,11.53-5.17,11.54-11.53,11.54Z"/>
        <path fill="#1f1f38" d="M288.3,1498.11c5.54,0,10.03,4.49,10.03,10.03h0c0,5.55-4.49,10.04-10.03,10.04h0c-5.54,0-10.03-4.49-10.03-10.03h0c0-5.55,4.49-10.04,10.03-10.04h0M288.3,1495.11c-7.19,0-13.03,5.85-13.03,13.03s5.85,13.04,13.03,13.04,13.03-5.85,13.03-13.03-5.85-13.04-13.03-13.03h0Z"/>
      </g>
      {/* Bottom-Left Light (225°) */}
      <g>
        <path fill={getControlsCornerLightColor(2)} d="M103.94,1708.16c-6.36,0-11.53-5.17-11.53-11.53s5.17-11.54,11.53-11.54,11.53,5.17,11.53,11.53-5.17,11.54-11.53,11.54Z"/>
        <path fill="#1f1f38" d="M103.94,1686.59c5.54,0,10.03,4.49,10.03,10.03h0c0,5.55-4.49,10.04-10.03,10.04h0c-5.54,0-10.03-4.49-10.03-10.03h0c0-5.55,4.49-10.04,10.03-10.04h0M103.94,1683.59c-7.19,0-13.03,5.85-13.03,13.03s5.85,13.04,13.03,13.04,13.03-5.85,13.03-13.03-5.85-13.04-13.03-13.03h0Z"/>
      </g>
      {/* Bottom-Right Light (135°) */}
      <g>
        <path fill={getControlsCornerLightColor(3)} d="M288.3,1708.16c-6.36,0-11.53-5.17-11.53-11.53s5.17-11.54,11.53-11.53,11.53,5.17,11.53,11.53-5.17,11.54-11.53,11.54Z"/>
        <path fill="#1f1f38" d="M288.3,1686.59c5.54,0,10.03,4.49,10.03,10.03h0c0,5.55-4.49,10.04-10.03,10.04h0c-5.54,0-10.03-4.49-10.03-10.03h0c0-5.55,4.49-10.04,10.03-10.04h0M288.3,1683.59c-7.19,0-13.03,5.85-13.03,13.03s5.85,13.04,13.03,13.04,13.03-5.85,13.03-13.03-5.85-13.04-13.03-13.03h0Z"/>
      </g>

      <text
        fill={textState.color}
        fontFamily="'Amazon Ember'"
        fontSize="20.93"
        transform="translate(108.17 1480.38)"
      >
        {textState.text}
      </text>

      {/* The Dial Itself - outer group for rotation/press, inner group for shake */}
      <g
        transform={`translate(0 ${dialPressed ? 4 : 0}) rotate(${Math.round(localDialRotation)} ${DIAL_CENTER_X} ${DIAL_CENTER_Y})`}
        style={{
          cursor: isDialDragging ? 'grabbing' : 'grab'
        }}
        onMouseDown={(e) => onDialStart(e.clientX, e.clientY)}
        onTouchStart={(e) => {
          if (e.touches.length > 0) {
            onDialStart(e.touches[0].clientX, e.touches[0].clientY);
          }
        }}
        onClick={handleDialClick}
      >
        {/* Inner group for shake animation - keeps rotation intact */}
        <g className={dialShaking ? 'shake' : ''}>
          <circle fill="#d36b28" cx="194.32" cy="1586.66" r="86.84"/>
          {/* Inner Arc */}
          <path fill="none" stroke="#fff" strokeWidth="6" strokeMiterlimit="10" d="M238.98,1629.6c-11.27,11.72-27.11,19.01-44.65,19.01s-32.11-6.72-43.27-17.62"/>
          {/* Inner Arrows */}
          <g transform="translate(170.65 1623.1) rotate(135) scale(1.74)">
            <path fill="#fff" d="M21.05,1.52v.45l-.14.45c-2.77,3.62-5.81,7.05-8.67,10.61-.73.94-1.94,1.07-2.8.21L.54,3.02C.27,2.71.1,2.38,0,1.98c.01-.15-.02-.31,0-.45C.1.77.79.08,1.55,0h17.84c.82.02,1.56.72,1.66,1.52ZM19.57,7.83c-.69.84-1.38,1.67-2.07,2.49-1.14,1.37-2.32,2.78-3.45,4.18-.81,1.04-2.03,1.66-3.31,1.66-1.1,0-2.15-.45-2.96-1.27l-.05-.05L1.62,7.81h-.07c-.76.08-1.45.77-1.54,1.52-.02.14.01.31,0,.45.09.41.26.74.54,1.05l8.9,10.22c.86.87,2.06.73,2.8-.21,2.86-3.56,5.91-6.99,8.67-10.61l.14-.45v-.45c-.09-.74-.74-1.39-1.48-1.5Z"/>
          </g>
          <g transform="translate(219.09 1623.1) rotate(45) scale(1.74 -1.74)">
            <path fill="#fff" d="M21.05,1.52v.45l-.14.45c-2.77,3.62-5.81,7.05-8.67,10.61-.73.94-1.94,1.07-2.8.21L.54,3.02C.27,2.71.1,2.38,0,1.98c.01-.15-.02-.31,0-.45C.1.77.79.08,1.55,0h17.84c.82.02,1.56.72,1.66,1.52ZM19.57,7.83c-.69.84-1.38,1.67-2.07,2.49-1.14,1.37-2.32,2.78-3.45,4.18-.81,1.04-2.03,1.66-3.31,1.66-1.1,0-2.15-.45-2.96-1.27l-.05-.05L1.62,7.81h-.07c-.76.08-1.45.77-1.54,1.52-.02.14.01.31,0,.45.09.41.26.74.54,1.05l8.9,10.22c.86.87,2.06.73,2.8-.21,2.86-3.56,5.91-6.99,8.67-10.61l.14-.45v-.45c-.09-.74-.74-1.39-1.48-1.5Z"/>
          </g>
          <path fill="#fff" d="M169.51,1524.47l20.43-20.43c1.99-1.99,5.23-1.99,7.22,0l20.43,20.43c3.22,3.22.94,8.72-3.61,8.72h-40.86c-4.55,0-6.83-5.5-3.61-8.72Z"/>
        </g>
      </g>

      {/* PRESS text - shows when dial is aligned with target */}
      {isComplicationActive && isDialAligned && (
        <text
          fill="#ffffff"
          fontFamily="'Amazon Ember'"
          fontSize="24"
          fontWeight="bold"
          textAnchor="middle"
          x={DIAL_CENTER_X}
          y={DIAL_CENTER_Y + 8}
          style={{ pointerEvents: 'none' }}
        >
          PRESS
        </text>
      )}
    </g>
  );
};
