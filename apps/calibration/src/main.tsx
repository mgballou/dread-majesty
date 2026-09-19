import { useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { buildSession, humanPredictor, baselinePredictor, stateSummary, toLogLine, type Predictor, type Question, type RoundLog } from './domain.ts';
import { brierScore, reliabilityCurve, type ScoredPrediction } from './metrics.ts';
import './styles.css';

const questions = buildSession(20);

function App() {
  const [index, setIndex] = useState(0);
  const [probability, setProbability] = useState(50);
  const [rounds, setRounds] = useState<RoundLog[]>([]);
  const [revealed, setRevealed] = useState<RoundLog | null>(null);
  const current = questions[index] ?? questions[0]!;
  const probabilityRef = useRef(probability / 100);
  probabilityRef.current = probability / 100;
  const human = useMemo(() => humanPredictor(() => probabilityRef.current), []);
  const baseline = useMemo(() => baselinePredictor(), []);

  async function submit() {
    const predictors: Predictor[] = [human, baseline];
    const entries = await Promise.all(predictors.map(async (predictor) => [predictor.name, await predictor.predict(current)] as const));
    const round: RoundLog = {
      seed: current.seed,
      question: current.text,
      horizonTicks: current.horizonTicks,
      predictions: Object.fromEntries(entries),
      outcome: current.trueOutcome,
    };
    setRounds((existing) => [...existing, round]);
    setRevealed(round);
  }

  function next() {
    setRevealed(null);
    setProbability(50);
    setIndex((value) => (value + 1) % questions.length);
  }

  function downloadLog() {
    const blob = new Blob([rounds.map(toLogLine).join('\n') + '\n'], { type: 'application/x-ndjson' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'calibration-session.ndjson';
    link.click();
    URL.revokeObjectURL(link.href);
  }

  const humanScores = rounds.map((round) => ({ p: round.predictions.human.p, outcome: Number(round.outcome) as 0 | 1 }));
  const baselineScores = rounds.map((round) => ({ p: round.predictions['base-rate baseline'].p, outcome: Number(round.outcome) as 0 | 1 }));

  return <main className="shell">
    <header>
      <p className="eyebrow">Calibration arena · round {Math.min(index + 1, questions.length)} / {questions.length}</p>
      <h1>Forecast the next state.</h1>
      <p className="lede">Read the visible state, state a probability, then compare it with a base-rate predictor.</p>
    </header>
    <section className="state" aria-label="visible simulation state">
      <span className="label">Visible state</span>
      <code>{stateSummary(current.state)}</code>
    </section>
    <section className="question">
      <span className="label">Question</span>
      <h2>{current.text}</h2>
      <p className="muted">Seed {current.seed} · {current.horizonTicks} fixed ticks · benchmark base rate {Math.round(current.baseRate * 100)}%</p>
    </section>
    <section className="forecast">
      <label htmlFor="confidence">Your probability: <strong>{probability}%</strong></label>
      <input id="confidence" type="range" min="0" max="100" value={probability} onChange={(event) => setProbability(Number(event.target.value))} />
      <button onClick={submit} disabled={revealed !== null}>Submit forecast</button>
    </section>
    {revealed && <section className="reveal" aria-live="polite">
      <span className="label">Outcome</span>
      <h2>{revealed.outcome ? 'Yes' : 'No'}</h2>
      <p>Your forecast: {Math.round(revealed.predictions.human.p * 100)}% · baseline: {Math.round(revealed.predictions['base-rate baseline'].p * 100)}%</p>
      <button onClick={next}>Next question</button>
    </section>}
    <section className="scoreboard">
      <div><span className="label">Recorded rounds</span><strong>{rounds.length}</strong></div>
      <div><span className="label">Human Brier</span><strong>{rounds.length ? brierScore(humanScores).toFixed(3) : '—'}</strong></div>
      <div><span className="label">Baseline Brier</span><strong>{rounds.length ? brierScore(baselineScores).toFixed(3) : '—'}</strong></div>
      <button className="secondary" onClick={downloadLog} disabled={rounds.length === 0}>Download NDJSON log</button>
    </section>
    {rounds.length > 0 && <Reliability rounds={rounds} />}
  </main>;
}

function Reliability({ rounds }: { readonly rounds: readonly RoundLog[] }) {
  const series = ['human', 'base-rate baseline'].map((name, seriesIndex) => {
    const scored: ScoredPrediction[] = rounds.map((round) => ({ p: round.predictions[name].p, outcome: Number(round.outcome) as 0 | 1 }));
    return { name, color: seriesIndex === 0 ? '#e5b769' : '#78a9d6', bins: reliabilityCurve(scored) };
  });
  return <section className="chart-section">
    <div><span className="label">Reliability curve</span><p className="muted">Stated probability against observed frequency. Perfect calibration follows the diagonal.</p></div>
    <svg className="chart" viewBox="0 0 420 260" role="img" aria-label="Reliability curve">
      <line x1="40" y1="220" x2="380" y2="40" className="diagonal" />
      <line x1="40" y1="220" x2="380" y2="220" className="axis" /><line x1="40" y1="220" x2="40" y2="40" className="axis" />
      {series.map(({ name, color, bins }) => <g key={name}>{bins.map((bin) => <circle key={`${name}-${bin.bucket}`} cx={40 + bin.stated * 340} cy={220 - bin.observed * 180} r="6" fill={color}><title>{name}: stated {bin.stated.toFixed(2)}, observed {bin.observed.toFixed(2)}</title></circle>)}</g>)}
    </svg>
    <div className="legend"><span><i className="human-dot" /> human</span><span><i className="baseline-dot" /> base-rate baseline</span></div>
  </section>;
}

createRoot(document.getElementById('root')!).render(<App />);
