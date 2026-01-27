
import React from 'react';

interface EndGameScreenProps {
  shiftScore: number;
  rank: number;
  xpCurrent: number;
  xpNext: number;
  cracksFilled: number;
  cracksTarget: number;
  pressureVented: number;  // ms of bonus time
  maxTime: number;         // total shift duration in ms
  massPurged: number;
  leftoverPenalty: number;
  unspentPower: number;
  isWin: boolean;
}

// Calculate grade based on performance metrics
const calculateGrade = (isWin: boolean, cracksFilled: number, cracksTarget: number, leftoverPenalty: number, pressureVented: number, maxTime: number, shiftScore: number): string => {
  if (!isWin) return "FAILURE";

  // Score out of 500 (5 categories × 100 max each)
  // 1. Crack Performance: (sealed / target) * 100
  const crackScore = cracksTarget > 0 ? Math.min(100, (cracksFilled / cracksTarget) * 100) : 100;

  // 2. Tank Efficiency: 100 - (residualGoop * 2), capped at 0
  const tankScore = Math.max(0, 100 - (leftoverPenalty * 2));

  // 3. System Control: simplified - 100 if win, degraded by leftover penalty
  const systemScore = Math.max(0, 100 - (leftoverPenalty * 3));

  // 4. Pressure Management: (totalVented / maxTime) * 100
  const pressureScore = maxTime > 0 ? Math.min(100, (pressureVented / maxTime) * 100) : 50;

  // 5. Shift Score: min(100, shiftScore / 100)
  const scoreBonus = Math.min(100, shiftScore / 100);

  const average = (crackScore + tankScore + systemScore + pressureScore + scoreBonus) / 5;

  if (average >= 80) return "A";
  if (average >= 60) return "B";
  if (average >= 40) return "C";
  return "FAILURE";
};

export const EndGameScreen: React.FC<EndGameScreenProps> = ({
  shiftScore, rank, xpCurrent, xpNext,
  cracksFilled, cracksTarget, pressureVented, maxTime,
  massPurged, leftoverPenalty, unspentPower, isWin
}) => {
  // Meter Fill Max Width is 366.31
  const xpRatio = Math.min(1, Math.max(0, xpCurrent / xpNext));
  const fillWidth = xpRatio * 366.31;

  const grade = calculateGrade(isWin, cracksFilled, cracksTarget, leftoverPenalty, pressureVented, maxTime, shiftScore);
  const gradeColor = grade === "A" ? "#5bbc70" : grade === "B" ? "#6acbda" : grade === "C" ? "#ffd92b" : "#d82727";

  // Calculate pressure vented as percentage
  const pressurePercent = maxTime > 0 ? Math.round((pressureVented / maxTime) * 100) : 0;

  return (
    <g id="End_Game_Monitor_Group">
      {/* Monitor Body - Orange */}
      <path fill="#f2a743" d="M16.86,32.56h549.95c9.31,0,16.86,7.55,16.86,16.86v847.89c0,6.78-5.5,12.28-12.28,12.28H12.28c-6.78,0-12.28-5.5-12.28-12.28V49.42c0-9.31,7.55-16.86,16.86-16.86Z"/>
      <path fill="#d36b28" d="M574.73,37.21H8.94c-3.39,0-5.14-4.05-2.82-6.52L25.37,10.16C31.46,3.68,39.96,0,48.85,0h485.98c8.89,0,17.39,3.68,23.47,10.16l19.25,20.52c2.32,2.47.57,6.52-2.82,6.52Z"/>
      
      {/* Bezel Outline - Dark Blue */}
      <path fill="#1d1d3a" d="M520.88,888.84H62.79c-23.18,0-42.03-18.86-42.03-42.03V100c0-23.18,18.86-42.03,42.03-42.03h458.1c23.18,0,42.03,18.86,42.03,42.03v746.81c0,23.18-18.86,42.03-42.03,42.03ZM62.79,62.96c-20.42,0-37.03,16.61-37.03,37.03v746.81c0,20.42,16.61,37.03,37.03,37.03h458.1c20.42,0,37.03-16.61,37.03-37.03V100c0-20.42-16.61-37.03-37.03-37.03H62.79Z"/>
      
      {/* Screen Background - Darker Blue */}
      <rect fill="#1f1f38" x="23.26" y="60.46" width="537.16" height="825.87" rx="39.53" ry="39.53"/>
      
      {/* HEADER: SHIFT OVER (always) */}
      <text fill="#6acbda" fontFamily="'From Where You Are'" fontSize="42" transform="translate(291.5 122.96)" textAnchor="middle">
          SHIFT OVER
      </text>

      {/* SUBHEADER: GRADE */}
      <text fill={gradeColor} fontFamily="'Amazon Ember'" fontWeight="800" fontSize="24" letterSpacing="0.1em" transform="translate(291.5 155)" textAnchor="middle">
          GRADE: {grade}
      </text>

      {/* OPERATOR RANK SECTION */}
      {/* Rank Bar BG */}
      <path fill="#5bbc70" d="M525.21,243.36H58.95c-5.73,0-10.38-4.66-10.38-10.38s4.66-10.38,10.38-10.38h466.26c5.73,0,10.38,4.66,10.38,10.38s-4.66,10.38-10.38,10.38ZM58.95,223.59c-5.17,0-9.38,4.21-9.38,9.38s4.21,9.38,9.38,9.38h466.26c5.17,0,9.38-4.21,9.38-9.38s-4.21-9.38-9.38-9.38H58.95Z"/>
      {/* Rank Bar Fill */}
      <path fill="#5bbc70" d={`M57.75,223.09h${fillWidth}v19.77H57.75c-4.79,0-8.68-3.89-8.68-8.68v-2.4c0-4.79,3.89-8.68,8.68-8.68Z`}/>
      
      {/* XP Values - Inside Bar */}
      <text fill="#ffffff" fontFamily="'Amazon Ember'" fontWeight="600" fontSize="14" textAnchor="end" transform="translate(530 237)">
          {Math.floor(xpCurrent).toLocaleString()} / {Math.floor(xpNext).toLocaleString()}
      </text>
      {/* Promotion Threshold Label - Above Bar */}
      <text fill="#59acae" fontFamily="'Amazon Ember'" fontSize="12" textAnchor="end" transform="translate(530 213)">
          PROMOTION THRESHOLD
      </text>
      
      {/* Rank Label */}
      <text fill="#6acbda" fontFamily="'Amazon Ember'" fontSize="20.93" transform="translate(49.87 209.32)">
          <tspan x="0" y="0">OPERATOR RANK</tspan>
      </text>
      
      {/* Rank Number */}
      <text fill="#6acbda" fontFamily="'Amazon Ember'" fontWeight="800" fontSize="34.88" transform="translate(230 210.8)" textAnchor="start">
          {rank}
      </text>

      {/* FOOTER ACTION: DRAG UP */}
      <path fill="#fff" d="M268.4,808.13v-1.02l.33-1.02c6.23-8.15,13.08-15.87,19.51-23.87,1.65-2.11,4.36-2.41,6.29-.46l20.02,23c.62.7,1,1.44,1.2,2.36-.03.33.04.7,0,1.02-.21,1.7-1.77,3.25-3.47,3.42h-40.15c-1.85-.05-3.51-1.61-3.74-3.42ZM271.73,793.93c1.56-1.89,3.12-3.76,4.65-5.6,2.57-3.07,5.23-6.25,7.76-9.4,1.83-2.35,4.56-3.73,7.45-3.73,2.47,0,4.83,1.01,6.66,2.85l.12.12,13.75,15.8h.16c1.7-.17,3.26-1.72,3.47-3.42.04-.32-.03-.69,0-1.02-.2-.92-.58-1.66-1.21-2.36l-20.02-23c-1.94-1.95-4.65-1.65-6.29.46-6.44,8.01-13.29,15.72-19.51,23.87l-.33,1.02v1.02c.21,1.67,1.66,3.12,3.33,3.37Z"/>
      <text fill="#d82727" fontFamily="'From Where You Are'" fontSize="24" transform="translate(291.5 860.65)" textAnchor="middle">
          DRAG UP TO END SHIFT
      </text>

      {/* SHIFT SCORE LABEL */}
      <text fill="#6acbda" fontFamily="'Amazon Ember'" fontSize="20.93" transform="translate(165.69 321.1)" textAnchor="middle">
          SHIFT SCORE
      </text>
      
      {/* FINAL SCORE VALUE */}
      <text fill="#fff" fontFamily="'Amazon Ember'" fontWeight="800" fontSize="60" transform="translate(165.69 390.05)" textAnchor="middle">
          {shiftScore.toLocaleString()}
      </text>

      {/* STATS GRID */}
      
      {/* 1. Cracks Filled */}
      <g>
        <rect fill="#0c0f19" x="55.99" y="467.32" width="219.4" height="117.59" rx="13.52" ry="13.52"/>
        <path fill="#fff" d="M261.87,585.41H69.52c-7.73,0-14.02-6.29-14.02-14.02v-90.54c0-7.73,6.29-14.02,14.02-14.02h192.35c7.73,0,14.02,6.29,14.02,14.02v90.54c0,7.73-6.29,14.02-14.02,14.02ZM69.52,467.82c-7.18,0-13.02,5.84-13.02,13.02v90.54c0,7.18,5.84,13.02,13.02,13.02h192.35c7.18,0,13.02-5.84,13.02-13.02v-90.54c0-7.18-5.84-13.02-13.02-13.02H69.52Z"/>
        <text fill="#6acbda" fontFamily="'Amazon Ember'" fontSize="18" transform="translate(165.69 503.38)" textAnchor="middle">CRACKS FILLED</text>
        <text fill="#fff" fontFamily="'Amazon Ember'" fontWeight="700" fontSize="36" transform="translate(165.69 557.36)" textAnchor="middle">{cracksFilled} / {cracksTarget}</text>
      </g>

      {/* 2. Pressure Vented */}
      <g>
        <rect fill="#0c0f19" x="308.38" y="467.32" width="219.4" height="117.59" rx="13.52" ry="13.52"/>
        <path fill="#fff" d="M514.25,585.41h-192.35c-7.73,0-14.02-6.29-14.02-14.02v-90.54c0-7.73,6.29-14.02,14.02-14.02h192.35c7.73,0,14.02,6.29,14.02,14.02v90.54c0,7.73-6.29,14.02-14.02,14.02ZM321.9,467.82c-7.18,0-13.02,5.84-13.02,13.02v90.54c0,7.18,5.84,13.02,13.02,13.02h192.35c7.18,0,13.02-5.84,13.02-13.02v-90.54c0-7.18-5.84-13.02-13.02-13.02h-192.35Z"/>
        <text fill="#6acbda" fontFamily="'Amazon Ember'" fontSize="18" transform="translate(418.08 503.38)" textAnchor="middle">PRESSURE VENTED</text>
        <text fill="#fff" fontFamily="'Amazon Ember'" fontWeight="700" fontSize="36" transform="translate(418.08 557.36)" textAnchor="middle">{pressurePercent}%</text>
      </g>

      {/* 3. Max Mass Purged */}
      <g>
        <rect fill="#0c0f19" x="55.99" y="613.59" width="219.4" height="117.59" rx="13.52" ry="13.52"/>
        <path fill="#fff" d="M261.87,731.68H69.52c-7.73,0-14.02-6.29-14.02-14.02v-90.54c0-7.73,6.29-14.02,14.02-14.02h192.35c7.73,0,14.02,6.29,14.02,14.02v90.54c0,7.73-6.29,14.02-14.02,14.02ZM69.52,614.09c-7.18,0-13.02,5.84-13.02,13.02v90.54c0,7.18,5.84,13.02,13.02,13.02h192.35c7.18,0,13.02-5.84,13.02-13.02v-90.54c0-7.18-5.84-13.02-13.02-13.02H69.52Z"/>
        <text fill="#6acbda" fontFamily="'Amazon Ember'" fontSize="18" transform="translate(165.69 649.64)" textAnchor="middle">MAX POP</text>
        <text fill="#fff" fontFamily="'Amazon Ember'" fontWeight="700" fontSize="36" transform="translate(165.69 703.63)" textAnchor="middle">{massPurged}</text>
      </g>

      {/* 4. Leftover Goop */}
      <g>
        <rect fill="#0c0f19" x="308.38" y="613.59" width="219.4" height="117.59" rx="13.52" ry="13.52"/>
        <path fill="#fff" d="M514.25,731.68h-192.35c-7.73,0-14.02-6.29-14.02-14.02v-90.54c0-7.73,6.29-14.02,14.02-14.02h192.35c7.73,0,14.02,6.29,14.02,14.02v90.54c0,7.73-6.29,14.02-14.02,14.02ZM321.9,614.09c-7.18,0-13.02,5.84-13.02,13.02v90.54c0,7.18,5.84,13.02,13.02,13.02h192.35c7.18,0,13.02-5.84,13.02-13.02v-90.54c0-7.18-5.84-13.02-13.02-13.02h-192.35Z"/>
        <text fill="#6acbda" fontFamily="'Amazon Ember'" fontSize="18" transform="translate(418.08 649.64)" textAnchor="middle">RESIDUAL GOOP</text>
        <text fill="#fff" fontFamily="'Amazon Ember'" fontWeight="700" fontSize="36" transform="translate(418.08 703.63)" textAnchor="middle">-{leftoverPenalty}</text>
      </g>

      {/* Scraps */}
      <text fill="#6acbda" fontFamily="'Amazon Ember'" fontSize="20.93" transform="translate(418.08 321.1)" textAnchor="middle">
          SCRAPS
      </text>
      <text fill="#ffd92b" fontFamily="'Amazon Ember'" fontWeight="800" fontSize="60" transform="translate(418.08 390.05)" textAnchor="middle">
          {unspentPower}
      </text>
    </g>
  );
};
