'use client';

import Toaster from "../src/components/Toaster";
import AuthProvider from "../src/modules/auth/components/AuthProvider";
import { useSrmTheme } from "../src/hooks/useSrmTheme";
import HSThemeWrapper from "../src/modules/builder/components/HSThemeWrapper";

export default function ClientShell({
  children,
}: {
  children: React.ReactNode;
}) {
  useSrmTheme();

  return (
    <AuthProvider>
      <HSThemeWrapper>{children}</HSThemeWrapper>
      <Toaster />
    </AuthProvider>
  );
}
