import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Section definitions for the sidebar.
 * Each maps to a brew-section[data-accent] on the page.
 * Colors are bold and saturated, inspired by therawmaterials.com sidebar.
 */
const SECTIONS = [
  { id: 'recipe-info', accent: 'recipe',       label: 'Recipe',       shortLabel: 'Rec.',   number: '01', bg: 'var(--sidebar-recipe-bg)',       text: 'var(--sidebar-recipe-text)'       },
  { id: 'equipment',   accent: 'equipment',     label: 'Equipment',    shortLabel: 'Equip.', number: '02', bg: 'var(--sidebar-equipment-bg)',    text: 'var(--sidebar-equipment-text)'    },
  { id: 'grain',       accent: 'grain',         label: 'Fermentables', shortLabel: 'Grain',  number: '03', bg: 'var(--sidebar-grain-bg)',        text: 'var(--sidebar-grain-text)'        },
  { id: 'mash',        accent: 'mash',          label: 'Mash',         shortLabel: 'Mash',   number: '04', bg: 'var(--sidebar-mash-bg)',         text: 'var(--sidebar-mash-text)'         },
  { id: 'hops',        accent: 'hops',          label: 'Hops',         shortLabel: 'Hops',   number: '05', bg: 'var(--sidebar-hops-bg)',         text: 'var(--sidebar-hops-text)'         },
  { id: 'yeast',       accent: 'yeast',         label: 'Yeast',        shortLabel: 'Yeast',  number: '06', bg: 'var(--sidebar-yeast-bg)',        text: 'var(--sidebar-yeast-text)'        },
  { id: 'water',       accent: 'water',         label: 'Water',        shortLabel: 'Water',  number: '07', bg: 'var(--sidebar-water-bg)',        text: 'var(--sidebar-water-text)'        },
  { id: 'fermentation',accent: 'fermentation',  label: 'Fermentation', shortLabel: 'Ferm.',  number: '08', bg: 'var(--sidebar-fermentation-bg)', text: 'var(--sidebar-fermentation-text)' },
  { id: 'checklist',   accent: 'checklist',     label: 'Checklist',    shortLabel: 'Check',  number: '09', bg: 'var(--sidebar-checklist-bg)',    text: 'var(--sidebar-checklist-text)'    },
] as const;

/** Expanded height for the active sidebar item */
const EXPANDED_HEIGHT = 320;
/** Padding inside each item where the dot can travel */
const DOT_PAD_TOP = 11;
const DOT_PAD_BOTTOM = 32; // leave room for the label

export default function SectionSidebar() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [dotProgress, setDotProgress] = useState(0); // 0..1 scroll progress within active section
  const sidebarRef = useRef<HTMLElement>(null);
  const isClickScrolling = useRef(false);
  const clickTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Find all brew-section elements on the page by data-accent.
   * First brew-section (the metadata card) maps to "Recipe".
   */
  const getSectionElements = useCallback((): HTMLElement[] => {
    const elements: HTMLElement[] = [];

    const allSections = document.querySelectorAll<HTMLElement>('.brew-section');
    if (allSections.length > 0) {
      elements.push(allSections[0]); // Recipe info is always first
    }

    const accentOrder = ['equipment', 'grain', 'mash', 'hops', 'yeast', 'water', 'fermentation', 'checklist'];
    for (const accent of accentOrder) {
      const el = document.querySelector<HTMLElement>(`.brew-section[data-accent="${accent}"]`);
      if (el) elements.push(el);
    }

    return elements;
  }, []);

  /**
   * Core scroll handler: determines active section + scroll progress within it.
   * The dot acts as a mini-scrollbar within the active section's tile.
   */
  const handleScroll = useCallback(() => {
    if (isClickScrolling.current) return;

    const sections = getSectionElements();
    if (sections.length === 0) return;

    const viewportHeight = window.innerHeight;
    const scrollY = window.scrollY;
    const docHeight = document.documentElement.scrollHeight;
    // How close to the bottom of the page we are (0 = top, 1 = at bottom)
    const bottomProximity = docHeight > viewportHeight
      ? scrollY / (docHeight - viewportHeight)
      : 0;
    // Trigger line sits near the bottom of the viewport (~80%) so sections
    // activate as soon as they scroll into view. Shifts toward 100% at page end
    // so the final sections can still activate.
    const triggerLine = viewportHeight * (0.52 + 0.2 * Math.pow(bottomProximity, 2));

    let bestIndex = 0;
    let bestScore = -Infinity;

    sections.forEach((section, i) => {
      const rect = section.getBoundingClientRect();
      const visibleTop = Math.max(0, rect.top);
      const visibleBottom = Math.min(viewportHeight, rect.bottom);
      const visibleHeight = Math.max(0, visibleBottom - visibleTop);
      const visibilityRatio = rect.height > 0 ? visibleHeight / Math.min(rect.height, viewportHeight) : 0;
      const distFromTrigger = Math.abs(rect.top - triggerLine);
      const proximityScore = 1 / (1 + distFromTrigger / viewportHeight);
      const passedBonus = (rect.top <= triggerLine && rect.bottom > triggerLine) ? 0.3 : 0;
      const score = visibilityRatio * 0.3 + proximityScore * 0.4 + passedBonus;

      if (score > bestScore && visibleHeight > 20) {
        bestScore = score;
        bestIndex = i;
      }
    });

    setActiveIndex(bestIndex);

    // Calculate scroll progress within the active section.
    // The dot always moves with scroll regardless of section size.
    // Uses the trigger line as the reference point: progress = 0 when section top
    // is at the trigger line, progress = 1 when section bottom is at the trigger line.
    const activeSection = sections[bestIndex];
    if (activeSection) {
      const rect = activeSection.getBoundingClientRect();
      const sectionHeight = rect.height;
      // When section.top == triggerLine → progress = 0 (just entered)
      // When section.bottom == triggerLine (i.e. section.top == triggerLine - sectionHeight) → progress = 1
      const progress = sectionHeight > 0
        ? (triggerLine - rect.top) / sectionHeight
        : 0;
      setDotProgress(Math.max(0, Math.min(1, progress)));
    }
  }, [getSectionElements]);

  /** Scroll listener */
  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  /** Auto-scroll the sidebar to keep the active item centered */
  const prevActiveRef = useRef(0);
  useEffect(() => {
    if (activeIndex < 0 || !sidebarRef.current) return;

    const sidebar = sidebarRef.current;
    const items = sidebar.querySelectorAll<HTMLElement>('.section-sidebar-item');
    const activeItem = items[activeIndex];
    if (!activeItem) return;

    // Use instant scroll for large jumps (>2 sections), smooth for nearby transitions
    const jump = Math.abs(activeIndex - prevActiveRef.current);
    prevActiveRef.current = activeIndex;
    const behavior = jump > 2 ? 'auto' as const : 'smooth' as const;

    // Small delay so the height style has been applied to the DOM
    const timer = setTimeout(() => {
      const sidebarHeight = sidebar.clientHeight;
      const itemTop = activeItem.offsetTop;
      const itemHeight = EXPANDED_HEIGHT;

      // Center the active item in the sidebar viewport
      const targetScroll = itemTop - (sidebarHeight / 2) + (itemHeight / 2);
      sidebar.scrollTo({ top: Math.max(0, targetScroll), behavior });
    }, 60);

    return () => clearTimeout(timer);
  }, [activeIndex]);

  /** Click handler: scroll to section */
  const handleClick = (index: number) => {
    const sections = getSectionElements();
    const target = sections[index];
    if (!target) return;

    isClickScrolling.current = true;
    if (clickTimeout.current) clearTimeout(clickTimeout.current);
    setActiveIndex(index);
    setDotProgress(0);

    const navHeight = 60;
    const targetTop = target.getBoundingClientRect().top + window.scrollY - navHeight;
    window.scrollTo({ top: targetTop, behavior: 'smooth' });

    clickTimeout.current = setTimeout(() => {
      isClickScrolling.current = false;
    }, 900);
  };

  /**
   * Calculate the dot's `top` position within the active tile.
   * It interpolates from DOT_PAD_TOP to (tileHeight - DOT_PAD_BOTTOM) based on scroll progress.
   */
  const getDotTop = (isActive: boolean): number => {
    if (!isActive) return DOT_PAD_TOP;
    const travelRange = EXPANDED_HEIGHT - DOT_PAD_TOP - DOT_PAD_BOTTOM;
    return DOT_PAD_TOP + travelRange * dotProgress;
  };

  return (
    <nav
      ref={sidebarRef}
      className="section-sidebar"
      aria-label="Recipe sections"
    >
      <div className="section-sidebar-track">
        {SECTIONS.map((section, i) => {
          const isActive = i === activeIndex;

          return (
            <button
              key={section.id}
              className={`section-sidebar-item${isActive ? ' is-active' : ''}`}
              style={{
                backgroundColor: section.bg,
                '--sidebar-accent': section.bg,
                height: isActive ? `${EXPANDED_HEIGHT}px` : undefined,
              } as React.CSSProperties}
              onClick={() => handleClick(i)}
              aria-current={isActive ? 'true' : undefined}
              title={section.label}
            >
              <span className="section-sidebar-number" style={{ color: section.text }}>
                {section.number}
              </span>
              <span
                className="section-sidebar-dot"
                style={{
                  backgroundColor: section.text,
                  top: `${getDotTop(isActive)}px`,
                  opacity: isActive ? 1 : 0,
                  transform: isActive ? 'scale(1)' : 'scale(0)',
                }}
              />
              <span className="section-sidebar-label" style={{ color: section.text }}>
                <span className="section-sidebar-label-full">{section.label}</span>
                <span className="section-sidebar-label-short">{section.shortLabel}</span>
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
