"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { hsTokens } from "@/modules/builder/tokens";
import { BuilderMock, type TabKey } from "../mock/BuilderMock";
import { useLenis } from "../lib/scroll";
import { useReducedMotion } from "../lib/useReducedMotion";

gsap.registerPlugin(useGSAP, ScrollTrigger);

// /homepage-v2 — structural starting ground:
//   HERO -> PLAN: the mock is held in a sticky stage and runs its sections while
//   the TEXT track pans sideways past it (camera dolly), scrubbed by vertical
//   scroll; the mock's active section switches per panel via onToggle markers.
//   -> MASH down-scroll, 3-col (curve-vs-standard graph | text | mock) -> BREW
//   -> PAYOFF -> CLOSE. Motion is deliberately simple; the cinematic tuning is a
//   Theatre pass on top of this rig.
const BUILD_HREF = "/recipes/new";

type Panel = { tab: TabKey; kicker: string; head: string; body: string };
const PANELS: Panel[] = [
  { tab: "fermentables", kicker: "plan it", head: "Build it.", body: "Drop in your grains and hops, and every number keeps up as you type." },
  { tab: "hops", kicker: "plan it", head: "See the flavor.", body: "Pick your hops and the radar fills in. Citrus, pine, tropical, before any water's hot." },
  { tab: "water", kicker: "plan it", head: "Dial the water.", body: "It sets your salts as close to target as your tap allows, wherever you brew from." },
];

const card: React.CSSProperties = { background: hsTokens.paper, border: "2px solid var(--hs-ink)", borderRadius: 18, boxShadow: hsTokens.sh3 };
const kicker = (c: string): React.CSSProperties => ({ fontFamily: hsTokens.body, fontSize: 13, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: c, margin: "0 0 12px" });
const head: React.CSSProperties = { fontFamily: hsTokens.display, fontSize: "clamp(28px, 3.6vw, 46px)", lineHeight: 1.06, letterSpacing: "-0.02em", margin: 0 };
const bodyText: React.CSSProperties = { fontFamily: hsTokens.body, fontSize: "clamp(15px, 1.4vw, 18px)", lineHeight: 1.6, color: hsTokens.muted };
const ctaStyle: React.CSSProperties = { display: "inline-block", background: hsTokens.roast, color: hsTokens.cream, fontFamily: hsTokens.display, fontSize: 16, padding: "12px 26px", border: "2px solid var(--hs-ink)", borderRadius: 12, boxShadow: hsTokens.sh3, textDecoration: "none" };
const sectionPad = "clamp(60px, 9vw, 120px) clamp(20px, 5vw, 64px)";

function MashGraph() {
  return (
    <svg width="100%" viewBox="0 0 320 230" role="img" aria-label="Our final-gravity curve follows the measured batches; the standard formula drifts off.">
      <line x1="44" y1="20" x2="44" y2="190" stroke="var(--hs-ink)" strokeWidth="1.5" />
      <line x1="44" y1="190" x2="306" y2="190" stroke="var(--hs-ink)" strokeWidth="1.5" />
      <line x1="44" y1="150" x2="306" y2="52" stroke={hsTokens.muted} strokeWidth="2" strokeDasharray="6 5" />
      <path d="M44 156 C 150 142, 205 110, 306 38" fill="none" stroke={hsTokens.roast} strokeWidth="3" strokeLinecap="round" />
      {[[74, 150], [116, 136], [162, 116], [212, 86], [258, 58], [296, 40]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="4" fill={hsTokens.roast} stroke="var(--hs-paper)" strokeWidth="1.5" />
      ))}
      <text x="44" y="212" style={{ fontFamily: hsTokens.body, fontSize: 11, fill: hsTokens.muted }}>mash temp →</text>
      <text x="14" y="100" style={{ fontFamily: hsTokens.body, fontSize: 11, fill: hsTokens.muted }} transform="rotate(-90 14 100)">final gravity →</text>
      <g style={{ fontFamily: hsTokens.body, fontSize: 12 }}>
        <line x1="196" y1="206" x2="214" y2="206" stroke={hsTokens.roast} strokeWidth="3" /><text x="219" y="210" style={{ fill: "var(--hs-ink)" }}>ours</text>
        <line x1="254" y1="206" x2="272" y2="206" stroke={hsTokens.muted} strokeWidth="2" strokeDasharray="4 3" /><text x="277" y="210" style={{ fill: hsTokens.muted }}>standard</text>
      </g>
    </svg>
  );
}

export default function HomepageV2() {
  const reducedMotion = useReducedMotion();
  useLenis(!reducedMotion);
  const rootRef = useRef<HTMLDivElement>(null);
  const planRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [planTab, setPlanTab] = useState<TabKey>("fermentables");

  useGSAP(() => {
    if (reducedMotion || !rootRef.current) return;

    // PLAN camera-pan: the text track slides left as you scroll the tall wrapper.
    if (trackRef.current && planRef.current) {
      gsap.fromTo(
        trackRef.current,
        { xPercent: 0 },
        { xPercent: -(PANELS.length - 1) * 100, ease: "none",
          scrollTrigger: { trigger: planRef.current, start: "top top", end: "bottom bottom", scrub: 1 } },
      );
    }
    // The mock's section switches per panel (proven onToggle marker pattern).
    gsap.utils.toArray<HTMLElement>(planRef.current?.querySelectorAll("[data-plan]") ?? []).forEach((el) => {
      const i = Number(el.dataset.plan);
      ScrollTrigger.create({ trigger: el, start: "top center", end: "bottom center", onToggle: (s) => { if (s.isActive) setPlanTab(PANELS[i].tab); } });
    });

    // Simple fade-up reveals elsewhere.
    gsap.utils.toArray<HTMLElement>(rootRef.current.querySelectorAll("[data-reveal]")).forEach((el) => {
      gsap.from(el, { opacity: 0, y: 28, duration: 0.7, ease: "power2.out", scrollTrigger: { trigger: el, start: "top 82%" } });
    });
  }, { scope: rootRef, dependencies: [reducedMotion] });

  return (
    <div ref={rootRef} style={{ background: hsTokens.cream, color: "var(--hs-ink)", overflowX: "clip" }}>
      <style>{`
        .hv2-planstage { position: sticky; top: 0; height: 100vh; overflow: hidden; display: grid; grid-template-columns: 1fr 1fr; align-items: center; column-gap: 40px; max-width: 1280px; margin: 0 auto; padding: 0 clamp(20px,5vw,64px); }
        .hv2-textwin { position: relative; height: 60vh; overflow: hidden; }
        .hv2-track { display: flex; height: 100%; will-change: transform; }
        .hv2-panel { flex: 0 0 100%; height: 100%; display: flex; flex-direction: column; justify-content: center; padding-right: 24px; }
        .hv2-mash { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 32px; align-items: center; }
        @media (max-width: 900px) { .hv2-mash { grid-template-columns: 1fr; } .hv2-planstage { grid-template-columns: 1fr; } }
      `}</style>

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section style={{ minHeight: "82vh", display: "flex", flexDirection: "column", justifyContent: "center", maxWidth: 900, margin: "0 auto", padding: sectionPad }}>
        <h1 style={{ ...head, fontSize: "clamp(38px, 6vw, 78px)", lineHeight: 0.98 }}>
          Every brew is an experiment.<br /><span style={{ color: hsTokens.roast }}>Let us help you run yours.</span>
        </h1>
        <p style={{ ...bodyText, fontSize: "clamp(16px, 1.7vw, 21px)", margin: "22px 0 30px", maxWidth: 520 }}>Plan it. Brew it. Make the next one better.</p>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <Link href={BUILD_HREF} style={ctaStyle}>Start a recipe</Link>
          <span style={{ ...bodyText, fontSize: 13, fontStyle: "italic" }}>free. no account.</span>
        </div>
      </section>

      {/* ── PLAN — sticky mock + sideways text pan ───────────── */}
      <div ref={planRef} style={{ height: `${PANELS.length * 100}vh`, position: "relative" }}>
        <div className="hv2-planstage">
          {/* left: text track panning sideways */}
          <div className="hv2-textwin">
            <div ref={trackRef} className="hv2-track">
              {PANELS.map((p, i) => (
                <div key={i} className="hv2-panel">
                  <p style={kicker(hsTokens.water)}>{p.kicker}</p>
                  <h2 style={head}>{p.head}</h2>
                  <p style={{ ...bodyText, margin: "16px 0 0", maxWidth: 360 }}>{p.body}</p>
                </div>
              ))}
            </div>
          </div>
          {/* right: the mock, held, changing section with us */}
          <div style={{ minWidth: 0 }}>
            <BuilderMock activeTab={planTab} onSelectTab={() => {}} />
          </div>
        </div>
        {/* markers drive the mock's section per panel */}
        {PANELS.map((_, i) => (
          <div key={i} data-plan={i} style={{ position: "absolute", top: `${(i / PANELS.length) * 100}%`, height: `${100 / PANELS.length}%`, width: 1, pointerEvents: "none" }} aria-hidden />
        ))}
      </div>

      {/* ── MASH — 3-col: graph | text | mock ────────────────── */}
      <section style={{ background: hsTokens.cream2, borderTop: "2px solid var(--hs-ink)", borderBottom: "2px solid var(--hs-ink)" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: sectionPad }}>
          <div className="hv2-mash">
            <div data-reveal style={{ ...card, background: hsTokens.paper, padding: "20px 22px" }}><MashGraph /></div>
            <div data-reveal style={{ textAlign: "center" }}>
              <p style={kicker(hsTokens.roast)}>our science</p>
              <h2 style={{ ...head, fontSize: "clamp(26px,3.2vw,40px)" }}>Your gravity comes from the mash.</h2>
              <p style={{ ...bodyText, margin: "18px 0 0" }}>Most apps guess it off the yeast packet. We modelled what the mash actually does and checked it against real batches. Ours follows the beer. The standard formula doesn't. And every brew that gets logged tunes it sharper.</p>
            </div>
            <div data-reveal style={{ minWidth: 0 }}><BuilderMock activeTab="mash" onSelectTab={() => {}} /></div>
          </div>
        </div>
      </section>

      {/* ── BREW ─────────────────────────────────────────────── */}
      <section style={{ maxWidth: 760, margin: "0 auto", padding: sectionPad, textAlign: "center" }}>
        <div data-reveal>
          <p style={kicker(hsTokens.roast)}>brew it</p>
          <h2 style={head}>On brew day, it keeps up with you.</h2>
          <p style={{ ...bodyText, margin: "18px auto 0", maxWidth: 540 }}>Log your numbers as you brew. Come in low on OG and it tells you the fix, the DME or the longer boil, and what it does to the rest.</p>
        </div>
      </section>

      {/* ── PAYOFF ───────────────────────────────────────────── */}
      <section style={{ maxWidth: 760, margin: "0 auto", padding: sectionPad, textAlign: "center" }}>
        <div data-reveal>
          <p style={kicker(hsTokens.hops)}>improve it</p>
          <h2 style={head}>See how close you got.</h2>
          <p style={{ ...bodyText, margin: "18px auto 0", maxWidth: 540 }}>Predicted 1.052, measured 1.051. The gap folds into your next prediction, and the numbers stop being the textbook's and start being yours.</p>
        </div>
      </section>

      {/* ── CLOSE ────────────────────────────────────────────── */}
      <section style={{ maxWidth: 720, margin: "0 auto", padding: "clamp(70px,10vw,150px) clamp(20px,5vw,64px) clamp(90px,12vw,180px)", textAlign: "center" }}>
        <h2 style={{ ...head, fontSize: "clamp(32px,4.8vw,56px)" }}>Every brew is an experiment. Run yours.</h2>
        <div style={{ marginTop: 28 }}><Link href={BUILD_HREF} style={{ ...ctaStyle, fontSize: 18, padding: "15px 32px" }}>Start a recipe</Link></div>
        <p style={{ ...bodyText, fontSize: 15, margin: "30px auto 0", maxWidth: 520 }}>Free to start. Five recipes, and brew as many batches off them as you want. Import and export anytime. More than five at once is $1.99 a month.</p>
      </section>
    </div>
  );
}
