import Link from "next/link";
import Typewriter from "@/components/Typewriter";
import GrainGradient from "@/components/GrainGradient";
// import HomePhysicsCansLoader from "@/modules/labels/HomePhysicsCansLoader";

export default function Home() {
  return (
    <div className="relative -mt-6">
      {/* Grainy ambient glow — behind all content, fades out over the feature cards */}
      <div
        className="pointer-events-none absolute top-0 h-[130vh]"
        style={{
          left: 'calc(50% - 50vw)',
          width: '100vw',
          zIndex: -1,
          maskImage: 'linear-gradient(to bottom, black 0%, black 25%, rgba(0,0,0,0.85) 45%, rgba(0,0,0,0.5) 60%, rgba(0,0,0,0.15) 75%, transparent 90%)',
          WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 25%, rgba(0,0,0,0.85) 45%, rgba(0,0,0,0.5) 60%, rgba(0,0,0,0.15) 75%, transparent 90%)',
        }}
        aria-hidden
      >
        <GrainGradient
          stops={[
            { pos: 0,    color: "color-mix(in oklch, var(--coral-300) 18%, transparent)" },
            { pos: 0.55, color: "color-mix(in oklch, var(--coral-200) 8%, transparent)" },
            { pos: 1,    color: "transparent" },
          ]}
          direction={145}
          displacement={0.6}
          grainOpacity={0.7}
          radius={12}
        />
      </div>

      {/* ── Hero ── */}
      <section className="full-bleed relative pt-12 pb-14 sm:pt-24 sm:pb-28">
        {/* Decorative hop cone — layered petal watermark */}
        <div
          className="pointer-events-none absolute top-1/2 right-[max(0px,calc(50%-38rem))] w-[280px] -translate-y-[45%] opacity-[0.06] sm:w-[360px] lg:w-[420px] dark:opacity-[0.035]"
          aria-hidden="true"
        >
          <svg viewBox="0 0 240 320" className="h-auto w-full">
            <defs>
              <clipPath id="hop-clip">
                <rect width="240" height="320" />
              </clipPath>
            </defs>
            <g clipPath="url(#hop-clip)" fill="var(--coral-500)">
              {/* Row 5 — bottom */}
              <ellipse cx="82" cy="240" rx="50" ry="28" transform="rotate(-25 82 240)" />
              <ellipse cx="158" cy="240" rx="50" ry="28" transform="rotate(25 158 240)" />
              {/* Row 4 */}
              <ellipse cx="76" cy="198" rx="48" ry="27" transform="rotate(-18 76 198)" />
              <ellipse cx="164" cy="198" rx="48" ry="27" transform="rotate(18 164 198)" />
              {/* Row 3 */}
              <ellipse cx="80" cy="158" rx="46" ry="26" transform="rotate(-12 80 158)" />
              <ellipse cx="160" cy="158" rx="46" ry="26" transform="rotate(12 160 158)" />
              {/* Row 2 */}
              <ellipse cx="86" cy="120" rx="42" ry="24" transform="rotate(-8 86 120)" />
              <ellipse cx="154" cy="120" rx="42" ry="24" transform="rotate(8 154 120)" />
              {/* Row 1 — top */}
              <ellipse cx="92" cy="86" rx="38" ry="22" transform="rotate(-4 92 86)" />
              <ellipse cx="148" cy="86" rx="38" ry="22" transform="rotate(4 148 86)" />
              {/* Tip */}
              <ellipse cx="120" cy="54" rx="32" ry="20" />
              {/* Stem */}
              <rect x="115" y="264" width="10" height="46" rx="5" />
            </g>
          </svg>
        </div>

        <div className="brew-animate-in relative z-10 mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="brew-animate-in brew-stagger-1">
            <span
              className="mb-6 inline-block text-xs font-bold tracking-[0.2em] uppercase"
              style={{ color: "var(--coral-600)" }}
            >
              Homebrewing tools
            </span>
          </div>

          <h1
            className="brew-animate-in brew-stagger-2 text-3xl leading-[0.95] font-black tracking-tight sm:text-5xl lg:text-6xl"
            style={{
              color: "var(--fg-strong)",
              letterSpacing: "-0.035em",
            }}
          >
            The only tab you need
            <br />
            on brew day.
          </h1>

          <Typewriter
            text="Built by a brewer who just kept forgetting things."
            className="mt-6 max-w-lg text-xl leading-relaxed sm:text-2xl"
            style={{
              fontFamily: "var(--font-handwritten)",
              color: "var(--brew-accent-500)",
              transform: "rotate(-3deg) translateX(45px) translateY(-3px)",
            }}
          />

          <div className="brew-animate-in brew-stagger-4 mt-8 flex items-center gap-3">
            <Link href="/recipes" className="brew-btn-primary !rounded-xl !px-5 !py-2.5">
              Start a Recipe
            </Link>
            <Link href="/calculators" className="brew-btn-ghost !rounded-xl !px-5 !py-2.5">
              Open Calculators
            </Link>
          </div>
        </div>
      </section>

      {/* ── Feature sections ── */}
      <div className="px-4 pb-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl space-y-6">
          {/* Recipe Builder */}
          <Link href="/recipes" className="group block">
            <div
              className="brew-section !mb-0 transition-all duration-200 group-hover:!shadow-[var(--shadow-card-hover)]"
              data-accent="grain"
              /* data-physics="card-0" */
            >
              <div className="brew-animate-in brew-stagger-5 flex flex-col gap-6 lg:flex-row lg:items-center lg:gap-10">
                {/* Left — copy */}
                <div className="min-w-0 flex-1">
                  <h2 className="brew-section-title !text-2xl">Recipe Builder</h2>
                  <p className="text-muted mt-3 max-w-md text-sm leading-relaxed">
                    Build recipes with real-time calculations. Grain bills, hop schedules, mash
                    steps, water chemistry — everything talks to your equipment profile.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="brew-tag">Fermentables</span>
                    <span className="brew-tag">Hops</span>
                    <span className="brew-tag">Mash</span>
                    <span className="brew-tag">Water</span>
                    <span className="brew-tag">Yeast</span>
                  </div>
                </div>

                {/* Right — decorative preview */}
                <div className="shrink-0 space-y-2 opacity-80 transition-opacity duration-200 group-hover:opacity-100 lg:w-72">
                  {/* Mock ingredient rows */}
                  <div className="brew-ingredient-row flex items-center justify-between !p-2.5">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ background: "var(--brew-accent-400)" }}
                      />
                      <span className="text-strong text-xs font-medium">Maris Otter</span>
                    </div>
                    <span className="text-muted text-xs tabular-nums">4.5 kg</span>
                  </div>
                  <div className="brew-ingredient-row flex items-center justify-between !p-2.5">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ background: "var(--brew-accent-300)" }}
                      />
                      <span className="text-strong text-xs font-medium">Crystal 60L</span>
                    </div>
                    <span className="text-muted text-xs tabular-nums">0.35 kg</span>
                  </div>
                  <div className="brew-ingredient-row flex items-center justify-between !p-2.5">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ background: "var(--brew-accent-200)" }}
                      />
                      <span className="text-strong text-xs font-medium">Munich II</span>
                    </div>
                    <span className="text-muted text-xs tabular-nums">0.25 kg</span>
                  </div>

                  {/* Mini gauges */}
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <div className="brew-gauge !p-2">
                      <div className="brew-gauge-label !text-[8px]">OG</div>
                      <div className="brew-gauge-value !text-base tabular-nums">1.054</div>
                    </div>
                    <div className="brew-gauge !p-2">
                      <div className="brew-gauge-label !text-[8px]">IBU</div>
                      <div className="brew-gauge-value !text-base tabular-nums">38</div>
                    </div>
                    <div className="brew-gauge !p-2">
                      <div className="brew-gauge-label !text-[8px]">SRM</div>
                      <div className="brew-gauge-value !text-base tabular-nums">12</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Link>

          {/* Calculators */}
          <Link href="/calculators" className="group block">
            <div
              className="brew-section !mb-0 transition-all duration-200 group-hover:!shadow-[var(--shadow-card-hover)]"
              data-accent="mash"
              /* data-physics="card-1" */
            >
              <div className="brew-animate-in brew-stagger-7 flex flex-col gap-6 lg:flex-row lg:items-center lg:gap-10">
                {/* Left — copy */}
                <div className="min-w-0 flex-1">
                  <h2 className="brew-section-title !text-2xl">Calculators</h2>
                  <p className="text-muted mt-3 max-w-md text-sm leading-relaxed">
                    Brew-day math without the spreadsheet. ABV from gravity readings, boil-off
                    targets, and more on the way.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="brew-tag">ABV</span>
                    <span className="brew-tag">Boil-Off</span>
                    <span className="brew-tag">Pre-Boil Gravity</span>
                  </div>
                </div>

                {/* Right — decorative calc preview */}
                <div className="shrink-0 opacity-80 transition-opacity duration-200 group-hover:opacity-100 lg:w-72">
                  <div className="space-y-3">
                    {/* Mock inputs */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="text-muted mb-1 text-[9px] font-bold tracking-widest uppercase">
                          OG
                        </div>
                        <div className="brew-input text-strong pointer-events-none w-full !py-1.5 text-sm tabular-nums">
                          1.054
                        </div>
                      </div>
                      <div>
                        <div className="text-muted mb-1 text-[9px] font-bold tracking-widest uppercase">
                          FG
                        </div>
                        <div className="brew-input text-strong pointer-events-none w-full !py-1.5 text-sm tabular-nums">
                          1.012
                        </div>
                      </div>
                    </div>

                    {/* Mock result */}
                    <div className="brew-gauge !p-3">
                      <div className="brew-gauge-label">Estimated ABV</div>
                      <div className="brew-gauge-value !text-3xl tabular-nums">5.51%</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Link>

          {/* Equipment */}
          <Link href="/recipes" className="group block">
            <div
              className="brew-section !mb-0 transition-all duration-200 group-hover:!shadow-[var(--shadow-card-hover)]"
              data-accent="equipment"
              /* data-physics="card-2" */
            >
              <div className="brew-animate-in brew-stagger-9 flex flex-col gap-6 lg:flex-row lg:items-center lg:gap-10">
                {/* Left — copy */}
                <div className="min-w-0 flex-1">
                  <h2 className="brew-section-title !text-2xl">Equipment Profiles</h2>
                  <p className="text-muted mt-3 max-w-md text-sm leading-relaxed">
                    Save your system — batch size, boil-off rate, dead spaces, efficiency. Every
                    calculation adjusts to your gear.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="brew-tag">Grainfather G30</span>
                    <span className="brew-tag">Anvil Foundry</span>
                    <span className="brew-tag">BIAB</span>
                    <span className="brew-tag">3-Vessel</span>
                  </div>
                </div>

                {/* Right — decorative equipment preview */}
                <div className="shrink-0 opacity-80 transition-opacity duration-200 group-hover:opacity-100 lg:w-72">
                  <div className="space-y-2">
                    <div className="brew-ingredient-row flex items-center justify-between !p-2.5">
                      <div className="flex items-center gap-2">
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 14 14"
                          fill="none"
                          className="shrink-0"
                        >
                          <rect
                            x="2"
                            y="1"
                            width="10"
                            height="9"
                            rx="2"
                            stroke="var(--brew-accent-400)"
                            strokeWidth="1.2"
                            fill="color-mix(in oklch, var(--brew-accent-200) 30%, transparent)"
                          />
                          <rect
                            x="4"
                            y="10"
                            width="6"
                            height="2"
                            rx="1"
                            fill="var(--brew-accent-300)"
                          />
                          <line
                            x1="5"
                            y1="4"
                            x2="9"
                            y2="4"
                            stroke="var(--brew-accent-400)"
                            strokeWidth="0.8"
                            strokeLinecap="round"
                          />
                          <line
                            x1="5"
                            y1="6"
                            x2="8"
                            y2="6"
                            stroke="var(--brew-accent-300)"
                            strokeWidth="0.8"
                            strokeLinecap="round"
                          />
                        </svg>
                        <span className="text-strong text-xs font-medium">Batch Size</span>
                      </div>
                      <span className="text-muted text-xs tabular-nums">23 L</span>
                    </div>
                    <div className="brew-ingredient-row flex items-center justify-between !p-2.5">
                      <div className="flex items-center gap-2">
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 14 14"
                          fill="none"
                          className="shrink-0"
                        >
                          <path
                            d="M3 11 L5 3 L9 3 L11 11"
                            stroke="var(--brew-accent-400)"
                            strokeWidth="1.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            fill="color-mix(in oklch, var(--brew-accent-200) 30%, transparent)"
                          />
                          <line
                            x1="4"
                            y1="8"
                            x2="10"
                            y2="8"
                            stroke="var(--brew-accent-300)"
                            strokeWidth="0.8"
                          />
                        </svg>
                        <span className="text-strong text-xs font-medium">Boil-Off</span>
                      </div>
                      <span className="text-muted text-xs tabular-nums">3.8 L/hr</span>
                    </div>
                    <div className="brew-ingredient-row flex items-center justify-between !p-2.5">
                      <div className="flex items-center gap-2">
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 14 14"
                          fill="none"
                          className="shrink-0"
                        >
                          <circle
                            cx="7"
                            cy="7"
                            r="5"
                            stroke="var(--brew-accent-400)"
                            strokeWidth="1.2"
                            fill="color-mix(in oklch, var(--brew-accent-200) 30%, transparent)"
                          />
                          <path
                            d="M7 4 L7 7 L9.5 8.5"
                            stroke="var(--brew-accent-500)"
                            strokeWidth="1"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        <span className="text-strong text-xs font-medium">Efficiency</span>
                      </div>
                      <span className="text-muted text-xs tabular-nums">72%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* <HomePhysicsCansLoader /> */}
    </div>
  );
}
