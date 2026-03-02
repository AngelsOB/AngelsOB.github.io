import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { Recipe, RecipeCalculations } from '../../domain/models/Recipe';

interface SectionSidebarProps {
  recipe: Recipe | null;
  calculations: RecipeCalculations | null;
}

/** Bold wrapper for numeric values in scribble lines */
const B = ({ children }: { children: React.ReactNode }) => <strong>{children}</strong>;

/**
 * Generate handwritten "margin scribble" lines for each sidebar section.
 * Returns an array of ReactNodes. All numbers are wrapped in <strong> for emphasis.
 */
function getScribbleLines(
  accent: string,
  recipe: Recipe | null,
  calculations: RecipeCalculations | null,
): React.ReactNode[] {
  if (!recipe) return [];

  switch (accent) {
    case 'recipe': {
      if (!calculations) return [];
      const lines: React.ReactNode[] = [];
      if (calculations.og > 1) lines.push(<>OG <B>{calculations.og.toFixed(3)}</B> · <B>{calculations.abv.toFixed(1)}</B>% ABV</>);
      if (calculations.ibu > 0) lines.push(<><B>{Math.round(calculations.ibu)}</B> IBU · <B>{calculations.srm.toFixed(1)}</B> SRM</>);
      return lines;
    }
    case 'equipment': {
      const eq = recipe.equipment;
      const batchVol = recipe.batchVolumeL;
      return [
        <span className="sidebar-scribble-equipment">
          <span className="sidebar-equip-batch"><B>{batchVol}</B>L batch</span>
          {calculations && (
            <span className="sidebar-equip-volumes">
              <span>mash <B>{calculations.mashWaterL.toFixed(1)}</B>L</span>
              <span>sparge <B>{calculations.spargeWaterL.toFixed(1)}</B>L</span>
            </span>
          )}
        </span>,
        <><B>{eq.boilTimeMin}</B> min boil · <B>{eq.mashEfficiencyPercent}</B>% eff</>,
      ];
    }
    case 'grain': {
      if (recipe.fermentables.length === 0) return [];
      const totalKg = recipe.fermentables.reduce((s, f) => s + f.weightKg, 0);
      if (totalKg === 0) return [];
      const sorted = [...recipe.fermentables].sort((a, b) => b.weightKg - a.weightKg);
      return sorted.map(f => {
        const pct = Math.round((f.weightKg / totalKg) * 100);
        const shortName = f.name.includes(' - ') ? f.name.split(' - ').slice(1).join(' - ') : f.name;
        return <>{shortName} <B>{pct}%</B></>;
      });
    }
    case 'mash': {
      if (recipe.mashSteps.length === 0) return [];
      return recipe.mashSteps.map(s => <><B>{s.temperatureC}</B>°C · <B>{s.durationMinutes}</B>min</>);
    }
    case 'hops': {
      if (recipe.hops.length === 0) return [];
      // Sort by brew-day addition order: FW → boil (desc time) → WP → DH → mash
      const typeOrder: Record<string, number> = { 'first wort': 0, 'boil': 1, 'whirlpool': 2, 'dry hop': 3, 'mash': 4 };
      const sorted = [...recipe.hops].sort((a, b) => {
        const oa = typeOrder[a.type] ?? 5;
        const ob = typeOrder[b.type] ?? 5;
        if (oa !== ob) return oa - ob;
        // Within boil, sort by time descending (60m before 15m)
        if (a.type === 'boil') return (b.timeMinutes ?? 0) - (a.timeMinutes ?? 0);
        return 0;
      });
      // Group hops by their addition label
      const additionLabel = (h: Recipe['hops'][number]) => {
        if (h.type === 'boil') return `@${h.timeMinutes ?? 0}m`;
        if (h.type === 'dry hop') return 'DH';
        if (h.type === 'whirlpool') return 'WP';
        if (h.type === 'first wort') return 'FW';
        if (h.type === 'mash') return 'Mash';
        return '';
      };
      // Group consecutive hops with the same addition label
      const groups: { label: string; hops: typeof sorted }[] = [];
      for (const h of sorted) {
        const lbl = additionLabel(h);
        const last = groups[groups.length - 1];
        if (last && last.label === lbl) {
          last.hops.push(h);
        } else {
          groups.push({ label: lbl, hops: [h] });
        }
      }
      // Render: hop names on left, shared addition label on right
      const lines: React.ReactNode[] = groups.map(g => (
        <span className="sidebar-scribble-hop-group">
          <span className="sidebar-hop-names">
            {g.hops.map((h, k) => <span key={k}>{h.name} <B>{h.grams}</B>g</span>)}
          </span>
          <span className="sidebar-hop-addition"><B>{g.label}</B></span>
        </span>
      ));
      // Total oz (bottom right) and IBU (bottom left, above "Hops" label)
      const totalG = sorted.reduce((s, h) => s + h.grams, 0);
      const totalOz = (totalG * 0.03527).toFixed(1);
      const ibu = calculations ? Math.round(calculations.ibu) : 0;
      lines.push(
        <span className="sidebar-hop-summary">
          <span className="sidebar-hop-ibu"><B>{ibu}</B> IBU</span>
          <span className="sidebar-hop-total">Total: <B>{totalOz}</B>oz</span>
        </span>
      );
      return lines;
    }
    case 'yeast': {
      if (recipe.yeasts.length === 0) return [];
      const y = recipe.yeasts[0];
      const att = Math.round(y.attenuation * 100);
      return [
        <span className="sidebar-scribble-yeast">
          {y.laboratory && <span className="sidebar-yeast-lab">{y.laboratory}</span>}
          <span>{y.name} · <B>{att}</B>% att</span>
        </span>,
      ];
    }
    case 'water': {
      const left: React.ReactNode[] = [];
      const right: React.ReactNode[] = [];
      if (recipe.waterChemistry) {
        const wc = recipe.waterChemistry;
        if (wc.sourceProfileName) left.push(<span key="profile">{wc.sourceProfileName}</span>);
        const { SO4, Cl } = wc.sourceProfile;
        if (Cl > 0) left.push(<span key="ratio">SO₄:Cl <B>{(SO4 / Cl).toFixed(1)}</B></span>);
        const sa = wc.saltAdditions;
        if (sa.gypsum_g) right.push(<span key="gypsum">Gypsum <B>{sa.gypsum_g}</B>g</span>);
        if (sa.cacl2_g) right.push(<span key="cacl2">CaCl₂ <B>{sa.cacl2_g}</B>g</span>);
        if (sa.epsom_g) right.push(<span key="epsom">Epsom <B>{sa.epsom_g}</B>g</span>);
        if (sa.nacl_g) right.push(<span key="nacl">NaCl <B>{sa.nacl_g}</B>g</span>);
        if (sa.nahco3_g) right.push(<span key="nahco3">Baking soda <B>{sa.nahco3_g}</B>g</span>);
      }
      const waterAgents = recipe.otherIngredients.filter(i => i.category === 'water-agent');
      for (const agent of waterAgents) {
        right.push(<span key={agent.id}>{agent.name} <B>{agent.amount}</B>{agent.unit}</span>);
      }
      if (left.length === 0 && right.length === 0) return [];
      return [
        <span className="sidebar-scribble-cols">
          <span className="sidebar-scribble-col-left">{left}</span>
          <span className="sidebar-scribble-col-right">{right}</span>
        </span>
      ];
    }
    case 'fermentation': {
      if (recipe.fermentationSteps.length === 0) return [];
      return recipe.fermentationSteps.map(s => <><B>{s.temperatureC}</B>°C · <B>{s.durationDays}</B>d</>);
    }
    default:
      return [];
  }
}

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

/** Padding inside each item where the dot can travel */
const DOT_PAD_TOP = 11;
const DOT_PAD_BOTTOM = 32; // leave room for the label

export default function SectionSidebar({ recipe, calculations }: SectionSidebarProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [dotProgress, setDotProgress] = useState(0); // 0..1 scroll progress within active section
  const sidebarRef = useRef<HTMLElement>(null);
  const isClickScrolling = useRef(false);
  const clickTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const activeHeightRef = useRef(320);

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

    // Measure the active tile's actual height for dot positioning
    const activeItem = itemRefs.current[bestIndex];
    if (activeItem) {
      activeHeightRef.current = activeItem.clientHeight || 320;
    }

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
      const itemHeight = activeItem.clientHeight || 320;

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
    const travelRange = activeHeightRef.current - DOT_PAD_TOP - DOT_PAD_BOTTOM;
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
          const scribbleLines = getScribbleLines(section.accent, recipe, calculations);

          return (
            <button
              key={section.id}
              ref={(el) => { itemRefs.current[i] = el; }}
              className={`section-sidebar-item${isActive ? ' is-active' : ''}`}
              style={{
                backgroundColor: section.bg,
                '--sidebar-accent': section.bg,
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
              {scribbleLines.length > 0 && (
                <span className="sidebar-scribble" style={{ color: section.text }}>
                  {scribbleLines.map((line, j) => {
                    // Pseudo-random per-line nudges for organic scribble feel
                    const seed = (j * 7 + i * 13) % 11;
                    const marginTop = seed % 3 === 0 ? 2 : seed % 3 === 1 ? -1 : 0;
                    return (
                      <span
                        key={j}
                        className="sidebar-scribble-line"
                        style={{
                          animationDelay: `${j * 40}ms`,
                          marginTop: `${marginTop}px`,
                        }}
                      >
                        {line}
                      </span>
                    );
                  })}
                </span>
              )}
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
