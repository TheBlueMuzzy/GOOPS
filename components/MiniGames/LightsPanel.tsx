import React from 'react';
import { ConsoleSlider } from '../ConsoleSlider';
import { ArcadeButton } from './ArcadeButton';
import {
  SliderPosition,
  LightsButtonIndex,
  LightsComplicationState,
  MinigameTextState,
} from '../../types/minigames';

interface LightsPanelProps {
  lightsComplication: LightsComplicationState;
  lightSlider: SliderPosition;
  onSliderChange: (value: SliderPosition) => void;
  onButtonPress: (buttonName: string) => void;
  onButtonRelease: (buttonName: string, callback?: () => void) => void;
  getLightsButtonLightColor: (lightIndex: LightsButtonIndex) => string;
  getLightsSliderLightColors: () => { top: string; bottom: string };
  textState: MinigameTextState;
  pressedBtn: string | null;
  sliderShaking: boolean;
  // Original button callbacks for release
  onBlueClick?: () => void;
  onGreenClick?: () => void;
  onPurpleClick?: () => void;
  isComplicationActive?: boolean;
  recentlyFixed?: boolean;
  isUnlocked?: boolean;
}

/**
 * Reset Lights panel SVG component.
 * Renders the sequence memory puzzle with:
 * - Vertical slider for position matching
 * - 3 arcade buttons for sequence input
 * - Indicator lights for feedback
 */
export const LightsPanel: React.FC<LightsPanelProps> = ({
  lightsComplication,
  lightSlider,
  onSliderChange,
  onButtonPress,
  onButtonRelease,
  getLightsButtonLightColor,
  getLightsSliderLightColors,
  textState,
  pressedBtn,
  sliderShaking,
  onBlueClick,
  onGreenClick,
  onPurpleClick,
  isComplicationActive = false,
  recentlyFixed = false,
  isUnlocked = true,
}) => {
  const sliderLightColors = getLightsSliderLightColors();
  const isButtonDisabled = lightsComplication.phase === 'slider1' || lightsComplication.phase === 'showing';

  return (
    <g id="Reset_Lights" className={isUnlocked ? 'minigame-active' : 'minigame-inactive'}>
      {/* Purple Base */}
      <polygon fill="#45486c" points="608.7 1720.12 341.17 1720.12 341.17 1452.22 564.14 1452.22 608.7 1720.12" className={isComplicationActive ? 'minigame-active-pulse' : recentlyFixed ? 'minigame-solved-fade' : ''}/>
      <text
        fill={textState.color}
        fontFamily="'Amazon Ember'"
        fontSize="19.9"
        transform="translate(414.68 1480.38)"
      >
        {textState.text}
      </text>

      {/* Pattern (Behind Slider) */}
      <g clipPath="url(#reset-lights-slider-clip)">
        <path fill="none" stroke="#d8672b" strokeWidth="3" strokeMiterlimit="10" opacity="0.25" d="M417.83,1530.35l-30.21-30.21c-3.04-3.04-7.97-3.04-11.02,0l-30.21,30.21M346.4,1555.03l30.21-30.21c3.04-3.04,7.97-3.04,11.02,0l30.21,30.21M346.4,1580.62l30.21-30.21c3.04-3.04,7.97-3.04,11.02,0l30.21,30.21M417.83,1643.18l-30.21,30.21c-3.04,3.04-7.97,3.04-11.02,0l-30.21-30.21M346.4,1618.5l30.21,30.21c3.04-3.04,7.97,3.04,11.02,0l30.21-30.21M346.4,1592.91l30.21,30.21c3.04-3.04,7.97,3.04,11.02,0l30.21-30.21"/>
      </g>

      {/* Functional Vertical Slider */}
      <ConsoleSlider
        x={382.11}
        y={1587.01}
        rotation={90}
        value={lightSlider}
        onChange={onSliderChange}
        className={sliderShaking ? 'shake' : ''}
      />

      {/* Slider Bottom Light */}
      <g>
        <path fill={sliderLightColors.bottom} d="M382.12,1706.83c-6.36,0-11.53-5.17-11.53-11.53s5.17-11.54,11.53-11.54,11.53,5.17,11.53,11.53-5.17,11.54-11.53,11.54Z"/>
        <path fill="#1f1f38" d="M382.12,1685.25c5.54,0,10.03,4.49,10.03,10.03h0c0,5.55-4.49,10.04-10.03,10.04s-10.03-4.49-10.03-10.03h0c0-5.55,4.49-10.04,10.03-10.04M382.12,1682.25c-7.19,0-13.03,5.85-13.03,13.03s5.85,13.03,13.03,13.03,13.04-5.85,13.04-13.03-5.85-13.04-13.03-13.04h0Z"/>
      </g>
      {/* Slider Top Light */}
      <g>
        <path fill={sliderLightColors.top} d="M382.12,1489.51c-6.36,0-11.53-5.17-11.53-11.53s5.17-11.54,11.53-11.54,11.53,5.17,11.53,11.53-5.17,11.54-11.53,11.54Z"/>
        <path fill="#1f1f38" d="M382.12,1467.94c5.54,0,10.03,4.49,10.03,10.03h0c0,5.55-4.49,10.04-10.03,10.04s-10.03-4.49-10.03-10.03h0c0-5.55,4.49-10.04,10.03-10.04M382.12,1464.94c-7.19,0-13.03,5.85-13.03,13.03s5.85,13.04,13.03,13.03,13.04-5.85,13.04-13.03-5.85-13.03-13.03-13.03h0Z"/>
      </g>

      {/* Blue Button (Rear) */}
      <ArcadeButton
        x={431.19} y={1495}
        colorBody="#3d8380" colorTop="#96d7dd"
        isPressed={pressedBtn === 'blue' || isButtonDisabled}
        onPress={() => onButtonPress('blue')}
        onRelease={() => onButtonRelease('blue', onBlueClick)}
      />

      {/* Light below Blue */}
      <g>
        <path fill={getLightsButtonLightColor(0)} d="M546.19,1547c-6.36,0-11.53-5.17-11.53-11.53s5.17-11.54,11.53-11.54,11.53,5.17,11.53,11.53-5.17,11.54-11.53,11.54Z"/>
        <path fill="#1f1f38" d="M546.19,1525.42c5.54,0,10.03,4.49,10.03,10.03h0c0,5.55-4.49,10.04-10.03,10.04s-10.03-4.49-10.03-10.03h0c0-5.55,4.49-10.04,10.03-10.04M546.19,1522.42c-7.19,0-13.03,5.85-13.03,13.03s5.85,13.04,13.03,13.04,13.03-5.85,13.03-13.03-5.85-13.04-13.03-13.04h0Z"/>
      </g>

      {/* Green Button (Middle) */}
      <ArcadeButton
        x={437.5} y={1565}
        colorBody="#4c833c" colorTop="#f6f081"
        isPressed={pressedBtn === 'green' || isButtonDisabled}
        onPress={() => onButtonPress('green')}
        onRelease={() => onButtonRelease('green', onGreenClick)}
      />

      {/* Light below Green */}
      <g>
        <path fill={getLightsButtonLightColor(1)} d="M554.61,1616.4c-6.36,0-11.53-5.17-11.53-11.53s5.17-11.54,11.53-11.54,11.53,5.17,11.53,11.53-5.17,11.54-11.53,11.54Z"/>
        <path fill="#1f1f38" d="M554.61,1594.82c5.54,0,10.03,4.49,10.03,10.03h0c0,5.55-4.49,10.04-10.03,10.04s-10.03-4.49-10.03-10.03h0c0-5.55,4.49-10.04,10.03-10.04M554.61,1591.82c-7.19,0-13.03,5.85-13.03,13.03s5.85,13.04,13.03,13.04,13.03-5.85,13.03-13.03-5.85-13.04-13.03-13.04h0Z"/>
      </g>

      {/* Purple Button (Front) */}
      <ArcadeButton
        x={444.51} y={1635}
        colorBody="#803d83" colorTop="#cb8abc"
        isPressed={pressedBtn === 'purple' || isButtonDisabled}
        onPress={() => onButtonPress('purple')}
        onRelease={() => onButtonRelease('purple', onPurpleClick)}
      />

      {/* Light below Purple */}
      <g>
        <path fill={getLightsButtonLightColor(2)} d="M565.12,1689.3c-6.36,0-11.53-5.17-11.53-11.53s5.17-11.54,11.53-11.54,11.53,5.17,11.53,11.53-5.17,11.54-11.53,11.54Z"/>
        <path fill="#1f1f38" d="M565.12,1667.73c5.54,0,10.03,4.49,10.03,10.03h0c0,5.55-4.49,10.04-10.03,10.04h0c-5.54,0-10.03-4.49-10.03-10.04h0M565.12,1664.73c-7.19,0-13.03,5.85-13.03,13.03s5.85,13.04,13.03,13.04,13.03-5.85,13.03-13.03-5.85-13.04-13.03-13.04h0Z"/>
      </g>
    </g>
  );
};
