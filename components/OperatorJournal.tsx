
import React, { useState, useMemo } from 'react';
import {
  Gauge,
  Keyboard,
  Target,
  ArrowUpCircle,
  AlertTriangle,
  RefreshCw,
  Lightbulb,
  Zap,
  Lock,
  Wrench,
  Sparkles,
  ChevronLeft,
  LucideIcon,
} from 'lucide-react';
import { JOURNAL_PAGES } from '../data/journalEntries';
import { JournalPage, JournalPageId } from '../types/tutorial';
import './OperatorJournal.css';

// --- Icon mapping: string name -> lucide component ---
const ICON_MAP: Record<string, LucideIcon> = {
  Gauge,
  Keyboard,
  Target,
  ArrowUpCircle,
  AlertTriangle,
  RefreshCw,
  Lightbulb,
  Zap,
  Lock,
  Wrench,
  Sparkles,
};

interface OperatorJournalProps {
  completedSteps: string[];
  onBack: () => void;
}

export const OperatorJournal: React.FC<OperatorJournalProps> = ({ completedSteps, onBack }) => {
  // Determine which pages are unlocked
  const unlockedPageIds = useMemo(() => {
    const ids = new Set<JournalPageId>();
    for (const page of JOURNAL_PAGES) {
      if (page.unlockedBy === 'ALWAYS' || completedSteps.includes(page.unlockedBy)) {
        ids.add(page.id);
      }
    }
    return ids;
  }, [completedSteps]);

  // Default selection: first unlocked page
  const defaultPage = useMemo(() => {
    const first = JOURNAL_PAGES.find(p => unlockedPageIds.has(p.id));
    return first?.id ?? 'BASICS';
  }, [unlockedPageIds]);

  const [selectedPageId, setSelectedPageId] = useState<JournalPageId>(defaultPage);
  const [contentKey, setContentKey] = useState(0); // For re-triggering fade animation

  const selectedPage = JOURNAL_PAGES.find(p => p.id === selectedPageId) ?? JOURNAL_PAGES[0];
  const isSelectedUnlocked = unlockedPageIds.has(selectedPageId);

  const handleTabClick = (page: JournalPage) => {
    if (!unlockedPageIds.has(page.id)) return; // Can't select locked pages
    if (page.id === selectedPageId) return;     // Already selected
    setSelectedPageId(page.id);
    setContentKey(prev => prev + 1); // Trigger fade animation
  };

  return (
    <div className="fixed inset-0 w-screen h-[100dvh] bg-slate-950 flex items-center justify-center overflow-hidden">
      {/* Green radial gradient background */}
      <div className="absolute inset-0 z-0 opacity-20 bg-[radial-gradient(circle_at_50%_50%,#059669_0%,transparent_50%)] pointer-events-none" />

      {/* Constrained Aspect Ratio Container (9:16) */}
      <div
        className="relative z-10 w-full h-full shadow-2xl"
        style={{
          width: 'min(100vw, 100dvh * 0.5625)',
          height: 'min(100dvh, 100vw * 1.7778)',
        }}
      >
        <div className="w-full h-full flex flex-col items-center relative bg-slate-950 overflow-hidden border-x-4 border-slate-900">

          {/* Title */}
          <div className="w-full flex items-center justify-center pt-5 pb-3 flex-shrink-0">
            <h2
              className="text-2xl text-slate-200 tracking-wider uppercase"
              style={{ fontFamily: '"From Where You Are", cursive' }}
            >
              Operator Journal
            </h2>
          </div>

          {/* Main Layout: tabs + content */}
          <div className="w-full flex-1 flex flex-col min-[400px]:flex-row overflow-hidden px-2 gap-2">

            {/* Tab Navigation */}
            {/* Narrow screens: horizontal strip at top */}
            {/* Wide screens (>=400px): vertical sidebar on left */}
            <div className="journal-tabs-strip flex min-[400px]:flex-col gap-1 overflow-x-auto min-[400px]:overflow-x-visible min-[400px]:overflow-y-auto flex-shrink-0 min-[400px]:w-[120px] pb-1 min-[400px]:pb-0 min-[400px]:pr-1">
              {JOURNAL_PAGES.map(page => {
                const isUnlocked = unlockedPageIds.has(page.id);
                const isActive = page.id === selectedPageId;
                const IconComponent = ICON_MAP[page.icon];

                return (
                  <button
                    key={page.id}
                    onClick={() => handleTabClick(page)}
                    disabled={!isUnlocked}
                    className={`
                      flex items-center gap-2 min-[400px]:gap-2 px-3 py-2.5
                      min-w-[100px] min-[400px]:min-w-0 min-[400px]:w-full
                      rounded-lg border text-left transition-all
                      flex-shrink-0
                      ${isActive
                        ? 'bg-slate-800 border-green-600 text-slate-100'
                        : isUnlocked
                          ? 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-300'
                          : 'bg-slate-900/50 border-slate-800 text-slate-600 cursor-not-allowed opacity-50'
                      }
                    `}
                    style={{ minHeight: '44px' }}
                  >
                    <div className="relative flex-shrink-0">
                      {IconComponent && (
                        <IconComponent
                          className={`w-4 h-4 ${isActive ? 'text-green-400' : isUnlocked ? 'text-slate-500' : 'text-slate-700'}`}
                        />
                      )}
                      {!isUnlocked && (
                        <Lock className="w-3 h-3 text-slate-600 absolute -bottom-1 -right-1" />
                      )}
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider truncate">
                      {isUnlocked ? page.title : '???'}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto pb-28 scrollbar-hide">
              {isSelectedUnlocked ? (
                <div key={contentKey} className="journal-page-enter space-y-4 px-2">
                  {/* Page Title */}
                  <div className="flex items-center gap-3 mb-2">
                    {ICON_MAP[selectedPage.icon] && (
                      React.createElement(ICON_MAP[selectedPage.icon], {
                        className: 'w-6 h-6 text-green-400',
                      })
                    )}
                    <h3
                      className="text-xl font-bold text-slate-100 tracking-wide uppercase"
                      style={{ fontFamily: '"From Where You Are", cursive' }}
                    >
                      {selectedPage.title}
                    </h3>
                  </div>

                  {/* Sections */}
                  {selectedPage.sections.map((section, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 backdrop-blur-sm"
                    >
                      <h4 className="text-sm font-bold text-slate-200 uppercase tracking-wider mb-2">
                        {section.heading}
                      </h4>
                      <p className="text-slate-400 text-sm leading-relaxed">
                        {section.body}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center text-slate-600">
                    <Lock className="w-8 h-8 mx-auto mb-2" />
                    <p className="text-sm uppercase tracking-wider">Access restricted</p>
                    <p className="text-xs text-slate-700 mt-1">Continue operating to unlock</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Floating Bottom Button */}
          <div className="absolute bottom-8 left-0 right-0 flex justify-center z-20 pointer-events-none">
            <button
              onClick={onBack}
              className="pointer-events-auto flex items-center justify-center bg-green-700 hover:bg-green-600 text-black rounded-full shadow-[0_0_20px_rgba(21,128,61,0.4)] transition-all active:scale-95 border border-green-500/30"
              style={{
                width: 'min(13.2vw, 7.4vh)',
                height: 'min(13.2vw, 7.4vh)',
              }}
            >
              <ChevronLeft className="w-1/2 h-1/2 stroke-[3]" />
            </button>
          </div>

          {/* Bottom Gradient Fade */}
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-slate-950 to-transparent pointer-events-none z-10" />
        </div>
      </div>
    </div>
  );
};
