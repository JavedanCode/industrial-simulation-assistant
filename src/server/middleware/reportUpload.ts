import multer from "multer";
import { extname } from "node:path";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const allowedExtensions = new Set([".xlsx", ".xlsm"]);

export const reportUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
  },
  fileFilter: (_req, file, callback) => {
    const extension = extname(file.originalname).toLowerCase();

    if (!allowedExtensions.has(extension)) {
      callback(
        new Error(
          "Unsupported report format. Please upload an .xlsx or .xlsm file.",
        ),
      );
      return;
    }

    callback(null, true);
  },
});
