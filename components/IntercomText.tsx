
import React, { useMemo } from 'react';

interface IntercomTextProps {
  fullText: string;        // The complete message
  keywords: string[];      // Words that render clearly (case-insensitive match)
  revealed?: boolean;      // If true, show all text clearly (for journal/replay)
  className?: string;
  /** How many characters to show (for typewriter effect). undefined = show all */
  visibleChars?: number;
}

// Industrial block characters for radio-static garble effect
const GARBLE_CHARS = '░▒▓█▌▐■▬▮▪';

/**
 * Seeded pseudo-random number generator.
 * Deterministic: same seed always produces same sequence.
 */
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

/**
 * Strip leading/trailing punctuation from a word for keyword matching.
 * Returns the core word without surrounding punctuation.
 */
function stripPunctuation(word: string): string {
  return word.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '');
}

/**
 * Extract trailing punctuation from a word.
 */
function getTrailingPunctuation(word: string): string {
  const match = word.match(/[^a-zA-Z0-9]+$/);
  return match ? match[0] : '';
}

/**
 * Extract leading punctuation from a word.
 */
function getLeadingPunctuation(word: string): string {
  const match = word.match(/^[^a-zA-Z0-9]+/);
  return match ? match[0] : '';
}

// Garble level for non-keyword words
type GarbleLevel = 'none' | 'garbled';

interface ProcessedWord {
  isKeyword: boolean;
  display: string;     // The rendered text (garbled or clear)
  original: string;    // The original word
  garbleLevel: GarbleLevel;  // How corrupted this word is
}

export const IntercomText: React.FC<IntercomTextProps> = ({
  fullText,
  keywords,
  revealed = false,
  className = '',
  visibleChars,
}) => {
  const processedWords = useMemo(() => {
    const keywordsLower = keywords.map(k => k.toLowerCase());
    const hasBrackets = fullText.includes('[');

    // --- Bracket-based garbling ---
    // fullText uses [brackets] to mark garbled words. Everything else is clear.
    // Keywords (from keywords array) render green. Non-keyword non-bracketed = plain clear.
    if (hasBrackets) {
      const result: ProcessedWord[] = [];
      // Split fullText into alternating clear/garbled segments
      // e.g. "[Welcome] Operator" → ["", "Welcome", " Operator"]
      const parts = fullText.split(/\[([^\]]*)\]/);
      let wordIndex = 0;

      for (let p = 0; p < parts.length; p++) {
        const isGarbled = p % 2 === 1; // Odd indices are bracket contents
        const text = parts[p];
        if (!text) continue;

        const tokens = text.split(/(\s+)/);
        for (const token of tokens) {
          if (!token) continue;
          if (/^\s+$/.test(token)) {
            result.push({ isKeyword: false, display: token, original: token, garbleLevel: 'none' });
            continue;
          }

          const coreWord = stripPunctuation(token);
          const leading = getLeadingPunctuation(token);
          const trailing = getTrailingPunctuation(token);
          const isKw = !isGarbled && keywordsLower.includes(coreWord.toLowerCase());
          const currentIndex = wordIndex++;

          // Revealed mode or keyword or non-garbled → show clearly
          if (revealed || isKw || !isGarbled) {
            result.push({ isKeyword: isKw, display: token, original: token, garbleLevel: 'none' });
            continue;
          }

          // Bracketed word → full garble (replace entire word with block characters)
          // Brackets provide EXPLICIT control: [word] = garbled, no randomness.
          const rng = seededRandom(currentIndex * 7919 + 31);
          const garbled = coreWord.split('')
            .map(() => GARBLE_CHARS[Math.floor(rng() * GARBLE_CHARS.length)])
            .join('');
          result.push({ isKeyword: false, display: leading + garbled + trailing, original: token, garbleLevel: 'garbled' });
        }
      }
      return result;
    }

    // --- Fallback: no brackets in fullText — garble all non-keyword words ---
    const words = fullText.split(/(\s+)/);
    let wordIndex = 0;
    return words.map((token): ProcessedWord => {
      if (/^\s+$/.test(token)) {
        return { isKeyword: false, display: token, original: token, garbleLevel: 'none' };
      }

      const coreWord = stripPunctuation(token);
      const leading = getLeadingPunctuation(token);
      const trailing = getTrailingPunctuation(token);
      const isKeyword = keywordsLower.includes(coreWord.toLowerCase());
      const currentIndex = wordIndex++;

      if (revealed || isKeyword) {
        return { isKeyword, display: token, original: token, garbleLevel: 'none' };
      }

      // No brackets → full garble on all non-keyword words
      const rng = seededRandom(currentIndex * 7919 + 31);
      const garbled = coreWord.split('')
        .map(() => GARBLE_CHARS[Math.floor(rng() * GARBLE_CHARS.length)])
        .join('');
      return { isKeyword: false, display: leading + garbled + trailing, original: token, garbleLevel: 'garbled' };
    });
  }, [fullText, keywords, revealed]);

  // Build the full display string for character counting
  const fullDisplay = processedWords.map(w => w.display).join('');
  const showAll = visibleChars === undefined || visibleChars >= fullDisplay.length;

  // Render spans, applying the visibleChars cutoff
  let charsRendered = 0;

  return (
    <p className={`leading-relaxed ${className}`}>
      {processedWords.map((word, i) => {
        if (!showAll && charsRendered >= visibleChars!) {
          return null;
        }

        let displayText = word.display;

        if (!showAll) {
          const remaining = visibleChars! - charsRendered;
          if (displayText.length > remaining) {
            displayText = displayText.slice(0, remaining);
          }
        }

        charsRendered += word.display.length;

        // Whitespace tokens — render as plain text
        if (/^\s+$/.test(word.original)) {
          return <span key={i}>{displayText}</span>;
        }

        if (word.isKeyword) {
          return (
            <span
              key={i}
              className="text-green-400 font-semibold"
            >
              {displayText}
            </span>
          );
        }

        // Three-color system: green (keywords), white (clear), muted (garbled)
        const garbleClass = word.garbleLevel !== 'none'
          ? 'text-slate-500'
          : 'text-slate-300';

        return (
          <span
            key={i}
            className={garbleClass}
          >
            {displayText}
          </span>
        );
      })}
    </p>
  );
};
