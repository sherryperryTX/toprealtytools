import type { SubjectProperty, ComparableProperty, AdjustmentSet, AdjustmentKey } from "./types";

/**
 * Calculate basic auto-suggested adjustments between subject and a comp.
 * These are starting points — the AI and user can override them.
 */
export function calculateAutoAdjustments(
  subject: SubjectProperty,
  comp: ComparableProperty,
  pricePerSqFt?: number
): Record<AdjustmentKey, number> {
  const adjustments: Record<AdjustmentKey, number> = {
    location: 0,
    saleDate: 0,
    lotSize: 0,
    view: 0,
    quality: 0,
    condition: 0,
    age: 0,
    gla: 0,
    basement: 0,
    garage: 0,
    pool: 0,
    other: 0,
  };

  // GLA adjustment
  const subjectGla = typeof subject.gla === "number" ? subject.gla : 0;
  const compGla = typeof comp.gla === "number" ? comp.gla : 0;
  if (subjectGla && compGla) {
    const glaDiff = subjectGla - compGla;
    const rate = pricePerSqFt || 100; // default $100/sqft if not provided
    adjustments.gla = Math.round(glaDiff * rate);
  }

  // Bedroom adjustment
  const subjectBeds = typeof subject.bedrooms === "number" ? subject.bedrooms : 0;
  const compBeds = typeof comp.bedrooms === "number" ? comp.bedrooms : 0;
  if (subjectBeds && compBeds && subjectBeds !== compBeds) {
    adjustments.other += (subjectBeds - compBeds) * 10000;
  }

  // Bathroom adjustment
  const subjectBaths = typeof subject.bathrooms === "number" ? subject.bathrooms : 0;
  const compBaths = typeof comp.bathrooms === "number" ? comp.bathrooms : 0;
  if (subjectBaths && compBaths && subjectBaths !== compBaths) {
    adjustments.other += (subjectBaths - compBaths) * 12000;
  }

  // Garage adjustment
  const subjectGarage = typeof subject.garageSpaces === "number" ? subject.garageSpaces : 0;
  const compGarage = typeof comp.garageSpaces === "number" ? comp.garageSpaces : 0;
  if (subjectGarage !== compGarage) {
    adjustments.garage = (subjectGarage - compGarage) * 10000;
  }

  // Pool adjustment
  if (subject.pool && !comp.pool) {
    adjustments.pool = 15000;
  } else if (!subject.pool && comp.pool) {
    adjustments.pool = -15000;
  }

  // Basement adjustment
  const subjectBasement = typeof subject.basementSqFt === "number" ? subject.basementSqFt : 0;
  const compBasement = typeof comp.basementSqFt === "number" ? comp.basementSqFt : 0;
  if (subjectBasement !== compBasement) {
    const finRate = 50; // per sq ft for finished basement
    const subVal = subject.basementFinished ? subjectBasement * finRate : subjectBasement * 20;
    const compVal = comp.basementFinished ? compBasement * finRate : compBasement * 20;
    adjustments.basement = Math.round(subVal - compVal);
  }

  // Condition adjustment (C1 best, C6 worst)
  const conditionMap: Record<string, number> = { C1: 6, C2: 5, C3: 4, C4: 3, C5: 2, C6: 1 };
  if (subject.condition && comp.condition) {
    const diff = (conditionMap[subject.condition] || 0) - (conditionMap[comp.condition] || 0);
    adjustments.condition = diff * 10000;
  }

  // Quality adjustment (Q1 best, Q6 worst)
  const qualityMap: Record<string, number> = { Q1: 6, Q2: 5, Q3: 4, Q4: 3, Q5: 2, Q6: 1 };
  if (subject.quality && comp.quality) {
    const diff = (qualityMap[subject.quality] || 0) - (qualityMap[comp.quality] || 0);
    adjustments.quality = diff * 12000;
  }

  // Age adjustment
  const subjectYear = typeof subject.yearBuilt === "number" ? subject.yearBuilt : 0;
  const compYear = typeof comp.yearBuilt === "number" ? comp.yearBuilt : 0;
  if (subjectYear && compYear && subjectYear !== compYear) {
    const ageDiff = compYear - subjectYear; // positive = comp is newer
    adjustments.age = ageDiff * -1500; // newer comp = negative adjustment
  }

  // Lot size adjustment
  const subjectLot = typeof subject.lotSize === "number" ? subject.lotSize : 0;
  const compLot = typeof comp.lotSize === "number" ? comp.lotSize : 0;
  if (subjectLot && compLot) {
    const lotDiff = subjectLot - compLot;
    if (Math.abs(lotDiff) > 500) {
      adjustments.lotSize = Math.round(lotDiff * 2); // ~$2/sqft for lot
    }
  }

  return adjustments;
}

/**
 * Build a full AdjustmentSet from adjustments record and comp data
 */
export function buildAdjustmentSet(
  comp: ComparableProperty,
  adjustments: Record<AdjustmentKey, number>
): AdjustmentSet {
  const salePrice = typeof comp.salePrice === "number" ? comp.salePrice : 0;
  const values = Object.values(adjustments);
  const netAdjustment = values.reduce((sum, v) => sum + v, 0);
  const grossAdjustment = values.reduce((sum, v) => sum + Math.abs(v), 0);

  return {
    compId: comp.compId,
    adjustments,
    netAdjustment,
    grossAdjustment,
    adjustedPrice: salePrice + netAdjustment,
  };
}
