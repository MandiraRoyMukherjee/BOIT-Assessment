import { useRef, useState, type DragEvent } from "react";
import { ALLOWED_EXTENSIONS, MAX_FILES, MAX_FILE_MB } from "../api";

interface Props {
  files: File[];
  disabled: boolean;
  onChange: (files: File[]) => void;
}

const extensionOf = (name: string): string => name.slice(name.lastIndexOf(".")).toLowerCase();

/** Client-side pre-checks for fast feedback only; the server re-validates everything. */
function checkFile(file: File): string | null {
  if (!(ALLOWED_EXTENSIONS as readonly string[]).includes(extensionOf(file.name))) {
    return `${file.name}: unsupported type (use PDF, TXT or CSV)`;
  }
  if (file.size === 0) return `${file.name}: file is empty`;
  if (file.size > MAX_FILE_MB * 1024 * 1024) return `${file.name}: larger than ${MAX_FILE_MB}MB`;
  return null;
}

const formatSize = (bytes: number): string =>
  bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export function UploadZone({ files, disabled, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);

  const addFiles = (incoming: File[]): void => {
    const next = [...files];
    const issues: string[] = [];
    for (const file of incoming) {
      const problem = checkFile(file);
      if (problem) issues.push(problem);
      else if (next.some((f) => f.name === file.name && f.size === file.size)) issues.push(`${file.name}: already added`);
      else if (next.length >= MAX_FILES) issues.push(`${file.name}: maximum of ${MAX_FILES} files`);
      else next.push(file);
    }
    setProblems(issues);
    onChange(next);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    setDragging(false);
    if (!disabled) addFiles(Array.from(event.dataTransfer.files));
  };

  return (
    <div>
      <div
        className={`dropzone${dragging ? " dragging" : ""}${disabled ? " disabled" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <p>
          Drag and drop documents here, or{" "}
          <button type="button" className="link" disabled={disabled} onClick={() => inputRef.current?.click()}>
            browse
          </button>
        </p>
        <p className="muted small">
          PDF, TXT or CSV · up to {MAX_FILES} files · {MAX_FILE_MB}MB each
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          accept={ALLOWED_EXTENSIONS.join(",")}
          onChange={(e) => {
            addFiles(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
      </div>

      {problems.length > 0 && (
        <ul className="problems" role="alert">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}

      {files.length > 0 && (
        <ul className="filelist">
          {files.map((file) => (
            <li key={`${file.name}-${file.size}`}>
              <span>
                {file.name} <span className="muted small">{formatSize(file.size)}</span>
              </span>
              <button
                type="button"
                className="link"
                disabled={disabled}
                aria-label={`Remove ${file.name}`}
                onClick={() => onChange(files.filter((f) => f !== file))}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
