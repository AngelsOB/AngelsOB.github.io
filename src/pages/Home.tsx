import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div className="-mt-6 -mx-4 sm:-mx-6 lg:-mx-8">
      {/* ── Hero ── */}
      <section className="relative overflow-hidden px-4 sm:px-6 lg:px-8 pt-12 sm:pt-24 pb-14 sm:pb-28">
        {/* Warm ambient glow */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 80% 50% at 20% 0%, color-mix(in oklch, var(--coral-300) 12%, transparent), transparent 70%),
              radial-gradient(ellipse 60% 60% at 80% 20%, color-mix(in oklch, var(--coral-400) 8%, transparent), transparent 60%)
            `,
          }}
        />

        {/* Decorative hop cone — layered petal watermark */}
        <div
          className="pointer-events-none absolute -right-12 sm:right-0 lg:right-[4%] top-1/2 -translate-y-[45%] w-[280px] sm:w-[360px] lg:w-[420px] opacity-[0.06] dark:opacity-[0.035]"
          aria-hidden="true"
        >
          <svg viewBox="0 0 240 320" className="w-full h-auto">
            <defs>
              <clipPath id="hop-clip"><rect width="240" height="320" /></clipPath>
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

        <div className="relative max-w-3xl mx-auto brew-animate-in">
          <div className="brew-animate-in brew-stagger-1">
            <span
              className="inline-block text-xs font-bold uppercase tracking-[0.2em] mb-6"
              style={{ color: "var(--coral-600)" }}
            >
              Homebrewing tools
            </span>
          </div>

          <h1
            className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[0.95] brew-animate-in brew-stagger-2"
            style={{
              color: "var(--fg-strong)",
              letterSpacing: "-0.035em",
            }}
          >
            Dial in
            <br />
            every batch.
          </h1>

          <p className="mt-6 text-base sm:text-lg leading-relaxed max-w-lg text-muted brew-animate-in brew-stagger-3">
            Gravity calculators, brew-day math, and a recipe builder that
            understands your system. Built for brewers who care about
            the details.
          </p>

          <div className="mt-8 flex items-center gap-3 brew-animate-in brew-stagger-4">
            <Link to="/recipes" className="brew-btn-primary !px-5 !py-2.5 !rounded-xl">
              Start a Recipe
            </Link>
            <Link to="/calculators" className="brew-btn-ghost !px-5 !py-2.5 !rounded-xl">
              Open Calculators
            </Link>
          </div>
        </div>
      </section>

      {/* ── Feature sections ── */}
      <div className="px-4 sm:px-6 lg:px-8 pb-16">
        <div className="max-w-5xl mx-auto space-y-6">

          {/* Recipe Builder */}
          <Link to="/recipes" className="block group">
            <div
              className="brew-section !mb-0 transition-all duration-200 group-hover:!shadow-[var(--shadow-card-hover)]"
              data-accent="grain"
            >
              <div className="flex flex-col lg:flex-row lg:items-center gap-6 lg:gap-10 brew-animate-in brew-stagger-5">
                {/* Left — copy */}
                <div className="flex-1 min-w-0">
                  <h2 className="brew-section-title !text-2xl">Recipe Builder</h2>
                  <p className="mt-3 text-sm text-muted leading-relaxed max-w-md">
                    Build recipes with real-time calculations. Grain bills,
                    hop schedules, mash steps, water chemistry — everything
                    talks to your equipment profile.
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
                <div className="lg:w-72 shrink-0 space-y-2 opacity-80 group-hover:opacity-100 transition-opacity duration-200">
                  {/* Mock ingredient rows */}
                  <div className="brew-ingredient-row !p-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ background: "var(--brew-accent-400)" }}
                      />
                      <span className="text-xs font-medium text-strong">
                        Maris Otter
                      </span>
                    </div>
                    <span className="text-xs text-muted tabular-nums">4.5 kg</span>
                  </div>
                  <div className="brew-ingredient-row !p-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ background: "var(--brew-accent-300)" }}
                      />
                      <span className="text-xs font-medium text-strong">
                        Crystal 60L
                      </span>
                    </div>
                    <span className="text-xs text-muted tabular-nums">0.35 kg</span>
                  </div>
                  <div className="brew-ingredient-row !p-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ background: "var(--brew-accent-200)" }}
                      />
                      <span className="text-xs font-medium text-strong">
                        Munich II
                      </span>
                    </div>
                    <span className="text-xs text-muted tabular-nums">0.25 kg</span>
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
          <Link to="/calculators" className="block group">
            <div
              className="brew-section !mb-0 transition-all duration-200 group-hover:!shadow-[var(--shadow-card-hover)]"
              data-accent="mash"
            >
              <div className="flex flex-col lg:flex-row lg:items-center gap-6 lg:gap-10 brew-animate-in brew-stagger-7">
                {/* Left — copy */}
                <div className="flex-1 min-w-0">
                  <h2 className="brew-section-title !text-2xl">Calculators</h2>
                  <p className="mt-3 text-sm text-muted leading-relaxed max-w-md">
                    Brew-day math without the spreadsheet. ABV from gravity
                    readings, boil-off targets, and more on the way.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="brew-tag">ABV</span>
                    <span className="brew-tag">Boil-Off</span>
                    <span className="brew-tag">Pre-Boil Gravity</span>
                  </div>
                </div>

                {/* Right — decorative calc preview */}
                <div className="lg:w-72 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity duration-200">
                  <div className="space-y-3">
                    {/* Mock inputs */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="text-[9px] font-bold text-muted uppercase tracking-widest mb-1">
                          OG
                        </div>
                        <div className="brew-input w-full !py-1.5 text-sm tabular-nums text-strong pointer-events-none">
                          1.054
                        </div>
                      </div>
                      <div>
                        <div className="text-[9px] font-bold text-muted uppercase tracking-widest mb-1">
                          FG
                        </div>
                        <div className="brew-input w-full !py-1.5 text-sm tabular-nums text-strong pointer-events-none">
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
          <Link to="/recipes" className="block group">
            <div
              className="brew-section !mb-0 transition-all duration-200 group-hover:!shadow-[var(--shadow-card-hover)]"
              data-accent="equipment"
            >
              <div className="flex flex-col lg:flex-row lg:items-center gap-6 lg:gap-10 brew-animate-in brew-stagger-9">
                {/* Left — copy */}
                <div className="flex-1 min-w-0">
                  <h2 className="brew-section-title !text-2xl">Equipment Profiles</h2>
                  <p className="mt-3 text-sm text-muted leading-relaxed max-w-md">
                    Save your system — batch size, boil-off rate, dead spaces,
                    efficiency. Every calculation adjusts to your gear.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="brew-tag">Grainfather G30</span>
                    <span className="brew-tag">Anvil Foundry</span>
                    <span className="brew-tag">BIAB</span>
                    <span className="brew-tag">3-Vessel</span>
                  </div>
                </div>

                {/* Right — decorative equipment preview */}
                <div className="lg:w-72 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity duration-200">
                  <div className="space-y-2">
                    <div className="brew-ingredient-row !p-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0">
                          <rect x="2" y="1" width="10" height="9" rx="2" stroke="var(--brew-accent-400)" strokeWidth="1.2" fill="color-mix(in oklch, var(--brew-accent-200) 30%, transparent)" />
                          <rect x="4" y="10" width="6" height="2" rx="1" fill="var(--brew-accent-300)" />
                          <line x1="5" y1="4" x2="9" y2="4" stroke="var(--brew-accent-400)" strokeWidth="0.8" strokeLinecap="round" />
                          <line x1="5" y1="6" x2="8" y2="6" stroke="var(--brew-accent-300)" strokeWidth="0.8" strokeLinecap="round" />
                        </svg>
                        <span className="text-xs font-medium text-strong">Batch Size</span>
                      </div>
                      <span className="text-xs text-muted tabular-nums">23 L</span>
                    </div>
                    <div className="brew-ingredient-row !p-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0">
                          <path d="M3 11 L5 3 L9 3 L11 11" stroke="var(--brew-accent-400)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="color-mix(in oklch, var(--brew-accent-200) 30%, transparent)" />
                          <line x1="4" y1="8" x2="10" y2="8" stroke="var(--brew-accent-300)" strokeWidth="0.8" />
                        </svg>
                        <span className="text-xs font-medium text-strong">Boil-Off</span>
                      </div>
                      <span className="text-xs text-muted tabular-nums">3.8 L/hr</span>
                    </div>
                    <div className="brew-ingredient-row !p-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0">
                          <circle cx="7" cy="7" r="5" stroke="var(--brew-accent-400)" strokeWidth="1.2" fill="color-mix(in oklch, var(--brew-accent-200) 30%, transparent)" />
                          <path d="M7 4 L7 7 L9.5 8.5" stroke="var(--brew-accent-500)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span className="text-xs font-medium text-strong">Efficiency</span>
                      </div>
                      <span className="text-xs text-muted tabular-nums">72%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Link>

        </div>
      </div>
    </div>
  );
}
