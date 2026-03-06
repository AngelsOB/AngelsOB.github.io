/**
 * PresetPickerModal Component
 *
 * A reusable modal shell for selecting items from a preset database.
 * Used by FermentableSection, HopSection, and YeastSection.
 *
 * Features:
 * - Accessible modal with focus trapping via ModalOverlay
 * - Search input with autofocus
 * - Collapsible advanced filters section
 * - Scrollable grouped preset list
 * - Footer with count and custom creation button
 */

import { useId } from "react";
import ModalOverlay from "./ModalOverlay";

interface PresetGroup<T> {
  label: string;
  items: T[];
}

interface PresetPickerModalProps<T> {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  searchPlaceholder: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  showFilters: boolean;
  onToggleFilters: () => void;
  filterContent?: React.ReactNode;
  groups: PresetGroup<T>[];
  isLoading: boolean;
  emptyMessage: string;
  renderItem: (item: T, group: PresetGroup<T>) => React.ReactNode;
  totalCount: number;
  countLabel: string;
  onCreateCustom: () => void;
  /** @deprecated No longer used — unified accent theme */
  colorScheme?: string;
  /** Additional content to render outside the modal (e.g., portaled tooltips) */
  portalContent?: React.ReactNode;
}

const filterIconSvg = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>
);

export default function PresetPickerModal<T>({
  isOpen,
  onClose,
  title,
  searchPlaceholder,
  searchQuery,
  onSearchChange,
  showFilters,
  onToggleFilters,
  filterContent,
  groups,
  isLoading,
  emptyMessage,
  renderItem,
  totalCount,
  countLabel,
  onCreateCustom,
  portalContent,
}: PresetPickerModalProps<T>) {
  const titleId = useId();

  return (
    <>
      <ModalOverlay
        isOpen={isOpen}
        onClose={onClose}
        size="3xl"
        labelledById={titleId}
      >
        {/* Modal Header */}
        <div className="p-6 border-b border-[rgb(var(--brew-border-subtle))]">
          <div className="flex justify-between items-center mb-4">
            <h3 id={titleId} className="brew-section-title">
              {title}
            </h3>
            <button
              onClick={onClose}
              className="text-[var(--fg-muted)] hover:text-[var(--fg-strong)] text-2xl transition-colors"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          {/* Search */}
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="brew-input flex-1"
              autoFocus
              data-autofocus
            />
            {filterContent && (
              <button
                onClick={onToggleFilters}
                className={showFilters ? "brew-chip-active px-3 py-2 rounded-lg" : "brew-chip px-3 py-2 rounded-lg"}
                title="Toggle Filters"
                aria-expanded={showFilters}
                aria-label="Toggle filters"
              >
                {filterIconSvg}
              </button>
            )}
          </div>

          {/* Advanced Filters */}
          {showFilters && filterContent && (
            <div className="space-y-3 mb-3 animate-in fade-in slide-in-from-top-1 duration-200">
              {filterContent}
            </div>
          )}
        </div>

        {/* Modal Body - Scrollable List */}
        <div className="flex-1 overflow-y-auto pb-4">
          {isLoading ? (
            <p className="text-muted px-6 py-8">
              Loading presets...
            </p>
          ) : groups.length === 0 ? (
            <p className="text-muted px-6 py-8 text-center">
              {emptyMessage}
            </p>
          ) : (
            <div className="space-y-6">
              {groups.map((group) => (
                <div key={group.label}>
                  <h4 className="text-sm font-bold uppercase sticky top-0 z-10 backdrop-blur-md px-6 py-2 border-b border-[rgb(var(--brew-border-subtle))]" style={{ letterSpacing: 'var(--brew-tracking-wide)', background: 'color-mix(in oklch, var(--brew-accent-600) 15%, rgb(var(--brew-card) / 0.9))' }}>
                    {group.label}
                  </h4>
                  <div className="grid gap-1.5 px-6 pt-2 pb-1">
                    {group.items.map((item, index) => (
                      <div key={index}>{renderItem(item, group)}</div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-[rgb(var(--brew-border-subtle))] flex justify-between items-center">
          <div className="text-sm text-muted">
            {totalCount} {countLabel}
          </div>
          <button
            onClick={onCreateCustom}
            className="brew-btn-primary text-sm"
          >
            + Create Custom
          </button>
        </div>
      </ModalOverlay>

      {/* Portal content (e.g., tooltips) rendered outside the modal */}
      {isOpen && portalContent}
    </>
  );
}
