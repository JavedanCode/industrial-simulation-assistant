import ExcelJS, { Buffer } from "exceljs";
import { describe, expect, it } from "vitest";
import { extractWorkbook } from "../../src/server/services/reportParserService.js";

async function createWorkbookBuffer(): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();

  const summary = workbook.addWorksheet("Summary");
  summary.getCell("A1").value = "Metric";
  summary.getCell("B1").value = "Value";
  summary.getCell("A2").value = "Customers served";
  summary.getCell("B2").value = 0;
  summary.getCell("A3").value = "Utilization";
  summary.getCell("B3").value = {
    formula: "1/2",
    result: 0.5,
  };

  const emptySheet = workbook.addWorksheet("Empty Sheet");
  emptySheet.getCell("A1").value = "Present";
  emptySheet.getCell("C1").value = "After a blank cell";

  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}

describe("extractWorkbook", () => {
  it("preserves worksheet names, dimensions, and cell addresses", async () => {
    const buffer = await createWorkbookBuffer();
    const result = await extractWorkbook(buffer, "report.xlsx");

    expect(result.sourceFormat).toBe("xlsx");
    expect(result.schemaVersion).toBe(1);
    expect(result.worksheets.map((sheet) => sheet.name)).toEqual([
      "Summary",
      "Empty Sheet",
    ]);

    const summary = result.worksheets[0];

    expect(summary.rowCount).toBe(3);
    expect(summary.columnCount).toBe(2);
    expect(summary.rows[1].cells[0].address).toBe("A2");
  });

  it("distinguishes blank cells from zero values", async () => {
    const buffer = await createWorkbookBuffer();
    const result = await extractWorkbook(buffer, "report.xlsx");

    const summary = result.worksheets[0];
    const emptySheet = result.worksheets[1];

    expect(summary.rows[1].cells[1].value).toBe(0);
    expect(emptySheet.rows[0].cells[1].value).toBeNull();
    expect(emptySheet.rows[0].cells[2].value).toBe("After a blank cell");
  });

  it("preserves formula text and its cached result", async () => {
    const buffer = await createWorkbookBuffer();
    const result = await extractWorkbook(buffer, "report.xlsx");

    const formulaCell = result.worksheets[0].rows[2].cells[1];

    expect(formulaCell.formula).toBe("1/2");
    expect(formulaCell.result).toBe(0.5);
    expect(formulaCell.value).toBe(0.5);
  });

  it("accepts the xlsm extension and records the source format", async () => {
    const buffer = await createWorkbookBuffer();
    const result = await extractWorkbook(buffer, "report.xlsm");

    expect(result.sourceFormat).toBe("xlsm");
    expect(result.worksheets).toHaveLength(2);
  });

  it("rejects unsupported file extensions", async () => {
    const buffer = await createWorkbookBuffer();

    await expect(extractWorkbook(buffer, "report.csv")).rejects.toThrow(
      "Unsupported report format. Please provide an .xlsx or .xlsm file.",
    );
  });

  it("extracts formula expressions and cached results", async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Formula Test");

    worksheet.getCell("A1").value = 10;
    worksheet.getCell("B1").value = {
      formula: "A1+1",
      result: 11,
    };

    const buffer = new Uint8Array(await workbook.xlsx.writeBuffer());
    const result = await extractWorkbook(buffer, "formula-test.xlsx");

    const formulaCell = result.worksheets[0].rows[0].cells[1];

    expect(formulaCell.formula).toBe("A1+1");
    expect(formulaCell.result).toBe(11);
    expect(formulaCell.value).toBe(11);
  });

  it("warns about missing formula results and preserves ordinary zero values", async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("ContinuousTimeStatsByRep");

    worksheet.getCell("A1").value = {
      formula: "1+1",
    };

    worksheet.getCell("B1").value = 0;

    const buffer = await workbook.xlsx.writeBuffer();

    const rawWorkbook = await extractWorkbook(
      new Uint8Array(buffer),
      "formula-test.xlsx",
    );

    expect(rawWorkbook.warnings).toEqual([
      {
        code: "MISSING_FORMULA_RESULT",
        severity: "warning",
        message: "Formula has no cached result.",
        worksheet: "ContinuousTimeStatsByRep",
        cellAddress: "A1",
      },
    ]);

    expect(rawWorkbook.worksheets[0]?.rows[0]?.cells[0]?.formula).toBe("1+1");
    expect(rawWorkbook.worksheets[0]?.rows[0]?.cells[1]?.value).toBe(0);
  });

  it("warns about Excel error cells and identifies their location", async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("OutputStatsByRep");

    worksheet.getCell("A1").value = {
      error: "#VALUE!",
    };

    const buffer = await workbook.xlsx.writeBuffer();

    const rawWorkbook = await extractWorkbook(
      new Uint8Array(buffer),
      "error-test.xlsx",
    );

    expect(rawWorkbook.warnings).toContainEqual(
      expect.objectContaining({
        code: "EXCEL_ERROR_VALUE",
        severity: "warning",
        worksheet: "OutputStatsByRep",
        cellAddress: "A1",
      }),
    );
  });
});
