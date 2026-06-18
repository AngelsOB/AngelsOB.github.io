"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import CalculatorsSidebar from "./CalculatorsSidebar";
import PageTransition from "./PageTransition";

/**
 * The section's two-column grid. The sidebar is ALWAYS mounted (so navigation
 * never remounts it — that was the lag source). On the /calculators directory
 * we only add a class that collapses the grid to one column and CSS-hides the
 * sidebar, so the cards go full-width with the double-listing gone. Navigation
 * stays plain/native — nothing is intercepted.
 */
export default function CalculatorsGrid({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const isDirectory = pathname === "/calculators";

  return (
    <div className={`hs-calc-layout${isDirectory ? " is-directory" : ""}`}>
      <PageTransition>{children}</PageTransition>
      <CalculatorsSidebar />
    </div>
  );
}
