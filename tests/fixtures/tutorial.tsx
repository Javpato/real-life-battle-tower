import { useState } from "react";
import { createRoot } from "react-dom/client";
import {
  GuidedTutorial,
  HelpGuide,
  getGuideSteps,
  type GuideStep,
} from "../../src/tutorial";
function Fixture() {
  const [hidden, H] = useState(false),
    [left, L] = useState(false),
    [hits, N] = useState(0),
    [acks, A] = useState(0),
    [help, P] = useState(false);
  const [step, S] = useState<GuideStep | null>({
    id: "test-attack",
    target: "battle-attack",
    title: "Choose an attack",
    body: "Click the actual highlighted attack control. The guide never blocks it.",
    missingTargetBody: "Open the battle controls to find Attack.",
    actionLabel: "Understood",
  });
  return (
    <main
      style={{
        position: "fixed",
        inset: 0,
        background: "#14272e",
        color: "#fff",
        fontFamily: "system-ui",
      }}
    >
      <nav style={{ display: "flex", gap: 12, padding: 12 }}>
        <button onClick={() => H((v) => !v)}>Toggle target</button>
        <button onClick={() => L((v) => !v)}>Move target</button>
        <button onClick={() => S(null)}>End guide</button>
        <button onClick={() => P(true)}>Open help</button>
        <button
          onClick={() =>
            S({
              id: "door",
              target: "world-door",
              title: "Enter the doorway",
              body: "Walk to this door.",
            })
          }
        >
          Guide door
        </button>
      </nav>
      <output data-testid="hits">{hits}</output>
      <output data-testid="acks">{acks}</output>
      {!hidden && (
        <button
          data-guide="battle-attack"
          onClick={() => N((v) => v + 1)}
          style={{
            position: "absolute",
            bottom: 36,
            ...(left ? { left: 36 } : { right: 36 }),
            width: 150,
            height: 52,
          }}
        >
          Actual Attack
        </button>
      )}
      <button
        data-testid="world-control"
        style={{ position: "absolute", top: "45%", left: 20, height: 48 }}
        onClick={() => N((v) => v + 10)}
      >
        Move in world
      </button>
      <div
        data-guide="world-door"
        style={{
          position: "absolute",
          left: 220,
          top: 200,
          width: 48,
          height: 44,
          pointerEvents: "none",
          background: "#8ba47c",
        }}
      >
        Door
      </div>
      <GuidedTutorial
        step={step}
        onAcknowledge={() => A((v) => v + 1)}
        onHelp={() => P(true)}
      />
      {help && (
        <HelpGuide
          scope="battle"
          onClose={() => P(false)}
          onStartGuide={(scope) => S(getGuideSteps(scope)[0])}
        />
      )}
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<Fixture />);
