import { type SubjectProperty, type ComparableProperty, EMPTY_SUBJECT, createEmptyComp } from "./types";

// ===== CSV Parsing Utilities =====

/**
 * Parse a CSV string into rows of key-value pairs.
 * Handles quoted fields with commas inside.
 */
function parseCSVRows(csv: string): Record<string, string>[] {
    const lines = csv.trim().split(/\r?\n/);
    if (lines.length < 2) return [];

  // Parse header row
  const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());

  const rows: Record<string, string>[] = [];
    for (let i = 1; i < lines.length; i++) {
          const values = parseCSVLine(lines[i]);
          if (values.every(v => !v.trim())) continue; // skip empty rows
      const row: Record<string, string> = {};
          headers.forEach((h, idx) => {
                  row[h] = (values[idx] || "").trim();
          });
          rows.push(row);
    }
    return rows;
}

/** Parse a single CSV line respecting quoted fields */
function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
                if (ch === '"' && line[i + 1] === '"') {
                          current += '"';
                          i++;
                } else if (ch === '"') {
                          inQuotes = false;
                } else {
                          current += ch;
                }
        } else {
                if (ch === '"') {
                          inQuotes = true;
                } else if (ch === ",") {
                          result.push(current);
                          current = "";
                } else {
                          current += ch;
                }
        }
  }
    result.push(current);
    return result;
}

// ===== Column name mapping =====
// Maps common CSV header variations to our property field names

const SUBJECT_FIELD_MAP: Record<string, keyof SubjectProperty> = {
    address: "address",
    "street address": "address",
    street: "address",
    city: "city",
    state: "state",
    zip: "zip",
    zipcode: "zip",
    "zip code": "zip",
    "property type": "propertyType",
    propertytype: "propertyType",
    type: "propertyType",
    "year built": "yearBuilt",
    yearbuilt: "yearBuilt",
    year: "yearBuilt",
    gla: "gla",
    "gross living area": "gla",
    sqft: "gla",
    "sq ft": "gla",
    "living area": "gla",
    "lot size": "lotSize",
    lotsize: "lotSize",
    lot: "lotSize",
    "lot sqft": "lotSize",
    bedrooms: "bedrooms",
    beds: "bedrooms",
    bed: "bedrooms",
    bathrooms: "bathrooms",
    baths: "bathrooms",
    bath: "bathrooms",
    "garage type": "garageType",
    garagetype: "garageType",
    garage: "garageType",
    "garage spaces": "garageSpaces",
    garagespaces: "garageSpaces",
    condition: "condition",
    quality: "quality",
    pool: "pool",
    "basement sqft": "basementSqFt",
    basementsqft: "basementSqFt",
    basement: "basementSqFt",
    "basement finished": "basementFinished",
    basementfinished: "basementFinished",
    view: "view",
    notes: "notes",
};

const COMP_EXTRA_FIELDS: Record<string, keyof ComparableProperty> = {
    "sale price": "salePrice",
    saleprice: "salePrice",
    price: "salePrice",
    "sold price": "salePrice",
    "sale date": "saleDate",
    saledate: "saleDate",
    "sold date": "saleDate",
    "date sold": "saleDate",
    date: "saleDate",
    distance: "distance",
    "data source": "dataSource",
    datasource: "dataSource",
    source: "dataSource",
    mls: "dataSource",
    "mls#": "dataSource",
    "mls number": "dataSource",
};

// Merge both maps for comp parsing
const COMP_FIELD_MAP: Record<string, keyof ComparableProperty> = {
    ...SUBJECT_FIELD_MAP,
    ...COMP_EXTRA_FIELDS,
} as Record<string, keyof ComparableProperty>;

// ===== Value coercion helpers =====

function toNumber(val: string): number | "" {
    const cleaned = val.replace(/[$,\s]/g, "");
    const n = Number(cleaned);
    return isNaN(n) || cleaned === "" ? "" : n;
}

function toBoolean(val: string): boolean {
    return ["true", "yes", "1", "y"].includes(val.toLowerCase());
}

function mapPropertyType(val: string): SubjectProperty["propertyType"] {
    const v = val.toLowerCase();
    if (v.includes("sfr") || v.includes("single")) return "SFR";
    if (v.includes("condo")) return "Condo";
    if (v.includes("town")) return "Townhouse";
    if (v.includes("multi")) return "Multi-Family";
    return "Other";
}

function mapGarageType(val: string): SubjectProperty["garageType"] {
    const v = val.toLowerCase();
    if (v.includes("attach")) return "Attached";
    if (v.includes("detach")) return "Detached";
    if (v.includes("carport")) return "Carport";
    if (v === "none" || v === "" || v === "no") return "None";
    return "Attached"; // default if they just put a number
}

function mapCondition(val: string): SubjectProperty["condition"] {
    const v = val.toUpperCase().trim();
    if (["C1", "C2", "C3", "C4", "C5", "C6"].includes(v)) return v as SubjectProperty["condition"];
    // Try numeric
  const n = parseInt(val);
    if (n >= 1 && n <= 6) return `C${n}` as SubjectProperty["condition"];
    return "";
}

function mapQuality(val: string): SubjectProperty["quality"] {
    const v = val.toUpperCase().trim();
    if (["Q1", "Q2", "Q3", "Q4", "Q5", "Q6"].includes(v)) return v as SubjectProperty["quality"];
    const n = parseInt(val);
    if (n >= 1 && n <= 6) return `Q${n}` as SubjectProperty["quality"];
    return "";
}

/** Set a field value on a property object with proper type coercion */
function setFieldValue(obj: any, field: string, rawValue: string) {
    if (!rawValue) return;

  switch (field) {
    case "yearBuilt":
    case "gla":
    case "lotSize":
    case "bedrooms":
    case "garageSpaces":
    case "basementSqFt":
    case "salePrice":
            obj[field] = toNumber(rawValue);
            break;
    case "bathrooms":
            obj[field] = toNumber(rawValue);
            break;
    case "propertyType":
            obj[field] = mapPropertyType(rawValue);
            break;
    case "garageType":
            obj[field] = mapGarageType(rawValue);
            break;
    case "condition":
            obj[field] = mapCondition(rawValue);
            break;
    case "quality":
            obj[field] = mapQuality(rawValue);
            break;
    case "pool":
    case "basementFinished":
            obj[field] = toBoolean(rawValue);
            break;
    default:
            obj[field] = rawValue;
  }
}

// ===== Public API =====

/**
 * Parse a CSV file and return a SubjectProperty.
 * Expects 1 data row (the subject). If multiple rows, uses the first.
 */
export function parseSubjectCSV(csv: string): { subject: SubjectProperty; warnings: string[] } {
    const warnings: string[] = [];
    const rows = parseCSVRows(csv);

  if (rows.length === 0) {
        return { subject: { ...EMPTY_SUBJECT }, warnings: ["No data rows found in CSV."] };
  }

  if (rows.length > 1) {
        warnings.push(`Found ${rows.length} rows — using the first row as the subject property.`);
  }

  const row = rows[0];
    const subject: SubjectProperty = { ...EMPTY_SUBJECT };

  // Map CSV columns to subject fields
  for (const [csvCol, rawVal] of Object.entries(row)) {
        const field = SUBJECT_FIELD_MAP[csvCol.toLowerCase()];
        if (field) {
                setFieldValue(subject, field, rawVal);
        } else if (rawVal) {
                warnings.push(`Unknown column "${csvCol}" — skipped.`);
        }
  }

  if (!subject.address) {
        warnings.push("No address found. Make sure your CSV has an 'address' column.");
  }

  return { subject, warnings };
}

/**
 * Parse a CSV file and return an array of ComparableProperties.
 * Each row becomes one comp.
 */
export function parseCompsCSV(csv: string): { comps: ComparableProperty[]; warnings: string[] } {
    const warnings: string[] = [];
    const rows = parseCSVRows(csv);

  if (rows.length === 0) {
        return { comps: [], warnings: ["No data rows found in CSV."] };
  }

  if (rows.length > 6) {
        warnings.push(`Found ${rows.length} rows — only the first 6 will be used (max 6 comps).`);
  }

  const comps: ComparableProperty[] = [];

  for (const row of rows.slice(0, 6)) {
        const comp = createEmptyComp();

      for (const [csvCol, rawVal] of Object.entries(row)) {
              const field = COMP_FIELD_MAP[csvCol.toLowerCase()];
              if (field) {
                        setFieldValue(comp, field, rawVal);
              }
      }

      // Only add if it has at least an address or sale price
      if (comp.address || comp.salePrice) {
              comps.push(comp);
      }
  }

  if (comps.length === 0) {
        warnings.push("No valid comps found. Each row needs at least an address or sale price.");
  }

  return { comps, warnings };
}

// ===== CSV Template Generators =====

export function getSubjectCSVTemplate(): string {
    return `address,city,state,zip,property type,year built,gla,lot size,bedrooms,bathrooms,garage type,garage spaces,condition,quality,pool,basement sqft,basement finished,view,notes
    "123 Main St",Austin,TX,78701,SFR,2005,2200,7500,4,2.5,Attached,2,C3,Q3,No,0,No,"City view",""`;
}

export function getCompsCSVTemplate(): string {
    return `address,city,state,zip,sale price,sale date,distance,property type,year built,gla,lot size,bedrooms,bathrooms,garage type,garage spaces,condition,quality,pool,data source
    "456 Oak Ave",Austin,TX,78701,350000,2025-12-15,"0.3 mi",SFR,2003,2100,7200,4,2,Attached,2,C3,Q3,No,MLS#12345
    "789 Elm St",Austin,TX,78702,375000,2025-11-20,"0.5 mi",SFR,2008,2300,8000,4,2.5,Attached,2,C3,Q4,Yes,MLS#12346`;
}
