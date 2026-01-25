import React, { useState, useEffect } from 'react';
import { PieceDefinition } from '../types';
import { getPaletteForRank } from '../utils/gameLogic';

interface PiecePreviewProps {
  piece: PieceDefinition | null;
  label: string;  // "HOLD" or "NEXT"
  visible: boolean;  // Show/hide based on upgrade ownership
  rank?: number;  // For wild color cycling
}

// Fixed box size for consistent appearance (like old color pool boxes)
const BOX_SIZE = 48;  // Fixed internal size
const CELL_SIZE = 12; // Size of each block in preview

export const PiecePreview: React.FC<PiecePreviewProps> = ({ piece, label, visible, rank = 0 }) => {
  const [now, setNow] = useState(Date.now());

  // Update time for wild color cycling
  useEffect(() => {
    if (!piece?.isWild) return;
    const interval = setInterval(() => setNow(Date.now()), 50);
    return () => clearInterval(interval);
  }, [piece?.isWild]);

  if (!visible) return null;

  // Get wild color based on palette, time, and X position (wave effect)
  const getWildColorAtX = (xPos: number) => {
    const palette = getPaletteForRank(rank);
    const cycleSpeed = 400; // ms per color
    const waveSpeed = 0.15; // Higher for smaller preview

    const basePhase = (now % (palette.length * cycleSpeed)) / cycleSpeed;
    const xOffset = xPos * waveSpeed;
    const t = (basePhase + xOffset) % palette.length;

    const index = Math.floor(t);
    const nextIndex = (index + 1) % palette.length;
    const blend = t - index;

    const c1 = palette[index];
    const c2 = palette[nextIndex];

    const r1 = parseInt(c1.slice(1, 3), 16);
    const g1 = parseInt(c1.slice(3, 5), 16);
    const b1 = parseInt(c1.slice(5, 7), 16);
    const r2 = parseInt(c2.slice(1, 3), 16);
    const g2 = parseInt(c2.slice(3, 5), 16);
    const b2 = parseInt(c2.slice(5, 7), 16);

    const r = Math.round(r1 + (r2 - r1) * blend);
    const g = Math.round(g1 + (g2 - g1) * blend);
    const b = Math.round(b1 + (b2 - b1) * blend);

    return `rgb(${r}, ${g}, ${b})`;
  };

  // Calculate piece bounds for centering (only if piece exists)
  let pieceContent = null;
  if (piece) {
    const isWild = piece.isWild;

    const minX = Math.min(...piece.cells.map(c => c.x));
    const maxX = Math.max(...piece.cells.map(c => c.x));
    const minY = Math.min(...piece.cells.map(c => c.y));
    const maxY = Math.max(...piece.cells.map(c => c.y));
    const pieceWidth = maxX - minX + 1;
    const pieceHeight = maxY - minY + 1;

    // Center the piece within the fixed box
    const offsetX = (BOX_SIZE - pieceWidth * CELL_SIZE) / 2;
    const offsetY = (BOX_SIZE - pieceHeight * CELL_SIZE) / 2;

    pieceContent = piece.cells.map((cell, i) => {
      const cellX = offsetX + (cell.x - minX) * CELL_SIZE;
      return (
        <rect
          key={i}
          x={cellX}
          y={offsetY + (cell.y - minY) * CELL_SIZE}
          width={CELL_SIZE - 1}
          height={CELL_SIZE - 1}
          fill={isWild ? getWildColorAtX(cellX) : (piece.cellColors?.[i] ?? piece.color)}
          rx={2}
        />
      );
    });
  }

  return (
    <div style={{
      background: 'rgba(0, 0, 0, 0.8)',
      border: '2px solid #475569',
      borderRadius: '6px',
      padding: '4px 6px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center'
    }}>
      <div style={{
        fontSize: '9px',
        color: '#94a3b8',
        textAlign: 'center',
        marginBottom: '2px',
        fontFamily: 'monospace',
        letterSpacing: '1px'
      }}>
        {label}
      </div>
      <svg
        width={BOX_SIZE}
        height={BOX_SIZE}
        style={{ display: 'block' }}
      >
        {/* Empty box background */}
        <rect
          x={0}
          y={0}
          width={BOX_SIZE}
          height={BOX_SIZE}
          fill="rgba(30, 41, 59, 0.5)"
          rx={4}
        />
        {pieceContent}
      </svg>
    </div>
  );
};
