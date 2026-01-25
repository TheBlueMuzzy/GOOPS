
import React, { useState, useEffect, useRef } from 'react';
import { EndGameScreen } from './EndGameScreen';
import { GameStats, Complication } from '../types';
import { UPGRADES } from '../constants';

// Minigame hooks
import { useLaserMinigame } from '../hooks/useLaserMinigame';
import { useLightsMinigame } from '../hooks/useLightsMinigame';
import { useControlsMinigame } from '../hooks/useControlsMinigame';

// Minigame panel components
import { LaserPanel } from './MiniGames/LaserPanel';
import { LightsPanel } from './MiniGames/LightsPanel';
import { ControlsPanel } from './MiniGames/ControlsPanel';

// Constants for CONTROLS dial (used for coord-reference and PRESS text positioning)
const DIAL_CENTER_X = 194.32;
const DIAL_CENTER_Y = 1586.66;

interface ConsoleLayoutProps {
    dialRotation: number;
    monitorOffset: number;
    periscopeY: number;
    dragHandlers: any;
    monitorDragHandlers?: any;
    isMonitorDragging?: boolean;
    isPeriscopeDragging?: boolean;
    isSnapping?: boolean;
    onDialClick?: () => void;
    onBlueClick?: () => void;
    onGreenClick?: () => void;
    onPurpleClick?: () => void;
    onUpgradesClick?: () => void;
    onSettingsClick?: () => void;
    onHelpClick?: () => void;
    onSetRank?: (rank: number) => void;
    onAbortClick?: () => void;
    upgradeCount: number;
    screenContent?: React.ReactNode;
    isGameOver?: boolean;
    isSessionActive?: boolean;

    // Stats for End Game Screen
    rank: number;
    currentXP: number;
    nextRankXP: number;
    totalScore?: number;
    gameStats?: GameStats;
    goalsCleared?: number;
    goalsTarget?: number;
    unspentPower?: number;

    // Complications from GameState
    complications?: Complication[];

    // Callback to resolve a complication when minigame is solved
    onResolveComplication?: (complicationId: string) => void;

    // Upgrade levels for max-level minigame effects
    upgradeLevels?: Record<string, number>;
}

export const ConsoleLayoutSVG: React.FC<ConsoleLayoutProps> = ({
    dialRotation,
    monitorOffset,
    periscopeY,
    dragHandlers,
    monitorDragHandlers,
    isMonitorDragging,
    isPeriscopeDragging = false,
    isSnapping = false,
    onDialClick,
    onBlueClick,
    onGreenClick,
    onPurpleClick,
    onUpgradesClick,
    onSettingsClick,
    onHelpClick,
    onSetRank,
    onAbortClick,
    upgradeCount,
    screenContent,
    isGameOver = false,
    isSessionActive = false,
    rank,
    currentXP,
    nextRankXP,
    totalScore = 0,
    gameStats = { startTime: 0, totalBonusTime: 0, maxGroupSize: 0, penalty: 0 },
    goalsCleared = 0,
    goalsTarget = 0,
    unspentPower = 0,
    complications = [],
    onResolveComplication,
    upgradeLevels = {}
}) => {
    // Extract max-level flags for minigame effects
    const isLaserMaxed = (upgradeLevels['CAPACITOR_EFFICIENCY'] || 0) >= UPGRADES.CAPACITOR_EFFICIENCY.maxLevel;
    const isLightsMaxed = (upgradeLevels['CIRCUIT_STABILIZER'] || 0) >= UPGRADES.CIRCUIT_STABILIZER.maxLevel;
    const isControlsMaxed = (upgradeLevels['GEAR_LUBRICATION'] || 0) >= UPGRADES.GEAR_LUBRICATION.maxLevel;

    // UI state
    const [pressedBtn, setPressedBtn] = useState<string | null>(null);
    const [rankDropdownOpen, setRankDropdownOpen] = useState(false);
    const [abortConfirm, setAbortConfirm] = useState(false);

    // ===== MINIGAME HOOKS =====
    // All minigame state and logic is now encapsulated in custom hooks

    const {
        laserSliders,
        updateLaserSlider,
        shakingSlider,
        getLaserLightColors,
        getLaserTextState,
        recentlyFixed: laserRecentlyFixed,
        isComplicationActive: laserComplicationActive,
    } = useLaserMinigame({
        complications,
        isLaserMaxed,
        onResolveComplication,
    });

    const {
        lightsComplication,
        lightSlider,
        handleLightsButton,
        handleLightsSliderChange,
        lightsSliderShaking,
        getLightsButtonLightColor,
        getLightsSliderLightColors,
        getLightsTextState,
        recentlyFixed: lightsRecentlyFixed,
        isComplicationActive: lightsComplicationActive,
    } = useLightsMinigame({
        complications,
        isLightsMaxed,
        pressedBtn,
        onResolveComplication,
    });

    const {
        localDialRotation,
        isDialDragging,
        dialShaking,
        dialPressed,
        handleDialStart,
        handleDialMove,
        handleDialEnd,
        handleDialPress,
        getControlsCornerLightColor,
        getControlsTextState,
        recentlyFixed: controlsRecentlyFixed,
        isDialAligned,
        isComplicationActive: controlsComplicationActive,
    } = useControlsMinigame({
        complications,
        isControlsMaxed,
        onResolveComplication,
    });

    // Global event listeners for dial drag (follows periscope pattern)
    useEffect(() => {
        if (!isDialDragging) return;

        const handleMouseMove = (e: MouseEvent) => {
            handleDialMove(e.clientX, e.clientY);
        };
        const handleMouseUp = () => {
            handleDialEnd();
        };
        const handleTouchMove = (e: TouchEvent) => {
            if (e.touches.length > 0) {
                handleDialMove(e.touches[0].clientX, e.touches[0].clientY);
            }
        };
        const handleTouchEnd = () => {
            handleDialEnd();
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        window.addEventListener('touchmove', handleTouchMove);
        window.addEventListener('touchend', handleTouchEnd);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            window.removeEventListener('touchmove', handleTouchMove);
            window.removeEventListener('touchend', handleTouchEnd);
        };
    }, [isDialDragging]);

    // Reset abort confirmation if session state changes (e.g. game over or restart)
    useEffect(() => {
        if (!isSessionActive) setAbortConfirm(false);
    }, [isSessionActive]);

    const handlePress = (btn: string) => {
        setPressedBtn(btn);
    };

    const handleRelease = (btn: string, action?: () => void) => {
        if (pressedBtn === btn) {
            setPressedBtn(null);
            // Handle Lights Out button presses
            if (btn === 'blue') handleLightsButton(0);
            else if (btn === 'green') handleLightsButton(1);
            else if (btn === 'purple') handleLightsButton(2);
            // Also call external handler if provided
            if (action) action();
        } else {
            setPressedBtn(null);
        }
    };

    const handleRankClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setRankDropdownOpen(prev => !prev);
    };

    const handleRankSelect = (selectedRank: number) => {
        if (onSetRank) onSetRank(selectedRank);
        setRankDropdownOpen(false);
    };

    const handleAbortInteraction = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (abortConfirm) {
            if (onAbortClick) onAbortClick();
            setAbortConfirm(false);
        } else {
            setAbortConfirm(true);
            // Auto-reset after 3s if no confirmation
            setTimeout(() => setAbortConfirm(false), 3000);
        }
    };

    const transitionStyle = { transition: isMonitorDragging ? 'none' : 'transform 0.7s cubic-bezier(0.34, 1.56, 0.64, 1)' };
    const opacityTransitionStyle = { transition: isMonitorDragging ? 'none' : 'opacity 0.7s cubic-bezier(0.34, 1.56, 0.64, 1)' };
    
    // XP Bar Width Calc
    // Max Width is ~363.9 from SVG path
    const xpPercentage = Math.min(1, Math.max(0, currentXP / nextRankXP));
    const xpBarWidth = 363.9 * xpPercentage;

    // Dimmer Opacity Calculation
    // Monitor range: -400 (hidden) to 520 (shown) -> Delta: 920
    // We want 0 opacity at -400, and max opacity at 520
    const monitorProgress = Math.min(1, Math.max(0, (monitorOffset + 400) / 920));
    
    // Periscope Dimming
    // Drag ranges from 0 to 300.
    const periscopeProgress = Math.min(1, Math.max(0, periscopeY / 300));
    
    // Combine dimming factors
    const dimmerOpacity = Math.max(monitorProgress, periscopeProgress) * 0.85; 

    // Translation to align EndGameScreen.svg (0,0 based) with standard monitor position (~432 Y)
    // 432 - 32.56 = 399.44 Y shift
    // 48.78 - 16.86 = 31.92 X shift
    const endGameTranslate = "translate(31.92, 399.44)";

    return (
        <svg
            viewBox="0 827.84 648 1152"
            className="w-full h-full"
            preserveAspectRatio="xMidYMid slice"
            style={{ overflow: 'hidden' }}
            onClick={() => { if (rankDropdownOpen) setRankDropdownOpen(false); }}
        >
            <defs>
                <linearGradient id="console-gradient" x1="324" y1="1979.84" x2="324" y2="827.84" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor="#363b5e"/>
                    <stop offset="1" stopColor="#0b1c3f"/>
                </linearGradient>
                <clipPath id="reset-lights-slider-clip">
                    <rect x="356.86" y="1499.08" width="50.51" height="175.86" rx="6.92" ry="6.92"/>
                </clipPath>
            </defs>

            {/* --- CONSOLE BASE GEOMETRY --- */}
            <g id="Console_Base">
                <polygon fill="#0f1829" points="42.37 1807.1 54.73 1865.36 592.78 1865.36 605.14 1807.1 42.37 1807.1"/>
                <path fill="#616a79" d="M615.77,1807.1l14.87-84.85c.65-3.69-2.19-7.08-5.94-7.08H22.81c-3.75,0-6.59,3.38-5.94,7.08l14.87,84.85h584.04Z"/>
                <path fill="#59acae" d="M583.65,1441.46H63.86l-47.08,283.09c-.6,3.61,2,6.92,5.44,6.92h603.07c3.44,0,6.04-3.31,5.44-6.92l-47.08-283.09Z"/>
                
                {/* Footer Text */}
                <text fill="#aad9d9" fontFamily="'Amazon Ember'" fontSize="15.7" transform="translate(55 1855.15)">
                    <tspan letterSpacing="-0.04em">V</tspan><tspan x="9.49">ersion 1.1.45</tspan>
                </text>
                <text fill="#aad9d9" fontFamily="'Amazon Ember'" fontSize="15.7" textAnchor="end" transform="translate(592.5 1855.15)">
                    MuzzyMade @ 2026
                </text>

                {/* Rank Selector - Dev Tool (disabled during game over) */}
                <g
                    id="RankSelector"
                    className={isGameOver ? "pointer-events-none" : "cursor-pointer hover:brightness-125 active:brightness-90 transition-all origin-center"}
                    onClick={isGameOver ? undefined : handleRankClick}
                >
                    <text fill={rankDropdownOpen ? "#5bbc70" : "#aad9d9"} fontFamily="'Amazon Ember'" fontSize="20.93" fontWeight={rankDropdownOpen ? "bold" : "normal"} textAnchor="middle" transform="translate(323.75 1855.99)">
                        RANK SELECT
                    </text>
                </g>
            </g>

            {/* --- INTERACTIVE PANELS --- */}

            {/* Console Top Housing + Reset Laser + Operator Rank */}
            <g transform="translate(17.28, 1057.14)">
                {/* 1. Background Geometry */}
                <path fill="#616a79" fillRule="evenodd" d="M597.13,32.56H15.82C6.56,32.56-.51,40.11.03,49.42l18.54,321.98c.39,6.78,5.81,12.28,12.11,12.28h551.59c6.3,0,11.72-5.5,12.11-12.28l18.54-321.98c.54-9.31-6.53-16.86-15.79-16.86Z"/>
                <path fill="#aad9d9" fillRule="evenodd" d="M604.74,37.21H8.21c-3.37,0-5.34-4.05-3.17-6.52L23.09,10.16C28.83,3.68,37.14,0,46.03,0h520.89c8.89,0,17.2,3.68,22.94,10.16l18.06,20.52c2.17,2.47.19,6.52-3.17,6.52Z"/>
                <path fill="#1d1d3a" d="M536.44,362.92H76.51c-21.64,0-40.25-18.8-41.48-41.9l-11.76-220.89c-.6-11.35,3.24-22,10.81-29.99,7.45-7.85,17.63-12.18,28.67-12.18h487.46c11.04,0,21.22,4.33,28.67,12.18,7.58,7.99,11.41,18.64,10.81,29.99l-11.76,220.89c-1.23,23.1-19.84,41.9-41.48,41.9ZM62.75,62.96c-9.65,0-18.55,3.77-25.04,10.62-6.62,6.98-9.98,16.32-9.45,26.28l11.76,220.89c1.09,20.49,17.46,37.17,36.49,37.17h459.93c19.03,0,35.4-16.67,36.49-37.17l11.76-220.89c.53-9.96-2.82-19.3-9.45-26.28-6.49-6.85-15.39-10.62-25.04-10.62H62.75Z"/>
                <path fill="#35385b" fillRule="evenodd" d="M550.2,60.46H62.75c-21.59,0-38.15,17.7-36.98,39.53l11.76,220.89c1.16,21.83,18.62,39.53,38.99,39.53h459.93c20.37,0,37.82-17.7,38.99-39.53l11.76-220.89c1.16-21.83-15.4-39.53-36.98-39.53Z"/>
                <path fill="#474871" fillRule="evenodd" d="M549.56,74.42H63.39c-21.53,0-38.04,17.7-36.88,39.53l11.02,206.94c1.16,21.83,18.62,39.53,38.99,39.53h459.93c20.37,0,37.82-17.7,38.99-39.53l11.02-206.94c1.16-21.83-15.35-39.53-36.88-39.53Z" className={laserComplicationActive ? 'minigame-active-pulse-laser' : laserRecentlyFixed ? 'minigame-solved-fade-laser' : ''}/>

                {/* 2. Operator Rank Meter */}
                <g id="Operator_Rank_-_meter">
                    {/* Meter Background */}
                    <path fill="#5bbc70" d="M540.77,147.84H74.51c-5.73,0-10.38-4.66-10.38-10.38s4.66-10.38,10.38-10.38h466.26c5.73,0,10.38,4.66,10.38,10.38s-4.66,10.38-10.38,10.38ZM74.51,128.07c-5.17,0-9.38,4.21-9.38,9.38s4.21,9.38,9.38,9.38h466.26c5.17,0,9.38-4.21,9.38-9.38s-4.21-9.38-9.38-9.38H74.51Z"/>
                    {/* Meter Fill - Dynamic Width */}
                    <path fill="#5bbc70" d={`M74.51,127.57h${xpBarWidth}c.66,0,1.2.54,1.2,1.2v17.36c0,.66-.54,1.2-1.2,1.2H74.51c-5.45,0-9.88-4.43-9.88-9.88h0c0-5.45,4.43-9.88,9.88-9.88Z`}/>
                    {/* XP Text */}
                    <text fill="#59acae" fontFamily="'Amazon Ember'" fontSize="17.44" transform="translate(384.64 111.95)">
                        <tspan letterSpacing="0em" x="0" y="0">{Math.floor(currentXP).toLocaleString()} / {Math.floor(nextRankXP).toLocaleString()}  </tspan>
                        <tspan fontFamily="'Amazon Ember'" fontWeight="800" x="137.32" y="0">XP</tspan>
                    </text>
                    {/* Rank Number */}
                    <text fill="#6acbda" fontFamily="'Amazon Ember'" fontWeight="800" fontSize="34.88" transform="translate(239.35 115.28)">{rank}</text>
                    {/* Rank Label */}
                    <text fill="#6acbda" fontFamily="'Amazon Ember'" fontSize="20.93" transform="translate(65.42 113.79)">
                        <tspan x="0" y="0">OPE</tspan>
                        <tspan letterSpacing=".02em" x="40.54" y="0">R</tspan>
                        <tspan letterSpacing="-.05em" x="53.68" y="0">A</tspan>
                        <tspan letterSpacing="-.03em" x="66.07" y="0">T</tspan>
                        <tspan x="77.45" y="0">OR </tspan>
                        <tspan letterSpacing=".02em" x="112.01" y="0">R</tspan>
                        <tspan x="125.16" y="0">ANK</tspan>
                    </text>
                </g>

                {/* 3. Reset Laser Panel Component */}
                <LaserPanel
                    laserSliders={laserSliders}
                    shakingSlider={shakingSlider}
                    onSliderChange={updateLaserSlider}
                    getLaserLightColors={getLaserLightColors}
                    textState={getLaserTextState()}
                    isComplicationActive={laserComplicationActive}
                    recentlyFixed={laserRecentlyFixed}
                />
            </g>

            {/* Reset Lights Panel Component */}
            <LightsPanel
                lightsComplication={lightsComplication}
                lightSlider={lightSlider}
                onSliderChange={handleLightsSliderChange}
                onButtonPress={handlePress}
                onButtonRelease={handleRelease}
                getLightsButtonLightColor={getLightsButtonLightColor}
                getLightsSliderLightColors={getLightsSliderLightColors}
                textState={getLightsTextState()}
                pressedBtn={pressedBtn}
                sliderShaking={lightsSliderShaking}
                onBlueClick={onBlueClick}
                onGreenClick={onGreenClick}
                onPurpleClick={onPurpleClick}
                isComplicationActive={lightsComplicationActive}
                recentlyFixed={lightsRecentlyFixed}
            />

            {/* Reset Controls (Dial) */}
            <ControlsPanel
                localDialRotation={localDialRotation}
                isDialDragging={isDialDragging}
                dialShaking={dialShaking}
                dialPressed={dialPressed}
                onDialStart={handleDialStart}
                onDialPress={handleDialPress}
                getControlsCornerLightColor={getControlsCornerLightColor}
                textState={getControlsTextState()}
                isDialAligned={isDialAligned()}
                isComplicationActive={controlsComplicationActive}
                recentlyFixed={controlsRecentlyFixed}
            />

            {/* Hidden reference point for coordinate conversion - MUST be outside rotating groups */}
            <circle
                id="coord-reference"
                cx={DIAL_CENTER_X}
                cy={DIAL_CENTER_Y}
                r="1"
                fill="transparent"
                style={{ pointerEvents: 'none' }}
            />

            {/* System Upgrades OR End Work Day */}
            {/* Hide upgrade button at rank 0 when not in session (no upgrades available) */}
            {(isSessionActive || rank > 0) && (
                <g
                    id="System_Upgrades"
                    className="cursor-pointer hover:brightness-110 active:brightness-90 transition-all origin-center"
                    onClick={isSessionActive ? handleAbortInteraction : onUpgradesClick}
                >
                    {isSessionActive ? (
                        // Red Abort Button
                        <>
                            <rect fill="#ef4444" x="123.18" y="1748.67" width="342.8" height="44.19" rx="12.37" ry="12.37"/>
                            <rect fill="none" stroke="#ef4444" strokeMiterlimit="10" x="123.45" y="1748.67" width="420.29" height="44.19" rx="9.43" ry="9.43"/>
                            <text fill="#ffffff" fontFamily="'Amazon Ember'" fontSize="20.93" fontWeight="bold" textAnchor="middle" x="294.58" y="1778.17">
                                {abortConfirm ? "ARE YOU SURE?" : "END WORK DAY"}
                            </text>
                            <text fill="#ef4444" fontFamily="'Amazon Ember'" fontWeight="bold" fontSize="34.88" transform="translate(492.79 1783.33)">X</text>
                        </>
                    ) : (
                        // Standard Yellow Upgrade Button
                        <>
                            <rect fill="#ffd92b" x="123.18" y="1748.67" width="342.8" height="44.19" rx="12.37" ry="12.37"/>
                            <rect fill="none" stroke="#ffd92b" strokeMiterlimit="10" x="123.45" y="1748.67" width="420.29" height="44.19" rx="9.43" ry="9.43"/>
                            <text fill="#45486c" fontFamily="'Amazon Ember'" fontSize="20.93" transform="translate(143.75 1778.17)">
                                <tspan letterSpacing="-.02em">S</tspan><tspan x="11.41">YSTEM UPG</tspan><tspan letterSpacing=".02em" x="124.56">R</tspan><tspan x="137.7">ADES </tspan><tspan letterSpacing="-.06em" x="194.7">AV</tspan><tspan x="219.21">AI</tspan><tspan letterSpacing=".02em" x="238.45">L</tspan><tspan x="249.94">ABLE</tspan>
                            </text>
                            <text fill="#ffd92b" fontFamily="'Amazon Ember'" fontWeight="bold" fontSize="34.88" textAnchor="middle" x="505" y="1783.33">{upgradeCount}</text>
                        </>
                    )}
                </g>
            )}

            {/* Title & Extra Buttons */}
            <text fill="#5bbc70" fontFamily="'From Where You Are'" fontSize="62.79" transform="translate(210.86 1947.47)">
                <tspan letterSpacing=".01em">G</tspan><tspan x="50.77">O</tspan><tspan letterSpacing=".01em" x="94.43">O</tspan><tspan letterSpacing=".03em" x="138.94">P</tspan><tspan x="182.79">S</tspan>
            </text>
            
            <g id="How_to_Play" className="cursor-pointer hover:brightness-110 active:brightness-90 transition-all origin-center" onClick={onHelpClick}>
                <circle fill="#5bbc70" cx="60.02" cy="1920.16" r="42.65"/>
                <text fill="#0f1528" fontFamily="'From Where You Are'" fontSize="62.79" transform="translate(43.23 1951.29)">?</text>
            </g>

            <g id="Settings" className="cursor-pointer hover:brightness-110 active:brightness-90 transition-all origin-center" onClick={onSettingsClick}>
                <circle fill="#5bbc70" cx="586.51" cy="1921.29" r="42.65"/>
                <path fill="#0f1528" d="M575.34,1888.9c1.31-.22,2.74.1,3.77.94.53.43.76,1.11,1.28,1.57,3.07,2.69,6.81,3.17,10.41,1.27,2.93-1.54,3.23-4.63,7.35-3.65,2.47.59,8.3,3.99,10.15,5.79,3.3,3.22.52,5.23.71,8.67.17,3.07,2.34,6.18,5.12,7.42,2.12.95,4.78.73,5.84,3.27s.95,10.11.24,12.77c-1.23,4.62-4.11,3.02-7.31,4.93-2.36,1.42-4.2,4.72-4.2,7.5s1.94,4.09.64,6.88c-1.06,2.28-8.15,6.41-10.64,7.02-3.9.96-4.47-2.07-6.97-3.74-2.65-1.77-6.22-1.75-9.02-.28-3.07,1.61-3.15,5.19-7.61,4.38-2.27-.42-8.91-4.29-10.53-5.98-2.69-2.79-.66-4.28-.3-6.87.55-3.94-1.21-8.15-4.99-9.77-2.48-1.06-5.42-.37-6.52-3.73-.83-2.52-.68-11.58.66-13.88,1.2-2.06,3.02-1.68,4.85-2.27,4.19-1.36,6.81-5.14,6.29-9.6-.29-2.49-1.96-4.37.32-6.86,1.42-1.56,8.41-5.43,10.46-5.77ZM586.19,1909.97c-14.67.42-14.14,22.83.44,22.69,14.84-.14,14.53-23.12-.44-22.69Z"/>
            </g>

            {/* Dimmer Overlay */}
            <rect 
                x="0" y="827.84" 
                width="648" height="1152" 
                fill="#000" 
                style={{ opacity: dimmerOpacity, ...opacityTransitionStyle, pointerEvents: 'none' }} 
            />

            {/* 2. PERISCOPE (Draggable) */}
            <g id="Periscope" transform={`translate(0, ${periscopeY})`} style={{ transition: isPeriscopeDragging || isSnapping ? 'none' : 'transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)', cursor: 'grab' }} {...dragHandlers}>
                <rect fill="#087962" x="22.36" y="978.45" width="603.66" height="51.13" rx="11.03" ry="11.03"/>
                {/* Periscope Stem/Body - Infinite Extension Upwards + Rounded Bottom Shape */}
                <path fill="#087962" d="M 390.17 -1000 V 1111.98 c 0 13.74 -11.16 24.9 -24.9 24.9 h -88.54 c -13.74 0 -24.9 -11.16 -24.9 -24.9 V -1000 H 390.17 Z" />
                <g>
                    <path fill="#5bbc70" fillRule="evenodd" d="M252.54,1089.77c-23.25,0-45.07-9.09-61.45-25.59-16.38-16.5-25.3-38.39-25.13-61.64.35-47.38,39.59-85.92,87.47-85.92h138.58c23.99,0,46.29,9.59,62.81,26.99,16.51,17.4,24.9,40.21,23.64,64.23-2.4,45.72-40.19,81.7-86.02,81.93h-.44c-24.04,0-47.19-10.12-63.53-27.77-2.19-2.36-4.86-2.71-6.27-2.71s-3.96.34-6.05,2.61c-16.35,17.72-39.54,27.87-63.63,27.87Z"/>
                    <path fill="#0b1c3f" fillRule="evenodd" d="M392.01,931.91h-138.58c-39.31,0-71.89,31.44-72.18,70.75-.29,39.62,31.74,71.83,71.29,71.83,20.72,0,39.37-8.84,52.39-22.95,9.32-10.1,25.43-10,34.77.09,13.09,14.14,31.85,22.97,52.67,22.87,37.55-.18,68.86-29.95,70.83-67.44,2.16-41.12-30.54-75.13-71.19-75.13Z"/>
                    <path fill="#373a60" fillRule="evenodd" d="M392.02,1054.51c-14.46,0-27.83-5.85-37.66-16.46-8.25-8.91-19.96-14.02-32.14-14.02s-23.79,5.09-31.97,13.96c-9.83,10.66-23.23,16.53-37.71,16.53s-26.71-5.39-36.42-15.17c-9.71-9.78-15-22.76-14.89-36.54.21-28.08,23.63-50.92,52.21-50.92h138.58c14.22,0,27.44,5.68,37.23,16,9.78,10.31,14.76,23.84,14.01,38.11-1.42,27.07-23.82,48.38-50.98,48.52h-.26Z"/>
                </g>
                <g transform="translate(303.67 1091.18) scale(1.74)">
                    <path fill="#fff" d="M21.05,1.52v.45l-.14.45c-2.77,3.62-5.81,7.05-8.67,10.61-.73.94-1.94,1.07-2.8.21L.54,3.02C.27,2.71.1,2.38,0,1.98c.01-.15-.02-.31,0-.45C.1.77.79.08,1.55,0h17.84c.82.02,1.56.72,1.66,1.52ZM19.57,7.83c-.69.84-1.38,1.67-2.07,2.49-1.14,1.37-2.32,2.78-3.45,4.18-.81,1.04-2.03,1.66-3.31,1.66-1.1,0-2.15-.45-2.96-1.27l-.05-.05L1.62,7.81h-.07c-.76.08-1.45.77-1.54,1.52-.02.14.01.31,0,.45.09.41.26.74.54,1.05l8.9,10.22c.86.87,2.06.73,2.8-.21,2.86-3.56,5.91-6.99,8.67-10.61l.14-.45v-.45c-.09-.74-.74-1.39-1.48-1.5Z"/>
                </g>
            </g>

            {/* 3. MONITOR GROUP (FRONT) - Body + Screen */}
            <g 
                transform={`translate(0, ${monitorOffset})`} 
                style={{
                    ...transitionStyle,
                    cursor: isGameOver ? 'grab' : 'default',
                    pointerEvents: isGameOver ? 'auto' : 'none'
                }}
                {...(isGameOver && isMonitorDragging !== undefined ? monitorDragHandlers : {})}
            >
                {isGameOver ? (
                    // When Game Over, replace the entire monitor geometry with EndGameScreen SVG contents (translated to align)
                    <g transform={endGameTranslate}>
                        <EndGameScreen 
                            score={totalScore}
                            rank={rank}
                            xpCurrent={currentXP}
                            xpNext={nextRankXP}
                            cracksFilled={goalsCleared}
                            cracksTarget={goalsTarget}
                            pressureVented={gameStats.totalBonusTime || 0}
                            massPurged={gameStats.maxGroupSize || 0}
                            leftoverPenalty={gameStats.penalty || 0}
                            unspentPower={unspentPower}
                            isWin={goalsCleared >= goalsTarget}
                        />
                    </g>
                ) : (
                    <>
                        {/* Standard Monitor Body - Corrected Y-Coordinates (+400px shift) */}
                        <path fill="#f2a743" d="M48.78,432h549.95c9.31,0,16.86,7.55,16.86,16.86v847.89c0,6.78-5.5,12.28-12.28,12.28H44.2c-6.78,0-12.28-5.5-12.28-12.28V448.86c0-9.31,7.55-16.86,16.86-16.86Z"/>
                        <path fill="#d36b28" d="M606.65,436.65H40.86c-3.39,0-5.14-4.05-2.82-6.52l19.25-20.52c6.08-6.49,14.58-10.16,23.47-10.16h485.98c8.89,0,17.39,3.68,23.47,10.16l19.25,20.52c2.32,2.47.57,6.52-2.82,6.52Z"/>
                        <path fill="none" stroke="#1d1d3a" strokeWidth="5" strokeMiterlimit="10" d="M592.34,1246.25c0,21.83-17.7,39.53-39.53,39.53H94.71c-21.83,0-39.53-17.7-39.53-39.53V499.44c0-21.83,17.7-39.53,39.53-39.53h458.1c21.83,0,39.53,17.7,39.53,39.53v746.81Z"/>
                        <rect fill="#1f1f38" x="55.17" y="459.91" width="537.16" height="825.87" rx="39.53" ry="39.53"/>
                        
                        {/* Embedded React Content for Screen */}
                        <foreignObject x="55.17" y="459.91" width="537.16" height="825.87" rx="39.53" ry="39.53">
                            <div className="w-full h-full overflow-hidden rounded-[39px]">
                                {screenContent}
                            </div>
                        </foreignObject>
                        
                        {/* Static Instruction Text from SVG (Visible on top of screen content) */}
                        <g pointerEvents="none">
                            <path fill="none" stroke="#5bbc70" strokeWidth="1" strokeOpacity="0.2" d="M94.71,474.42h458.1c21.82,0,39.53,17.71,39.53,39.53v732.85c0,21.82-17.71,39.53-39.53,39.53H94.71c-21.82,0-39.53-17.71-39.53-39.53V513.95c0-21.82,17.71-39.53,39.53-39.53Z"/>
                        </g>
                    </>
                )}
            </g>

            {/* Rank Dropdown Overlay (hidden during game over) */}
            {rankDropdownOpen && !isGameOver && (
                <foreignObject x="200" y="1550" width="250" height="300">
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            background: 'linear-gradient(180deg, #1d1d3a 0%, #0f1829 100%)',
                            border: '2px solid #5bbc70',
                            borderRadius: '8px',
                            overflow: 'hidden',
                        }}
                    >
                        <div
                            style={{
                                padding: '8px 12px',
                                borderBottom: '1px solid #5bbc70',
                                color: '#5bbc70',
                                fontFamily: 'Amazon Ember, sans-serif',
                                fontWeight: 'bold',
                                fontSize: '14px',
                                textAlign: 'center',
                            }}
                        >
                            SELECT RANK
                        </div>
                        <div
                            style={{
                                flex: 1,
                                overflowY: 'auto',
                                padding: '4px',
                            }}
                        >
                            {Array.from({ length: 101 }, (_, i) => (
                                <div
                                    key={i}
                                    onClick={() => handleRankSelect(i)}
                                    style={{
                                        padding: '8px 12px',
                                        color: i === 0 ? '#f87171' : i === rank ? '#5bbc70' : '#aad9d9',
                                        fontFamily: 'Amazon Ember, sans-serif',
                                        fontSize: '14px',
                                        cursor: 'pointer',
                                        borderRadius: '4px',
                                        background: i === rank ? 'rgba(91, 188, 112, 0.2)' : 'transparent',
                                        fontWeight: i === rank ? 'bold' : 'normal',
                                        transition: 'background 0.15s',
                                    }}
                                    onMouseEnter={(e) => {
                                        if (i !== rank) e.currentTarget.style.background = 'rgba(170, 217, 217, 0.1)';
                                    }}
                                    onMouseLeave={(e) => {
                                        if (i !== rank) e.currentTarget.style.background = 'transparent';
                                    }}
                                >
                                    {i === 0 ? '0 - WIPE DATA' : `Rank ${i}`}
                                </div>
                            ))}
                        </div>
                    </div>
                </foreignObject>
            )}

        </svg>
    );
};
