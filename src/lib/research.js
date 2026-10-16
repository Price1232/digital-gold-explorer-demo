// Research-status rules for the public portfolio edition.
//
// The shared views ask this module whether a result reproduces a research
// artifact. This repository contains no research artifacts, so every lookup
// reports the synthetic-data reason and nothing can be marked validated. The
// exports match the private research edition's module, so the shared views
// work unchanged.

import { SYNTHETIC_REASON } from "./edition.js";

export const TOLERANCE = 1e-9;

/** No frozen rolling series exist in this edition. */
export function frozenRolling() {
  return { reason: SYNTHETIC_REASON };
}

/** Every rolling series is synthetic, so it is never validated. */
export function rollingStatus() {
  return { status: "exploratory", reasons: [SYNTHETIC_REASON], parity: null };
}

/** No correlation artifacts exist in this edition. */
export function correlationArtifact() {
  return { reasons: [SYNTHETIC_REASON] };
}

/** No beta artifacts exist in this edition. */
export function betaArtifact() {
  return { reasons: [SYNTHETIC_REASON] };
}

/** Always exploratory: there is nothing to compare against. */
export function assess() {
  return { status: "exploratory", reasons: [SYNTHETIC_REASON], source: null, artifactValue: null, delta: null };
}

/** Regime filters need daily observations; weekly/monthly regimes are undefined. */
export function regimeUnavailable(state) {
  return state.regime !== "all" && state.frequency !== "daily";
}

/** Configuration of the current explorer selection. */
export function configFor(state, regimeIsFrozen) {
  return {
    assetA: state.assetA,
    assetB: state.assetB,
    period: state.period,
    regime: state.regime,
    frequency: state.frequency,
    thresholdsFrozen: regimeIsFrozen,
  };
}

/** Matrix status: validated only when every off-diagonal pair is validated. */
export function matrixStatus(assessments) {
  const validated = assessments.filter((a) => a.status === "validated").length;
  if (assessments.length && validated === assessments.length) return "validated";
  return validated > 0 ? "partial" : "exploratory";
}

/** Summary statistics are at best "derived" from a validated series. */
export function summaryStatus(seriesStatus) {
  return seriesStatus === "validated" ? "derived" : "exploratory";
}
