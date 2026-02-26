// Types for inspection findings
export interface Finding {
  id: string;
  area: string;
  issue: string;
  classification: "Code Issue" | "Repair Issue";
  severity: "Critical" | "Major" | "Minor" | "Cosmetic";
  costLow: number;
  costHigh: number;
  recommendation: string;
  photoData?: string; // base64
}

export interface InspectionReport {
  propertyAddress: string;
  inspectionDate: string;
  inspectorSummary: string;
  findings: Finding[];
}

export async function generateReport(report: InspectionReport): Promise<void> {
  // Dynamic import for client-side only
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFillColor(27, 42, 74); // navy
  doc.rect(0, 0, pageWidth, 40, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.text("Snitch Mitch", 14, 20);
  doc.setFontSize(10);
  doc.text("Home Inspection Report", 14, 28);
  doc.text(`"The Inspector Who Can't Hold a Secret"`, 14, 34);

  // Property info
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);
  doc.text(`Property: ${report.propertyAddress || "Not specified"}`, 14, 52);
  doc.text(`Date: ${report.inspectionDate}`, 14, 60);

  // Summary
  doc.setFontSize(14);
  doc.setTextColor(199, 91, 57); // rust
  doc.text("Inspector Summary", 14, 76);
  doc.setFontSize(10);
  doc.setTextColor(74, 85, 104);
  const summaryLines = doc.splitTextToSize(report.inspectorSummary || "No summary provided.", pageWidth - 28);
  doc.text(summaryLines, 14, 84);

  let yPos = 84 + summaryLines.length * 5 + 10;

  // Findings count summary
  const criticalCount = report.findings.filter(f => f.severity === "Critical").length;
  const majorCount = report.findings.filter(f => f.severity === "Major").length;
  const minorCount = report.findings.filter(f => f.severity === "Minor").length;
  const cosmeticCount = report.findings.filter(f => f.severity === "Cosmetic").length;
  const codeIssues = report.findings.filter(f => f.classification === "Code Issue").length;
  const repairIssues = report.findings.filter(f => f.classification === "Repair Issue").length;

  doc.setFontSize(14);
  doc.setTextColor(199, 91, 57);
  doc.text("Findings Overview", 14, yPos);
  yPos += 8;

  // Summary table
  autoTable(doc, {
    startY: yPos,
    head: [["Category", "Count"]],
    body: [
      ["Critical Issues", criticalCount.toString()],
      ["Major Issues", majorCount.toString()],
      ["Minor Issues", minorCount.toString()],
      ["Cosmetic Issues", cosmeticCount.toString()],
      ["Code Violations", codeIssues.toString()],
      ["Repair Needs", repairIssues.toString()],
      ["Total Findings", report.findings.length.toString()],
    ],
    theme: "grid",
    headStyles: { fillColor: [27, 42, 74] },
    columnStyles: { 0: { cellWidth: 80 } },
    margin: { left: 14 },
  });

  // Total cost estimate
  const totalLow = report.findings.reduce((sum, f) => sum + f.costLow, 0);
  const totalHigh = report.findings.reduce((sum, f) => sum + f.costHigh, 0);

  yPos = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(12);
  doc.setTextColor(27, 42, 74);
  doc.text(`Estimated Total Cost to Cure: $${totalLow.toLocaleString()} — $${totalHigh.toLocaleString()}`, 14, yPos);

  // Detailed findings
  doc.addPage();
  doc.setFontSize(18);
  doc.setTextColor(27, 42, 74);
  doc.text("Detailed Findings", 14, 20);

  yPos = 30;

  for (const finding of report.findings) {
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }

    // Severity color
    const severityColors: Record<string, [number, number, number]> = {
      Critical: [220, 38, 38],
      Major: [234, 88, 12],
      Minor: [202, 138, 4],
      Cosmetic: [107, 114, 128],
    };

    const color = severityColors[finding.severity] || [0, 0, 0];

    doc.setFillColor(color[0], color[1], color[2]);
    doc.roundedRect(14, yPos - 4, 4, 16, 1, 1, "F");

    doc.setFontSize(11);
    doc.setTextColor(27, 42, 74);
    doc.text(finding.issue, 22, yPos + 2);

    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text(`${finding.area} | ${finding.classification} | ${finding.severity}`, 22, yPos + 8);
    doc.text(`Cost: $${finding.costLow.toLocaleString()} — $${finding.costHigh.toLocaleString()}`, 22, yPos + 14);

    if (finding.recommendation) {
      const recLines = doc.splitTextToSize(`Action: ${finding.recommendation}`, pageWidth - 36);
      doc.text(recLines, 22, yPos + 20);
      yPos += 20 + recLines.length * 4 + 8;
    } else {
      yPos += 24;
    }
  }

  // Footer on last page
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Snitch Mitch Inspection Report — Page ${i} of ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: "center" }
    );
  }

  // Download
  doc.save(`inspection-report-${new Date().toISOString().split("T")[0]}.pdf`);
}
