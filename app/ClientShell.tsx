'use client';

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

import Toaster from "../src/components/Toaster";
import AuthProvider from "../src/modules/auth/components/AuthProvider";
import { useSrmTheme } from "../src/hooks/useSrmTheme";
import HSThemeWrapper from "../src/modules/builder/components/HSThemeWrapper";
import FeedbackModal from "../src/modules/feedback/FeedbackModal";
import { useImportStore } from "../src/modules/recipe/stores/importStore";

// The import flow pulls the full ~100KB hop+yeast preset library (via its parse
// services). It's rarely used but was mounted on EVERY page, so that dataset
// rode in the global first-load JS sitewide. Load it only once the user first
// opens import — then keep it mounted (it owns the post-parse review sheet).
const ImportRecipeFlow = dynamic(
  () => import("../src/modules/builder/components/ImportRecipeFlow"),
  { ssr: false }
);

export default function ClientShell({
  children,
}: {
  children: React.ReactNode;
}) {
  useSrmTheme();

  const isImportOpen = useImportStore((s) => s.isOpen);
  const [importMounted, setImportMounted] = useState(false);
  useEffect(() => {
    if (isImportOpen) setImportMounted(true);
  }, [isImportOpen]);

  return (
    <AuthProvider>
      <HSThemeWrapper>{children}</HSThemeWrapper>
      {importMounted ? <ImportRecipeFlow /> : null}
      <FeedbackModal />
      <Toaster />
    </AuthProvider>
  );
}
