import multer from "multer";
import path from "path";
import fs from "fs";
import { Request } from "express";

const UPLOAD_DIR = path.join(process.cwd(), process.env.UPLOAD_DIR || "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowed = /jpeg|jpg|png|webp|pdf/;
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.test(ext)) cb(null, true);
  else cb(new Error("Only images (jpg, png, webp) and PDFs are allowed"));
};

const MAX_MB = parseInt(process.env.MAX_FILE_SIZE_MB || "5");

export const uploadImage  = multer({ storage, fileFilter, limits: { fileSize: MAX_MB * 1024 * 1024 } }).single("image");
export const uploadProof  = multer({ storage, fileFilter, limits: { fileSize: 8 * 1024 * 1024 } }).single("proof");
