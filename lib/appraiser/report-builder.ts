import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { AppraisalReport } from "./types";
import { ADJUSTMENT_CATEGORIES } from "./types";

export function generateAppraisalReport(report: AppraisalReport) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // ===== Page 1: Cover / Summary =====

  // Header
  doc.setFillColor(27, 58, 107); // navy
  doc.rect(0, 0, pageWidth, 42, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.text("AI Appraiser", 14, 20);
  doc.setFontSize(10);
  doc.text("Residential Appraisal Report", 14, 28);
  doc.setTextColor(249, 115, 22); // rust
  doc.text("Powered by TopRealtyTools.com", 14, 36);

  // Subject Property Info
  let yPos = 54;
  doc.setTextColor(27, 58, 107);
  doc.setFontSize(14);
  doc.text("Subject Property", 14, yPos);
  yPos += 8;
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(10);
  doc.text(`Address: ${report.subject.address}`, 14, yPos); yPos += 5;
  doc.text(`${report.subject.city}, ${report.subject.state} ${report.subject.zip}`, 14, yPos); yPos += 8;

  const subjectDetails = [
    ["Property Type", report.subject.propertyType],
    ["Year Built", String(report.subject.yearBuilt || "N/A")],
    ["GLA (sq ft)", String(report.subject.gla || "N/A")],
    ["Lot Size (sq ft)", String(report.subject.lotSize || "N/A")],
    ["Bedrooms", String(report.subject.bedrooms || "N/A")],
    ["Bathrooms", String(report.subject.bathrooms || "N/A")],
    ["Condition", report.subject.condition || "N/A"],
    ["Quality", report.subject.quality || "N/A"],
    ["Garage", `${report.subject.garageType} (${report.subject.garageSpaces || 0} spaces)`],
    ["Pool", report.subject.pool ? "Yes" : "No"],
    ["Basement", report.subject.basementSqFt ? `${report.subject.basementSqFt} sqft (${report.subject.basementFinished ? "Finished" : "Unfinished"})` : "None"],
    ["View", report.subject.view || "N/A"],
  ];

  autoTable(doc, {
    startY: yPos,
    head: [["Feature", "Detail"]],
    body: subjectDetails,
    headStyles: { fillColor: [27, 58, 107] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 },
    styles: { fontSize: 9 },
  });

  // ===== Page 2: Comparable Sales =====
  doc.addPage();
  doc.setFillColor(27, 58, 107);
  doc.rect(0, 0, pageWidth, 12, "F");

  doc.setTextColor(27, 58, 107);
  doc.setFontSize(16);
  doc.text("Comparable Sales", 14, 24);

  yPos = 32;
  report.comparables.forEach((comp, i) => {
    if (yPos > 240) {
      doc.addPage();
      doc.setFillColor(27, 58, 107);
      doc.rect(0, 0, pageWidth, 12, "F");
      yPos = 24;
    }

    doc.setFontSize(11);
    doc.setTextColor(249, 115, 22);
    doc.text(`Comparable ${i + 1}: ${comp.address}`, 14, yPos);
    yPos += 6;

    const compDetails = [
      ["Sale Price", `$${Number(comp.salePrice).toLocaleString()}`],
      ["Sale Date", comp.saleDate || "N/A"],
      ["Distance", comp.distance || "N/A"],
      ["GLA", `${comp.gla || "N/A"} sqft`],
      ["Lot Size", `${comp.lotSize || "N/A"} sqft`],
      ["Year Built", String(comp.yearBuilt || "N/A")],
      ["Beds/Baths", `${comp.bedrooms || "N/A"} / ${comp.bathrooms || "N/A"}`],
      ["Condition/Quality", `${comp.condition || "N/A"} / ${comp.quality || "N/A"}`],
      ["Garage", `${comp.garageType} (${comp.garageSpaces || 0})`],
      ["Pool", comp.pool ? "Yes" : "No"],
      ["Source", comp.dataSource || "N/A"],
    ];

    autoTable(doc, {
      startY: yPos,
      body: compDetails,
      headStyles: { fillColor: [27, 58, 107] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 14, right: 14 },
      styles: { fontSize: 8 },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 40 } },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;
  });

  // ===== Page 3: Adjustment Grid =====
  doc.addPage();
  doc.setFillColor(27, 58, 107);
  doc.rect(0, 0, pageWidth, 12, "F");

  doc.setTextColor(27, 58, 107);
  doc.setFontSize(16);
  doc.text("Adjustment Grid", 14, 24);

  const adjHead = ["Category", ...report.adjustments.map((_, i) => `Comp ${i + 1}`)];
  const adjBody: string[][] = ADJUSTMENT_CATEGORIES.map(cat => {
    const row: string[] = [cat.label];
    report.adjustments.forEach(as => {
      const val = as.adjustments[cat.key];
      row.push(val === 0 ? "-" : `$${val.toLocaleString()}`);
    });
    return row;
  });

  // Add totals rows
  adjBody.push(["Net Adjustment", ...report.adjustments.map(as => `$${as.netAdjustment.toLocaleString()}`)]);
  adjBody.push(["Gross Adjustment", ...report.adjustments.map(as => `$${as.grossAdjustment.toLocaleString()}`)]);
  adjBody.push(["Adjusted Sale Price", ...report.adjustments.map(as => `$${as.adjustedPrice.toLocaleString()}`)]);

  autoTable(doc, {
    startY: 32,
    head: [adjHead],
    body: adjBody,
    headStyles: { fillColor: [27, 58, 107], fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 2 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 },
    didParseCell: (data: any) => {
      // Bold the last 3 rows (totals)
      if (data.section === "body" && data.row.index >= adjBody.length - 3) {
        data.cell.styles.fontStyle = "bold";
        if (data.row.index === adjBody.length - 1) {
          data.cell.styles.fillColor = [27, 58, 107];
          data.cell.styles.textColor = [255, 255, 255];
        }
      }
    },
  });

  // ===== Page 4: Reconciliation =====
  doc.addPage();
  doc.setFillColor(27, 58, 107);
  doc.rect(0, 0, pageWidth, 12, "F");

  doc.setTextColor(27, 58, 107);
  doc.setFontSize(16);
  doc.text("Value Reconciliation", 14, 24);

  yPos = 34;

  // Comp weights table
  const weightRows = report.adjustments.map((as, i) => {
    const weight = report.reconciliation.compWeights[as.compId] || 0;
    return [`Comp ${i + 1}`, `$${as.adjustedPrice.toLocaleString()}`, `${weight}%`, `$${Math.round(as.adjustedPrice * weight / 100).toLocaleString()}`];
  });

  autoTable(doc, {
    startY: yPos,
    head: [["Comparable", "Adjusted Price", "Weight", "Contribution"]],
    body: weightRows,
    headStyles: { fillColor: [27, 58, 107] },
    margin: { left: 14, right: 14 },
    styles: { fontSize: 10 },
  });

  yPos = (doc as any).lastAutoTable.finalY + 14;

  // Final value
  doc.setFillColor(27, 58, 107);
  doc.roundedRect(14, yPos, pageWidth - 28, 30, 4, 4, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.text("OPINION OF VALUE", pageWidth / 2, yPos + 10, { align: "center" });
  doc.setFontSize(22);
  doc.text(`$${report.reconciliation.finalValue.toLocaleString()}`, pageWidth / 2, yPos + 23, { align: "center" });

  yPos += 40;

  if (report.reconciliation.valueRange.low > 0) {
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(10);
    doc.text(
      `Value Range: $${report.reconciliation.valueRange.low.toLocaleString()} — $${report.reconciliation.valueRange.high.toLocaleString()}`,
      pageWidth / 2, yPos, { align: "center" }
    );
    yPos += 8;
  }

  doc.text(`Effective Date: ${report.reconciliation.effectiveDate}`, pageWidth / 2, yPos, { align: "center" });
  yPos += 12;

  if (report.reconciliation.comments) {
    doc.setTextColor(27, 58, 107);
    doc.setFontSize(11);
    doc.text("Reconciliation Comments:", 14, yPos);
    yPos += 6;
    doc.setTextColor(71, 85, 105);
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(report.reconciliation.comments, pageWidth - 28);
    doc.text(lines, 14, yPos);
  }

  // Footer on each page
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(160, 160, 160);
    doc.text(
      `AI Appraiser Report — ${report.subject.address} — Page ${i} of ${totalPages}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: "center" }
    );
  }

  doc.save(`Appraisal_${report.subject.address.replace(/\s+/g, "_") || "Report"}.pdf`);
}
