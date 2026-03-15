/**
 * Water Chemistry Section Component
 *
 * Shows final ion metrics inline, source/target profiles,
 * salt additions, and ion comparison table.
 */

import type { SaltAdditions, WaterProfile } from "../../../domain/services/WaterChemistryService";
import SaltAdditionsPanel from "./SaltAdditionsPanel";
import WaterProfileComparison from "./WaterProfileComparison";

type TargetStyle = {
  profile: WaterProfile;
  clToSo4Ratio: string;
};

type Props = {
  /** Source water profile */
  sourceProfile: WaterProfile;
  /** Source water profile name */
  sourceProfileName?: string;
  /** Target style profile with ratio description */
  targetStyle: TargetStyle | undefined;
  /** Target style name (auto-detected or custom) */
  targetStyleName?: string;
  /** Whether the target is a user-defined custom profile (vs BJCP auto-detected) */
  isCustomTarget?: boolean;
  /** BJCP auto-detected target profile (for per-ion custom detection) */
  bjcpTargetProfile?: WaterProfile;
  /** Calculated final water profile */
  finalProfile: WaterProfile;
  /** Current salt additions */
  saltAdditions: Partial<SaltAdditions>;
  /** Salt amounts for mash water */
  mashSalts: Partial<SaltAdditions>;
  /** Salt amounts for sparge water */
  spargeSalts: Partial<SaltAdditions>;
  /** Callback to open source water profile modal */
  onOpenSourceModal: () => void;
  /** Callback to revert to BJCP auto-detected target */
  onSwitchToBjcp: () => void;
  /** Callback to open custom target modal */
  onOpenCustomTarget: () => void;
  /** Callback when a salt amount changes */
  onSaltChange: (saltKey: keyof SaltAdditions, value: number) => void;
  /** Callback when user drags a target needle */
  onTargetDrag?: (ion: keyof WaterProfile, value: number) => void;
};

export default function WaterChemistrySection({
  sourceProfile,
  sourceProfileName,
  targetStyle,
  targetStyleName,
  isCustomTarget,
  bjcpTargetProfile,
  finalProfile,
  saltAdditions,
  mashSalts,
  spargeSalts,
  onOpenSourceModal,
  onSwitchToBjcp,
  onOpenCustomTarget,
  onSaltChange,
  onTargetDrag,
}: Props) {
  const targetProfile = targetStyle?.profile || { Ca: 75, Mg: 10, Na: 10, Cl: 75, SO4: 75, HCO3: 75 };

  return (
    <div className="space-y-4">
      {/* Source → Target Profiles */}
      <div className="water-source-target-row">
        <span id="water-source-label" className="text-sm font-semibold">Source Water</span>
        <div />
        <span className="text-sm font-semibold">Target Water</span>

        <button
          aria-labelledby="water-source-label"
          onClick={onOpenSourceModal}
          className="brew-btn-ghost brew-btn-ghost--inset text-left self-end"
        >
          {sourceProfileName || "Custom"}
        </button>

        <span className="text-muted self-end">→</span>

        <div className="self-end">
          <div className="brew-segmented-toggle brew-segmented-toggle--lg w-fit">
            <button
              onClick={() => isCustomTarget && onSwitchToBjcp()}
              className={!isCustomTarget ? "is-active" : ""}
            >
              BJCP
            </button>
            <button
              onClick={onOpenCustomTarget}
              className={isCustomTarget ? "is-active" : ""}
            >
              Custom
            </button>
          </div>
        </div>

        {/* Row 3: target info — spans only the target column */}
        {targetStyle ? (
          <>
            <div />
            <div />
            <p className="text-xs text-muted mt-0.5">
              {targetStyleName || "Balanced"} — Cl:SO₄ {targetStyle.clToSo4Ratio}
              {isCustomTarget && (
                <button
                  onClick={onOpenCustomTarget}
                  className="brew-link ml-1.5 text-xs"
                >
                  Edit
                </button>
              )}
            </p>
          </>
        ) : null}
      </div>

      {/* Salt Additions */}
      <SaltAdditionsPanel
        saltAdditions={saltAdditions}
        mashSalts={mashSalts}
        spargeSalts={spargeSalts}
        onSaltChange={onSaltChange}
      />

      {/* Water Profile Comparison */}
      <WaterProfileComparison
        sourceProfile={sourceProfile}
        targetProfile={targetProfile}
        bjcpTargetProfile={bjcpTargetProfile}
        finalProfile={finalProfile}
        isCustomTarget={isCustomTarget}
        onTargetDrag={onTargetDrag}
      />
    </div>
  );
}
