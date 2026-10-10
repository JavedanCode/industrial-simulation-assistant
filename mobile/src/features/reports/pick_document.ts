import * as DocumentPicker from "expo-document-picker";

const Doc_Types = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/rtf",
  "text/rtf",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel.sheet.macroEnabled.12",
];

const Doc_Extension = /\.(pdf|docx?|txt|md|csv|rtf|xls|xlsx|xlsm)$/i;

export async function pickDoc() {
  const result = await DocumentPicker.getDocumentAsync({
    type: Doc_Types,
    multiple: false,
    copyToCacheDirectory: true,
    base64: false,
  });

  if (result.canceled) {
    return null;
  }

  const document = result.assets[0];

  if (!document) {
    throw new Error("No document was selected.");
  }

  if (!Doc_Extension.test(document.name)) {
    throw new Error("Not an allowed document type.");
  }

  return document;
}
