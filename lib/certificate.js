import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb } from "pdf-lib";
import { wib } from "./format.js";

let fontFile;
const COLORS = {
  paper: rgb(0.96, 0.98, 0.95),
  forest: rgb(0.09, 0.27, 0.20),
  ink: rgb(0.07, 0.16, 0.12),
  border: rgb(0.62, 0.73, 0.65),
};

export async function certificatePDF(record) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  fontFile ??= readFile(path.join(process.cwd(), "assets", "pdf", "NotoSans-Regular.ttf"));
  const font = await pdf.embedFont(await fontFile, { subset: true });
  pdf.setTitle("Sertifikat GreenEvent " + record.code);
  pdf.setAuthor("GreenEvent");
  pdf.setCreationDate(new Date(record.issued_at));
  pdf.setModificationDate(new Date(record.issued_at));
  const width = 842;
  const height = 595;
  const page = pdf.addPage([width, height]);

  function center(text, y, size, color = COLORS.ink, maxWidth = 690) {
    const measured = font.widthOfTextAtSize(text, size);
    const fit = size * Math.min(1, maxWidth / Math.max(1, measured));
    page.drawText(text, { x: (width - font.widthOfTextAtSize(text, fit)) / 2, y, size: fit, font, color });
  }

  page.drawRectangle({ x: 0, y: 0, width, height, color: COLORS.paper });
  page.drawRectangle({ x: 0, y: height - 18, width, height: 18, color: COLORS.forest });
  page.drawRectangle({ x: 32, y: 32, width: width - 64, height: height - 64, borderColor: COLORS.border, borderWidth: 1 });
  center("GreenEvent", 487, 17, COLORS.forest);
  center("Sertifikat Partisipasi", 424, 40);
  center("Diberikan kepada", 376, 14);
  center(record.participant_name, 319, 33, COLORS.forest);
  center("atas partisipasi dan kehadirannya dalam kegiatan", 268, 14);
  center(record.event_title, 226, 25);
  center(wib(record.event_date), 192, 13);
  page.drawLine({ start: { x: 356, y: 151 }, end: { x: 486, y: 151 }, thickness: 1, color: COLORS.border });
  center(record.organizer_name, 123, 14);
  center("Panitia penyelenggara", 102, 10);
  center(record.code, 58, 9, COLORS.forest);
  return pdf.save();
}
