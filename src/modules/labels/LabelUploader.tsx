'use client';

import React, { useCallback, useRef, useState } from 'react';
import { useRecipeStore } from '../beta-builder/presentation/stores/recipeStore';

interface LabelUploaderProps {
  labelUrl?: string;
  isReadOnly?: boolean;
  onSpawnCan?: () => void;
}

export default function LabelUploader({ labelUrl, isReadOnly, onSpawnCan }: LabelUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const uploadLabel = useRecipeStore((s) => s.uploadLabel);
  const removeLabel = useRecipeStore((s) => s.removeLabel);

  const handleFile = useCallback(
    async (file: File) => {
      setIsUploading(true);
      try {
        await uploadLabel(file);
      } finally {
        setIsUploading(false);
      }
    },
    [uploadLabel],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      // Reset so the same file can be re-selected
      e.target.value = '';
    },
    [handleFile],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file?.type.startsWith('image/')) handleFile(file);
    },
    [handleFile],
  );

  const handleRemove = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsUploading(true);
      try {
        await removeLabel();
      } finally {
        setIsUploading(false);
      }
    },
    [removeLabel],
  );

  // Read-only: just show the image (or nothing)
  if (isReadOnly) {
    if (!labelUrl) return null;
    return (
      <div className="flex justify-center">
        <img
          src={labelUrl}
          alt="Beer label"
          className="max-h-48 rounded-xl object-contain"
          loading="lazy"
        />
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={handleChange}
      />

      {labelUrl ? (
        /* Has label — show preview with overlay actions */
        <div
          className="group relative flex cursor-pointer justify-center"
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
        >
          <img
            src={labelUrl}
            alt="Beer label"
            className="max-h-48 rounded-xl object-contain transition-opacity group-hover:opacity-70"
            loading="lazy"
          />
          {/* Hover overlay */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-3 rounded-xl opacity-0 transition-opacity group-hover:opacity-100">
            <span className="brew-tag bg-[rgb(var(--brew-surface))]/80 text-xs font-medium backdrop-blur-sm">
              Replace
            </span>
            <button
              className="brew-tag bg-red-500/80 text-xs font-medium text-white backdrop-blur-sm pointer-events-auto"
              onClick={handleRemove}
            >
              Remove
            </button>
            {onSpawnCan && (
              <button
                className="brew-tag bg-[rgb(var(--brew-accent-400))]/80 text-xs font-medium text-white backdrop-blur-sm pointer-events-auto"
                onClick={(e) => { e.stopPropagation(); onSpawnCan(); }}
              >
                Spawn Can
              </button>
            )}
          </div>
        </div>
      ) : (
        /* No label — show upload zone */
        <button
          type="button"
          className={
            'flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 transition-colors ' +
            (isDragging
              ? 'border-[rgb(var(--brew-accent-400))] bg-[rgb(var(--brew-accent-400))]/10'
              : 'border-[rgb(var(--brew-border))] hover:border-[rgb(var(--brew-accent-400))] hover:bg-[rgb(var(--brew-surface))]/50')
          }
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          {/* Upload icon */}
          <svg className="h-8 w-8 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          <span className="text-muted text-sm">Upload a beer label</span>
          <span className="text-muted/60 text-xs">PNG, JPG, or WebP</span>
        </button>
      )}

      {/* Upload spinner overlay */}
      {isUploading && (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-[rgb(var(--brew-surface))]/80 backdrop-blur-sm">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[rgb(var(--brew-accent-400))] border-t-transparent" />
        </div>
      )}
    </div>
  );
}
