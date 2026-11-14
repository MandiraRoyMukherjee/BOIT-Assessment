const EXAMPLES = [
  "Compare the information across all uploaded documents.",
  "Identify inconsistencies between the application form and supporting documents.",
  "Extract key dates, obligations, financial values, and missing information.",
  "Highlight discrepancies in names, addresses, licence details, or revenue figures.",
];

interface Props {
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}

export const MAX_PROMPT_CHARS = 2000;

export function PromptInput({ value, disabled, onChange }: Props) {
  return (
    <div>
      <label htmlFor="prompt" className="label">
        Analysis instruction
      </label>
      <textarea
        id="prompt"
        rows={4}
        maxLength={MAX_PROMPT_CHARS}
        value={value}
        disabled={disabled}
        placeholder="Describe what you want to find out from the documents…"
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="chips">
        {EXAMPLES.map((example) => (
          <button key={example} type="button" className="chip" disabled={disabled} onClick={() => onChange(example)}>
            {example}
          </button>
        ))}
      </div>
    </div>
  );
}
