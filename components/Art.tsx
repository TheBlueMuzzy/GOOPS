
import React, { useState, useEffect, useRef } from 'react';
import { EndGameScreen } from './EndGameScreen';
import { ConsoleSlider } from './ConsoleSlider';
import { GameStats } from '../types';

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
    onWipeClick?: () => void;
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
}

const ArcadeButton = ({ 
    x, y, 
    colorBody, colorTop, 
    isPressed, 
    onPress,
    onRelease
}: { 
    x: number, y: number, 
    colorBody: string, colorTop: string, 
    isPressed: boolean, 
    onPress: () => void,
    onRelease: () => void
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
    onWipeClick,
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
    unspentPower = 0
}) => {
    const [pressedBtn, setPressedBtn] = useState<string | null>(null);
    const [wipeConfirm, setWipeConfirm] = useState(false);
    const [abortConfirm, setAbortConfirm] = useState(false);

    // Local state for visual sliders (functional but not yet tied to game logic)
    const [laserSliders, setLaserSliders] = useState<(-1|0|1)[]>([0, 0, 0, 0]);
    const [lightSlider, setLightSlider] = useState<-1|0|1>(0);

    // Reset Laser complication state
    interface LaserComplication {
        active: boolean;
        solved: boolean;
        targets: (-1 | 0 | 1)[]; // 4 target positions: -1=left, 0=center, 1=right
    }
    const [laserComplication, setLaserComplication] = useState<LaserComplication>({
        active: false,
        solved: false,
        targets: [0, 0, 0, 0]
    });

    // Track which slider is shaking (for wrong position feedback)
    const [shakingSlider, setShakingSlider] = useState<number | null>(null);

    // Reset Lights complication state (Lights Out puzzle)
    interface LightsComplication {
        active: boolean;
        solved: boolean;
        lights: [boolean, boolean, boolean]; // L1, L2, L3 on/off state
        buttonPhaseComplete: boolean; // all lights on?
        sliderTarget: 1 | -1; // random top or bottom
    }
    const [lightsComplication, setLightsComplication] = useState<LightsComplication>({
        active: false,
        solved: false,
        lights: [false, false, false],
        buttonPhaseComplete: false,
        sliderTarget: 1
    });

    // Track if Reset Lights slider is shaking
    const [lightsSliderShaking, setLightsSliderShaking] = useState(false);

    // Local state for dial rotation (drag-based, replaces prop)
    const [localDialRotation, setLocalDialRotation] = useState(0);
    const [isDialDragging, setIsDialDragging] = useState(false);

    // Dial center in SVG coordinates
    const DIAL_CENTER_X = 194.32;
    const DIAL_CENTER_Y = 1586.66;
    const DIAL_RADIUS = 86.84;
    // Touch zone: allow touches from 40% of radius out to 130% (extra padding for finger imprecision)
    const DIAL_TOUCH_INNER = DIAL_RADIUS * 0.4; // ~35 - includes the chevron arrows
    const DIAL_TOUCH_OUTER = DIAL_RADIUS * 1.3; // ~113 - padding beyond visual edge
    // Curved arrow angular range (in degrees, where 90° is down in SVG coords)
    // Widened to 0° to 180° to cover the entire bottom half of the dial
    const DIAL_ARROW_ANGLE_MIN = 0;
    const DIAL_ARROW_ANGLE_MAX = 180;

    // Get dial center in screen coordinates
    const getDialScreenCenter = (): { x: number; y: number } | null => {
        const svg = document.querySelector('svg');
        if (!svg) return null;
        const rect = svg.getBoundingClientRect();
        const viewBox = { x: 0, y: 827.84, width: 648, height: 1152 };
        return {
            x: rect.left + ((DIAL_CENTER_X - viewBox.x) / viewBox.width) * rect.width,
            y: rect.top + ((DIAL_CENTER_Y - viewBox.y) / viewBox.height) * rect.height
        };
    };

    // Vector approach: rotate dial so line from center through grab point aims at cursor
    // All refs to avoid stale closure issues in event handlers
    const isDraggingRef = useRef(false);
    const grabAngleRef = useRef(0);      // Angle of initial grab point from center
    const rotationAtGrabRef = useRef(0); // Dial rotation when grab started
    const currentRotationRef = useRef(0); // Current rotation (ref version for snap calculation)

    // Convert screen coordinates to SVG coordinates
    // Use a NON-ROTATING reference element for clean CTM
    const screenToSvg = (clientX: number, clientY: number): { x: number; y: number } | null => {
        try {
            // Use the hidden reference point that doesn't rotate
            const refPoint = document.getElementById('coord-reference') as SVGCircleElement | null;
            if (!refPoint) return null;

            const svg = refPoint.ownerSVGElement;
            if (!svg) return null;

            const point = svg.createSVGPoint();
            point.x = clientX;
            point.y = clientY;

            const ctm = refPoint.getScreenCTM();
            if (!ctm) return null;

            const svgPoint = point.matrixTransform(ctm.inverse());
            return { x: svgPoint.x, y: svgPoint.y };
        } catch (e) {
            return null;
        }
    };

    const handleDialStart = (clientX: number, clientY: number) => {
        // Convert touch to SVG coordinates (fixes aspect ratio distortion!)
        const touchSvg = screenToSvg(clientX, clientY);
        if (!touchSvg) return;

        // Calculate distance and angle in SVG space
        const dx = touchSvg.x - DIAL_CENTER_X;
        const dy = touchSvg.y - DIAL_CENTER_Y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Check touch zone in SVG space
        if (distance > DIAL_TOUCH_OUTER) return;

        // Store grab angle (in SVG coordinates) and current rotation
        grabAngleRef.current = Math.atan2(dy, dx) * (180 / Math.PI);
        rotationAtGrabRef.current = localDialRotation;
        isDraggingRef.current = true;
        setIsDialDragging(true);
    };

    const handleDialMove = (clientX: number, clientY: number) => {
        if (!isDraggingRef.current) return;

        // Convert to SVG coordinates (fixes aspect ratio!)
        const cursorSvg = screenToSvg(clientX, clientY);
        if (!cursorSvg) return;

        const dx = cursorSvg.x - DIAL_CENTER_X;
        const dy = cursorSvg.y - DIAL_CENTER_Y;

        // Current cursor angle from center (in SVG space)
        const cursorAngle = Math.atan2(dy, dx) * (180 / Math.PI);

        // Vector approach: rotate dial so grab point aims at cursor
        // newRotation = cursorAngle - grabAngle + rotationAtGrab
        const newRotation = cursorAngle - grabAngleRef.current + rotationAtGrabRef.current;
        currentRotationRef.current = newRotation; // Keep ref in sync for snap calculation
        setLocalDialRotation(newRotation);
    };

    // Snap positions: 4 corners at 45°, 135°, 225°, 315°
    const DIAL_SNAP_POSITIONS = [45, 135, 225, 315];

    const handleDialEnd = () => {
        if (!isDraggingRef.current) return;
        isDraggingRef.current = false;
        setIsDialDragging(false);

        // Use ref value (not state) to avoid stale closure issues
        const currentRotation = currentRotationRef.current;

        // Snap to nearest corner position (45°, 135°, 225°, 315°)
        // Must find the snap angle that's closest to current rotation to avoid
        // the CSS transition animating the "long way around"

        // Normalize to find which base snap position we're closest to
        let normalized = currentRotation % 360;
        if (normalized < 0) normalized += 360;

        // Find closest snap position in 0-360 space
        let closestBaseSnap = DIAL_SNAP_POSITIONS[0];
        let minDiff = Infinity;

        for (const snap of DIAL_SNAP_POSITIONS) {
            const diff = Math.min(
                Math.abs(normalized - snap),
                Math.abs(normalized - snap + 360),
                Math.abs(normalized - snap - 360)
            );
            if (diff < minDiff) {
                minDiff = diff;
                closestBaseSnap = snap;
            }
        }

        // Now find the equivalent of closestBaseSnap that's actually closest
        // to the current rotation (handles multi-revolution rotations)
        const base = Math.floor(currentRotation / 360) * 360;
        const candidates = [
            base + closestBaseSnap - 360,
            base + closestBaseSnap,
            base + closestBaseSnap + 360
        ];

        let finalSnap = candidates[0];
        let minFinalDiff = Math.abs(currentRotation - candidates[0]);
        for (const c of candidates) {
            const diff = Math.abs(currentRotation - c);
            if (diff < minFinalDiff) {
                minFinalDiff = diff;
                finalSnap = c;
            }
        }

        currentRotationRef.current = finalSnap; // Keep ref in sync
        setLocalDialRotation(finalSnap);
    };

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

    const handleWipeInteraction = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (wipeConfirm) {
            if (onWipeClick) onWipeClick();
            setWipeConfirm(false);
        } else {
            setWipeConfirm(true);
            setTimeout(() => setWipeConfirm(false), 3000);
        }
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

    const updateLaserSlider = (index: number, val: -1|0|1) => {
        const next = [...laserSliders];
        next[index] = val;
        setLaserSliders(next);

        // Check if this slider matches its target (when complication is active)
        if (laserComplication.active && !laserComplication.solved) {
            const target = laserComplication.targets[index];
            if (val !== target) {
                // Wrong position - trigger shake
                setShakingSlider(index);
                setTimeout(() => setShakingSlider(null), 300);
            } else {
                // Check if all sliders now match their targets
                const allMatch = next.every((sliderVal, i) => sliderVal === laserComplication.targets[i]);
                if (allMatch) {
                    setLaserComplication(prev => ({ ...prev, solved: true }));
                }
            }
        }
    };

    // Test function: Activate Reset Laser complication with random targets
    // Click on Reset Laser text to toggle
    const toggleLaserComplication = () => {
        if (laserComplication.active) {
            // Deactivate
            setLaserComplication({
                active: false,
                solved: false,
                targets: [0, 0, 0, 0]
            });
            // Reset sliders to center
            setLaserSliders([0, 0, 0, 0]);
        } else {
            // Activate with random targets that don't match current slider positions
            const generateRandomTargets = (): (-1 | 0 | 1)[] => {
                return [0, 1, 2, 3].map((i) => {
                    // Pick a random target different from current slider position
                    const current = laserSliders[i];
                    const options: (-1 | 0 | 1)[] = ([-1, 0, 1] as (-1 | 0 | 1)[]).filter(v => v !== current);
                    return options[Math.floor(Math.random() * options.length)];
                });
            };

            setLaserComplication({
                active: true,
                solved: false,
                targets: generateRandomTargets()
            });
        }
    };

    // Helper to get Reset Lights button indicator light color
    // lightIndex: 0=L1 (below blue), 1=L2 (below green), 2=L3 (below purple)
    const getLightsButtonLightColor = (lightIndex: 0 | 1 | 2): string => {
        const OFF = "#231f20";
        const ON = "#d8672b";

        if (!lightsComplication.active) return OFF;
        return lightsComplication.lights[lightIndex] ? ON : OFF;
    };

    // Helper to get Reset Lights slider indicator light colors
    // Returns { top: color, bottom: color } based on buttonPhaseComplete and sliderTarget
    const getLightsSliderLightColors = (): { top: string; bottom: string } => {
        const OFF = "#231f20";
        const ON = "#d8672b";

        if (!lightsComplication.active || !lightsComplication.buttonPhaseComplete) {
            return { top: OFF, bottom: OFF };
        }

        // Show the target position
        if (lightsComplication.sliderTarget === 1) {
            return { top: ON, bottom: OFF };
        } else {
            return { top: OFF, bottom: ON };
        }
    };

    // Lights Out button toggle logic
    // B1 (blue) → L1 + L2, B2 (green) → L2 + L3, B3 (purple) → L1 + L3
    const handleLightsButton = (buttonIndex: 0 | 1 | 2) => {
        if (!lightsComplication.active || lightsComplication.solved) return;

        setLightsComplication(prev => {
            const newLights = [...prev.lights] as [boolean, boolean, boolean];

            if (buttonIndex === 0) { // B1 (blue)
                newLights[0] = !newLights[0];
                newLights[1] = !newLights[1];
            } else if (buttonIndex === 1) { // B2 (green)
                newLights[1] = !newLights[1];
                newLights[2] = !newLights[2];
            } else { // B3 (purple)
                newLights[0] = !newLights[0];
                newLights[2] = !newLights[2];
            }

            const allOn = newLights.every(l => l);
            return {
                ...prev,
                lights: newLights,
                buttonPhaseComplete: allOn
            };
        });
    };

    // Handle light slider changes with validation after button phase
    const handleLightsSliderChange = (newValue: -1 | 0 | 1) => {
        setLightSlider(newValue);

        // Only validate if button phase complete and complication active
        if (!lightsComplication.active || lightsComplication.solved) return;
        if (!lightsComplication.buttonPhaseComplete) return;

        // Check if slider matches target (target is 1 or -1, slider can be -1, 0, or 1)
        if (newValue === lightsComplication.sliderTarget) {
            // Solved!
            setLightsComplication(prev => ({ ...prev, solved: true }));
        } else if (newValue !== 0) {
            // Wrong non-center position - shake the slider
            setLightsSliderShaking(true);
            setTimeout(() => setLightsSliderShaking(false), 500);
        }
    };

    // Helper to get Reset Laser text color based on complication state
    const getLaserTextColor = (): string => {
        const TEAL = "#14b8a6";  // Inactive
        const RED = "#ef4444";   // Active, unsolved
        const GREEN = "#22c55e"; // Solved

        if (!laserComplication.active) return TEAL;
        if (laserComplication.solved) return GREEN;
        return RED;
    };

    // Helper to get laser slider indicator light colors
    // Returns { left: color, right: color } based on target and active state
    const getLaserLightColors = (sliderIndex: number): { left: string; right: string } => {
        const OFF = "#231f20";
        const ON = "#d8672b";

        if (!laserComplication.active) {
            return { left: OFF, right: OFF };
        }

        const target = laserComplication.targets[sliderIndex];
        if (target === -1) {
            return { left: ON, right: OFF }; // Target is left
        } else if (target === 1) {
            return { left: OFF, right: ON }; // Target is right
        } else {
            return { left: OFF, right: OFF }; // Target is center
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
                <text fill="#aad9d9" fontFamily="'Amazon Ember'" fontSize="15.7" transform="translate(83.81 1855.15)">
                    <tspan letterSpacing="-0.04em">V</tspan><tspan x="9.49">ersion 0.6.1</tspan>
                </text>
                <text fill="#aad9d9" fontFamily="'Amazon Ember'" fontSize="15.7" transform="translate(442.36 1855.15)">
                    <tspan>Muz</tspan><tspan letterSpacing="0em" x="29.67">z</tspan><tspan x="37.29">yMade @ 2026</tspan>
                </text>

                {/* Wipe Save Data - Made Interactive */}
                <g 
                    id="Wipe" 
                    className="cursor-pointer hover:brightness-125 active:brightness-90 transition-all origin-center" 
                    onClick={handleWipeInteraction}
                >
                    {wipeConfirm ? (
                        <text fill="#ef4444" fontFamily="'Amazon Ember'" fontSize="20.93" fontWeight="bold" transform="translate(259.17 1855.99)">
                            ARE YOU SURE?
                        </text>
                    ) : (
                        <text fill="#aad9d9" fontFamily="'Amazon Ember'" fontSize="20.93" transform="translate(259.17 1855.99)">
                            <tspan>WIPE S</tspan><tspan letterSpacing="-.06em" x="61.36">A</tspan><tspan x="72.61">VE </tspan><tspan letterSpacing="-.04em" x="100.66">D</tspan><tspan letterSpacing="-.05em" x="113.22">AT</tspan><tspan x="134.62">A</tspan>
                        </text>
                    )}
                    <path fill={wipeConfirm ? "#ef4444" : "#59acae"} d="M237.88,1840.61h14.55c.46.03.69.29.64.76-.31,4-.59,8.01-.9,12.01-.06.77-.07,1.57-.15,2.34-.11,1.05-.67,1.79-1.71,2.04-3.3.1-6.62.01-9.93.04-1.09-.07-1.91-.88-2.02-1.96-.27-3.77-.54-7.55-.81-11.32-.07-.99-.2-2.01-.24-3-.02-.48,0-.84.56-.9ZM240.87,1842.35c-.13.03-.32.22-.34.34-.06.31.02.81.02,1.13.07,2.82.18,5.63.27,8.45.03.82-.01,1.72.06,2.52.06.73.96.7,1.02.03.03-.37-.05-.93-.06-1.32-.09-3.11-.18-6.23-.3-9.34-.02-.43.03-1-.03-1.41-.05-.3-.35-.46-.64-.4ZM245.06,1842.35c-.23.04-.37.26-.38.49v11.98c.06.72,1.03.63,1.02-.06v-11.86c-.02-.37-.26-.61-.64-.55ZM249.34,1855.18s.11-.18.12-.22c.02-.1.03-.35.04-.47.12-2.38.11-4.77.18-7.16.04-1.46.15-2.94.15-4.4,0-.34-.17-.59-.53-.59-.64.01-.48.79-.49,1.22-.11,3.13-.19,6.27-.27,9.4-.01.58-.11,1.32-.06,1.89.04.44.56.63.86.33ZM240.61,1836.42c.1-1,1.08-1.87,2.08-1.9,1.7.08,3.5-.11,5.18,0,.98.06,2.11.92,2.11,1.96v.7s.08-.03.13-.03c.58-.01,1.22-.02,1.8,0,.74.02,1.37.09,1.77.81.26.46.44,1.47-.25,1.64h-16.41c-.8-.06-.59-1.21-.31-1.68.25-.42.8-.77,1.3-.77h2.55s.02.04.04.03c.02-.25-.02-.52,0-.76ZM234.2,780.05v-.64s-.09-.24-.11-.28c-.15-.27-.43-.41-.74-.43-1.65-.12-3.45.09-5.12,0-.28-.02-.77.41-.77.67v.67h6.74Z"/>
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
                <path fill="#474871" fillRule="evenodd" d="M549.56,74.42H63.39c-21.53,0-38.04,17.7-36.88,39.53l11.02,206.94c1.16,21.83,18.62,39.53,38.99,39.53h459.93c20.37,0,37.82-17.7,38.99-39.53l11.02-206.94c1.16-21.83-15.35-39.53-36.88-39.53Z"/>

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

                {/* 3. Reset Laser (Tracks + Functional Sliders) */}
                <g id="Reset_Laser_Top">
                    {/* Background Texture (Zig-Zags) - Static */}
                    <g pointerEvents="none">
                        {/* Top Left */}
                        <path fill="none" stroke="#d8672b" strokeWidth="3" strokeMiterlimit="10" opacity="0.25" d="M157.91,233.16h-4.24l-18.69-18.69c-3.62-3.62-3.62-9.52,0-13.14l18.69-18.69h4.24l-20.81,20.81c-2.45,2.45-2.45,6.44,0-8.89l20.81,20.81ZM111.51,212.35c-2.45-2.45-2.45-6.44,0-8.89l20.81-20.81h-4.24l-18.69,18.69c-1.75,1.75-2.72,4.09-2.72,6.57s.97,4.81,2.72,6.57l18.69,18.69h4.24l-20.81-20.81ZM107.64,182.65h-4.24l-18.68,18.68v13.15l18.68,18.68h4.24l-20.81-20.81c-2.45-2.45-2.45-6.44,0-8.89l20.81-20.81ZM235.4,214.47c3.62-3.62,3.62-9.52,0-13.14l-18.69-18.69h-4.24l20.81,20.81c2.45,2.45,2.45,6.44,0,8.89l-20.81,20.81h4.24l18.69-18.69ZM186.88,233.16h4.24l18.69-18.69c1.75-1.75,2.72-4.09,2.72-6.57s-.97-4.81-2.72-6.57l-18.69-18.69h-4.24l20.81,20.81c2.45,2.45,2.45,6.44,0,8.89l-20.81,20.81h4.24l18.69-18.69ZM260.08,214.47c.17-.17.33-.36.49-.54v-12.05c-.16-.19-.32-.37-.49-.54l-18.69-18.69h-4.24l20.81,20.81c2.45,2.45,2.45,6.44,0,8.89l-20.81,20.81h4.24l18.69-18.69Z"/>
                        {/* Bot Left */}
                        <path fill="none" stroke="#d8672b" strokeWidth="3" strokeMiterlimit="10" opacity="0.25" d="M132.32,324.04h-4.24l-18.69-18.69c-1.75-1.75-2.72-4.09-2.72-6.57s.97-4.81,2.72-6.57l18.69-18.69h4.24l-20.81,20.81c-2.45,2.45-2.45,6.44,0,8.89l20.81,20.81ZM137.1,303.23c-2.45-2.45-2.45-6.44,0-8.89l20.81-20.81h-4.24l-18.69,18.69c-3.62,3.62-3.62-9.52,0,13.14l18.69,18.69h4.24l-20.81-20.81ZM107.64,273.53h-4.24l-18.68,18.68v13.15l18.68,18.68h4.24l-20.81-20.81c-2.45-2.45-2.45-6.44,0-8.89l20.81-20.81ZM260.08,305.35c.18-.18.34-.36.49-.55v-12.04c-.16-.19-.32-.37-.49-.55l-18.69-18.69h-4.24l20.81,20.81c2.45,2.45,2.45,6.44,0,8.89l-20.81,20.81h4.24l18.69-18.69ZM186.88,324.04h4.24l18.69-18.69c3.62-3.62,3.62-9.52,0-13.14l-18.69-18.69h-4.24l20.81,20.81c1.19,1.19,1.84,2.77,1.84,4.45s-.65,3.26-1.84,4.45l-20.81,20.81ZM235.4,305.35c3.62-3.62,3.62-9.52,0-13.14l-18.69-18.69h-4.24l20.81,20.81c2.45,2.45,2.45,6.44,0,8.89l-20.81,20.81h4.24l18.69-18.69Z"/>
                        {/* Top Right - REMOVED TO FIX ARTIFACTS */}
                        {/* Bot Right - REMOVED TO FIX ARTIFACTS */}
                    </g>

                    {/* Functional Sliders */}
                    <ConsoleSlider x={172.65} y={207.9} value={laserSliders[0]} onChange={(v) => updateLaserSlider(0, v)} className={shakingSlider === 0 ? "shake-anim" : ""} />
                    <ConsoleSlider x={172.65} y={298.78} value={laserSliders[1]} onChange={(v) => updateLaserSlider(1, v)} className={shakingSlider === 1 ? "shake-anim" : ""} />
                    <ConsoleSlider x={445.24} y={207.9} value={laserSliders[2]} onChange={(v) => updateLaserSlider(2, v)} className={shakingSlider === 2 ? "shake-anim" : ""} />
                    <ConsoleSlider x={445.24} y={298.78} value={laserSliders[3]} onChange={(v) => updateLaserSlider(3, v)} className={shakingSlider === 3 ? "shake-anim" : ""} />

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

                    {/* Reset Laser Text - Click to toggle complication (for testing) */}
                    <text
                        fill={getLaserTextColor()}
                        fontFamily="'Amazon Ember'"
                        fontSize="20.93"
                        transform="translate(245.29 261.57)"
                        style={{ cursor: 'pointer' }}
                        onClick={toggleLaserComplication}
                    >
                        <tspan x="0" y="0">RESET </tspan>
                        <tspan letterSpacing=".02em" x="65.7" y="0">L</tspan>
                        <tspan x="77.19" y="0">ASER</tspan>
                    </text>
                </g>
            </g>

            {/* Reset Lights (Right Panel) */}
            <g id="Reset_Lights">
                {/* Purple Base */}
                <polygon fill="#45486c" points="608.7 1720.12 341.17 1720.12 341.17 1452.22 564.14 1452.22 608.7 1720.12"/>
                <text fill="#aad9d9" fontFamily="'Amazon Ember'" fontSize="20.93" transform="translate(414.68 1486.69)">RESET LIGHTS</text>
                
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
                    onChange={handleLightsSliderChange}
                    className={lightsSliderShaking ? 'shake' : ''}
                />

                {/* Slider Bottom Light (Off) */}
                <g>
                    <path fill={getLightsSliderLightColors().bottom} d="M382.12,1706.83c-6.36,0-11.53-5.17-11.53-11.53s5.17-11.54,11.53-11.54,11.53,5.17,11.53,11.53-5.17,11.54-11.53,11.54Z"/>
                    <path fill="#1f1f38" d="M382.12,1685.25c5.54,0,10.03,4.49,10.03,10.03h0c0,5.55-4.49,10.04-10.03,10.04s-10.03-4.49-10.03-10.03h0c0-5.55,4.49-10.04,10.03-10.04M382.12,1682.25c-7.19,0-13.03,5.85-13.03,13.03s5.85,13.03,13.03,13.03,13.04-5.85,13.04-13.03-5.85-13.04-13.03-13.04h0Z"/>
                </g>
                {/* Slider Top Light (On) */}
                <g>
                    <path fill={getLightsSliderLightColors().top} d="M382.12,1489.51c-6.36,0-11.53-5.17-11.53-11.53s5.17-11.54,11.53-11.54,11.53,5.17,11.53,11.53-5.17,11.54-11.53,11.54Z"/>
                    <path fill="#1f1f38" d="M382.12,1467.94c5.54,0,10.03,4.49,10.03,10.03h0c0,5.55-4.49,10.04-10.03,10.04s-10.03-4.49-10.03-10.03h0c0-5.55,4.49-10.04,10.03-10.04M382.12,1464.94c-7.19,0-13.03,5.85-13.03,13.03s5.85,13.04,13.03,13.03,13.04-5.85,13.04-13.03-5.85-13.03-13.03-13.03h0Z"/>
                </g>

                {/* Blue Button (Rear) */}
                <ArcadeButton 
                    x={431.19} y={1495} 
                    colorBody="#3d8380" colorTop="#96d7dd"
                    isPressed={pressedBtn === 'blue'}
                    onPress={() => handlePress('blue')}
                    onRelease={() => handleRelease('blue', onBlueClick)}
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
                    isPressed={pressedBtn === 'green'}
                    onPress={() => handlePress('green')}
                    onRelease={() => handleRelease('green', onGreenClick)}
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
                    isPressed={pressedBtn === 'purple'}
                    onPress={() => handlePress('purple')}
                    onRelease={() => handleRelease('purple', onPurpleClick)}
                />

                {/* Light below Purple */}
                <g>
                    <path fill={getLightsButtonLightColor(2)} d="M565.12,1689.3c-6.36,0-11.53-5.17-11.53-11.53s5.17-11.54,11.53-11.54,11.53,5.17,11.53,11.53-5.17,11.54-11.53,11.54Z"/>
                    <path fill="#1f1f38" d="M565.12,1667.73c5.54,0,10.03,4.49,10.03,10.03h0c0,5.55-4.49,10.04-10.03,10.04h0c-5.54,0-10.03-4.49-10.03-10.04h0M565.12,1664.73c-7.19,0-13.03,5.85-13.03,13.03s5.85,13.04,13.03,13.04,13.03-5.85,13.03-13.03-5.85-13.04-13.03-13.04h0Z"/>
                </g>
            </g>

            {/* Reset Controls (Dial) */}
            <g id="Reset_Controls">
                {/* Dial Base Panel - Corrected Shape */}
                <path fill="#45486c" d="M290.21,1663.73c10.78-17.3,17.01-37.73,17.01-59.61,0-23.97-7.48-46.2-20.22-64.48,7.77-.06,15.53-3.05,21.46-8.98,11.98-11.98,11.98-31.4,0-43.37-1.9-1.9-3.99-3.5-6.21-4.8-.5-17.51-14.85-31.56-32.48-31.56H121.34c-17.78,0-32.22,14.28-32.49,32-1.95,1.22-3.81,2.66-5.5,4.36-11.98,11.98-11.98,31.4,0,43.37,5.16,5.16,11.69,8.09,18.42,8.8-12.82,18.31-20.34,40.6-20.34,64.65,0,22.08,6.34,42.67,17.3,60.07-5.63,1.18-11,3.95-15.38,8.32-11.98,11.98-11.98,31.4,0,43.37,11.98,11.98,31.4,11.98,43.37,0,4.44-4.44,7.23-9.91,8.38-15.64,17.22,10.63,37.5,16.77,59.22,16.77,22.93,0,44.26-6.84,62.07-18.59.88,6.39,3.78,12.55,8.69,17.46,11.98,11.98,31.4,11.98,43.37,0,11.98-11.98,11.98-31.4,0-43.37-5.11-5.11-11.58-8.03-18.24-8.78Z"/>
                
                {/* Shadow Circle under Dial */}
                <circle fill="#0d1a19" cx="194.32" cy="1604.12" r="97.6" opacity="0.3"/> 
                
                {/* Light Indicators */}
                <g>
                    <path fill="#231f20" d="M103.94,1519.68c-6.36,0-11.53-5.17-11.53-11.53s5.17-11.54,11.53-11.54,11.53,5.17,11.53,11.53-5.17,11.54-11.53,11.54Z"/>
                    <path fill="#1f1f38" d="M103.94,1498.11c5.54,0,10.03,4.49,10.03,10.03h0c0,5.55-4.49,10.04-10.03,10.04h0c-5.54,0-10.03-4.49-10.03-10.03h0c0-5.55,4.49-10.04,10.03-10.04h0M103.94,1495.11c-7.19,0-13.03,5.85-13.03,13.03s5.85,13.04,13.03,13.04,13.03-5.85,13.03-13.03-5.85-13.04-13.03-13.03h0Z"/>
                </g>
                <g>
                    <path fill="#231f20" d="M288.3,1519.68c-6.36,0-11.53-5.17-11.53-11.53s5.17-11.54,11.53-11.54,11.53,5.17,11.53,11.53-5.17,11.54-11.53,11.54Z"/>
                    <path fill="#1f1f38" d="M288.3,1498.11c5.54,0,10.03,4.49,10.03,10.03h0c0,5.55-4.49,10.04-10.03,10.04h0c-5.54,0-10.03-4.49-10.03-10.03h0c0-5.55,4.49-10.04,10.03-10.04h0M288.3,1495.11c-7.19,0-13.03,5.85-13.03,13.03s5.85,13.04,13.03,13.04,13.03-5.85,13.03-13.03-5.85-13.04-13.03-13.03h0Z"/>
                </g>
                <g>
                    <path fill="#231f20" d="M103.94,1708.16c-6.36,0-11.53-5.17-11.53-11.53s5.17-11.54,11.53-11.54,11.53,5.17,11.53,11.53-5.17,11.54-11.53,11.54Z"/>
                    <path fill="#1f1f38" d="M103.94,1686.59c5.54,0,10.03,4.49,10.03,10.03h0c0,5.55-4.49,10.04-10.03,10.04h0c-5.54,0-10.03-4.49-10.03-10.03h0c0-5.55,4.49-10.04,10.03-10.04h0M103.94,1683.59c-7.19,0-13.03,5.85-13.03,13.03s5.85,13.04,13.03,13.04,13.03-5.85,13.03-13.03-5.85-13.04-13.03-13.03h0Z"/>
                </g>
                <g>
                    <path fill="#d8672b" d="M288.3,1708.16c-6.36,0-11.53-5.17-11.53-11.53s5.17-11.54,11.53-11.53,11.53,5.17,11.53,11.53-5.17,11.54-11.53,11.54Z"/>
                    <path fill="#1f1f38" d="M288.3,1686.59c5.54,0,10.03,4.49,10.03,10.03h0c0,5.55-4.49,10.04-10.03,10.04h0c-5.54,0-10.03-4.49-10.03-10.03h0c0-5.55,4.49-10.04,10.03-10.04h0M288.3,1683.59c-7.19,0-13.03,5.85-13.03,13.03s5.85,13.04,13.03,13.04,13.03-5.85,13.03-13.03-5.85-13.04-13.03-13.03h0Z"/>
                </g>

                <text fill="#aad9d9" fontFamily="'Amazon Ember'" fontSize="20.93" transform="translate(108.17 1480.38)">
                    <tspan>RESET </tspan><tspan letterSpacing="-0.02em" x="65.7">C</tspan><tspan x="77.88">ONT</tspan><tspan letterSpacing="-0.02em" x="121.09">R</tspan><tspan x="133.6">OLS</tspan>
                </text>
                
                {/* The Dial Itself */}
                <g
                    transform={`rotate(${Math.round(localDialRotation)} ${DIAL_CENTER_X} ${DIAL_CENTER_Y})`}
                    className="cursor-grab"
                    style={{
                        cursor: isDialDragging ? 'grabbing' : 'grab'
                    }}
                    onMouseDown={(e) => handleDialStart(e.clientX, e.clientY)}
                    onTouchStart={(e) => {
                        if (e.touches.length > 0) {
                            handleDialStart(e.touches[0].clientX, e.touches[0].clientY);
                        }
                    }}
                >
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
                        <text fill="#ffd92b" fontFamily="'Amazon Ember'" fontWeight="bold" fontSize="34.88" transform="translate(492.79 1783.33)">{upgradeCount}</text>
                    </>
                )}
            </g>

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

        </svg>
    );
};
