const STEPS = ['You', 'Your craft'] as const;

// Two-step progress list. The current step is marked, a finished step is a button that goes back, a future step is plain text.
export function Stepper({ step, onGoTo }: { step: 1 | 2; onGoTo: (s: 1 | 2) => void }) {
  return (
    <>
      <p className="sr-only" aria-live="polite">Step {step} of 2: {STEPS[step - 1]}</p>
      <ol className="onboard-stepper" aria-label="Progress">
        {STEPS.map((label, i) => {
          const n = (i + 1) as 1 | 2;
          const state = n < step ? 'done' : n === step ? 'current' : 'todo';
          const mark = <span className="onboard-stepper-dot" aria-hidden="true">{state === 'done' ? '✓' : n}</span>;
          const text = <span className="onboard-stepper-label">{label}</span>;
          return (
            <li key={label} className={`onboard-stepper-step ${state}`} aria-current={state === 'current' ? 'step' : undefined}>
              {state === 'done' ? (
                <button type="button" className="onboard-stepper-btn" onClick={() => onGoTo(n)}>
                  {mark}{text}<span className="sr-only">(completed, go back)</span>
                </button>
              ) : (
                <span className="onboard-stepper-btn">{mark}{text}</span>
              )}
            </li>
          );
        })}
      </ol>
    </>
  );
}
