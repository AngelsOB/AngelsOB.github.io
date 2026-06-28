"use client";

import { createContext, useContext } from "react";
import { STAGES } from "./data";

// Lets the homepage tour render with alternate copy without touching the live
// copy. Defaults to STAGES, so the production `/` homepage (which renders no
// provider) is byte-for-byte unchanged. /homepage-v2 wraps HomeTour in a
// provider with the re-angled STAGES_V2 to compare the new positioning on the
// exact same animation.
export type StageCopy = typeof STAGES;

export const StageCopyContext = createContext<StageCopy>(STAGES);

export const useStageCopy = (): StageCopy => useContext(StageCopyContext);
