/**
 * Water Profile Comparison
 *
 * Stack of horizontal range strips — one per ion (Ca, Mg, Na, Cl, SO₄, HCO₃).
 * Range block spans source water → target; needle shows the final (current) profile.
 */

import type { WaterProfile } from "../../../domain/services/WaterChemistryService";
import { ION_LABELS } from "./constants";
import OLD_WaterIonRangeStrip from "./OLD_WaterIonRangeStrip";

const ION_DISPLAY: Record<keyof WaterProfile, string> = {
  Ca: "Ca",
  Mg: "Mg",
  Na: "Na",
  Cl: "Cl",
  SO4: "SO₄",
  HCO3: "HCO₃",
};

type Props = {
  /** The source water profile */
  sourceProfile: WaterProfile;
  /** The target style profile */
  targetProfile: WaterProfile;
  /** BJCP auto-detected target profile (for per-ion custom detection) */
  bjcpTargetProfile?: WaterProfile;
  /** The calculated final profile after salt additions */
  finalProfile: WaterProfile;
  /** Whether the target is a user-defined custom profile (vs BJCP preset) */
  isCustomTarget?: boolean;
  /** Callback when user drags a target needle */
  onTargetDrag?: (ion: keyof WaterProfile, value: number) => void;
};

export default function OLD_WaterProfileComparison({
  sourceProfile,
  targetProfile,
  bjcpTargetProfile,
  finalProfile,
  isCustomTarget,
  onTargetDrag,
}: Props) {
  return (
    <div>
      <h4 className="text-sm font-semibold mb-2">Water Profile (ppm)</h4>
      <div className="style-strip-stack">
        {ION_LABELS.map((ion) => (
          <OLD_WaterIonRangeStrip
            key={ion}
            ion={ion}
            label={ION_DISPLAY[ion]}
            source={sourceProfile[ion]}
            target={targetProfile[ion]}
            final={finalProfile[ion]}
            isCustomTarget={isCustomTarget && bjcpTargetProfile !== undefined && targetProfile[ion] !== bjcpTargetProfile[ion]}
            onTargetDrag={onTargetDrag}
          />
        ))}
      </div>
    </div>
  );
}
