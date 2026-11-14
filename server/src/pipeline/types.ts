import type { Chunk, DocumentKind } from "../domain/types.js";

/** Thrown by parsers when a document is valid in type but its content cannot be read. */
export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParseError";
  }
}

export interface DocumentParser {
  readonly kind: DocumentKind;
  /** Returns location-tagged chunks. Throws ParseError when the content is unreadable. */
  parse(buffer: Buffer): Promise<Chunk[]>;
}
