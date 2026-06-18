import type { Metadata } from "next";
import { learnBreadcrumb } from "@/modules/learn/breadcrumbs";
import Link from "next/link";
import HSLearnArticle from "@/modules/builder/components/HSLearnArticle";
import {
  EquipmentMockup,
  FermentablesMockup,
  WaterChemMockup,
  MashMockup,
  BrewDayMockup,
} from "@/modules/builder/components/HSBuilderMockups";

export const metadata: Metadata = {
  title: "How To Use Brewing.It: Quick Start Guide",
  description:
    "A quick overview of how the Brewing.It recipe builder works: what it calculates, what you need to set up, and how to use it on brew day.",
  alternates: { canonical: "/learn/getting-started" },
  openGraph: {
    title: "How To Use Brewing.It: Quick Start Guide | Brewing.It Learn",
    description:
      "A quick overview of how the Brewing.It recipe builder works: what it calculates, what you need to set up, and how to use it on brew day.",
  },
  twitter: {
    card: "summary",
    title: "How To Use Brewing.It: Quick Start Guide | Brewing.It Learn",
    description:
      "A quick overview of how the Brewing.It recipe builder works: what it calculates, what you need to set up, and how to use it on brew day.",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "How To Use Brewing.It: Quick Start Guide",
  description:
    "A quick overview of the recipe builder: what it calculates, what matters, and how to use the numbers on brew day.",
  author: { "@type": "Organization", name: "Brewing.It" },
  publisher: { "@type": "Organization", name: "Brewing.It" },
  datePublished: "2026-03-23",
  dateModified: "2026-03-23",
  mainEntityOfPage: {
    "@type": "WebPage",
    "@id": `${process.env.NEXT_PUBLIC_BASE_URL || "https://brewing.it.com"}/learn/getting-started`,
  },
};

/** Visual mockup of the stat strip */
function StatStripPreview() {
  const stats = [
    { label: "ABV", value: "6.3%" },
    { label: "OG", value: "1.062" },
    { label: "FG", value: "1.014" },
    { label: "IBU", value: "46" },
    { label: "SRM", value: "9.2", color: true },
    { label: "CAL", value: "204" },
  ];

  return (
    <div
      className="my-8 rounded-2xl overflow-hidden"
      style={{
        boxShadow: "var(--shadow-card)",
        border:
          "1px solid color-mix(in oklch, var(--fg-strong) 8%, transparent)",
      }}
    >
      <div className="px-4 py-4 flex items-center justify-center gap-2 flex-wrap" style={{ background: "var(--card)" }}>
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="text-center px-3 py-2 rounded-xl min-w-[4.5rem]"
            style={{
              background: stat.color
                ? "linear-gradient(135deg, oklch(72% 0.12 55), oklch(68% 0.1 50))"
                : "color-mix(in oklch, var(--surface) 60%, transparent)",
              border: `1px solid color-mix(in oklch, var(--fg-strong) 6%, transparent)`,
            }}
          >
            <div
              className="text-[9px] font-bold uppercase tracking-widest mb-0.5"
              style={{ color: stat.color ? "white" : "var(--fg-muted)" }}
            >
              {stat.label}
            </div>
            <div
              className="text-lg font-black tabular-nums"
              style={{ color: stat.color ? "white" : "var(--fg-strong)" }}
            >
              {stat.value}
            </div>
          </div>
        ))}
      </div>
      <div
        className="px-5 py-2.5 text-center"
        style={{
          color: "var(--fg-muted)",
          fontFamily: "var(--hs-font-script)",
          fontSize: "0.85rem",
          background:
            "color-mix(in oklch, var(--surface) 50%, transparent)",
          borderTop:
            "1px solid color-mix(in oklch, var(--fg-strong) 5%, transparent)",
        }}
      >
        These update in real time as you build your recipe.
      </div>
    </div>
  );
}


export default function GettingStartedPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify([jsonLd, learnBreadcrumb("getting-started")]) }}
      />
      <HSLearnArticle
        title="How To Use Brewing.It"
        subtitle="A quick start guide to the recipe builder"
        relatedLearn={["/learn/ibu", "/learn/gravity", "/learn/mash-ph"]}
        ctaText="Start building a recipe"
      >
        {/* ── The short version ── */}
        <p className="text-base leading-relaxed">
          Add your grains, hops, and yeast. We calculate everything else: gravity, ABV, bitterness, color, mash pH, water volumes, nutrition,
          and more. Every number updates in real time as you change your recipe.
        </p>

        <StatStripPreview />

        {/* ── Set up your system first ── */}
        <h2
          id="set-up-your-system"
          className="text-xl font-bold mt-10 mb-4"
        >
          Set Up Your System First
        </h2>
        <p className="text-sm leading-relaxed mb-2">
          Before the numbers mean anything, the builder needs to know about
          your equipment. Three things matter most: <strong>batch size</strong>{" "}
          (how much finished beer you want to end up with), <strong>mash efficiency</strong>{" "}
          (how well your system extracts sugar, start at 70–75% if you&apos;re
          new), and <strong>boil time</strong>.
        </p>

        <EquipmentMockup />

        <div
          className="grain relative rounded-xl p-5 my-4"
          style={{
            background: `linear-gradient(135deg, color-mix(in oklch, var(--card) 95%, oklch(80% 0.08 30)), var(--card))`,
            border: "1px solid color-mix(in oklch, var(--fg-strong) 8%, transparent)",
          }}
        >
          {/* Diagonal red pen "Note!" — top-left, intersecting the corner */}
          <span
            className="absolute pointer-events-none select-none"
            style={{
              top: "-20px",
              left: "-2px",
              fontFamily: "var(--hs-font-script)",
              fontSize: "1.8rem",
              color: "var(--brew-danger, oklch(55% 0.2 25))",
              transform: "rotate(-12deg)",
              transformOrigin: "center center",
              opacity: 0.9,
              zIndex: 1,
              padding: "4px 10px",
            }}
          >
            Note!
          </span>
          <h3
            className="text-base font-bold mb-2"
          >
            Batch size = finished beer
          </h3>
          <p className="text-sm leading-relaxed" style={{ color: "var(--fg-muted)" }}>
            Most recipes and tools (including the BeerXML standard) define
            &ldquo;batch size&rdquo; as the volume going{" "}
            <em>into the fermenter</em>. We define it as how much{" "}
            <em>finished beer</em> you want to end up with. We then work
            backwards, adding fermenter loss and trub loss on top to calculate
            how much to actually brew.
          </p>
          <p className="text-sm leading-relaxed mt-2" style={{ color: "var(--fg-muted)" }}>
            In practice the difference is small (roughly 0.5L for most setups),
            but it&apos;s worth knowing. If you import a recipe where
            &ldquo;20L&rdquo; was meant as fermenter volume, your water
            calculations will be slightly higher than intended. Just adjust
            the batch size down after importing.
          </p>
        </div>

        <p className="text-sm leading-relaxed">
          If you consistently hit higher or lower OG than predicted, tweak your
          efficiency number. After 3–4 brews you&apos;ll have it dialed in.
          Advanced settings let you set boil-off rate, kettle deadspace, and
          other system-specific losses for more precise water volume
          calculations.
        </p>

        {/* ── Building a recipe ── */}
        <h2
          id="building-a-recipe"
          className="text-xl font-bold mt-10 mb-4"
        >
          Building a Recipe
        </h2>
        <p className="text-sm leading-relaxed mb-4">
          The builder walks you through 10 sections. You don&apos;t have to
          fill them all in. Just grains, hops, and yeast are enough to get
          useful numbers. The rest adds precision.
        </p>

        <div
          className="grain rounded-xl p-5 mb-6"
          style={{
            background: `linear-gradient(135deg, color-mix(in oklch, var(--card) 95%, oklch(80% 0.08 55)), var(--card))`,
            border: "1px solid color-mix(in oklch, var(--fg-strong) 8%, transparent)",
          }}
        >
          <div className="relative mb-2">
            <span
              style={{
                fontFamily: "var(--hs-font-script)",
                fontSize: "1.1rem",
                color: "var(--coral-600)",
                transform: "rotate(-1deg)",
                display: "inline-block",
              }}
            >
              Start here →
            </span>
          </div>
          <p className="text-sm leading-relaxed" style={{ color: "var(--fg-strong)" }}>
            <strong>Pick a BJCP style first.</strong> When you select a style
            (like &ldquo;American IPA&rdquo; or &ldquo;German Pilsner&rdquo;),
            the builder shows you the guidelines for that style: target ranges
            for OG, FG, IBU, SRM, and ABV. As you build your recipe, you can
            see at a glance whether your numbers fall within the style or
            not. It&apos;s like having guardrails. You know the boundaries
            you&apos;re working within, and you can choose to stay inside them
            or deliberately push past them.
          </p>
        </div>

        <FermentablesMockup />

        <p className="text-sm leading-relaxed mb-2">
          Your grain bill determines OG, color, and how fermentable the wort
          is. The mash schedule controls body and final gravity. Lower temps
          produce drier beer, higher temps produce fuller body.
        </p>

        <MashMockup />

        <p className="text-sm leading-relaxed mb-2">
          The{" "}
          <Link href="/learn/ibu" className="text-[var(--coral-500)] hover:underline font-medium">
            hops section
          </Link>{" "}
          calculates IBU and flavor profile from every addition type. The{" "}
          <Link href="/learn/yeast-starters" className="text-[var(--coral-500)] hover:underline font-medium">
            yeast section
          </Link>{" "}
          tells you if you need a starter based on your OG and package date.
        </p>

        <p className="text-sm leading-relaxed mb-2">
          If you want to dial in your water, the{" "}
          <Link href="/learn/water-chemistry" className="text-[var(--coral-500)] hover:underline font-medium">
            water chemistry section
          </Link>{" "}
          lets you set a source and target profile. Choose a BJCP style target
          or set custom ion levels, then hit <strong>Auto-Calculate</strong> and we solve for the optimal salt additions using a least-squares
          optimizer.
        </p>

        <WaterChemMockup />

        {/* ── On brew day ── */}
        <h2
          id="on-brew-day"
          className="text-xl font-bold mt-10 mb-4"
        >
          On Brew Day
        </h2>
        <p className="text-sm leading-relaxed mb-3">
          Everything the builder produces is a <strong>target</strong>, not a
          guarantee. Your OG might come in a few points high. Your pre-boil
          volume might be off by half a liter. That&apos;s normal. Brewing is
          a physical process and every system is a little different.
        </p>
        <p className="text-sm leading-relaxed mb-2">
          Think of it like cooking: a recipe gives you proportions and
          temperatures, but a good cook still tastes and adjusts. The same
          applies here. Measure your actual numbers and adapt.
        </p>

        <BrewDayMockup />

        <div
          className="grain rounded-xl p-5 my-6"
          style={{
            background: `linear-gradient(135deg, color-mix(in oklch, var(--card) 95%, oklch(80% 0.08 30)), var(--card))`,
            border:
              "1px solid color-mix(in oklch, var(--fg-strong) 8%, transparent)",
          }}
        >
          <h3
            className="text-base font-bold mb-2"
          >
            Measure → adjust → learn your system
          </h3>
          <div className="text-sm space-y-2" style={{ color: "var(--fg-muted)" }}>
            <p>
              <strong>Pre-boil gravity too high?</strong> Use the{" "}
              <Link href="/calculators/dilution" className="text-[var(--coral-500)] hover:underline font-medium">
                dilution calculator
              </Link>{" "}
              to figure out how much water to add.
            </p>
            <p>
              <strong>Pre-boil gravity too low?</strong> Use the{" "}
              <Link href="/calculators/boil-off" className="text-[var(--coral-500)] hover:underline font-medium">
                boil-off calculator
              </Link>{" "}
              to see how much longer to boil, or add DME.
            </p>
            <p>
              <strong>Consistently hitting different numbers than predicted?</strong>{" "}
              Adjust your mash efficiency in the equipment section. After 3–4
              brews you&apos;ll have it dialed in and the predictions will be
              very close.
            </p>
          </div>
        </div>

        <p className="text-sm leading-relaxed">
          The standalone{" "}
          <Link href="/calculators" className="text-[var(--coral-500)] hover:underline font-medium">
            calculators page
          </Link>{" "}
          has quick tools for exactly this: ABV from gravity readings,
          dilution, boil-off, hydrometer correction, and carbonation. They&apos;re
          designed for brew-day use when you need a fast answer without opening
          the full builder.
        </p>

        {/* ── What we calculate ── */}
        <h2
          id="what-we-calculate"
          className="text-xl font-bold mt-10 mb-4"
        >
          What We Calculate
        </h2>
        <p className="text-sm leading-relaxed mb-4">
          Here&apos;s everything the builder produces from your recipe. Each
          one has a dedicated page in this Learn section if you want to
          understand how it works.
        </p>

        <div className="text-sm space-y-1.5" style={{ color: "var(--fg-muted)" }}>
          <p>
            <strong style={{ color: "var(--fg-strong)" }}>
              <Link href="/learn/gravity" className="hover:text-[var(--coral-500)] transition-colors">OG, FG &amp; ABV</Link>
            </strong>{" "}
            : gravity from your grain bill, predicted final gravity from yeast
            attenuation, and alcohol content
          </p>
          <p>
            <strong style={{ color: "var(--fg-strong)" }}>
              <Link href="/learn/ibu" className="hover:text-[var(--coral-500)] transition-colors">IBU</Link>
            </strong>{" "}
            : bitterness from every hop addition type (boil, whirlpool, dry hop,
            first wort, mash)
          </p>
          <p>
            <strong style={{ color: "var(--fg-strong)" }}>SRM</strong>{" "}
            : beer color from grain bill composition
          </p>
          <p>
            <strong style={{ color: "var(--fg-strong)" }}>
              <Link href="/learn/hop-flavor" className="hover:text-[var(--coral-500)] transition-colors">Hop flavor profile</Link>
            </strong>{" "}
            : a 9-axis radar showing the shape of your hop character
          </p>
          <p>
            <strong style={{ color: "var(--fg-strong)" }}>
              <Link href="/learn/mash-ph" className="hover:text-[var(--coral-500)] transition-colors">Mash pH</Link>
            </strong>{" "}
            : predicted from grain and water chemistry, with adjustment
            recommendations
          </p>
          <p>
            <strong style={{ color: "var(--fg-strong)" }}>
              <Link href="/learn/yeast-starters" className="hover:text-[var(--coral-500)] transition-colors">Yeast starter</Link>
            </strong>{" "}
            : cell counts, viability, and multi-step starter plans
          </p>
          <p>
            <strong style={{ color: "var(--fg-strong)" }}>Water volumes</strong>{" "}
            : mash water, sparge water, pre-boil volume, and strike temperature
          </p>
          <p>
            <strong style={{ color: "var(--fg-strong)" }}>Nutrition</strong>{" "}
            : calories and carbs per serving
          </p>
          <p>
            <strong style={{ color: "var(--fg-strong)" }}>Carbonation</strong>{" "}
            : priming sugar amounts or keg PSI for your target CO₂ volumes
          </p>
        </div>
      </HSLearnArticle>
    </>
  );
}
