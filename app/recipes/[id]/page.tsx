import HopSkipBuilder from "@/modules/hopskip/components/HopSkipBuilder";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  return <HopSkipBuilder recipeId={id} />;
}
