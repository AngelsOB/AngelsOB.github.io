import type { Metadata } from "next";
import SessionRedirectClient from "./SessionRedirectClient";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

export default async function SessionPage({ params }: PageProps) {
  const { sessionId } = await params;
  return <SessionRedirectClient sessionId={sessionId} />;
}
