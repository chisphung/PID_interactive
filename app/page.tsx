"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";

type AtomKey = "R" | "U1" | "U2" | "S";

const ATOMS: Record<
  AtomKey,
  {
    symbol: string;
    name: string;
    short: string;
    question: string;
    example: string;
    color: string;
  }
> = {
  R: {
    symbol: "R",
    name: "Redundancy",
    short: "Either modality can tell you the same task-relevant fact.",
    question: "What can either source tell us about Y?",
    example: "A face and a voice both signal the same emotion.",
    color: "#b6493a",
  },
  U1: {
    symbol: "U₁",
    name: "Unique to X₁",
    short: "Only the first modality carries this task-relevant fact.",
    question: "What is lost if X₁ disappears?",
    example: "Only the image reveals the object color.",
    color: "#2458a6",
  },
  U2: {
    symbol: "U₂",
    name: "Unique to X₂",
    short: "Only the second modality carries this task-relevant fact.",
    question: "What is lost if X₂ disappears?",
    example: "Only the text names the unseen location.",
    color: "#d99320",
  },
  S: {
    symbol: "S",
    name: "Synergy",
    short: "The fact becomes available only after the modalities are combined.",
    question: "What appears only when X₁ and X₂ meet?",
    example: "Sarcasm emerges from positive words plus a negative tone.",
    color: "#17847d",
  },
};

const PAPER_SECTIONS = [
  { id: "intuition", label: "01 · PID" },
  { id: "coupling", label: "02 · The coupling" },
  { id: "estimators", label: "03 · Estimators" },
  { id: "evidence", label: "04 · Evidence" },
  { id: "models", label: "05 · Models" },
  { id: "applications", label: "06 · Applications" },
  { id: "limits", label: "07 · Limits" },
];

const BIT_TASKS = {
  COPY: {
    label: "Redundant copy",
    rule: "Y = X₁ = X₂",
    note: "Both sources carry the same one bit about Y.",
    values: { R: 1, U1: 0, U2: 0, S: 0 },
    rows: [
      [0, 0, 0],
      [1, 1, 1],
    ],
  },
  UNIQUE: {
    label: "Unique source",
    rule: "Y = X₁; X₂ is noise",
    note: "Knowing X₂ adds nothing; X₁ alone determines Y.",
    values: { R: 0, U1: 1, U2: 0, S: 0 },
    rows: [
      [0, 0, 0],
      [0, 1, 0],
      [1, 0, 1],
      [1, 1, 1],
    ],
  },
  XOR: {
    label: "Pure synergy",
    rule: "Y = X₁ ⊕ X₂",
    note: "Each source alone is useless; their relationship determines Y.",
    values: { R: 0, U1: 0, U2: 0, S: 1 },
    rows: [
      [0, 0, 0],
      [0, 1, 1],
      [1, 0, 1],
      [1, 1, 0],
    ],
  },
  OR: {
    label: "Mixed interaction",
    rule: "Y = X₁ ∨ X₂",
    note: "OR contains both shared evidence and a genuinely joint component.",
    values: { R: 0.31, U1: 0, U2: 0, S: 0.5 },
    rows: [
      [0, 0, 0],
      [0, 1, 1],
      [1, 0, 1],
      [1, 1, 1],
    ],
  },
} as const;

const DATASETS = [
  {
    id: "avmnist",
    name: "AV-MNIST",
    modalities: "image + audio",
    estimator: "CVX",
    task: "digit classification",
    values: { R: 0.1, U1: 0.97, U2: 0.03, S: 0.08 },
    reading: "The image modality dominates; a strong unimodal route is plausible.",
  },
  {
    id: "enrico",
    name: "ENRICO",
    modalities: "screenshot + wireframe",
    estimator: "CVX",
    task: "interface classification",
    values: { R: 0.73, U1: 0.38, U2: 0.53, S: 0.34 },
    reading: "All four atoms are substantial, making the decomposition harder to separate.",
  },
  {
    id: "vqa",
    name: "VQA 2.0",
    modalities: "image + question",
    estimator: "CVX",
    task: "visual question answering",
    values: { R: 0.79, U1: 0.87, U2: 0, S: 4.92 },
    reading: "Most task information is synergistic: the question must be grounded in the image.",
  },
  {
    id: "clevr",
    name: "CLEVR",
    modalities: "image + question",
    estimator: "CVX",
    task: "compositional QA",
    values: { R: 0.55, U1: 0.48, U2: 0, S: 5.16 },
    reading: "Synergy forms 83% of the estimated total—higher than VQA 2.0's 75%.",
  },
  {
    id: "mosei",
    name: "MOSEI",
    modalities: "language + video/audio",
    estimator: "BATCH",
    task: "sentiment and emotion",
    values: { R: 0.26, U1: 0.49, U2: 0.03, S: 0.04 },
    reading: "Language supplies the largest unique contribution in this benchmark.",
  },
  {
    id: "urfunny",
    name: "UR-FUNNY",
    modalities: "language + video/audio",
    estimator: "BATCH",
    task: "humor detection",
    values: { R: 0.03, U1: 0.04, U2: 0.01, S: 0.08 },
    reading: "The largest atom is synergy, consistent with contextual humor cues.",
  },
  {
    id: "mustard",
    name: "MUStARD",
    modalities: "language + video/audio",
    estimator: "BATCH",
    task: "sarcasm detection",
    values: { R: 0.14, U1: 0.01, U2: 0.01, S: 0.3 },
    reading: "Words and delivery can contradict; the joint interpretation dominates.",
  },
  {
    id: "mimic",
    name: "MIMIC",
    modalities: "time series + static clinical",
    estimator: "BATCH",
    task: "clinical prediction",
    values: { R: 0.05, U1: 0.17, U2: 0, S: 0.01 },
    reading: "Low synergy and a clear unique source explain why unimodal models can be strong.",
  },
] as const;

const MODELS = [
  { id: "EF", name: "Early fusion", family: "General", R: 0.35, U: 0.29, S: 0.13, formula: "f([x₁, x₂])" },
  { id: "ADDITIVE", name: "Additive late fusion", family: "Redundancy", R: 0.48, U: 0.31, S: 0.09, formula: "½(f₁(x₁)+f₂(x₂))" },
  { id: "AGREE", name: "Prediction agreement", family: "Redundancy", R: 0.44, U: 0.19, S: 0.08, formula: "+ λ‖f₁−f₂‖²" },
  { id: "ALIGN", name: "Feature alignment", family: "Redundancy", R: 0.47, U: 0.44, S: 0.29, formula: "+ λ sim(x₁,x₂)" },
  { id: "ELEM", name: "Element-wise product", family: "Synergy", R: 0.27, U: 0.2, S: 0.14, formula: "f(x₁ ⊙ x₂)" },
  { id: "TENSOR", name: "Tensor fusion", family: "Synergy", R: 0.55, U: 0.52, S: 0.33, formula: "f(x₁x₂ᵀ)" },
  { id: "MI", name: "Multiplicative interaction", family: "Synergy", R: 0.2, U: 0.18, S: 0.12, formula: "f(x₁Wx₂)" },
  { id: "MULT", name: "Multimodal Transformer", family: "Synergy", R: 0.4, U: 0.45, S: 0.29, formula: "f(softmax(x₁x₂ᵀ)x₁)" },
  { id: "LOWER", name: "Lower-order tensor terms", family: "Unique", R: 0.47, U: 0.55, S: 0.31, formula: "higher + lower order" },
  { id: "REC", name: "Modality reconstruction", family: "Unique", R: 0.53, U: 0.55, S: 0.32, formula: "Ltask + Lreconstruct" },
] as const;

const CASES = [
  {
    id: "pathology",
    number: "01",
    domain: "Computational pathology",
    title: "When does genomics need the slide?",
    modalities: "whole-slide image + genomic features → survival",
    detail:
      "In TCGA-LGG, nearly everything is zero except genomic uniqueness U₂ = 0.06. In TCGA-PAAD, synergy S = 0.15 exceeds pathology U₁ = 0.06 and genomics U₂ = 0.08.",
    conclusion:
      "The profile mirrors prior performance: multimodal integration helps PAAD more than LGG.",
    values: { R: 0.02, U1: 0.06, U2: 0.08, S: 0.15 },
    caveat: "Bars show the PAAD profile; LGG is discussed in the text.",
  },
  {
    id: "mood",
    number: "02",
    domain: "Mental health",
    title: "Mood lives between typing and text",
    modalities: "text + keystrokes → daily mood",
    detail:
      "MAPS contains 844 samples from 17 participants. Text plus keystrokes yields R = 0.12, U₁ = 0, U₂ = 0.04, and a much larger S = 0.40.",
    conclusion:
      "Models selected from the synergy-specialized synthetic task—LOWER, REC, TENSOR—were the top three on this pair.",
    values: { R: 0.12, U1: 0, U2: 0.04, S: 0.4 },
    caveat: "This is the text + keystroke pairing.",
  },
  {
    id: "robotics",
    number: "03",
    domain: "Robotic perception",
    title: "The camera already knows most",
    modalities: "images + force/contact → object position",
    detail:
      "On MuJoCo PUSH, BATCH gives image uniqueness U₁ = 1.79 as the largest atom, low sensor uniqueness, and high redundancy.",
    conclusion:
      "That profile predicts little benefit from higher-order fusion; the experiments find no performance difference from unimodal modeling.",
    values: { R: 0.72, U1: 1.79, U2: 0.08, S: 0.18 },
    caveat: "Only U₁ = 1.79 is numerically reported in the main text; other bar lengths are schematic.",
  },
] as const;

const BASE_MATRIX = [
  [0.86, 0.12, 0.43, 0.2],
  [0.22, 0.76, 0.19, 0.37],
  [0.31, 0.18, 0.68, 0.41],
  [0.14, 0.39, 0.25, 0.82],
];
const ROW_TARGET = [0.4, 0.3, 0.2, 0.1];
const COL_TARGET = [0.25, 0.25, 0.3, 0.2];

function runSinkhorn(iterations: number) {
  const matrix = BASE_MATRIX.map((row) => [...row]);
  for (let step = 0; step < iterations; step += 1) {
    for (let i = 0; i < matrix.length; i += 1) {
      const total = matrix[i].reduce((a, b) => a + b, 0);
      const scale = ROW_TARGET[i] / total;
      matrix[i] = matrix[i].map((value) => value * scale);
    }
    for (let j = 0; j < matrix[0].length; j += 1) {
      const total = matrix.reduce((sum, row) => sum + row[j], 0);
      const scale = COL_TARGET[j] / total;
      for (let i = 0; i < matrix.length; i += 1) matrix[i][j] *= scale;
    }
  }
  const rowSums = matrix.map((row) => row.reduce((a, b) => a + b, 0));
  const colSums = matrix[0].map((_, j) => matrix.reduce((sum, row) => sum + row[j], 0));
  const error = Math.max(
    ...rowSums.map((sum, i) => Math.abs(sum - ROW_TARGET[i])),
    ...colSums.map((sum, i) => Math.abs(sum - COL_TARGET[i])),
  );
  return { matrix, rowSums, colSums, error };
}

function AtomStrip({
  values,
  showValues = true,
}: {
  values: Record<AtomKey, number>;
  showValues?: boolean;
}) {
  const total = Math.max(Object.values(values).reduce((a, b) => a + b, 0), 0.0001);
  return (
    <div className="atom-strip-wrap" aria-label="PID composition">
      <div className="atom-strip">
        {(Object.keys(ATOMS) as AtomKey[]).map((key) => (
          <div
            className={`strip-piece atom-${key.toLowerCase()}`}
            key={key}
            style={{ width: `${(values[key] / total) * 100}%` }}
            title={`${ATOMS[key].name}: ${values[key].toFixed(2)}`}
          />
        ))}
      </div>
      {showValues && (
        <div className="strip-legend">
          {(Object.keys(ATOMS) as AtomKey[]).map((key) => (
            <span key={key}>
              <i style={{ background: ATOMS[key].color }} />
              {ATOMS[key].symbol} {values[key].toFixed(2)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function MetricBars({ model }: { model: (typeof MODELS)[number] }) {
  const metrics = [
    { key: "R", label: "Redundancy", value: model.R, color: ATOMS.R.color },
    { key: "U", label: "Uniqueness", value: model.U, color: ATOMS.U1.color },
    { key: "S", label: "Synergy", value: model.S, color: ATOMS.S.color },
  ];
  return (
    <div className="metric-bars">
      {metrics.map((metric) => (
        <div className="metric-row" key={metric.key}>
          <div className="metric-label">
            <span>{metric.label}</span>
            <b>{metric.value.toFixed(2)}</b>
          </div>
          <div className="metric-track">
            <div
              className="metric-fill"
              style={{ width: `${(metric.value / 0.6) * 100}%`, background: metric.color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function HeroFlow({ active, setActive }: { active: AtomKey; setActive: (key: AtomKey) => void }) {
  const pathClass = (key: AtomKey) => `flow-path atom-${key.toLowerCase()} ${active === key ? "is-active" : "is-muted"}`;
  return (
    <div className="hero-flow" aria-label="Partial information decomposition diagram">
      <svg viewBox="0 0 920 470" role="img" aria-label="X1 and X2 decompose into four information atoms before predicting Y">
        <path className={pathClass("R")} d="M120,166 C250,166 264,64 460,64 S728,130 814,208" />
        <path className={pathClass("R")} d="M120,326 C250,326 264,92 460,92 S728,142 814,213" />
        <path className={pathClass("U1")} d="M120,166 C258,166 290,176 460,176 S714,180 814,222" />
        <path className={pathClass("U2")} d="M120,326 C258,326 290,284 460,284 S714,280 814,238" />
        <path className={pathClass("S")} d="M120,166 C252,166 286,390 460,390 S714,320 814,247" />
        <path className={pathClass("S")} d="M120,326 C252,326 286,418 460,418 S714,338 814,250" />
        <circle className="source-node" cx="92" cy="166" r="48" />
        <circle className="source-node" cx="92" cy="326" r="48" />
        <circle className="target-node" cx="842" cy="230" r="52" />
        <text className="node-label" x="92" y="176" textAnchor="middle">X₁</text>
        <text className="node-label" x="92" y="336" textAnchor="middle">X₂</text>
        <text className="node-label" x="842" y="241" textAnchor="middle">Y</text>
        {(Object.keys(ATOMS) as AtomKey[]).map((key, index) => {
          const y = [78, 176, 284, 404][index];
          return (
            <g
              className={`flow-atom atom-${key.toLowerCase()} ${active === key ? "is-active" : "is-muted"}`}
              key={key}
              role="button"
              tabIndex={0}
              aria-label={`${ATOMS[key].name}: ${ATOMS[key].short}`}
              onClick={() => setActive(key)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") setActive(key);
              }}
            >
              <rect x="408" y={y - 31} width="104" height="62" rx="31" />
              <text x="460" y={y + 10} textAnchor="middle">{ATOMS[key].symbol}</text>
            </g>
          );
        })}
      </svg>
      <div className="flow-explainer" style={{ "--active-color": ATOMS[active].color } as CSSProperties}>
        <div className="flow-explainer-number">{ATOMS[active].symbol}</div>
        <div>
          <p>{ATOMS[active].question}</p>
          <strong>{ATOMS[active].short}</strong>
        </div>
      </div>
    </div>
  );
}

function CouplingLab() {
  const [coupling, setCoupling] = useState(45);
  const t = coupling / 100;
  const cells = [t, 0.5 - t, 0.5 - t, t];
  const distance = Math.abs(t - 0.25) / 0.2;
  return (
    <div className="coupling-lab">
      <div className="lab-controls">
        <div>
          <span className="micro-label">TOY LABEL SLICE · q(x₁,x₂ | y)</span>
          <h3>Rewire the coupling, preserve the marginals</h3>
        </div>
        <label>
          <span>source coupling</span>
          <input
            type="range"
            min="5"
            max="45"
            value={coupling}
            onChange={(event) => setCoupling(Number(event.target.value))}
            aria-label="Source coupling"
          />
        </label>
      </div>
      <div className="coupling-stage">
        <div className="matrix-with-labels">
          <div className="matrix-title">candidate q</div>
          <div className="matrix-col-labels"><span>x₂=0</span><span>x₂=1</span></div>
          <div className="matrix-row-labels"><span>x₁=0</span><span>x₁=1</span></div>
          <div className="coupling-matrix">
            {cells.map((value, index) => (
              <div
                key={index}
                className="coupling-cell"
                style={{ "--cell-alpha": 0.12 + value * 1.4 } as CSSProperties}
              >
                {value.toFixed(2)}
              </div>
            ))}
          </div>
        </div>
        <div className="marginal-proof">
          <div><span>row sums</span><b>0.50 · 0.50</b></div>
          <div><span>column sums</span><b>0.50 · 0.50</b></div>
          <div><span>coupling strength</span><b>{Math.round(distance * 100)}%</b></div>
        </div>
        <div className={`entropy-marker ${Math.abs(coupling - 25) < 2 ? "at-optimum" : ""}`}>
          <span>maximum entropy</span>
          <b>q* sits at the center in this toy slice</b>
          <p>The rows and columns stay fixed while the relationship between X₁ and X₂ changes.</p>
        </div>
      </div>
    </div>
  );
}

function SinkhornLab() {
  const [iterations, setIterations] = useState(0);
  const result = useMemo(() => runSinkhorn(iterations), [iterations]);
  const max = Math.max(...result.matrix.flat());
  return (
    <div className="sinkhorn-lab">
      <div className="lab-controls sinkhorn-head">
        <div>
          <span className="micro-label">INTERACTIVE · ONE LABEL SLICE</span>
          <h3>Watch Sinkhorn project A toward Δp</h3>
        </div>
        <label className="iteration-control">
          <span>normalization rounds</span>
          <input
            type="range"
            min="0"
            max="12"
            value={iterations}
            onChange={(event) => setIterations(Number(event.target.value))}
            aria-label="Sinkhorn normalization rounds"
          />
          <b>{iterations}</b>
        </label>
      </div>
      <div className="sinkhorn-grid-wrap">
        <div className="sinkhorn-matrix">
          {result.matrix.map((row, rowIndex) =>
            row.map((value, colIndex) => (
              <div
                className="sinkhorn-cell"
                key={`${rowIndex}-${colIndex}`}
                style={{ "--heat": value / max } as CSSProperties}
                title={`row ${rowIndex + 1}, column ${colIndex + 1}: ${value.toFixed(4)}`}
              >
                {value.toFixed(3)}
              </div>
            )),
          )}
        </div>
        <div className="sinkhorn-sums row-sums">
          {result.rowSums.map((sum, index) => (
            <div key={index}><span>{sum.toFixed(3)}</span><em>→ {ROW_TARGET[index].toFixed(2)}</em></div>
          ))}
        </div>
        <div className="sinkhorn-sums col-sums">
          {result.colSums.map((sum, index) => (
            <div key={index}><span>{sum.toFixed(3)}</span><em>↓ {COL_TARGET[index].toFixed(2)}</em></div>
          ))}
        </div>
      </div>
      <div className="error-readout">
        <span>maximum marginal error</span>
        <strong>{result.error.toExponential(2)}</strong>
        <div className="error-track"><i style={{ width: `${Math.min(result.error * 420, 100)}%` }} /></div>
      </div>
      <p className="figure-note">
        This small matrix is pedagogical. In BATCH, A has shape m × m × |Y|, and normalization targets come from frozen unimodal predictions p̂(y|xᵢ).
      </p>
    </div>
  );
}

function DatasetExplorer() {
  const [selectedId, setSelectedId] = useState("clevr");
  const dataset = DATASETS.find((item) => item.id === selectedId) ?? DATASETS[0];
  const total = Object.values(dataset.values).reduce((a, b) => a + b, 0);
  return (
    <div className="dataset-explorer">
      <div className="dataset-list" role="list" aria-label="Real-world datasets">
        {DATASETS.map((item) => (
          <button
            key={item.id}
            className={item.id === selectedId ? "selected" : ""}
            onClick={() => setSelectedId(item.id)}
          >
            <span>{item.name}</span>
            <small>{item.estimator}</small>
          </button>
        ))}
      </div>
      <div className="dataset-detail">
        <div className="dataset-kicker">
          <span>{dataset.estimator} ESTIMATE</span>
          <span>{dataset.task}</span>
        </div>
        <h3>{dataset.name}</h3>
        <p className="dataset-modalities">{dataset.modalities}</p>
        <AtomStrip values={{ ...dataset.values }} />
        <blockquote>{dataset.reading}</blockquote>
        <div className="dataset-total"><span>total estimated task information</span><b>{total.toFixed(2)} bits</b></div>
      </div>
    </div>
  );
}

function ModelExplorer() {
  const [selectedId, setSelectedId] = useState("TENSOR");
  const model = MODELS.find((item) => item.id === selectedId) ?? MODELS[0];
  return (
    <div className="model-explorer">
      <div className="model-tabs" role="list" aria-label="Model families">
        {MODELS.map((item) => (
          <button
            key={item.id}
            className={item.id === selectedId ? "selected" : ""}
            onClick={() => setSelectedId(item.id)}
          >
            {item.id}
          </button>
        ))}
      </div>
      <div className="model-detail">
        <div>
          <span className="micro-label">{model.family.toUpperCase()}-MOTIVATED FAMILY</span>
          <h3>{model.name}</h3>
          <div className="model-formula">{model.formula}</div>
          <p>
            Values summarize the interaction captured by this family on the paper&apos;s matching specialized synthetic datasets—not a universal score for the architecture.
          </p>
        </div>
        <MetricBars model={model} />
      </div>
    </div>
  );
}

function GmmLab() {
  const [mode, setMode] = useState<"cartesian" | "polar">("cartesian");
  const [angle, setAngle] = useState(45);
  return (
    <div className="gmm-lab">
      <div className="lab-controls">
        <div>
          <span className="micro-label">FIGURE 3 · QUALITATIVE REPRODUCTION</span>
          <h3>Representation changes the decomposition</h3>
        </div>
        <div className="segmented">
          <button className={mode === "cartesian" ? "selected" : ""} onClick={() => setMode("cartesian")}>Cartesian</button>
          <button className={mode === "polar" ? "selected" : ""} onClick={() => setMode("polar")}>Polar</button>
        </div>
      </div>
      <div className="gmm-body">
        <div className="gmm-plot">
          <svg viewBox="0 0 420 330" role="img" aria-label={`Gaussian mixture viewed in ${mode} coordinates`}>
            <line x1="40" y1="165" x2="385" y2="165" />
            <line x1="210" y1="30" x2="210" y2="300" />
            <g transform={`rotate(${-angle} 210 165)`}>
              <ellipse className="cluster cluster-a" cx="290" cy="165" rx="54" ry="26" />
              <ellipse className="cluster cluster-b" cx="130" cy="165" rx="54" ry="26" />
              <circle className="cluster-dot a1" cx="278" cy="157" r="5" />
              <circle className="cluster-dot a2" cx="305" cy="176" r="5" />
              <circle className="cluster-dot b1" cx="118" cy="154" r="5" />
              <circle className="cluster-dot b2" cx="145" cy="177" r="5" />
            </g>
            {mode === "polar" && <circle className="polar-ring" cx="210" cy="165" r="110" />}
            <text x="385" y="187" textAnchor="end">{mode === "cartesian" ? "X₁" : "r"}</text>
            <text x="224" y="42">{mode === "cartesian" ? "X₂" : "θ"}</text>
          </svg>
          <label>
            <span>centroid angle μ</span>
            <input type="range" min="0" max="90" value={angle} onChange={(event) => setAngle(Number(event.target.value))} />
            <b>{angle}°</b>
          </label>
        </div>
        <div className="gmm-reading">
          {mode === "cartesian" ? (
            <>
              <span className="atom-pill atom-u1">Cartesian</span>
              <h4>Unique information dominates near the axes.</h4>
              <p>At 0° or 90°, one coordinate separates the classes while the other reveals little. Redundancy and synergy peak around 45°.</p>
            </>
          ) : (
            <>
              <span className="atom-pill atom-s">Polar</span>
              <h4>The same points now expose different atoms.</h4>
              <p>The paper finds redundancy R = 0. The angle θ has no unique information because it needs the sign of r to identify the class.</p>
            </>
          )}
          <div className="key-lesson">Total task information can stay similar while its PID allocation changes dramatically.</div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [activeAtom, setActiveAtom] = useState<AtomKey>("S");
  const [bitTask, setBitTask] = useState<keyof typeof BIT_TASKS>("XOR");
  const [bins, setBins] = useState(8);
  const [activeSection, setActiveSection] = useState("intuition");
  const [progress, setProgress] = useState(0);
  const [activeCase, setActiveCase] = useState("mood");

  useEffect(() => {
    const onScroll = () => {
      const height = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(height > 0 ? (window.scrollY / height) * 100 : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) setActiveSection(visible[0].target.id);
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: [0.05, 0.2, 0.5] },
    );
    PAPER_SECTIONS.forEach(({ id }) => {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    });
    return () => observer.disconnect();
  }, []);

  const currentTask = BIT_TASKS[bitTask];
  const currentCase = CASES.find((item) => item.id === activeCase) ?? CASES[0];

  return (
    <main>
      <div className="reading-progress" style={{ width: `${progress}%` }} />
      <header className="site-header">
        <a className="wordmark" href="#top">PID / INTERACTIONS</a>
        <nav aria-label="Primary navigation">
          <a href="#intuition">Concept</a>
          <a href="#estimators">Method</a>
          <a href="#evidence">Evidence</a>
          <a href="#applications">Cases</a>
        </nav>
        <a className="paper-link" href="https://arxiv.org/abs/2302.12247" target="_blank" rel="noreferrer">Paper ↗</a>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">INTERACTIVE PAPER · NEURIPS 2023</p>
          <h1>What do two modalities know <em>together?</em></h1>
          <p className="hero-deck">
            A visual, technical guide to Liang et al.&apos;s framework for measuring redundancy, unique information, and synergy—and using those measurements to choose multimodal models.
          </p>
          <div className="hero-actions">
            <a className="primary-button" href="#intuition">Explore the four atoms <span>→</span></a>
            <a className="text-link" href="https://github.com/pliang279/PID" target="_blank" rel="noreferrer">Open the code ↗</a>
          </div>
        </div>
        <aside className="hero-equations" aria-label="PID identities">
          <p>I(X₁, X₂; Y) = R + U₁ + U₂ + S</p>
          <p>I(X₁; Y) = R + U₁</p>
          <p>I(X₂; Y) = R + U₂</p>
          <p>I(X₁; X₂; Y) = R − S</p>
        </aside>
        <div className="hero-diagram">
          <HeroFlow active={activeAtom} setActive={setActiveAtom} />
        </div>
        <div className="hero-caption">
          <span>FIG. 01</span>
          <p>PID divides the task-relevant information supplied by X₁ and X₂ into four non-negative atoms. Select an atom to isolate its paths.</p>
        </div>
      </section>

      <div className="paper-shell">
        <aside className="section-rail" aria-label="Paper sections">
          <span className="micro-label">PAPER MAP</span>
          {PAPER_SECTIONS.map((section) => (
            <a key={section.id} className={activeSection === section.id ? "active" : ""} href={`#${section.id}`}>{section.label}</a>
          ))}
        </aside>

        <article className="paper-body">
          <section className="paper-section intro-section" id="intuition">
            <div className="section-heading">
              <span className="section-number">01</span>
              <div>
                <p className="eyebrow">THE CENTRAL MOVE</p>
                <h2>Mutual information gives a total.<br />PID gives it structure.</h2>
              </div>
            </div>
            <div className="prose-grid">
              <p className="lead">
                If two modalities jointly contain 1 bit about a target, that bit can mean four very different things. It may be duplicated, belong to one source, or exist only in their relationship. A single mutual-information number cannot tell these cases apart.
              </p>
              <p>
                The paper brings the Bertschinger et al. definition of partial information decomposition into multimodal machine learning. Crucially, every atom is <em>task-relative</em>: shared pixels or correlated embeddings are not automatically redundant unless they carry the same information about Y.
              </p>
            </div>

            <div className="atom-cards">
              {(Object.keys(ATOMS) as AtomKey[]).map((key) => (
                <button
                  key={key}
                  className={`atom-card atom-${key.toLowerCase()} ${activeAtom === key ? "selected" : ""}`}
                  onClick={() => setActiveAtom(key)}
                  style={{ "--atom-color": ATOMS[key].color } as CSSProperties}
                >
                  <span className="atom-symbol">{ATOMS[key].symbol}</span>
                  <span className="atom-name">{ATOMS[key].name}</span>
                  <strong>{ATOMS[key].short}</strong>
                  <small>{ATOMS[key].example}</small>
                </button>
              ))}
            </div>

            <div className="equation-spread">
              <div className="equation-main">
                <span className="equation-label">Four observable identities</span>
                <p>I(X₁;Y) = R + U₁</p>
                <p>I(X₂;Y) = R + U₂</p>
                <p>I(X₁;Y | X₂) = U₁ + S</p>
                <p>I(X₂;Y | X₁) = U₂ + S</p>
              </div>
              <div className="equation-note">
                <b>Why four equations still do not solve PID</b>
                <p>They are not independent. Three-variable co-information gives R − S, so redundancy and synergy can cancel. PID needs one additional principle to separate them.</p>
              </div>
            </div>

            <div className="bit-playground">
              <div className="playground-head">
                <div>
                  <span className="micro-label">TRY FOUR GENERATIVE STORIES</span>
                  <h3>The same variables, different information atoms</h3>
                </div>
                <div className="segmented task-switch">
                  {(Object.keys(BIT_TASKS) as (keyof typeof BIT_TASKS)[]).map((key) => (
                    <button key={key} className={bitTask === key ? "selected" : ""} onClick={() => setBitTask(key)}>{key}</button>
                  ))}
                </div>
              </div>
              <div className="bit-body">
                <div className="truth-panel">
                  <span className="micro-label">TRUTH TABLE</span>
                  <div className="truth-rule">{currentTask.rule}</div>
                  <div className="truth-table">
                    <div className="truth-row truth-head"><span>X₁</span><span>X₂</span><span>Y</span></div>
                    {currentTask.rows.map((row, index) => (
                      <div className="truth-row" key={index}>{row.map((cell, j) => <span key={j}>{cell}</span>)}</div>
                    ))}
                  </div>
                </div>
                <div className="bit-result">
                  <div><span className="micro-label">PID PROFILE</span><h4>{currentTask.label}</h4></div>
                  <AtomStrip values={{ ...currentTask.values }} />
                  <p>{currentTask.note}</p>
                  {(bitTask === "OR" || bitTask === "XOR") && (
                    <span className="source-note">The paper reports OR/AND as R=0.31, S=0.50 and XOR as S=1.00; both CVX and BATCH recover them exactly.</span>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="paper-section" id="coupling">
            <div className="section-heading">
              <span className="section-number">02</span>
              <div>
                <p className="eyebrow">THE DEFINITION</p>
                <h2>The trick is to break the coupling—but keep what each modality says about Y.</h2>
              </div>
            </div>
            <div className="prose-grid">
              <p className="lead">
                PID asks a counterfactual question: among every joint distribution that preserves the two source–target marginals, how little joint task information could remain?
              </p>
              <p>
                Preserving p(x₁,y) and p(x₂,y) locks in what each source can say alone. Varying q(x₁,x₂,y) changes only how the sources are coupled. Whatever information disappears under the least-informative coupling is synergy.
              </p>
            </div>

            <div className="definition-card">
              <div className="delta-definition">
                <span>feasible family</span>
                <p>Δ<sub>p</sub> = &#123; q : q(x₁,y)=p(x₁,y), q(x₂,y)=p(x₂,y) &#125;</p>
              </div>
              <div className="optimizer-definition">
                <span>least-informative coupling</span>
                <p>q* = arg min<sub>q∈Δp</sub> I<sub>q</sub>(X₁,X₂;Y)</p>
                <small>equivalently: arg max H<sub>q</sub>(Y | X₁,X₂)</small>
              </div>
            </div>

            <CouplingLab />

            <div className="derivation-grid">
              <div className="derivation-card red">
                <span>REDUNDANCY</span>
                <p>R = I<sub>p</sub>(X₁;Y) + I<sub>p</sub>(X₂;Y) − I<sub>q*</sub>(X₁,X₂;Y)</p>
              </div>
              <div className="derivation-card blue">
                <span>UNIQUE X₁</span>
                <p>U₁ = I<sub>q*</sub>(X₁,X₂;Y) − I<sub>p</sub>(X₂;Y)</p>
              </div>
              <div className="derivation-card amber">
                <span>UNIQUE X₂</span>
                <p>U₂ = I<sub>q*</sub>(X₁,X₂;Y) − I<sub>p</sub>(X₁;Y)</p>
              </div>
              <div className="derivation-card teal">
                <span>SYNERGY</span>
                <p>S = I<sub>p</sub>(X₁,X₂;Y) − I<sub>q*</sub>(X₁,X₂;Y)</p>
              </div>
            </div>

            <div className="insight-callout">
              <span className="callout-mark">!</span>
              <div><b>Do not read q* as a learned fusion model.</b><p>It is an auxiliary distribution used to define the atoms. The estimator searches for q*; the downstream multimodal model is a separate object analyzed later.</p></div>
            </div>
          </section>

          <section className="paper-section" id="estimators">
            <div className="section-heading">
              <span className="section-number">03</span>
              <div>
                <p className="eyebrow">THE TECHNICAL CONTRIBUTION</p>
                <h2>Two estimators, chosen by the support of your modalities.</h2>
              </div>
            </div>

            <div className="estimator-overview">
              <article className="estimator-summary cvx">
                <span className="estimator-tag">EXACT AFTER DISCRETIZATION</span>
                <h3>CVX</h3>
                <p>Represent q explicitly as a |X₁| × |X₂| × |Y| tensor and solve a convex maximum-entropy problem.</p>
                <ul><li>Small, discrete support</li><li>Roughly up to 100 states per variable</li><li>Histogram or cluster continuous features first</li></ul>
              </article>
              <article className="estimator-summary batch">
                <span className="estimator-tag">NEURAL APPROXIMATION</span>
                <h3>BATCH</h3>
                <p>Parameterize q with learned similarity matrices, project them to Δp with Sinkhorn, and optimize over minibatches.</p>
                <ul><li>High-dimensional continuous features</li><li>Amortized over sampled batches</li><li>Requires unimodal probability models</li></ul>
              </article>
            </div>

            <div className="method-chapter">
              <div className="chapter-title">
                <span>3.1</span><div><p>ESTIMATOR ONE</p><h3>CVX: make q explicit</h3></div>
              </div>
              <div className="cvx-grid">
                <div className="cvx-steps">
                  <div className="method-step"><span>01</span><div><b>Discretize each source</b><p>Histogram raw values or cluster pretrained features so every support is enumerable.</p></div></div>
                  <div className="method-step"><span>02</span><div><b>Construct Q[i,j,k]</b><p>Each tensor cell is q(X₁=i, X₂=j, Y=k). Linear sums enforce both source–target marginals.</p></div></div>
                  <div className="method-step"><span>03</span><div><b>Maximize conditional entropy</b><p>Find the coupling that makes Y hardest to infer jointly while respecting those marginals.</p></div></div>
                  <div className="method-step"><span>04</span><div><b>Recover all four atoms</b><p>Insert q* into the PID identities above.</p></div></div>
                </div>
                <div className="tensor-demo">
                  <span className="micro-label">DISCRETIZATION COST</span>
                  <div className="tensor-stack" style={{ "--grid-size": Math.min(bins, 10) } as CSSProperties}>
                    {[0, 1, 2].map((layer) => (
                      <div className="tensor-layer" key={layer}>
                        {Array.from({ length: Math.min(bins, 10) ** 2 }).map((_, index) => <i key={index} />)}
                      </div>
                    ))}
                  </div>
                  <label><span>bins / clusters per source</span><input type="range" min="3" max="10" value={bins} onChange={(event) => setBins(Number(event.target.value))} /><b>{bins}</b></label>
                  <div className="cell-count"><b>{(bins * bins * 3).toLocaleString()}</b><span>cells for |Y| = 3</span></div>
                </div>
              </div>

              <div className="kl-rewrite">
                <div><span className="micro-label">WHY THE REWRITE MATTERS</span><h4>Conditional entropy becomes a convex-programming objective.</h4></div>
                <p>H<sub>q</sub>(Y|X₁,X₂) = log|Y| − KL(Q ∥ Q̃)</p>
                <small>with Q̃(x₁,x₂,y) = Q(x₁,x₂) / |Y| and linear marginal constraints</small>
              </div>
              <div className="method-caveats three">
                <div><b>Binning bias</b><p>Too-coarse bins discard interaction; too-fine bins destabilize density estimates.</p></div>
                <div><b>Numerical conditioning</b><p>Very small empirical probabilities can break conic solvers.</p></div>
                <div><b>Paper heuristic</b><p>The appendix cites cube-root growth in bin count and uses ≤100 bins with at least 10⁶ GMM samples.</p></div>
              </div>
            </div>

            <div className="method-chapter batch-chapter">
              <div className="chapter-title">
                <span>3.2</span><div><p>ESTIMATOR TWO</p><h3>BATCH: learn q without enumerating it</h3></div>
              </div>
              <div className="batch-pipeline" aria-label="BATCH estimator pipeline">
                <div className="pipeline-node inputs"><span>minibatch</span><b>X₁, X₂, Y</b><small>m ≪ n</small></div>
                <span className="pipeline-arrow">→</span>
                <div className="pipeline-node encoders"><span>trainable</span><b>fφ¹, fφ²</b><small>label-conditioned encoders</small></div>
                <span className="pipeline-arrow">→</span>
                <div className="pipeline-node matrix"><span>positive scores</span><b>A<sub>y</sub> = exp(h₁h₂ᵀ)</b><small>m × m × |Y|</small></div>
                <span className="pipeline-arrow">→</span>
                <div className="pipeline-node projection"><span>projection</span><b>Sinkhorn<sub>p̂</sub>(A)</b><small>q̃ ∈ Δp</small></div>
                <span className="pipeline-arrow">→</span>
                <div className="pipeline-node objective"><span>optimize</span><b>min I<sub>q̃</sub>(X₁,X₂;Y)</b><small>backpropagate through Sinkhorn</small></div>
              </div>

              <SinkhornLab />

              <div className="training-ledger">
                <div className="ledger-head"><span>COMPONENT</span><span>ROLE</span><span>STATUS</span></div>
                <div><b>Unimodal predictors p̂(y|x₁), p̂(y|x₂)</b><p>Supply the row and column targets that approximate p(xᵢ,y).</p><em className="frozen">TRAIN FIRST · FREEZE</em></div>
                <div><b>Encoders fφ¹ and fφ²</b><p>Produce label-conditioned embeddings whose outer products parameterize A.</p><em className="trained">TRAINED BY PID OBJECTIVE</em></div>
                <div><b>Unrolled Sinkhorn</b><p>Projects A onto the marginal constraints and passes gradients.</p><em className="fixed">FIXED ALGORITHM</em></div>
                <div><b>Multimodal predictor p̂(y|x₁,x₂)</b><p>Estimates total I<sub>p</sub>(X₁,X₂;Y), needed when extracting synergy.</p><em className="frozen">TRAIN SEPARATELY</em></div>
              </div>

              <div className="insight-callout teal-callout">
                <span className="callout-mark">S</span>
                <div><b>The multimodal predictor can make S a lower estimate.</b><p>If p̂(y|x₁,x₂) is not expressive enough, it underestimates total joint information and therefore synergy. The paper recommends trying stronger models until the measured S stops increasing. R, U₁, and U₂ are not affected by this particular choice.</p></div>
              </div>

              <div className="method-caveats three">
                <div><b>Amortized approximation</b><p>fφ shares structure across batches, but minibatch gradients are not guaranteed to equal full-batch gradients.</p></div>
                <div><b>Expressivity limit</b><p>The similarity-matrix parameterization restricts which q distributions can be represented.</p></div>
                <div><b>Batch support</b><p>Only within-batch alignments are available; the experiments use batch size 256 to reduce this constraint.</p></div>
              </div>
            </div>

            <div className="comparison-table" role="table" aria-label="CVX and BATCH comparison">
              <div className="comparison-row table-head" role="row"><span>Decision</span><span>CVX</span><span>BATCH</span></div>
              <div className="comparison-row" role="row"><b>Input support</b><span>small / discretized</span><span>large / continuous</span></div>
              <div className="comparison-row" role="row"><b>Representation of q</b><span>explicit 3D tensor</span><span>implicit neural scores</span></div>
              <div className="comparison-row" role="row"><b>Marginal enforcement</b><span>linear constraints</span><span>unrolled Sinkhorn</span></div>
              <div className="comparison-row" role="row"><b>Optimization</b><span>exact convex program</span><span>minibatch gradient descent</span></div>
              <div className="comparison-row" role="row"><b>Main failure mode</b><span>information lost in bins</span><span>model / batch approximation</span></div>
            </div>
          </section>

          <section className="paper-section" id="evidence">
            <div className="section-heading">
              <span className="section-number">04</span>
              <div>
                <p className="eyebrow">VALIDATION AND DATASETS</p>
                <h2>They test the estimators where truth is known, then where only evidence is available.</h2>
              </div>
            </div>

            <div className="evidence-ladder">
              <div><span>01</span><b>Bitwise truth</b><p>OR, AND, XOR have analytically known atoms.</p></div>
              <div><span>02</span><b>Controlled generators</b><p>Latents are assigned to shared, unique, or joint label rules.</p></div>
              <div><span>03</span><b>Human judgments</b><p>Annotators assess real examples on a 0–5 interaction scale.</p></div>
              <div><span>04</span><b>Downstream utility</b><p>PID should explain model behavior and enable selection.</p></div>
            </div>

            <GmmLab />

            <div className="synthetic-story">
              <div className="synthetic-copy">
                <span className="micro-label">THE 10-DATASET GENERATOR</span>
                <h3>Ground truth is built into the latent story.</h3>
                <p>z₁ and z₂ are private latents; z<sub>c</sub> is common. Fixed transforms create high-dimensional X₁=[z₁,z<sub>c</sub>] and X₂=[z₂,z<sub>c</sub>]. The label function is then wired to exactly the desired atom or mixture.</p>
                <p>Both estimators recover the predominant interaction type. Absolute values differ because the labels contain noise and the total capturable information is only about 0.42–0.59 bits.</p>
              </div>
              <div className="latent-diagram">
                <div className="latent-row"><span className="private-one">z₁</span><span className="common">zᶜ</span><span className="private-two">z₂</span></div>
                <div className="latent-arrows"><i /><i /><i /></div>
                <div className="latent-row outputs"><span>X₁</span><span className="label-function">y = f( selected latents )</span><span>X₂</span></div>
                <div className="latent-presets"><span>R-only</span><span>U₁-only</span><span>U₂-only</span><span>S-only</span><span>6 mixtures</span></div>
              </div>
            </div>

            <div className="subsection-heading">
              <span>4.2</span><div><p>REAL-WORLD BENCHMARKS</p><h3>Eight datasets, eight interaction profiles</h3></div>
            </div>
            <DatasetExplorer />

            <div className="human-validation">
              <div className="human-big-number"><b>0.68–0.72</b><span>Krippendorff&apos;s α across the four atoms</span></div>
              <div><h4>Human judgments broadly agree—but not everywhere.</h4><p>Three annotators scored 50 examples per eligible dataset. Estimated and human-dominant atoms match on AV-MNIST, MOSEI, VQA 2.0, and CLEVR. Humor and sarcasm are less clear: people disagree whether an attribute is already in language or emerges only with video.</p></div>
              <div className="confidence-badge"><span>mean confidence</span><b>4.27–4.46 / 5</b></div>
            </div>
          </section>

          <section className="paper-section" id="models">
            <div className="section-heading">
              <span className="section-number">05</span>
              <div>
                <p className="eyebrow">MODEL QUANTIFICATION AND SELECTION</p>
                <h2>A dataset has a PID profile. A trained model&apos;s predictions have one too.</h2>
              </div>
            </div>
            <div className="prose-grid">
              <p className="lead">Train a model on D<sub>train</sub>, replace the validation labels with its predictions ŷ, and compute PID on D<sub>pred</sub> = &#123;(x₁,x₂,ŷ)&#125;. The result describes the interactions expressed by that model&apos;s decisions.</p>
              <p>This is not the same as computing PID on internal embeddings. It asks how the model&apos;s output depends on each input and their coupling. The authors compare ten fusion families motivated by different interaction biases.</p>
            </div>

            <ModelExplorer />

            <div className="finding-row">
              <div className="finding-card red"><span>R</span><b>0.41 ± 0.11</b><p>Redundancy is easiest. Additive, agreement, and alignment objectives do well.</p></div>
              <div className="finding-card blue"><span>U</span><b>0.37 ± 0.14</b><p>Lower-order terms and reconstruction reach about 0.55 on unique-specialized data.</p></div>
              <div className="finding-card teal"><span>S</span><b>0.21 ± 0.10</b><p>Synergy is hardest. Tensor fusion reaches 0.33; the multimodal Transformer reaches 0.29.</p></div>
            </div>

            <div className="robustness-panel">
              <div className="robustness-graphic">
                <div className="axis-y">performance drop when Xᵢ is missing</div>
                <div className="scatter-area">
                  <i style={{ left: "12%", bottom: "16%" }} /><i style={{ left: "28%", bottom: "24%" }} /><i style={{ left: "38%", bottom: "38%" }} /><i style={{ left: "52%", bottom: "49%" }} /><i style={{ left: "67%", bottom: "62%" }} /><i style={{ left: "82%", bottom: "80%" }} />
                  <i className="synergy-point" style={{ left: "8%", bottom: "68%" }} /><i className="synergy-point" style={{ left: "19%", bottom: "57%" }} />
                  <div className="trend-line" />
                </div>
                <div className="axis-x">unique information Uᵢ →</div>
              </div>
              <div className="robustness-copy">
                <span className="micro-label">MISSING MODALITIES</span>
                <h3>High uniqueness predicts fragility—but low uniqueness does not guarantee robustness.</h3>
                <p>The correlation between Uᵢ and performance drop is ρ = 0.80. The high-drop points with low Uᵢ are explained by synergy: remove either source and the joint-only atom also vanishes.</p>
                <div className="correlation-pair"><span>when Uᵢ ≤ 0.05</span><b>ρ(S, drop) = 0.73</b><b>ρ(R, drop) = 0.01</b></div>
              </div>
            </div>

            <div className="agreement-panel">
              <div>
                <span className="micro-label">PID AGREEMENT</span>
                <h3>Match what the dataset needs to what the model captures.</h3>
                <p className="agreement-equation">α<sub>I</sub>(f,D) = Î<sub>D</sub> · I<sub>f(D)</sub></p>
                <p>Î<sub>D</sub> is the normalized importance of atom I in the dataset. I<sub>f(D)</sub> is how much of that atom appears in model predictions. Sum over R,U₁,U₂,S for total agreement.</p>
              </div>
              <div className="correlation-stamp"><span>correlation with accuracy</span><b>ρ = 0.81</b><small>across 10 synthetic datasets</small></div>
            </div>

            <div className="selection-flow">
              <div><span>1</span><b>Estimate new dataset D</b><p>Normalize its four PID atoms.</p></div><i>→</i>
              <div><span>2</span><b>Find nearest synthetic D*</b><p>Use L₁ distance between PID profiles.</p></div><i>→</i>
              <div><span>3</span><b>Transfer its top models</b><p>Return the three strongest families on D*.</p></div>
            </div>
            <div className="selection-result">
              <b>95–100%</b><p>of the oracle-best model&apos;s accuracy across five unseen synthetic and six real-world datasets; all exceed 98.5% except MUStARD at 95.15%.</p>
            </div>
            <div className="selection-examples">
              <div><span>HIGH SYNERGY</span><b>UR-FUNNY · MUStARD</b><p>Transformers and higher-order interaction models are helpful.</p></div>
              <div><span>R + U₂</span><b>ENRICO</b><p>LOWER, ALIGN, and AGREE are among the strongest reported families.</p></div>
              <div><span>U₁ DOMINANT</span><b>MIMIC</b><p>Unimodal models are mostly sufficient.</p></div>
            </div>
          </section>

          <section className="paper-section" id="applications">
            <div className="section-heading">
              <span className="section-number">06</span>
              <div>
                <p className="eyebrow">THREE DOMAIN CASE STUDIES</p>
                <h2>The decomposition becomes a scientific diagnostic.</h2>
              </div>
            </div>
            <div className="case-tabs">
              {CASES.map((item) => (
                <button key={item.id} className={activeCase === item.id ? "selected" : ""} onClick={() => setActiveCase(item.id)}>
                  <span>{item.number}</span><b>{item.domain}</b>
                </button>
              ))}
            </div>
            <div className="case-detail">
              <div className="case-copy">
                <span className="micro-label">{currentCase.modalities}</span>
                <h3>{currentCase.title}</h3>
                <p>{currentCase.detail}</p>
                <blockquote>{currentCase.conclusion}</blockquote>
              </div>
              <div className="case-profile">
                <span className="micro-label">REPORTED INTERACTION PROFILE</span>
                <AtomStrip values={{ ...currentCase.values }} />
                <small>{currentCase.caveat}</small>
              </div>
            </div>
          </section>

          <section className="paper-section" id="limits">
            <div className="section-heading">
              <span className="section-number">07</span>
              <div>
                <p className="eyebrow">CONCLUSION, LIMITATIONS, AND USE</p>
                <h2>PID is a lens, not a ground-truth interaction oracle.</h2>
              </div>
            </div>
            <div className="limits-grid">
              <article><span>01</span><h3>Every route approximates something</h3><p>CVX approximates continuous variables through bins or clusters. BATCH relies on learned unimodal models, a neural q, and sampled batches.</p></article>
              <article><span>02</span><h3>Atoms can be hard to disentangle</h3><p>Datasets such as ENRICO express all interaction types, so R versus S and U versus S become difficult to estimate cleanly.</p></article>
              <article><span>03</span><h3>Real data hides its generator</h3><p>Without a known data-generating process, validation must triangulate human judgment, automatic measures, model behavior, and downstream utility.</p></article>
              <article><span>04</span><h3>PID depends on representation and target</h3><p>Changing Cartesian coordinates to polar can reallocate the atoms. Changing Y can do the same. A PID profile is never context-free.</p></article>
            </div>

            <div className="practical-checklist">
              <div><span className="micro-label">IF YOU APPLY THIS PAPER</span><h3>A careful reading checklist</h3></div>
              <ol>
                <li><span>1</span><p><b>Define Y precisely.</b> PID measures task-relevant interaction, not generic modality dependence.</p></li>
                <li><span>2</span><p><b>Choose the estimator by support.</b> Use CVX only when discretization is defensible; otherwise inspect BATCH assumptions.</p></li>
                <li><span>3</span><p><b>Audit the auxiliary predictors.</b> Calibrate p̂(y|xᵢ), and strengthen p̂(y|x₁,x₂) until S stabilizes.</p></li>
                <li><span>4</span><p><b>Report sensitivity.</b> Vary bins, clusters, seeds, batch sizes, and representations.</p></li>
                <li><span>5</span><p><b>Use PID comparatively.</b> The paper&apos;s strongest evidence is relative profiles and model ranking, not treating every decimal as exact truth.</p></li>
              </ol>
            </div>

            <details className="appendix-drawer">
              <summary><span>Appendix guide</span><b>What is worth reading after the main paper?</b><i>+</i></summary>
              <div className="appendix-grid">
                <div><span>A</span><b>PID derivations</b><p>Why the max-entropy solution simultaneously supplies the four atoms and their non-negativity properties.</p></div>
                <div><span>B.1–B.2</span><b>CVX implementation</b><p>Solver choices, numerical instability, histogram rules, and alternatives for continuous variables.</p></div>
                <div><span>B.3</span><b>BATCH derivation</b><p>The density-ratio objective, neural parameterization, Sinkhorn constraints, Algorithm 1, and extraction equations.</p></div>
                <div><span>C.1–C.6</span><b>Validation details</b><p>GMMs, synthetic generators, benchmark preprocessing, human annotation, and comparisons to I-min, WMS, CI, Shapley, IG, and CCA.</p></div>
                <div><span>C.7–C.8</span><b>Models and selection</b><p>The ten fusion families, hyperparameters, full PID tables, robustness, agreement, and nearest-profile selection.</p></div>
                <div><span>C.9–C.11</span><b>Domain studies</b><p>Full pathology, mobile mood, and robotic pushing setups and results.</p></div>
              </div>
            </details>
          </section>
        </article>
      </div>

      <footer>
        <div>
          <span className="micro-label">SOURCE PAPER</span>
          <h2>Quantifying &amp; Modeling Multimodal Interactions</h2>
          <p>Paul Pu Liang, Yun Cheng, Xiang Fan, Chun Kai Ling, Suzanne Nie, Richard J. Chen, Zihao Deng, Nicholas Allen, Randy Auerbach, Faisal Mahmood, Ruslan Salakhutdinov, and Louis-Philippe Morency · NeurIPS 2023.</p>
        </div>
        <div className="footer-links">
          <a href="https://arxiv.org/abs/2302.12247" target="_blank" rel="noreferrer">Paper ↗</a>
          <a href="https://github.com/pliang279/PID" target="_blank" rel="noreferrer">Code ↗</a>
          <a href="#top">Back to top ↑</a>
        </div>
        <p className="editorial-note">This is an independent interactive explanation. Numerical values and claims are drawn from the authors&apos; paper; diagrams are explanatory recreations.</p>
      </footer>
    </main>
  );
}
