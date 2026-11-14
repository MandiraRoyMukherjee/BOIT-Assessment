import { extractText, getDocumentProxy } from "unpdf";
import type { Chunk } from "../../domain/types.js";
import { chunkPage } from "../chunking.js";
import { ParseError, type DocumentParser } from "../types.js";

export const pdfParser: DocumentParser = {
  kind: "pdf",
  async parse(buffer: Buffer): Promise<Chunk[]> {
    let pages: string[];
    try {
      // Copy: pdf.js takes ownership of (detaches) the underlying buffer.
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      const extracted = await extractText(pdf, { mergePages: false });
      pages = extracted.text;
    } catch {
      throw new ParseError("PDF could not be read (corrupt, encrypted or malformed).");
    }

    const chunks = pages.flatMap((text, i) =>
      text.trim() === "" ? [] : chunkPage(i + 1, text.trim()),
    );
    if (chunks.length === 0) {
      throw new ParseError("PDF has no extractable text (scanned images need OCR, which is not supported).");
    }
    return chunks;
  },
};
