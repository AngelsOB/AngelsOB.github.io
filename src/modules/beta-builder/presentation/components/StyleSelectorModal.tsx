'use client';

/**
 * Style Selector Modal Component
 *
 * Modal for selecting BJCP beer styles with:
 * - Search by style name or code
 * - Grouped by category
 * - Similar UX to fermentable/hop modals
 */

import { useState, useMemo } from "react";
import { getBjcpCategories } from "../../../../utils/bjcp";
import type { BjcpStyle } from "../../../../utils/bjcp";
import ModalOverlay from "./ModalOverlay";

type StyleSelectorModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (style: string) => void;
  currentStyle?: string;
};

export default function StyleSelectorModal({
  isOpen,
  onClose,
  onSelect,
  currentStyle,
}: StyleSelectorModalProps) {
  const [searchQuery, setSearchQuery] = useState("");

  // Get all categories
  const categories = getBjcpCategories();

  // Filter categories and styles by search query
  const filteredCategories = useMemo(() => {
    if (!searchQuery) return categories;

    const query = searchQuery.toLowerCase();
    return categories
      .map((cat) => ({
        ...cat,
        styles: cat.styles.filter(
          (style) =>
            style.name.toLowerCase().includes(query) ||
            style.code.toLowerCase().includes(query) ||
            cat.name.toLowerCase().includes(query)
        ),
      }))
      .filter((cat) => cat.styles.length > 0);
  }, [searchQuery, categories]);

  const handleSelect = (style: BjcpStyle) => {
    onSelect(`${style.code}. ${style.name}`);
    onClose();
    setSearchQuery("");
  };

  const handleClear = () => {
    onSelect("");
    onClose();
    setSearchQuery("");
  };

  return (
    <ModalOverlay isOpen={isOpen} onClose={onClose} size="3xl">
        {/* Header */}
        <div className="border-b border-[rgb(var(--brew-border-subtle))] px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-semibold">Select BJCP Style</h2>
            <button
              onClick={onClose}
              className="text-[var(--fg-muted)] hover:text-[var(--fg-strong)] transition-colors"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Search */}
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search styles by name or code..."
            className="brew-input w-full"
            autoFocus
            data-autofocus
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto pb-4">
          {currentStyle && (
            <div className="mb-4 mx-6 mt-4 flex items-center justify-between p-3 rounded-lg backdrop-blur-sm" style={{ background: 'color-mix(in oklch, var(--brew-info) 8%, rgb(var(--brew-card) / 0.5))', border: '1px solid color-mix(in oklch, var(--brew-info) 20%, transparent)' }}>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--brew-info)' }}>Current Style:</p>
                <p>{currentStyle}</p>
              </div>
              <button
                onClick={handleClear}
                className="brew-danger-text px-3 py-1 text-sm rounded-lg transition-colors"
                style={{ background: 'color-mix(in oklch, var(--brew-danger) 10%, transparent)', border: '1px solid color-mix(in oklch, var(--brew-danger) 20%, transparent)' }}
              >
                Clear Style
              </button>
            </div>
          )}

          {filteredCategories.length === 0 ? (
            <div className="text-center py-8 px-6 text-muted">
              No styles found matching "{searchQuery}"
            </div>
          ) : (
            <div className="space-y-6">
              {filteredCategories.map((category) => (
                <div key={category.code}>
                  {/* Category Header */}
                  <h3 
                    className="text-sm font-semibold mb-2 sticky top-0 px-6 py-2 border-b border-[rgb(var(--brew-border-subtle))] z-10 shadow-sm" 
                    style={{ 
                      backgroundColor: 'rgb(var(--brew-card))', 
                      background: 'color-mix(in oklch, var(--brew-accent-500) 15%, rgb(var(--brew-card)))' 
                    }}
                  >
                    {category.code}. {category.name}
                  </h3>

                  {/* Styles Grid */}
                  <div className="grid grid-cols-1 gap-2 px-6">
                    {category.styles.map((style) => {
                      const styleString = `${style.code}. ${style.name}`;
                      const isSelected = currentStyle === styleString;

                      return (
                        <button
                          key={style.code}
                          onClick={() => handleSelect(style)}
                          className={
                            isSelected
                              ? "w-full text-left px-4 py-2.5 rounded-lg transition-all duration-150 bg-[var(--brew-accent-500)] text-white border border-[var(--brew-accent-600)] shadow-md"
                              : "brew-picker-row"
                          }
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-semibold">{style.code}</span>
                              <span className="ml-2">{style.name}</span>
                            </div>
                            {isSelected && (
                              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[rgb(var(--brew-border-subtle))] px-6 py-4">
          <div className="flex gap-3 justify-end">
            <button
              onClick={onClose}
              className="brew-btn-ghost"
            >
              Cancel
            </button>
            {!currentStyle && (
              <button
                onClick={handleClear}
                className="brew-btn-ghost"
              >
                No Style (Clear)
              </button>
            )}
          </div>
        </div>
    </ModalOverlay>
  );
}
