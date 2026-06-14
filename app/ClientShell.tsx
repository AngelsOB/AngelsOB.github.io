'use client';

import Toaster from "../src/components/Toaster";
import AuthProvider from "../src/modules/auth/components/AuthProvider";
import { useSrmTheme } from "../src/hooks/useSrmTheme";
import HSThemeWrapper from "../src/modules/builder/components/HSThemeWrapper";
import ImportRecipeFlow from "../src/modules/builder/components/ImportRecipeFlow";
import FeedbackModal from "../src/modules/feedback/FeedbackModal";

export default function ClientShell({
  children,
}: {
  children: React.ReactNode;
}) {
  useSrmTheme();

  return (
    <AuthProvider>
      <HSThemeWrapper>{children}</HSThemeWrapper>
      <ImportRecipeFlow />
      <FeedbackModal />
      <Toaster />
    </AuthProvider>
  );
}
