import * as DocumentPicker from "expo-document-picker";
import { Platform } from "react-native";

const Doc_Types = [
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel.sheet.macroEnabled.12",
];

const Doc_Extension = /\.(xls|xlsx|xlsm)$/i;

export async function pickDoc() {
  const result = await DocumentPicker.getDocumentAsync({
    type: Doc_Types,
    multiple: false,
    // Android: retain the URI granted by the system picker. Saving copies it
    // into Paths.document; the picker's cache may be outside Expo Go's scope.
    copyToCacheDirectory: Platform.OS !== "android",
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
