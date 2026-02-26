export interface SubjectProperty {
  address: string;
  city: string;
  state: string;
  zip: string;
  propertyType: "SFR" | "Condo" | "Townhouse" | "Multi-Family" | "Other";
  yearBuilt: number | "";
  gla: number | ""; // Gross Living Area (sq ft)
  lotSize: number | ""; // sq ft
  bedrooms: number | "";
  bathrooms: number | "";
  garageType: "None" | "Attached" | "Detached" | "Carport";
  garageSpaces: number | "";
  condition: "C1" | "C2" | "C3" | "C4" | "C5" | "C6" | "";
  quality: "Q1" | "Q2" | "Q3" | "Q4" | "Q5" | "Q6" | "";
  pool: boolean;
  basementSqFt: number | "";
  basementFinished: boolean;
  view: string;
  notes: string;
}

export interface ComparableProperty extends SubjectProperty {
  compId: string;
  salePrice: number | "";
  saleDate: string;
  distance: string; // e.g., "0.3 mi"
  dataSource: string; // e.g., "MLS#12345"
}

export const ADJUSTMENT_CATEGORIES = [
  { key: "location", label: "Location" },
  { key: "saleDate", label: "Date of Sale / Time" },
  { key: "lotSize", label: "Site / Lot Size" },
  { key: "view", label: "View" },
  { key: "quality", label: "Quality of Construction" },
  { key: "condition", label: "Condition" },
  { key: "age", label: "Age / Effective Age" },
  { key: "gla", label: "Gross Living Area" },
  { key: "basement", label: "Basement & Finished" },
  { key: "garage", label: "Garage / Carport" },
  { key: "pool", label: "Pool" },
  { key: "other", label: "Other" },
] as const;

export type AdjustmentKey = typeof ADJUSTMENT_CATEGORIES[number]["key"];

export interface AdjustmentSet {
  compId: string;
  adjustments: Record<AdjustmentKey, number>;
  netAdjustment: number;
  grossAdjustment: number;
  adjustedPrice: number;
}

export interface Reconciliation {
  compWeights: Record<string, number>; // compId -> weight (0-100)
  finalValue: number;
  valueRange: { low: number; high: number };
  effectiveDate: string;
  comments: string;
}

export interface AppraisalReport {
  subject: SubjectProperty;
  comparables: ComparableProperty[];
  adjustments: AdjustmentSet[];
  reconciliation: Reconciliation;
  appraiserName: string;
  reportDate: string;
}

export const EMPTY_SUBJECT: SubjectProperty = {
  address: "",
  city: "",
  state: "",
  zip: "",
  propertyType: "SFR",
  yearBuilt: "",
  gla: "",
  lotSize: "",
  bedrooms: "",
  bathrooms: "",
  garageType: "None",
  garageSpaces: "",
  condition: "",
  quality: "",
  pool: false,
  basementSqFt: "",
  basementFinished: false,
  view: "",
  notes: "",
};

export function createEmptyComp(): ComparableProperty {
  return {
    ...EMPTY_SUBJECT,
    compId: crypto.randomUUID(),
    salePrice: "",
    saleDate: "",
    distance: "",
    dataSource: "",
  };
}
