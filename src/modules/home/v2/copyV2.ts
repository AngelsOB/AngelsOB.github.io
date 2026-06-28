import { STAGES } from "../data";
import type { StageCopy } from "../stageCopy";

// The new-angle copy for /homepage-v2. Same SHAPE as STAGES (so it drives the
// exact same tour animation), but the tour beats are re-cut SHORT and re-framed
// to the loop story: predict -> flavor -> water -> mash(science) -> the payoff.
// The "opening" (chaos) beat is dropped via empty sentences (StageOpening
// returns null). Post-tour beats (compare/library/learn/faq/close) keep the
// current copy via the spread.
export const STAGES_V2 = {
  ...STAGES,

  hero: {
    kicker: "every brew is an experiment —",
    headline: {
      pre: "It predicts your beer. Then it ",
      accent: "learns your kit.",
    },
    subhead:
      "Plan it, brew it, log how it went. The predictions dial in to your kit, sharper every batch.",
  },

  // Dropped (StageOpening returns null on empty sentences).
  opening: {
    sentences: [],
  },

  grains: {
    h2: "The live builder",
    lead: "Plan it, and every number keeps up.",
    body: "Drop in a grain and the gravity climbs, the color deepens, the gauges slide right into the style. The real builder, live on the page.",
  },

  hops: {
    h2: "Flavor",
    lead: "See the flavor before you brew it.",
    paragraphs: [
      "Pick your hops and it lands, citrus, pine, tropical. Drawn from when they go in, not just what you add.",
    ],
  },

  water: {
    h2: "Water",
    lead: "Dial your water to target, wherever you brew from.",
    paragraphs: [
      "One click sets your salts as close to the style as your tap allows, fed by your grain bill and your mash pH.",
    ],
  },

  honestNumbers: {
    h2: "Honest numbers",
    lead: "Your gravity comes from the mash, not a guess.",
    paragraphs: [
      "We model what the mash actually does, then check it against real measured batches. It already beats the standard formula.",
      "And it gets sharper. Every brew that gets logged tunes it, and yours tunes it to your kit.",
    ],
  },

  brewSheet: {
    ...STAGES.brewSheet,
    h2: "The payoff",
    lead: "See how close you got.",
    paragraphs: [
      "Log your real OG and FG. Predicted 1.052, measured 1.051. The gap folds into your next prediction, and the numbers stop being the textbook's and start being yours.",
    ],
  },
} as unknown as StageCopy;
