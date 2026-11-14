import { describe, expect, it } from "vitest";
import { sanitizeFilename, validateFile, type UploadedFileLike } from "./fileValidation.js";

function file(name: string, mimetype: string, content: string | Buffer): UploadedFileLike {
  const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content);
  return { originalname: name, mimetype, size: buffer.length, buffer };
}

describe("validateFile", () => {
  it("accepts a plain text file", () => {
    const result = validateFile(file("notes.txt", "text/plain", "hello"));
    expect(result).toMatchObject({ ok: true, kind: "text" });
  });

  it("accepts a CSV declared as vnd.ms-excel", () => {
    const result = validateFile(file("data.csv", "application/vnd.ms-excel", "a,b\n1,2"));
    expect(result).toMatchObject({ ok: true, kind: "csv" });
  });

  it("accepts a PDF with valid magic bytes", () => {
    const result = validateFile(file("a.pdf", "application/pdf", "%PDF-1.4\n..."));
    expect(result).toMatchObject({ ok: true, kind: "pdf" });
  });

  it("accepts generic octet-stream for text files (content is sniffed instead)", () => {
    const result = validateFile(file("data.csv", "application/octet-stream", "a,b\n1,2"));
    expect(result).toMatchObject({ ok: true, kind: "csv" });
  });

  it("rejects unsupported extensions", () => {
    const result = validateFile(file("run.exe", "application/octet-stream", "MZ"));
    expect(result).toMatchObject({ ok: false, status: "unsupported" });
  });

  it("rejects a .pdf that is not really a PDF", () => {
    const result = validateFile(file("fake.pdf", "application/pdf", "just text"));
    expect(result).toMatchObject({ ok: false, status: "invalid" });
  });

  it("rejects a MIME/extension mismatch", () => {
    const result = validateFile(file("a.txt", "application/pdf", "hello"));
    expect(result).toMatchObject({ ok: false, status: "invalid" });
  });

  it("rejects empty files", () => {
    const result = validateFile(file("empty.txt", "text/plain", ""));
    expect(result).toMatchObject({ ok: false, status: "invalid", reason: "File is empty." });
  });

  it("rejects binary content disguised as text", () => {
    const result = validateFile(file("bin.txt", "text/plain", Buffer.from([0x41, 0x00, 0x42])));
    expect(result).toMatchObject({ ok: false, status: "invalid" });
  });
});

describe("sanitizeFilename", () => {
  it("removes path traversal and unsafe characters", () => {
    expect(sanitizeFilename("../../etc/pass<wd>.txt")).toBe("pass_wd_.txt");
    expect(sanitizeFilename("C:\\temp\\report.pdf")).toBe("report.pdf");
  });

  it("falls back for empty names", () => {
    expect(sanitizeFilename("...")).toBe("unnamed");
  });
});
