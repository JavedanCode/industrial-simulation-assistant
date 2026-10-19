import ExcelJS from "exceljs";
import { extname } from "node:path";
import type {
  RawCell,
  RawCellValue,
  RawWorkbook,
} from "../../models/RawWorkbook.js";
import type { ReportWarning } from "../../models/ReportWarning.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toRawCellValue(value: unknown): RawCellValue {
  if (value === null || value === undefined) {
    return null;
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (isRecord(item) && typeof item.text === "string") {
          return item.text;
        }

        return String(item);
      })
      .join("");
  }

  if (isRecord(value)) {
    if (typeof value.text === "string") {
      return value.text;
    }

    if (typeof value.hyperlink === "string") {
      return value.hyperlink;
    }

    if (typeof value.error === "string") {
      return value.error;
    }

    if (Array.isArray(value.richText)) {
      return value.richText
        .map((part) => {
          if (isRecord(part) && typeof part.text === "string") {
            return part.text;
          }

          return "";
        })
        .join("");
    }

    return JSON.stringify(value);
  }

  return String(value);
}

function extractCell(
  cell: ExcelJS.Cell,
  worksheetName: string,
  warnings: ReportWarning[],
): RawCell {
  const rawValue: unknown = cell.value;
  const rawType = ExcelJS.ValueType[cell.type] ?? String(cell.type);

  const isFormula =
    isRecord(rawValue) &&
    (typeof rawValue.formula === "string" ||
      typeof rawValue.sharedFormula === "string");

  const formulaResult = isFormula ? rawValue.result : undefined;

  const cachedResult =
    formulaResult ?? (isFormula ? cell.model.result : undefined);

  const result: RawCell = {
    address: cell.address,
    value: isFormula ? toRawCellValue(cachedResult) : toRawCellValue(rawValue),
    type: rawType,
  };

  if (
    !isFormula &&
    (cell.type === ExcelJS.ValueType.Error ||
      (isRecord(rawValue) && typeof rawValue.error === "string"))
  ) {
    const errorValue =
      isRecord(rawValue) && typeof rawValue.error === "string"
        ? rawValue.error
        : String(rawValue);

    warnings.push({
      code: "EXCEL_ERROR_VALUE",
      severity: "warning",
      message: `Excel cell contains an error value: ${errorValue}.`,
      worksheet: worksheetName,
      cellAddress: cell.address,
    });
  }

  if (isFormula && isRecord(rawValue)) {
    // ExcelJS resolves shared formulas through the cell's formula getter.
    const resolvedFormula = cell.formula;

    if (typeof resolvedFormula === "string") {
      result.formula = resolvedFormula;
    }

    const hasMissingResult =
      cachedResult === undefined || cachedResult === null;

    if (hasMissingResult) {
      warnings.push({
        code: "MISSING_FORMULA_RESULT",
        severity: "warning",
        message: "Formula has no cached result.",
        worksheet: worksheetName,
        cellAddress: cell.address,
      });
    } else {
      result.result = toRawCellValue(cachedResult);
    }
  }

  return result;
}

export async function extractWorkbook(
  buffer: Uint8Array,
  fileName: string,
): Promise<RawWorkbook> {
  const extension = extname(fileName).toLowerCase();

  if (extension !== ".xlsx" && extension !== ".xlsm") {
    throw new Error(
      "Unsupported report format. Please provide an .xlsx or .xlsm file.",
    );
  }

  const workbook = new ExcelJS.Workbook();

  const arrayBuffer = new ArrayBuffer(buffer.byteLength);
  new Uint8Array(arrayBuffer).set(buffer);

  await workbook.xlsx.load(arrayBuffer);

  const warnings: ReportWarning[] = [];

  const worksheets = workbook.worksheets.map((worksheet) => {
    const rows = [];

    for (let rowNumber = 1; rowNumber <= worksheet.rowCount; rowNumber++) {
      const cells: RawCell[] = [];

      for (
        let columnNumber = 1;
        columnNumber <= worksheet.columnCount;
        columnNumber++
      ) {
        cells.push(
          extractCell(
            worksheet.getCell(rowNumber, columnNumber),
            worksheet.name,
            warnings,
          ),
        );
      }

      rows.push({
        excelRow: rowNumber,
        cells,
      });
    }

    return {
      name: worksheet.name,
      rowCount: worksheet.rowCount,
      columnCount: worksheet.columnCount,
      rows,
    };
  });

  return {
    schemaVersion: 1,
    sourceFormat: extension === ".xlsm" ? "xlsm" : "xlsx",
    worksheets,
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}
