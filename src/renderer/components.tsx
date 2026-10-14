import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { X, Keyboard, Volume2 } from "lucide-react";

export function Modal({
  title,
  close,
  children,
  wide = false,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      className={`modal ${wide ? "wide" : ""}`}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button className="icon-button" aria-label="Fermer" onClick={close}>
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Volume({
  value,
  onChange,
  label,
  compact = false,
}: {
  value: number;
  onChange: (volume: number) => void;
  label: string;
  compact?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    if (draft !== value) onChange(draft);
  };
  return (
    <label className={`volume ${compact ? "compact" : ""}`}>
      <span>
        <Volume2 size={17} />
        {!compact && label}
      </span>
      <input
        aria-label={label}
        type="range"
        min="0"
        max="100"
        value={Math.round(draft * 100)}
        onChange={(e) => setDraft(Number(e.target.value) / 100)}
        onPointerUp={commit}
        onKeyUp={commit}
        onBlur={commit}
      />
      <output>
        {Math.round(draft * 100)}
        <small>%</small>
      </output>
    </label>
  );
}
export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled = false,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <label className="toggle-row">
      <span>
        <strong>{label}</strong>
        {description && <small>{description}</small>}
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="toggle-track" aria-hidden="true" />
    </label>
  );
}
export function ShortcutInput({
  value,
  onChange,
  label = "Raccourci global",
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}) {
  const [recording, setRecording] = useState(false);
  useEffect(
    () => () => {
      void window.soundboard.suspendShortcuts(false);
    },
    [],
  );
  async function record() {
    const result = await window.soundboard.suspendShortcuts(true);
    if (result.ok) setRecording(true);
  }
  function finish() {
    setRecording(false);
    void window.soundboard.suspendShortcuts(false);
  }
  function capture(event: KeyboardEvent<HTMLInputElement>) {
    if (!recording) return;
    event.preventDefault();
    event.stopPropagation();
    if (["Control", "Alt", "Shift", "Meta", "AltGraph"].includes(event.key))
      return;
    if (event.key === "Escape") {
      finish();
      return;
    }
    if (event.metaKey || event.getModifierState("AltGraph")) return;
    let key = event.code.startsWith("Digit")
      ? event.code.slice(5)
      : event.code.startsWith("Key")
        ? event.code.slice(3)
        : event.key;
    const names: Record<string, string> = {
      " ": "Space",
      ArrowUp: "Up",
      ArrowDown: "Down",
      ArrowLeft: "Left",
      ArrowRight: "Right",
    };
    key = names[key] ?? key;
    onChange(
      [
        event.ctrlKey ? "Control" : "",
        event.altKey ? "Alt" : "",
        event.shiftKey ? "Shift" : "",
        key,
      ]
        .filter(Boolean)
        .join("+"),
    );
    finish();
  }
  return (
    <label className="field">
      {label}
      <div className="shortcut-field">
        <input
          aria-label={label}
          value={value}
          placeholder={
            recording ? "Appuyez sur votre combinaison…" : "Control+Alt+1"
          }
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={capture}
          onBlur={() => {
            if (recording) finish();
          }}
        />
        <button
          type="button"
          className={recording ? "active" : ""}
          onClick={async (event) => {
            const input =
              event.currentTarget.parentElement?.querySelector("input");
            await record();
            input?.focus();
          }}
          title="Capturer un raccourci"
          aria-label="Capturer un raccourci"
        >
          <Keyboard size={18} />
        </button>
      </div>
      <small>
        Ctrl + Alt + une touche recommandé. Échap annule la capture. Videz le
        champ pour retirer le raccourci.
      </small>
    </label>
  );
}
export const shortcutLabel = (shortcut: string) =>
  shortcut
    .replaceAll("Control", "Ctrl")
    .replaceAll("Shift", "Maj")
    .replaceAll("+", " + ");
export const durationLabel = (seconds: number | null) =>
  seconds === null
    ? "Audio"
    : `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60)
        .toString()
        .padStart(2, "0")}`;
