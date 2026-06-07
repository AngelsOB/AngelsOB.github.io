import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Credits",
  description:
    "Where Brewing.It's ingredient data comes from, and the projects behind it.",
  alternates: { canonical: "/credits" },
  openGraph: {
    title: "Credits | Brewing.It",
    description:
      "Where Brewing.It's ingredient data comes from, and the projects behind it.",
  },
  twitter: {
    card: "summary",
    title: "Credits | Brewing.It",
    description:
      "Where Brewing.It's ingredient data comes from, and the projects behind it.",
  },
};

export default function CreditsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8 brew-animate-in">
      <h1
        className="text-3xl font-bold mb-2"
        style={{ fontFamily: "'Bitter', serif", color: "var(--fg-strong)" }}
      >
        Credits
      </h1>
      <p className="text-sm mb-10" style={{ color: "var(--fg-muted)" }}>
        Where the data comes from, and the projects behind it.
      </p>

      <div className="prose-sm space-y-6" style={{ color: "var(--fg-muted)" }}>
        <Section title="Hop data">
          <p>
            The hop facts in the builder &mdash; alpha and beta acids, total oil,
            cohumulone, and country of origin &mdash; come from the{" "}
            <a
              href="https://github.com/kasperg3/HopDatabase"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--coral-500)] hover:underline"
            >
              HopDatabase
            </a>{" "}
            project by Kasper Andreas Rømer Grøntved. It pulls together specs that
            hop growers publish themselves, including Yakima Chief Hops, BarthHaas,
            Crosby Hops, and Hopsteiner. We use it under the MIT License.
          </p>
        </Section>

        <Section title="Hop flavor profiles">
          <p>
            The flavor radar &mdash; citrus, tropical fruit, stone fruit, and so
            on &mdash; is our own work. We&apos;d hand-rated a core set of hops
            already. For the rest, we started from the growers&apos; published
            aroma data and adjusted it toward how they actually describe each hop.
          </p>
          <p>
            One honest caveat: these are estimates, not lab numbers. Hop flavor is
            subjective, and even the big references disagree with each other. Treat
            them as a solid starting point, not gospel.
          </p>
        </Section>

        <Section title="Grain">
          <p>Grain specifications are compiled from maltster published data.</p>
        </Section>

        <Section title="Yeast">
          <p>
            Yeast facts &mdash; attenuation, temperature range, flocculation,
            type, form, and alcohol tolerance &mdash; are compiled from the
            producers&apos; own published data: Escarpment Labs, White Labs,
            Wyeast, Fermentis/Lallemand, Imperial Yeast, Omega Yeast, and
            Mangrove Jack&apos;s. We reproduce only the factual specs, not the
            producers&apos; written descriptions.
          </p>
        </Section>

        <Section title="Yeast strain matching">
          <p>
            The &ldquo;same strain, other labs&rdquo; groupings and substitute
            suggestions are built from the homebrew community&apos;s
            strain-equivalence work &mdash; dmtaylor&apos;s Yeast Master chart,
            the suregork genome analysis, and the Mr. Malty strain chart &mdash;
            informed by published brewing-yeast genomics (Gallone et al., 2016).
          </p>
          <p>
            We compiled these into our own dataset. Honest caveat: which
            commercial products are genetically &ldquo;the same strain&rdquo; is
            partly inference, not lab-verified identity, so treat substitutes as
            well-informed suggestions, not certainties.
          </p>
        </Section>

        <Section title="Built with">
          <p>
            Brewing.It runs on Next.js, React, and Firebase, plus a pile of other
            open-source libraries. Thanks to everyone who maintains them.
          </p>
        </Section>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2
        className="text-lg font-bold mb-2"
        style={{ fontFamily: "'Bitter', serif", color: "var(--fg-strong)" }}
      >
        {title}
      </h2>
      <div className="space-y-2 text-sm leading-relaxed">{children}</div>
    </section>
  );
}
