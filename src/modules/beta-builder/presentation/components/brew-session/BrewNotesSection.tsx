import { SectionCard } from './SectionCard';

interface BrewNotesSectionProps {
  notes: string | undefined;
  onNotesChange: (notes: string) => void;
}

export function BrewNotesSection({
  notes,
  onNotesChange,
}: BrewNotesSectionProps) {
  return (
    <SectionCard title="Brew Notes" tone="slate">
      <h2 className="text-xl font-semibold mb-4">Brew Notes</h2>
      <textarea
        value={notes || ''}
        onChange={(e) => onNotesChange(e.target.value)}
        placeholder="Notes about this brew day..."
        className="w-full h-32 px-3 py-2 border border-[rgb(var(--border))] rounded-md bg-[var(--bg)] resize-none"
      />
    </SectionCard>
  );
}
