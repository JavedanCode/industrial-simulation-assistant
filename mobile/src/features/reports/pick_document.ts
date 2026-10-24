import * as DocumentPicker from "expo-document-picker";
import { Platform } from "react-native";

import {
  REPORT_FILE_TYPES,
  REPORT_FORMAT_ERROR,
  isExcelReport,
} from "./report_file_types";

export async function pickDoc() {
  const result = await DocumentPicker.getDocumentAsync({
    type: REPORT_FILE_TYPES,
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

  if (!isExcelReport(document.name)) {
    throw new Error(REPORT_FORMAT_ERROR);
  }

  return document;
}
