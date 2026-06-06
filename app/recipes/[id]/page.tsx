import type { Metadata } from "next";
import HopSkipBuilder from "@/modules/hopskip/components/HopSkipBuilder";

export const dynamic = "force-dynamic";

// Auth-gated recipe editor — keep out of search indexes.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  return <HopSkipBuilder recipeId={id} />;
}
