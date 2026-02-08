
import React, { useMemo } from 'react';

interface IntercomTextProps {
  fullText: string;        // The complete message
  keywords: string[];      // Words that render clearly (case-insensitive match)
  revealed?: boolean;      // If true, show all text clearly (for journal/replay)
  className?: string;
  /** How many characters to show (for typewriter effect). undefined = show all */
  visibleChars?: number;
}

// Industrial/terminal garble characters
const GARBLE_CHARS = '░▒▓█▐▌╪╫╬─│┤├┬┴┼';

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
type GarbleLevel = 'none' | 'partial' | 'full';

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
    const words = fullText.split(/(\s+)/); // Split but preserve whitespace tokens

    let wordIndex = 0;
    return words.map((token): ProcessedWord => {
      // Whitespace tokens pass through as-is
      if (/^\s+$/.test(token)) {
        return { isKeyword: false, display: token, original: token, garbleLevel: 'none' };
      }

      const coreWord = stripPunctuation(token);
      const leading = getLeadingPunctuation(token);
      const trailing = getTrailingPunctuation(token);
      const isKeyword = keywordsLower.includes(coreWord.toLowerCase());

      const currentIndex = wordIndex;
      wordIndex++;

      if (revealed || isKeyword) {
        return { isKeyword, display: token, original: token, garbleLevel: 'none' };
      }

      // Light corruption: most text readable, some garbled for radio-static flavor
      // 70% clear, 15% partial (1-2 chars garbled), 15% fully garbled
      const rng = seededRandom(currentIndex * 7919 + 31);
      const roll = rng(); // 0-1 determines corruption level

      if (roll < 0.70) {
        // Clear — word renders as-is
        return {
          isKeyword: false,
          display: token,
          original: token,
          garbleLevel: 'none',
        };
      }

      if (roll < 0.85) {
        // Partial garble — 1-2 characters within the word are corrupted
        const chars = coreWord.split('');
        const garbleCount = Math.min(chars.length, coreWord.length <= 2 ? 1 : (rng() < 0.5 ? 1 : 2));
        const indicesToGarble = new Set<number>();
        while (indicesToGarble.size < garbleCount) {
          indicesToGarble.add(Math.floor(rng() * chars.length));
        }
        const partialGarbled = chars
          .map((ch, idx) => indicesToGarble.has(idx)
            ? GARBLE_CHARS[Math.floor(rng() * GARBLE_CHARS.length)]
            : ch
          )
          .join('');

        return {
          isKeyword: false,
          display: leading + partialGarbled + trailing,
          original: token,
          garbleLevel: 'partial',
        };
      }

      // Full garble — entire word replaced with block chars
      const garbled = coreWord
        .split('')
        .map(() => GARBLE_CHARS[Math.floor(rng() * GARBLE_CHARS.length)])
        .join('');

      return {
        isKeyword: false,
        display: leading + garbled + trailing,
        original: token,
        garbleLevel: 'full',
      };
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

        // Garbled or partially garbled word
        // Full garble: muted color so it blends as static, not redaction
        // Partial garble: normal text color (corrupted chars blend in)
        const garbleClass = word.garbleLevel === 'full'
          ? 'text-slate-500 font-mono'
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
