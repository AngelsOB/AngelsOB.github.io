"use client";

import { hsTokens } from "@/modules/hopskip/tokens";
import { STAGES } from "../data";

// Stage 7. Mock swaps to Brewed Versions panel (task #6). Copy is one
// paragraph: the recipe-as-record story.
export default function StageBrewedAgain() {
  return (
    <section
      style={{
        paddingTop: "clamp(56px, 8vw, 96px)",
        paddingBottom: "clamp(56px, 8vw, 96px)",
      }}
    >
      <p
        style={{
          fontFamily: hsTokens.body,
          fontSize: 17,
          lineHeight: 1.6,
          color: hsTokens.ink,
          maxWidth: 480,
        }}
      >
        {STAGES.brewedAgain.body}
      </p>
    </section>
  );
}
