import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { GUIDE_CATALOG, GUIDE_SCOPES } from "./catalog";
import type { GuideScope } from "./types";
import "./tutorial.css";
export type HelpGuideProps = {
  scope?: GuideScope;
  onClose: () => void;
  onStartGuide?: (scope: GuideScope) => void;
};
/** Read-only help. A tour callback is a presentation request, never a reward action. */
export default function HelpGuide({
  scope = "settings",
  onClose,
  onStartGuide,
}: HelpGuideProps) {
  const [selected, setSelected] = useState(scope),
    dialog = useRef<HTMLElement>(null),
    close = useRef(onClose);
  close.current = onClose;
  useEffect(() => setSelected(scope), [scope]);
  useEffect(() => {
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    dialog.current?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        close.current();
        return;
      }
      if (event.key !== "Tab" || !dialog.current) return;
      const controls = [
        ...dialog.current.querySelectorAll<HTMLElement>(
          'button:not(:disabled),select,input,a[href],[tabindex="0"]',
        ),
      ].filter((node) => node.getClientRects().length);
      if (!controls.length) {
        event.preventDefault();
        dialog.current.focus();
        return;
      }
      const first = controls[0],
        last = controls.at(-1)!;
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === dialog.current)
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          document.activeElement === dialog.current)
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", key, true);
    return () => {
      document.removeEventListener("keydown", key, true);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  const section = GUIDE_CATALOG[selected];
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="guide-help-backdrop">
      <section
        ref={dialog}
        className="guide-help-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Game help"
        tabIndex={-1}
      >
        <header className="guide-help-heading">
          <div>
            <small>REAL-LIFE RPG</small>
            <h2>Adventure handbook</h2>
          </div>
          <button type="button" aria-label="Close game help" onClick={onClose}>
            ×
          </button>
        </header>
        <label className="guide-help-select">
          What would you like help with?
          <select
            value={selected}
            onChange={(event) => setSelected(event.target.value as GuideScope)}
          >
            {GUIDE_SCOPES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
        </label>
        <div className="guide-help-description">
          <h3>{section.title}</h3>
          <p>{section.introduction}</p>
          {onStartGuide && (
            <button
              type="button"
              className="guide-tour-button"
              onClick={() => {
                onClose();
                onStartGuide(selected);
              }}
            >
              Show me these controls
            </button>
          )}
        </div>
        <ol className="guide-help-steps">
          {section.steps.map((step) => (
            <li key={step.id}>
              <h4>{step.title}</h4>
              <p>{step.body}</p>
            </li>
          ))}
        </ol>
        <footer>
          Replay help whenever you like. Guides do not spend items or grant
          rewards.
        </footer>
      </section>
    </div>,
    document.body,
  );
}
