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
];

const Doc_Extension = /\.(pdf|docx?|txt|md|csv|rtf)$/i;

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
