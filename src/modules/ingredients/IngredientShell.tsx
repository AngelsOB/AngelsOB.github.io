"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import IngredientMasthead from "./IngredientMasthead";
import type { IngredientSection } from "./types";

/**
 * Section container. Shows the big masthead on the index only and wraps every
 * page in the shared max-width gutter. The category sidebar is NOT rendered
 * here — each page lays out its own header + (body | sidebar) grid so the
 * sticky sidebar lines up with that page's visualizer.
 */
export default function IngredientShell({
  section,
  children,
}: {
  section: IngredientSection;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const isIndex = pathname === `/${section.basePath}`;

  return (
    <main>
      {isIndex ? <IngredientMasthead section={section} /> : null}

      <section
        style={{
          maxWidth: 1600,
          margin: "0 auto",
          padding: isIndex
            ? "0 clamp(20px, 4vw, 56px) clamp(40px, 6vw, 96px)"
            : "clamp(26px, 3.5vw, 48px) clamp(20px, 4vw, 56px) clamp(40px, 6vw, 96px)",
        }}
      >
        {children}
      </section>
    </main>
  );
}
