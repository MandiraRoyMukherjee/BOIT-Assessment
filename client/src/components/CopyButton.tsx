import { useState } from "react";

interface Props {
  label: string;
  getText: () => string;
}

/** Copies text to the clipboard, with a fallback for non-secure contexts. */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}

export function CopyButton({ label, getText }: Props) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  const onClick = async (): Promise<void> => {
    const ok = await copyText(getText());
    setState(ok ? "copied" : "failed");
    window.setTimeout(() => setState("idle"), 2000);
  };

  return (
    <button type="button" className="btn secondary" onClick={onClick}>
      {state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : label}
    </button>
  );
}
