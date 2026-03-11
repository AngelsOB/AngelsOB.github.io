import type { ReactNode } from 'react';

interface InstructionStepProps {
  number: number;
  title: string;
  children: ReactNode;
}

export function InstructionStep({
  number,
  title,
  children,
}: InstructionStepProps) {
  return (
    <div className="rounded-lg border border-[rgb(var(--border))] bg-[var(--card)] p-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-7 h-7 rounded-full bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center">
          {number}
        </div>
        <div className="text-sm font-semibold text-gray-700 dark:text-gray-200">{title}</div>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
