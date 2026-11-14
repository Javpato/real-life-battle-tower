import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { GuideStep } from "./types";
import {
  guideArrow,
  intersect,
  placeGuideCard,
  type GuideRect,
  type GuideViewport,
} from "./layout";
import "./tutorial.css";
export type GuidedTutorialProps = {
  step: GuideStep | null;
  onAcknowledge: (id: string) => void;
  onHelp?: () => void;
};
const viewport = (): GuideViewport => ({
  left: window.visualViewport?.offsetLeft ?? 0,
  top: window.visualViewport?.offsetTop ?? 0,
  width: window.visualViewport?.width ?? window.innerWidth,
  height: window.visualViewport?.height ?? window.innerHeight,
});
function visibleTarget(
  value: string | undefined,
  bounds: GuideViewport,
): GuideRect | null {
  if (!value) return null;
  for (const node of document.querySelectorAll<HTMLElement>("[data-guide]")) {
    if (
      node.dataset.guide !== value ||
      node.closest(
        '[hidden],[aria-hidden="true"],details:not([open]) > :not(summary)',
      )
    )
      continue;
    const style = getComputedStyle(node);
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      Number(style.opacity) === 0
    )
      continue;
    let rect: GuideRect | null = intersect(
      node.getBoundingClientRect(),
      bounds,
    );
    for (
      let parent = node.parentElement;
      parent && rect;
      parent = parent.parentElement
    ) {
      const style = getComputedStyle(parent);
      if (
        style.display === "none" ||
        style.visibility === "hidden" ||
        Number(style.opacity) === 0
      ) {
        rect = null;
        break;
      }
      if (
        /hidden|clip|auto|scroll/.test(
          style.overflow + style.overflowX + style.overflowY,
        )
      )
        rect = intersect(rect, parent.getBoundingClientRect());
    }
    if (rect) {
      const hit = document
        .elementsFromPoint(
          rect.left + rect.width / 2,
          rect.top + rect.height / 2,
        )
        .find((element) => !element.closest(".guided-tutorial"));
      if (hit && (node.contains(hit) || hit.contains(node))) return rect;
    }
  }
  return null;
}
export default function GuidedTutorial({
  step,
  onAcknowledge,
  onHelp,
}: GuidedTutorialProps) {
  const card = useRef<HTMLElement>(null),
    markerId = useId().replaceAll(":", "");
  const [geometry, setGeometry] = useState<{
    target: GuideRect | null;
    viewport: GuideViewport;
    size: { width: number; height: number };
  } | null>(null);
  useEffect(() => {
    if (!step) {
      setGeometry(null);
      return;
    }
    let frame = 0,
      disposed = false,
      last = "";
    const measure = () => {
      frame = 0;
      if (disposed) return;
      const bounds = viewport(),
        target = visibleTarget(step.target, bounds),
        size = {
          width: Math.min(340, bounds.width - 24),
          height: card.current?.offsetHeight ?? 160,
        };
      const next = { target, viewport: bounds, size },
        key = JSON.stringify(next);
      if (key !== last) {
        last = key;
        setGeometry(next);
      }
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    const mutation = new MutationObserver(schedule);
    mutation.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: [
        "class",
        "style",
        "hidden",
        "open",
        "data-guide",
        "aria-hidden",
      ],
    });
    const resize = new ResizeObserver(schedule);
    resize.observe(document.documentElement);
    if (card.current) resize.observe(card.current);
    // Moving CSS targets may change their rect without any DOM mutation.
    const timer = setInterval(schedule, 120);
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    window.visualViewport?.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("scroll", schedule);
    measure();
    return () => {
      disposed = true;
      if (frame) cancelAnimationFrame(frame);
      clearInterval(timer);
      mutation.disconnect();
      resize.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
      window.visualViewport?.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("scroll", schedule);
    };
  }, [
    step?.id,
    step?.target,
    step?.body,
    step?.missingTargetBody,
    step?.actionLabel,
  ]);
  if (!step || typeof document === "undefined") return null;
  const bounds = geometry?.viewport ?? viewport(),
    target = geometry?.target ?? null;
  const position = placeGuideCard(
      target,
      geometry?.size ?? { width: 340, height: 160 },
      bounds,
    ),
    arrow = target ? guideArrow(position, target) : null;
  return createPortal(
    <div
      className="guided-tutorial"
      data-guide-step={step.id}
      data-target-found={Boolean(target)}
    >
      {target && (
        <div
          className="guided-target-outline"
          aria-hidden="true"
          style={{
            left: target.left - 5,
            top: target.top - 5,
            width: target.width + 10,
            height: target.height + 10,
          }}
        />
      )}
      {arrow && (
        <svg className="guided-target-arrow" aria-hidden="true">
          <defs>
            <marker
              id={markerId}
              markerWidth="9"
              markerHeight="9"
              refX="8"
              refY="4.5"
              orient="auto"
            >
              <path d="M0 0L9 4.5L0 9Z" />
            </marker>
          </defs>
          <line {...arrow} markerEnd={`url(#${markerId})`} />
        </svg>
      )}
      <aside
        ref={card}
        className="guided-card"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={{
          left: position.left,
          top: position.top,
          width: position.width,
          maxHeight: bounds.height - 24,
        }}
      >
        <span className="guided-eyebrow">YOUR NEXT STEP</span>
        <h2>{step.title}</h2>
        <p>
          {!target && step.target
            ? (step.missingTargetBody ?? step.body)
            : step.body}
        </p>
        {(step.actionLabel || onHelp) && (
          <div className="guided-card-actions">
            {step.actionLabel && (
              <button type="button" onClick={() => onAcknowledge(step.id)}>
                {step.actionLabel}
              </button>
            )}
            {onHelp && (
              <button
                type="button"
                className="guided-help-button"
                onClick={onHelp}
                aria-label="Open game help"
              >
                Help
              </button>
            )}
          </div>
        )}
      </aside>
    </div>,
    document.body,
  );
}
