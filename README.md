# Explainable Anomaly Detection for Polymer Extrusion Processes

> **A real-time multivariate statistical process control (MSPC) prototype with integrated fault diagnosis — applied to cable insulation extrusion.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)](https://github.com/krishnamalladi/extrusion-anomaly-detection)
[![React](https://img.shields.io/badge/React-18%2B-61dafb.svg)](https://reactjs.org/)
[![Recharts](https://img.shields.io/badge/Recharts-2.x-22b5bf.svg)](https://recharts.org/)
[![Status](https://img.shields.io/badge/status-active-brightgreen.svg)]()

---

## Table of Contents

1. [Overview](#1-overview)
2. [Background and Motivation](#2-background-and-motivation)
3. [Methodology](#3-methodology)
   - [Univariate SPC — Shewhart Control Charts](#31-univariate-spc--shewhart-control-charts)
   - [Multivariate SPC — Hotelling T²](#32-multivariate-spc--hotelling-t²)
   - [T² Decomposition — Contribution Analysis](#33-t²-decomposition--contribution-analysis)
   - [Reconstruction-Based Contribution (RBC)](#34-reconstruction-based-contribution-rbc)
   - [Fault Diagnosis Engine](#35-fault-diagnosis-engine)
4. [System Architecture](#4-system-architecture)
5. [Monitored Process Parameters](#5-monitored-process-parameters)
6. [Fault Mode Library](#6-fault-mode-library)
7. [Live Demo — How to Run](#7-live-demo--how-to-run)
8. [Screenshots](#8-screenshots)
9. [Research Context and Novelty](#9-research-context-and-novelty)
10. [References](#10-references)
11. [Author and Citation](#11-author-and-citation)
12. [License](#12-license)
13. [Contributing](#13-contributing)
14. [Roadmap](#14-roadmap)

---

## 1. Overview

This repository presents a **fully interactive, browser-based prototype** for real-time anomaly detection and fault diagnosis in polymer extrusion manufacturing — specifically targeting **cable insulation extrusion lines** used in the wire and cable industry.

The system implements two complementary detection layers:

| Layer | Method | Detects |
|---|---|---|
| **Univariate** | Shewhart X̄ control charts (±3σ) | Individual parameter excursions |
| **Multivariate** | Hotelling T² statistic | Correlated multivariate shifts |

Beyond detection, the system provides **explainability** through:

- **T² Decomposition** (Mason, Tracy & Young, 1995) — identifies which variables contributed most to each alarm
- **Reconstruction-Based Contribution (RBC)** — isolates the primary fault driver by quantifying how much T² would drop if each variable were corrected to nominal
- **Process State Radar** — visualizes multivariate deviation in polar space
- **Fault Diagnosis Engine** — matches observed contribution patterns against a library of six named extrusion failure modes using cosine similarity, producing ranked hypotheses with root cause mechanisms and corrective action guidance

This prototype addresses a recognized gap in industrial practice: **most deployed SPC systems detect anomalies but cannot explain their causes**. The explainability layer transforms the system from a monitoring tool into a decision support system — reducing mean time to diagnosis (MTTD) and enabling operator-level root cause analysis without specialist statistical knowledge.

---

## 2. Background and Motivation

### The Industrial Problem

Modern cable extrusion lines operate at line speeds of 30–150 m/min, producing insulated conductors where dimensional, electrical, and mechanical properties must conform to standards such as IEC 60502, IEC 60227, and BS 7655. A typical extrusion line generates 6–20 critical process measurements every few seconds: barrel zone temperatures, screw speed, melt pressure, die pressure, line speed, wall thickness, eccentricity, and spark test results.

Three problems arise in industrial quality monitoring:

**Problem 1 — Correlation blindness in univariate SPC.** Process variables are physically correlated. Melt pressure, screw speed, and die pressure are linked by the polymer rheology equation. Monitoring each independently ignores their joint behavior. A simultaneous small shift across three correlated variables — each within its individual control limits — may represent a serious process disturbance that univariate charts entirely miss.

**Problem 2 — False alarm accumulation.** Applying separate 3σ control charts to k variables yields a combined false alarm probability of 1 − (0.9973)^k. For six variables this is approximately 1.6%; for twenty variables, approximately 5.3%. In a 24-hour production run, this produces dozens of spurious alarms, eroding operator trust in the monitoring system.

**Problem 3 — Detection without explanation.** Even well-implemented MSPC systems stop at "the process is out of control." Identifying *which variable*, *in which direction*, *for what physical reason* — and *what to do about it* — remains the domain of experienced process engineers. In MSME and mid-tier manufacturing, such expertise is scarce. An explainable system that provides actionable diagnosis at the point of detection is therefore of direct industrial value.

### The Research Gap

The Explainable Fault Detection and Diagnosis (EFDD) field has produced significant theoretical literature (see References). However, **published open-source implementations specifically applied to polymer extrusion — and combining T² decomposition, RBC, and rule-based fault pattern matching in a single interactive tool — are notably absent from the literature**. This prototype is intended to fill that gap and serve as a foundation for further research.

---

## 3. Methodology

### 3.1 Univariate SPC — Shewhart Control Charts

Each of the six process parameters is monitored by an individual X̄ (Individuals) control chart. Control limits are placed at the process mean ± 3σ, derived from in-control reference data:

```
UCL = μ + 3σ
CL  = μ
LCL = μ − 3σ
```

For a normally distributed process in statistical control, the probability that a single point falls outside the 3σ limits by chance is 0.0027 (0.27%), yielding an average run length (ARL) of 370 under the null hypothesis of no shift. The 3σ limits are a Shewhart (1931) convention balancing sensitivity to real shifts against false alarm frequency.

A data point is flagged anomalous when it crosses either limit. Flagged points are rendered with a red halo on the control chart.

### 3.2 Multivariate SPC — Hotelling T²

The Hotelling T² statistic is the multivariate generalization of the univariate z-score. For a p-dimensional observation vector **x** = [x₁, x₂, ..., xₚ], measured against an in-control mean vector **μ₀** and covariance matrix **Σ**:

```
T² = (x − μ₀)ᵀ Σ⁻¹ (x − μ₀)
```

In this prototype, the simplified diagonal case is used (assuming independence between parameters for the simulated data), reducing the formula to:

```
T² = Σᵢ [(xᵢ − μᵢ) / σᵢ]²
```

This is equivalent to the sum of squared standardized deviations — the squared Mahalanobis distance from the process centroid under the diagonal covariance assumption.

**Control Limit:** The T² statistic follows a chi-squared distribution with p degrees of freedom under the null hypothesis. For p = 6 process parameters at significance level α = 0.05:

```
UCL(T²) = χ²(α=0.05, df=6) = 12.592
```

Any observation with T² > 12.592 signals a multivariate out-of-control condition.

**Key advantage:** The T² chart will signal when variables shift jointly in a correlated direction, even when no individual variable crosses its own 3σ limits — a class of fault that is undetectable by univariate charts alone.

### 3.3 T² Decomposition — Contribution Analysis

When the T² chart signals, the critical diagnostic question is: *which variable or combination of variables is responsible?*

The decomposition approach (Mason, Tracy & Young, 1995) partitions the T² statistic into individual contributions:

```
Cᵢ = [(xᵢ − μᵢ) / σᵢ]²   (diagonal case)
```

such that:

```
T² = C₁ + C₂ + ... + Cₚ
```

Each contribution Cᵢ is the squared standardized deviation of variable i from its nominal value. The relative contribution (Cᵢ / T²) × 100 represents variable i's percentage share of the total alarm signal. Variables with disproportionately high contributions are identified as primary drivers of the out-of-control condition.

**Limitation of simple decomposition:** When two variables are strongly correlated, a fault in one may appear to be shared between both, masking the true root cause. This is the motivation for RBC (Section 3.4).

### 3.4 Reconstruction-Based Contribution (RBC)

The Reconstruction-Based Contribution method (Alcala & Qin, 2009) addresses the masking limitation of simple decomposition by asking a counterfactual question: *"If variable i were replaced by its nominal (in-control) value, how much would T² decrease?"*

```
RBCᵢ = T²(x) − T²(x with xᵢ replaced by μᵢ)
       = Cᵢ   (under diagonal covariance)
```

Under diagonal covariance (as in this implementation), RBC equals the simple decomposition. The true advantage of RBC emerges with a full non-diagonal covariance matrix, where it correctly isolates the causal variable even when a correlated variable shows a high simple contribution. The full covariance RBC implementation is included in the Roadmap for the next version.

The RBC result is visualized as a horizontal bar chart. The variable with the tallest bar is the most likely fault driver — the one whose correction would most restore the process to statistical control.

### 3.5 Fault Diagnosis Engine

The Fault Diagnosis Engine maps the observed contribution pattern to a library of named physical fault modes using **cosine similarity**:

**Step 1 — Normalize observed contributions:**
```
normᵢ = Cᵢ / Σ Cᵢ
```

**Step 2 — Define fault signatures:**
Each named fault mode has a pre-defined signature vector **s** = [s₁, s₂, ..., sₚ] where sᵢ is the expected normalized contribution of variable i during that fault mode. Signatures are derived from physical process knowledge and published extrusion fault taxonomy literature.

**Step 3 — Compute cosine similarity:**
```
similarity(f) = (norm · s_f) / (‖norm‖ × ‖s_f‖)
```

**Step 4 — Rank hypotheses:**
All fault modes are ranked by descending similarity score (expressed as a percentage). The top-ranked hypothesis is presented as the primary diagnosis, with expanded detail including root cause mechanism, expected vs. observed signature comparison, numbered corrective action steps, and normative references.

This approach produces an **interpretable, ranked diagnostic output** that:
- Explains *why* a fault was identified (signature comparison charts)
- Provides actionable guidance (corrective action steps)
- Cites relevant standards and literature
- Is accessible to non-specialist operators

---

## 4. System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   DATA LAYER                            │
│  generatePoint(t, activeFault)                          │
│  Simulated sensor data · 6 parameters · 800ms interval  │
│  [Replace with OPC-UA / SCADA feed for production]      │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│               DETECTION LAYER                           │
│                                                         │
│  ┌──────────────────┐   ┌──────────────────────────┐   │
│  │ Univariate SPC   │   │  Hotelling T²            │   │
│  │ X̄ chart per param│   │  Multivariate statistic  │   │
│  │ UCL/LCL at ±3σ   │   │  UCL = χ²(0.05, df=6)   │   │
│  └──────────────────┘   └──────────────────────────┘   │
└───────────────────────┬─────────────────────────────────┘
                        │ Alarm signal
┌───────────────────────▼─────────────────────────────────┐
│             EXPLAINABILITY LAYER                        │
│                                                         │
│  ┌──────────────────┐   ┌──────────────────────────┐   │
│  │ T² Decomposition │   │ Reconstruction-Based     │   │
│  │ Cᵢ per variable  │   │ Contribution (RBC)       │   │
│  └──────────────────┘   └──────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Process State Radar  (|z| polar visualization) │   │
│  └─────────────────────────────────────────────────┘   │
└───────────────────────┬─────────────────────────────────┘
                        │ Contribution vector
┌───────────────────────▼─────────────────────────────────┐
│              DIAGNOSIS LAYER                            │
│                                                         │
│  Fault Signature Library (6 named failure modes)        │
│  Cosine Similarity Matching                             │
│  Ranked Hypothesis Output                               │
│  Root Cause Mechanism + Corrective Actions              │
└─────────────────────────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│             PRESENTATION LAYER (React)                  │
│                                                         │
│  Tab 1: Control Charts (univariate + T²)                │
│  Tab 2: Contribution Analysis (decomposition + radar)   │
│  Tab 3: Fault Diagnosis (ranked hypotheses + actions)   │
│  KPI bar · Parameter cards · Alarm event log            │
└─────────────────────────────────────────────────────────┘
```

---

## 5. Monitored Process Parameters

| Parameter | Symbol | Unit | Nominal (μ) | σ | UCL | LCL | Physical Significance |
|---|---|---|---|---|---|---|---|
| Barrel Temperature | BT | °C | 200 | 3 | 209 | 191 | Polymer melt temperature; controls viscosity and crosslinking rate |
| Screw Speed | SS | RPM | 85 | 2 | 91 | 79 | Throughput rate; drives melt pressure and shear heating |
| Melt Pressure | MP | bar | 280 | 8 | 304 | 256 | System backpressure; indicates flow resistance and die condition |
| Line Speed | LS | m/min | 45 | 1.5 | 49.5 | 40.5 | Draw-down ratio and wall thickness; directly controls dimensional output |
| Die Pressure | DP | bar | 180 | 5 | 195 | 165 | Die land condition; sensitive indicator of die wear or blockage |
| Wall Thickness | WT | mm | 1.200 | 0.05 | 1.350 | 1.050 | Primary dimensional quality characteristic; IEC 60502-1 §8.3 |

All nominal values, standard deviations, and control limits are representative of a medium-voltage XLPE cable extrusion line. For deployment, these values must be replaced with plant-specific in-control estimates derived from Phase I SPC analysis.

---

## 6. Fault Mode Library

Six named failure modes are encoded in the diagnosis engine. Each entry defines the primary affected parameter, direction and magnitude of deviation, expected duration, physical mechanism, and normalized contribution signature across all six parameters.

| Fault Name | Primary Driver | Severity | Physical Mechanism | Signature Key |
|---|---|---|---|---|
| **Die Wear** | Die Pressure ↓ | HIGH | Progressive wear of die land increases die gap; downstream wall thickness variance increases | DP: 65%, MP: 18%, WT: 10% |
| **Screw Slip** | Screw Speed ↓ | MEDIUM | Feed zone bridging or worn screw flight reduces conveying efficiency; throughput and pressure drop together | SS: 60%, MP: 20%, LS: 10% |
| **Temp Spike** | Barrel Temp ↑ | HIGH | Zone heater overshoot or thermocouple failure; melt viscosity drops, pressure profile shifts, polymer degradation risk | BT: 70%, MP: 15%, SS: 8% |
| **Pressure Surge** | Melt Pressure ↑ | HIGH | Screen pack blockage, cold plug, or abrupt screw acceleration; risk of die swell instability | MP: 62%, BT: 14%, DP: 12% |
| **Line Slowdown** | Line Speed ↓ | MEDIUM | Haul-off belt slip or drive failure; material accumulates at die exit, wall thickness increases, draw ratio drops | LS: 58%, WT: 22%, DP: 10% |
| **Thin Wall** | Wall Thickness ↓ | CRITICAL | Excessive line speed, die eccentricity, or low-viscosity material batch; directly compromises dielectric withstand | WT: 68%, DP: 14%, LS: 10% |

> **Note on Thin Wall severity:** Under IEC 60502-1, insulation wall thickness below the specified minimum is cause for mandatory rejection. All cable produced during a Thin Wall event should be quarantined for enhanced HV testing per IEC 60229.

---

## 7. Live Demo — How to Run

### Option A — Instant (No Installation): StackBlitz

1. Go to **[stackblitz.com](https://stackblitz.com)** and click **Create → React**
2. Open `src/App.jsx` and replace all contents with `extrusion-anomaly-v2.jsx`
3. In the terminal panel, run: `npm install recharts`
4. The demo loads automatically in the browser preview

### Option B — Local Development

**Prerequisites:** Node.js v18 or later, npm v8 or later

```bash
# 1. Create a new React application
npx create-react-app extrusion-anomaly-demo
cd extrusion-anomaly-demo

# 2. Install the charting dependency
npm install recharts

# 3. Replace the default App component
cp /path/to/extrusion-anomaly-v2.jsx src/App.jsx

# 4. Start the development server
npm start
```

The application opens at `http://localhost:3000`

### Option C — Vite (faster, recommended for development)

```bash
npm create vite@latest extrusion-demo -- --template react
cd extrusion-demo
npm install
npm install recharts
cp /path/to/extrusion-anomaly-v2.jsx src/App.jsx
npm run dev
```

### Using the Demo

| Action | How |
|---|---|
| Start live data stream | Click **▶ START** |
| Inject a named fault | Click any fault button (only active while running) |
| Drill into a parameter chart | Click any parameter card |
| View contribution analysis | Click **Contribution Analysis** tab |
| View fault diagnosis | Click **Fault Diagnosis** tab |
| Expand a fault hypothesis | Click any ranked hypothesis row |
| Stop and reset | **⏹ STOP** then **↺ RESET** |

---

## 8. Screenshots

> *Screenshots will be added following initial publication. Contributors are welcome to submit screenshots via pull request.*

**Tab 1 — Control Charts:** Real-time X̄ chart for the selected parameter and Hotelling T² multivariate chart, with anomalous points marked with red halos.

**Tab 2 — Contribution Analysis:** T² decomposition bar chart showing each variable's share of the alarm signal; RBC chart for fault isolation; process state radar.

**Tab 3 — Fault Diagnosis:** Ranked fault hypothesis list with cosine similarity confidence scores; expandable panels showing root cause mechanism, signature comparison chart, numbered corrective actions, and standards references.

---

## 9. Research Context and Novelty

### Field Positioning

This work sits at the intersection of three active research areas:

**Statistical Process Monitoring (SPM)** — the mathematical foundation, established by Shewhart (1931), Hotelling (1947), and extended to multivariate methods by Alt (1985), Mason et al. (1995), and Lowry et al. (1992). The field is mature but implementation in open-source industrial tools remains sparse.

**Explainable AI / Explainable Fault Detection (EFDD)** — a rapidly growing area driven by the need for interpretable industrial AI systems. Key contributions include contribution plot methods (Miller, 2002; Alcala & Qin, 2009), SHAP-based explanations for anomaly detectors (Lundberg & Lee, 2017), and causal graph approaches (Janzing et al., 2020). Most published EFDD work addresses chemical and petrochemical processes (the Tennessee Eastman benchmark); application to polymer extrusion and cable manufacturing is underrepresented.

**Smart Manufacturing / Industry 4.0** — the deployment context, where edge-deployable, real-time monitoring tools with operator-accessible explanations are a stated priority in both EU Horizon research programmes and national manufacturing competitiveness strategies.

### Claims of Novelty

This prototype makes the following contributions that are not individually represented in existing open-source literature:

1. **Combined T² decomposition and RBC in a single interactive visualization** — existing open-source SPC tools (qcc in R, PySPC in Python) implement control charts but not the decomposition layer for fault isolation.

2. **Fault signature library with cosine similarity matching for extrusion** — published fault taxonomies exist in grey literature and OEM documentation; encoding them as a searchable signature library with ranked output is not available in any known open-source repository.

3. **Corrective action integration** — connecting statistical alarm signals directly to normative corrective action guidance (with IEC, ISO, and technical literature references) within the monitoring interface.

4. **Browser-native implementation** — the entire system runs client-side in a web browser with no server infrastructure, making it deployable in air-gapped factory environments with a single HTML file.

### Limitations and Scope

This prototype uses **simulated process data** generated from parameterized normal distributions with injected faults. The following limitations apply to the current version:

- The covariance matrix is diagonal (parameters treated as independent). A full covariance matrix estimated from real plant data would improve T² sensitivity and make RBC theoretically superior to simple decomposition.
- Fault signatures are derived from physical reasoning and published extrusion literature, not from empirical data-driven training. In production deployment, signatures should be validated and calibrated against plant-specific historical alarm data.
- The fault diagnosis engine uses cosine similarity, a simple geometric measure. Future versions will incorporate Bayesian diagnosis, neural pattern matching, and causal inference methods.
- Six process parameters are monitored. Real extrusion lines typically monitor 12–30 parameters; extension to higher-dimensional spaces is addressed in the Roadmap.

---

## 10. References

The following works form the theoretical and applied foundation of this implementation. All are cited within the codebase at the relevant implementation points.

**Foundational SPC / MSPC:**

> Shewhart, W.A. (1931). *Economic Control of Quality of Manufactured Product.* Van Nostrand, New York. Reprinted 1980 by American Society for Quality.

> Hotelling, H. (1947). Multivariate quality control — illustrated by the air testing of sample bombsights. In Eisenhart, C., Hastay, M.W., Wallis, W.A. (Eds.), *Techniques of Statistical Analysis.* McGraw-Hill, New York.

> Alt, F.B. (1985). Multivariate Quality Control. In Kotz, S., Johnson, N.L. (Eds.), *Encyclopedia of Statistical Sciences*, Vol. 6. Wiley, New York.

> Lowry, C.A., Woodall, W.H., Champ, C.W., Rigdon, S.E. (1992). A Multivariate Exponentially Weighted Moving Average Control Chart. *Technometrics*, 34(1), 46–53.

**T² Decomposition and Fault Isolation:**

> Mason, R.L., Tracy, N.D., Young, J.C. (1995). Decomposition of T² for Multivariate Control Chart Interpretation. *Journal of Quality Technology*, 27(2), 99–108.

> Alcala, C.F., Qin, S.J. (2009). Reconstruction-Based Contribution for Process Monitoring. *Automatica*, 45(7), 1593–1600.

> Miller, P., Swanson, R.E., Heckler, C.E. (1998). Contribution Plots: A Missing Link in Multivariate Quality Control. *Applied Mathematics and Computer Science*, 8(4), 775–792.

**Explainable Fault Detection:**

> Lundberg, S.M., Lee, S.I. (2017). A Unified Approach to Interpreting Model Predictions. In *Advances in Neural Information Processing Systems 30 (NeurIPS)*, 4765–4774.

> Janzing, D., Balduzzi, D., Grosse-Wentrup, M., Schölkopf, B. (2013). Quantifying causal influences. *Annals of Statistics*, 41(5), 2324–2358.

**Polymer Extrusion Process:**

> Rauwendaal, C. (2014). *Polymer Extrusion*, 5th ed. Hanser, Munich. ISBN 978-1-56990-516-6.

> Tadmor, Z., Gogos, C.G. (2006). *Principles of Polymer Processing*, 2nd ed. Wiley-Interscience, Hoboken. ISBN 978-0-471-38771-8.

**Applicable Standards:**

> IEC 60502-1:2004+AMD1:2009. Power cables with extruded insulation and their accessories for rated voltages from 1 kV (Um = 1,2 kV) up to 30 kV (Um = 36 kV) — Part 1: Cables for rated voltages of 1 kV and 3 kV.

> IEC 60811-1-1:2001. Common test methods for insulating and sheathing materials of electric cables and optical cables — Part 1-1: Methods for general application — Measurement of thickness and overall dimensions.

> IEC 60228:2004. Conductors of insulated cables.

> ISO 9001:2015. Quality management systems — Requirements. §8.5.1: Control of production and service provision.

---

## 11. Author and Citation

**Author:** Krishna Malladi
**Affiliation:** Independent Researcher; Author, Industrial Manufacturing Series (14 volumes); Insurance Consultant, Subhala Insurance / Bajaj Allianz, Telangana, India
**AI-Assisted Implementation:** Developed with Claude (claude-sonnet-4-6, Anthropic, 2026)
**Date:** February 2026
**Repository:** https://github.com/krishnamalladi/extrusion-anomaly-detection

### How to Cite This Work

If you use this prototype, methodology, or code in your own research or publications, please cite it as follows:

**APA format:**
```
Malladi, K. (2026). Explainable Anomaly Detection for Polymer Extrusion Processes
[Software]. GitHub. https://github.com/krishnamalladi/extrusion-anomaly-detection
```

**BibTeX format:**
```bibtex
@software{malladi2026extrusion,
  author       = {Malladi, Krishna},
  title        = {Explainable Anomaly Detection for Polymer Extrusion Processes},
  year         = {2026},
  month        = {February},
  publisher    = {GitHub},
  url          = {https://github.com/krishnamalladi/extrusion-anomaly-detection},
  version      = {2.0.0},
  note         = {AI-assisted implementation with Claude (Anthropic)}
}
```

**IEEE format:**
```
K. Malladi, "Explainable Anomaly Detection for Polymer Extrusion Processes,"
GitHub, Feb. 2026. [Online]. Available: https://github.com/krishnamalladi/extrusion-anomaly-detection
```

---

## 12. License

This project is released under the **MIT License**.

```
MIT License

Copyright (c) 2026 Krishna Malladi

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

See the [LICENSE](./LICENSE) file for the full text.

### Dependency Licenses

| Dependency | License | Notes |
|---|---|---|
| React | MIT | Meta Platforms, Inc. |
| Recharts | MIT | Recharts Group |

Both dependencies are MIT-licensed and fully compatible with this project's MIT license.

---

## 13. Contributing

Contributions are warmly welcomed. Please read [CONTRIBUTING.md](./CONTRIBUTING.md) for the full guidelines.

**Priority contribution areas** (see Roadmap below):

- Full covariance matrix estimation from historical data (Phase I analysis module)
- SHAP-based explanation layer for ML anomaly detector integration
- OPC-UA / MQTT data connector for live plant integration
- Additional fault modes for other extrusion process types (wire drawing, stranding)
- Validation case studies using real plant data (with appropriate data sharing agreements)

---

## 14. Roadmap

### Version 2.1 (Near Term)
- [ ] Full non-diagonal covariance matrix support (Phase I estimation from uploaded CSV)
- [ ] WECO sensitizing rules (runs, trends, stratification) on univariate charts
- [ ] CUSUM and EWMA chart options alongside Shewhart charts
- [ ] Export alarm log and contribution data to CSV

### Version 3.0 (Medium Term)
- [ ] Integration with Isolation Forest and Autoencoder anomaly detectors
- [ ] SHAP explanation layer for ML-based detectors
- [ ] OPC-UA data connector for live plant integration
- [ ] Configurable parameter set (user-defined process variables and limits)
- [ ] Multi-language UI (Hindi, Telugu, German, Chinese)

### Version 4.0 (Research Direction)
- [ ] Causal graph-based fault propagation analysis (PC algorithm / LiNGAM)
- [ ] Bayesian fault diagnosis with prior updating from historical alarm data
- [ ] Digital twin synchronization for predictive (pre-alarm) fault warning
- [ ] Federated learning for cross-plant fault pattern sharing

---

*This README was last updated: February 2026*

*"Quality is not an act. It is a habit." — Aristotle*
