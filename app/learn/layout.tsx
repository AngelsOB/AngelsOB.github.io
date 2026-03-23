import "katex/dist/katex.min.css";
import type { Metadata } from "next";
import LearnNav from "@/modules/learn/LearnNav";

export const metadata: Metadata = {
  title: {
    template: "%s | BeerApp Learn",
    default: "Learn Brewing Science | BeerApp",
  },
};

export default function LearnLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <div className="flex gap-10">
        <LearnNav />
        <main className="min-w-0 flex-1 pb-16">{children}</main>
      </div>
    </div>
  );
}
