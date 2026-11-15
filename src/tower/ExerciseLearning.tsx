import { useEffect, useRef, useState } from "react";
import ExerciseDemo from "../exercises/ExerciseDemo";
import { SKILL_BY_ID } from "./catalog";
import { skillGuide } from "./skillGuides";
import "./exercise-learning.css";
/** Lessons mount only when requested. The native top layer keeps them readable
 * above scrollable library cards and supplies keyboard focus containment. */
export default function ExerciseLearning({ skillId }: { skillId: string }) {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const skill = SKILL_BY_ID[skillId];
  useEffect(() => {
    const node = dialog.current;
    if (open && node && !node.open) node.showModal();
    return () => {
      if (node?.open) node.close();
    };
  }, [open]);
  function close() {
    setOpen(false);
    trigger.current?.focus();
  }
  return (
    <div className="bt-training-learn">
      <button
        type="button"
        ref={trigger}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        Visual learn · {skill.name}
      </button>
      {open && (
        <dialog
          ref={dialog}
          className="bt-learning-dialog"
          aria-label={`${skill.name} visual guide`}
          onKeyDown={(event) => {
            if (event.key === "Escape") event.stopPropagation();
          }}
          onCancel={(event) => {
            event.preventDefault();
            close();
          }}
          onClose={close}
        >
          <header>
            <strong>{skill.name} · Visual learn</strong>
            <button
              type="button"
              aria-label="Close visual guide"
              onClick={close}
              autoFocus
            >
              Close ✕
            </button>
          </header>
          <div className="bt-learning-content">
            <ExerciseDemo
              skillId={skill.id}
              exerciseId={skill.exercise}
              guideOverride={skillGuide(skill.id)}
            />
          </div>
        </dialog>
      )}
    </div>
  );
}
