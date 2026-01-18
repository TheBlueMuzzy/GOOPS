
import React, { useState, useRef, useEffect } from 'react';

interface ConsoleSliderProps {
    x: number;
    y: number;
    rotation?: number; // Degrees
    length?: number;   // Total length of the track
    width?: number;    // Width of the track
    handleSize?: number;
    value?: -1 | 0 | 1; // Controlled state
    onChange?: (val: -1 | 0 | 1) => void;
    trackColor?: string;
    handleColor?: string;
    arrowColor?: string;
}

// Arrow path from Art.tsx
const ARROW_PATH = "M21.05,1.52v.45l-.14.45c-2.77,3.62-5.81,7.05-8.67,10.61-.73.94-1.94,1.07-2.8.21L.54,3.02C.27,2.71.1,2.38,0,1.98c.01-.15-.02-.31,0-.45C.1.77.79.08,1.55,0h17.84c.82.02,1.56.72,1.66,1.52ZM19.57,7.83c-.69.84-1.38,1.67-2.07,2.49-1.14,1.37-2.32,2.78-3.45,4.18-.81,1.04-2.03,1.66-3.31,1.66-1.1,0-2.15-.45-2.96-1.27l-.05-.05L1.62,7.81h-.07c-.76.08-1.45.77-1.54,1.52-.02.14.01.31,0,.45.09.41.26.74.54,1.05l8.9,10.22c.86.87,2.06.73,2.8-.21,2.86-3.56,5.91-6.99,8.67-10.61l.14-.45v-.45c-.09-.74-.74-1.39-1.48-1.5Z";

export const ConsoleSlider: React.FC<ConsoleSliderProps> = ({
    x, y, 
    rotation = 0,
    length = 176,
    width = 50,
    handleSize = 50,
    value = 0,
    onChange,
    trackColor = "#eebfc5",
    handleColor = "#d36b28",
    arrowColor = "#ffffff"
}) => {
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState(0); // Pixel offset from center
    const dragStartPos = useRef<{ x: number, y: number } | null>(null);
    const startValueOffset = useRef(0);

    // Calculate boundaries
    const maxTravel = (length - handleSize) / 2;
    
    // Snap points in pixels relative to center
    const snapPoints = {
        '-1': -maxTravel,
        '0': 0,
        '1': maxTravel
    };

    // Calculate current visual position
    // If dragging, use dragOffset. If not, snap to current value.
    const currentPos = isDragging ? dragOffset : (snapPoints[`${value}` as '-1'|'0'|'1'] || 0);

    const handlePointerDown = (e: React.PointerEvent) => {
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        setIsDragging(true);
        dragStartPos.current = { x: e.clientX, y: e.clientY };
        startValueOffset.current = currentPos;
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDragging || !dragStartPos.current) return;
        e.stopPropagation();

        const dx = e.clientX - dragStartPos.current.x;
        const dy = e.clientY - dragStartPos.current.y;

        // Project delta onto the slider's rotated axis
        // Rotation is in degrees, convert to radians
        const rad = (rotation * Math.PI) / 180;
        
        // Axis vector: (cos(r), sin(r))
        // Dot product: dx * cos + dy * sin
        const projectedDelta = dx * Math.cos(rad) + dy * Math.sin(rad);

        const rawPos = startValueOffset.current + projectedDelta;
        const clampedPos = Math.max(-maxTravel, Math.min(maxTravel, rawPos));
        
        setDragOffset(clampedPos);
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        if (!isDragging) return;
        e.stopPropagation();
        e.currentTarget.releasePointerCapture(e.pointerId);
        setIsDragging(false);

        // Snap Logic
        // Find closest snap point
        const distLeft = Math.abs(dragOffset - snapPoints['-1']);
        const distCenter = Math.abs(dragOffset - snapPoints['0']);
        const distRight = Math.abs(dragOffset - snapPoints['1']);

        let newValue: -1 | 0 | 1 = 0;
        if (distLeft < distCenter && distLeft < distRight) newValue = -1;
        else if (distRight < distCenter && distRight < distLeft) newValue = 1;
        else newValue = 0;

        if (onChange && newValue !== value) {
            onChange(newValue);
        }
    };

    return (
        <g transform={`translate(${x}, ${y}) rotate(${rotation})`}>
            {/* Track Slot */}
            <rect 
                x={-length / 2} 
                y={-width / 2} 
                width={length} 
                height={width} 
                rx={6.92} 
                ry={6.92} 
                fill={trackColor} 
            />

            {/* Handle Group */}
            <g 
                transform={`translate(${currentPos}, 0)`} 
                style={{ transition: isDragging ? 'none' : 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }}
            >
                {/* Handle Body */}
                <rect 
                    x={-handleSize / 2} 
                    y={-handleSize / 2} 
                    width={handleSize} 
                    height={handleSize} 
                    rx={3.69} 
                    ry={3.69} 
                    fill={handleColor} 
                />
                
                {/* Arrows Removed for Phase 1 - Reserved for future upgrade logic */}
            </g>

            {/* Hit Area (Invisible, wider for better touch) */}
            <rect 
                x={-length / 2 - 20} 
                y={-width / 2 - 20} 
                width={length + 40} 
                height={width + 40} 
                fill="transparent" 
                style={{ cursor: 'grab', touchAction: 'none' }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
            />
        </g>
    );
};
