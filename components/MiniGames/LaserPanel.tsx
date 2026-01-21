import React from 'react';
import { ConsoleSlider } from '../ConsoleSlider';
import { SliderPosition, MinigameTextState, SliderLightColors } from '../../types/minigames';

interface LaserPanelProps {
  laserSliders: SliderPosition[];
  shakingSlider: number | null;
  onSliderChange: (index: number, value: SliderPosition) => void;
  getLaserLightColors: (index: number) => SliderLightColors;
  textState: MinigameTextState;
}

/**
 * Reset Laser panel SVG component.
 * Renders 4 sliders with indicator lights for the LASER minigame.
 * Player must move sliders to match lit indicator positions.
 */
export const LaserPanel: React.FC<LaserPanelProps> = ({
  laserSliders,
  shakingSlider,
  onSliderChange,
  getLaserLightColors,
  textState,
}) => {
  return (
    <g id="Reset_Laser_Top">
      {/* Background Texture (Zig-Zags) - Static */}
      <g pointerEvents="none">
        {/* Top Left */}
        <path fill="none" stroke="#d8672b" strokeWidth="3" strokeMiterlimit="10" opacity="0.25" d="M157.91,233.16h-4.24l-18.69-18.69c-3.62-3.62-3.62-9.52,0-13.14l18.69-18.69h4.24l-20.81,20.81c-2.45,2.45-2.45,6.44,0-8.89l20.81,20.81ZM111.51,212.35c-2.45-2.45-2.45-6.44,0-8.89l20.81-20.81h-4.24l-18.69,18.69c-1.75,1.75-2.72,4.09-2.72,6.57s.97,4.81,2.72,6.57l18.69,18.69h4.24l-20.81-20.81ZM107.64,182.65h-4.24l-18.68,18.68v13.15l18.68,18.68h4.24l-20.81-20.81c-2.45-2.45-2.45-6.44,0-8.89l20.81-20.81ZM235.4,214.47c3.62-3.62,3.62-9.52,0-13.14l-18.69-18.69h-4.24l20.81,20.81c2.45,2.45,2.45,6.44,0,8.89l-20.81,20.81h4.24l18.69-18.69ZM186.88,233.16h4.24l18.69-18.69c1.75-1.75,2.72-4.09,2.72-6.57s-.97-4.81-2.72-6.57l-18.69-18.69h-4.24l20.81,20.81c2.45,2.45,2.45,6.44,0,8.89l-20.81,20.81h4.24l18.69-18.69ZM260.08,214.47c.17-.17.33-.36.49-.54v-12.05c-.16-.19-.32-.37-.49-.54l-18.69-18.69h-4.24l20.81,20.81c2.45,2.45,2.45,6.44,0,8.89l-20.81,20.81h4.24l18.69-18.69Z"/>
        {/* Bot Left */}
        <path fill="none" stroke="#d8672b" strokeWidth="3" strokeMiterlimit="10" opacity="0.25" d="M132.32,324.04h-4.24l-18.69-18.69c-1.75-1.75-2.72-4.09-2.72-6.57s.97-4.81,2.72-6.57l18.69-18.69h4.24l-20.81,20.81c-2.45,2.45-2.45,6.44,0,8.89l20.81,20.81ZM137.1,303.23c-2.45-2.45-2.45-6.44,0-8.89l20.81-20.81h-4.24l-18.69,18.69c-3.62,3.62-3.62-9.52,0,13.14l18.69,18.69h4.24l-20.81-20.81ZM107.64,273.53h-4.24l-18.68,18.68v13.15l18.68,18.68h4.24l-20.81-20.81c-2.45-2.45-2.45-6.44,0-8.89l20.81-20.81ZM260.08,305.35c.18-.18.34-.36.49-.55v-12.04c-.16-.19-.32-.37-.49-.55l-18.69-18.69h-4.24l20.81,20.81c2.45,2.45,2.45,6.44,0,8.89l-20.81,20.81h4.24l18.69-18.69ZM186.88,324.04h4.24l18.69-18.69c3.62-3.62,3.62-9.52,0-13.14l-18.69-18.69h-4.24l20.81,20.81c1.19,1.19,1.84,2.77,1.84,4.45s-.65,3.26-1.84,4.45l-20.81,20.81ZM235.4,305.35c3.62-3.62,3.62-9.52,0-13.14l-18.69-18.69h-4.24l20.81,20.81c2.45,2.45,2.45,6.44,0,8.89l-20.81,20.81h4.24l18.69-18.69Z"/>
      </g>

      {/* Functional Sliders */}
      <ConsoleSlider x={172.65} y={207.9} value={laserSliders[0]} onChange={(v) => onSliderChange(0, v)} className={shakingSlider === 0 ? "shake-anim" : ""} />
      <ConsoleSlider x={172.65} y={298.78} value={laserSliders[1]} onChange={(v) => onSliderChange(1, v)} className={shakingSlider === 1 ? "shake-anim" : ""} />
      <ConsoleSlider x={445.24} y={207.9} value={laserSliders[2]} onChange={(v) => onSliderChange(2, v)} className={shakingSlider === 2 ? "shake-anim" : ""} />
      <ConsoleSlider x={445.24} y={298.78} value={laserSliders[3]} onChange={(v) => onSliderChange(3, v)} className={shakingSlider === 3 ? "shake-anim" : ""} />

      {/* Slider Lights (Top Left = Slider 0) */}
      <g>
        {/* Right light */}
        <path fill={getLaserLightColors(0).right} fillRule="evenodd" d="M280.92,219.43c-6.36,0-11.53-5.17-11.53-11.53s5.17-11.53,11.53-11.53,11.54,5.17,11.54,11.53-5.17,11.53-11.53,11.53h0Z"/>
        <path fill="#1f1f38" fillRule="evenodd" d="M280.93,197.87c5.54,0,10.03,4.49,10.03,10.03s-4.49,10.03-10.03,10.03h0c-5.54,0-10.03-4.49-10.03-10.03s4.49-10.03,10.03-10.03h0M280.93,194.87h0c-7.19,0-13.03,5.85-13.03,13.03s5.85,13.03,13.03,13.03,13.04-5.85,13.04-13.03-5.85-13.03-13.03-13.03h0Z"/>
        {/* Left light */}
        <path fill={getLaserLightColors(0).left} fillRule="evenodd" d="M63.6,219.43c-6.36,0-11.53-5.17-11.53-11.53s5.17-11.53,11.53-11.53,11.54,5.17,11.54,11.53-5.17,11.53-11.53,11.53h0Z"/>
        <path fill="#1f1f38" fillRule="evenodd" d="M63.61,197.87c5.54,0,10.03,4.49,10.03,10.03s-4.49,10.03-10.03,10.03h0c-5.54,0-10.03-4.49-10.03-10.03s4.49-10.03,10.03-10.03h0M63.61,194.87h0c-7.19,0-13.03,5.85-13.03,13.03s5.85,13.03,13.03,13.03,13.04-5.85,13.04-13.03-5.85-13.03-13.03-13.03h0Z"/>
      </g>
      {/* Slider Lights (Bot Left = Slider 1) */}
      <g>
        {/* Right light */}
        <path fill={getLaserLightColors(1).right} fillRule="evenodd" d="M280.92,310.32c-6.36,0-11.53-5.17-11.53-11.53s5.17-11.53,11.53-11.53,11.54,5.17,11.54,11.53-5.17,11.53-11.53,11.53h0Z"/>
        <path fill="#1f1f38" fillRule="evenodd" d="M280.93,288.75c5.54,0,10.03,4.49,10.03,10.03s-4.49,10.03-10.03,10.03h0c-5.54,0-10.03-4.49-10.03-10.03s4.49-10.03,10.03-10.03h0M280.93,285.75h0c-7.19,0-13.03,5.85-13.03,13.03s5.85,13.03,13.03,13.03,13.04-5.85,13.04-13.03-5.85-13.03-13.03-13.03h0Z"/>
        {/* Left light */}
        <path fill={getLaserLightColors(1).left} fillRule="evenodd" d="M63.6,310.32c-6.36,0-11.53-5.17-11.53-11.53s5.17-11.53,11.53-11.53,11.54,5.17,11.54,11.53-5.17,11.53-11.53,11.53h0Z"/>
        <path fill="#1f1f38" fillRule="evenodd" d="M63.61,288.75c5.54,0,10.03,4.49,10.03,10.03s-4.49,10.03-10.03,10.03h0c-5.54,0-10.03-4.49-10.03-10.03s4.49-10.03,10.03-10.03h0M63.61,285.75h0c-7.19,0-13.03,5.85-13.03,13.03s5.85,13.03,13.03,13.03,13.04-5.85,13.04-13.03-5.85-13.03-13.03-13.03h0Z"/>
      </g>
      {/* Slider Lights (Top Right = Slider 2) */}
      <g>
        {/* Left light */}
        <path fill={getLaserLightColors(2).left} fillRule="evenodd" d="M336.96,219.43c-6.36,0-11.53-5.17-11.53-11.53s5.17-11.53,11.53-11.53,11.54,5.17,11.54,11.53-5.17,11.53-11.53,11.53h0Z"/>
        <path fill="#1f1f38" fillRule="evenodd" d="M336.97,197.87c5.54,0,10.03,4.49,10.03,10.03s-4.49,10.03-10.03,10.03h0c-5.54,0-10.03-4.49-10.03-10.03s4.49-10.03,10.03-10.03h0M336.97,194.87h0c-7.19,0-13.03,5.85-13.03,13.03s5.85,13.03,13.03,13.03,13.04-5.85,13.04-13.03-5.85-13.03-13.03-13.03h0Z"/>
        {/* Right light */}
        <path fill={getLaserLightColors(2).right} fillRule="evenodd" d="M554.28,219.43c-6.36,0-11.53-5.17-11.53-11.53s5.17-11.53,11.53-11.53,11.54,5.17,11.54,11.53-5.17,11.53-11.53,11.53h0Z"/>
        <path fill="#1f1f38" fillRule="evenodd" d="M554.29,197.87c5.54,0,10.03,4.49,10.03,10.03s-4.49,10.03-10.03,10.03h0c-5.54,0-10.03-4.49-10.03-10.03s4.49-10.03,10.03-10.03h0M554.29,194.87h0c-7.19,0-13.03,5.85-13.03,13.03s5.85,13.03,13.03,13.03,13.04-5.85,13.04-13.03-5.85-13.03-13.03-13.03h0Z"/>
      </g>
      {/* Slider Lights (Bot Right = Slider 3) */}
      <g>
        {/* Left light */}
        <path fill={getLaserLightColors(3).left} fillRule="evenodd" d="M336.96,310.32c-6.36,0-11.53-5.17-11.53-11.53s5.17-11.53,11.53-11.53,11.54,5.17,11.54,11.53-5.17,11.53-11.53,11.53h0Z"/>
        <path fill="#1f1f38" fillRule="evenodd" d="M336.97,288.75c5.54,0,10.03,4.49,10.03,10.03s-4.49,10.03-10.03,10.03h0c-5.54,0-10.03-4.49-10.03-10.03s4.49-10.03,10.03-10.03h0M336.97,285.75h0c-7.19,0-13.03,5.85-13.03,13.03s5.85,13.03,13.03,13.03,13.04-5.85,13.04-13.03-5.85-13.03-13.03-13.03h0Z"/>
        {/* Right light */}
        <path fill={getLaserLightColors(3).right} fillRule="evenodd" d="M554.28,310.32c-6.36,0-11.53-5.17-11.53-11.53s5.17-11.53,11.53-11.53,11.54,5.17,11.54,11.53-5.17,11.53-11.53,11.53h0Z"/>
        <path fill="#1f1f38" fillRule="evenodd" d="M554.29,288.75c5.54,0,10.03,4.49,10.03,10.03s-4.49,10.03-10.03,10.03h0c-5.54,0-10.03-4.49-10.03-10.03s4.49-10.03,10.03-10.03h0M554.29,285.75h0c-7.19,0-13.03,5.85-13.03,13.03s5.85,13.03,13.03,13.03,13.04-5.85,13.04-13.03-5.85-13.03-13.03-13.03h0Z"/>
      </g>

      {/* Reset Laser Text */}
      <text
        fill={textState.color}
        fontFamily="'Amazon Ember'"
        fontSize="20.93"
        transform="translate(245.29 261.57)"
      >
        {textState.text}
      </text>
    </g>
  );
};
