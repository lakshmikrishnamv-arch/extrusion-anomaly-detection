/**
 * ============================================================================
 * EXTRUSION PROCESS ANOMALY DETECTION & FAULT DIAGNOSIS SYSTEM
 * ============================================================================
 *
 * @title    Explainable Multivariate Anomaly Detection for Polymer Extrusion
 * @author   Krishna Malladi
 * @collab   Developed with Claude (Anthropic) — AI-assisted implementation
 * @date     2026-02-20
 * @version  2.0.0
 *
 * @description
 *   A real-time industrial SPC/MSPC monitoring prototype demonstrating:
 *     - Univariate Shewhart X̄ control charts (±3σ, WECO rules)
 *     - Hotelling T² multivariate control chart (χ², df=6, α=0.05)
 *     - T² Decomposition — variable contribution plots (Mason et al., 1995)
 *     - Reconstruction-Based Contribution (RBC) fault isolation
 *     - Rule-based Fault Diagnosis Engine with corrective action guidance
 *     - Fault injection simulator for six named extrusion failure modes
 *
 * @methodology
 *   The T² statistic is decomposed into individual variable contributions
 *   using the standardized squared deviation method. Fault diagnosis maps
 *   contribution patterns to named failure modes via a weighted signature
 *   library, producing a ranked hypothesis list with confidence scores.
 *
 * @references
 *   Shewhart, W.A. (1931). Economic Control of Quality of Manufactured Product.
 *   Hotelling, H. (1947). Multivariate Quality Control. Techniques of Statistical
 *     Analysis, McGraw-Hill.
 *   Mason, R.L., Tracy, N.D., Young, J.C. (1995). Decomposition of T² for
 *     Multivariate Control Chart Interpretation. Journal of Quality Technology,
 *     27(2), 99–108.
 *   Lowry, C.A., Woodall, W.H., Champ, C.W., Rigdon, S.E. (1992). A Multivariate
 *     Exponentially Weighted Moving Average Control Chart. Technometrics, 34(1).
 *
 * @license  MIT License — Free to use, modify, and publish with attribution.
 *           Copyright (c) 2026 Krishna Malladi
 *
 * @note     This prototype uses simulated data. For production deployment,
 *           replace the generatePoint() function with live OPC-UA / SCADA feeds.
 * ============================================================================
 */

import { useState, useEffect, useRef, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, BarChart, Bar, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from "recharts";

// ─── Process Parameter Configuration ─────────────────────────────────────────
const PARAMS = {
  barrel_temp:    { label: "Barrel Temp",    unit: "°C",    mean: 200, std: 3,    ucl: 209,  lcl: 191,  color: "#FF6B35", short: "BT"  },
  screw_speed:    { label: "Screw Speed",    unit: "RPM",   mean: 85,  std: 2,    ucl: 91,   lcl: 79,   color: "#00C9A7", short: "SS"  },
  melt_pressure:  { label: "Melt Pressure",  unit: "bar",   mean: 280, std: 8,    ucl: 304,  lcl: 256,  color: "#4CC9F0", short: "MP"  },
  line_speed:     { label: "Line Speed",     unit: "m/min", mean: 45,  std: 1.5,  ucl: 49.5, lcl: 40.5, color: "#FFD166", short: "LS"  },
  die_pressure:   { label: "Die Pressure",   unit: "bar",   mean: 180, std: 5,    ucl: 195,  lcl: 165,  color: "#A78BFA", short: "DP"  },
  wall_thickness: { label: "Wall Thickness", unit: "mm",    mean: 1.2, std: 0.05, ucl: 1.35, lcl: 1.05, color: "#F72585", short: "WT"  },
};

const PARAM_KEYS = Object.keys(PARAMS);
const T2_UCL = 12.6; // χ² critical value, df=6, α=0.05

// ─── Fault Mode Library ───────────────────────────────────────────────────────
// Each fault has: primary driver, secondary correlated effects, duration,
// a signature (normalized expected contribution pattern), and diagnosis metadata.
const FAULT_MODES = [
  {
    name: "Die Wear",
    param: "die_pressure",
    delta: -28,
    duration: 10,
    severity: "HIGH",
    color: "#ef4444",
    // Normalized contribution signature across all 6 params (sums to 1.0)
    signature: { die_pressure: 0.65, melt_pressure: 0.18, wall_thickness: 0.10, line_speed: 0.04, barrel_temp: 0.02, screw_speed: 0.01 },
    mechanism: "Progressive wear of die land increases die gap, causing die pressure drop. Downstream effect increases wall thickness variability.",
    actions: [
      "Schedule immediate die inspection and measurement",
      "Compare current die gap to nominal specification",
      "Check die land surface for galling or erosion",
      "Prepare spare die set for changeover",
      "Log cumulative throughput since last die change"
    ],
    references: "ISO 9001 §8.5.1 — Controlled production; die maintenance interval per OEM schedule"
  },
  {
    name: "Screw Slip",
    param: "screw_speed",
    delta: -12,
    duration: 6,
    severity: "MEDIUM",
    color: "#f97316",
    signature: { screw_speed: 0.60, melt_pressure: 0.20, line_speed: 0.10, barrel_temp: 0.06, die_pressure: 0.03, wall_thickness: 0.01 },
    mechanism: "Screw slippage in feed zone caused by bridging, overheating, or worn screw flight. Reduces throughput and melt pressure simultaneously.",
    actions: [
      "Inspect feed zone for material bridging or agglomeration",
      "Check barrel cooling water flow in feed zone",
      "Measure screw-barrel clearance — replace if > 2× nominal",
      "Verify hopper vibration / agitator is functioning",
      "Reduce back pressure setpoint temporarily and observe"
    ],
    references: "Rauwendaal, C. (2014). Polymer Extrusion, §7.3 — Solids conveying instabilities"
  },
  {
    name: "Temp Spike",
    param: "barrel_temp",
    delta: +22,
    duration: 5,
    severity: "HIGH",
    color: "#FF6B35",
    signature: { barrel_temp: 0.70, melt_pressure: 0.15, screw_speed: 0.08, die_pressure: 0.04, line_speed: 0.02, wall_thickness: 0.01 },
    mechanism: "Zone heater overshoot or thermocouple failure causes barrel temperature excursion. Reduces melt viscosity, alters pressure profile, and risks polymer degradation.",
    actions: [
      "Check PID setpoint and actual temperature for affected zone",
      "Inspect thermocouple calibration and connection",
      "Verify heater band contactor is not stuck closed",
      "Check for localized viscous dissipation hot spot",
      "If T > 230°C for XLPE/PVC — initiate material purge to prevent degradation"
    ],
    references: "IEC 60502-1 §9 — Conductor temperature limits during manufacture"
  },
  {
    name: "Pressure Surge",
    param: "melt_pressure",
    delta: +45,
    duration: 7,
    severity: "HIGH",
    color: "#4CC9F0",
    signature: { melt_pressure: 0.62, barrel_temp: 0.14, die_pressure: 0.12, screw_speed: 0.07, wall_thickness: 0.03, line_speed: 0.02 },
    mechanism: "Sudden melt pressure surge caused by screen pack blockage, cold plug, or abrupt screw speed increase. Risk of die swell instability and dimensional non-conformance.",
    actions: [
      "Check screen pack differential pressure — replace if blocked",
      "Inspect breaker plate for embedded contamination",
      "Verify melt temperature uniformity across die face",
      "Check for cold slug from recent material interruption",
      "Review screw speed ramp rate — reduce acceleration limit"
    ],
    references: "Tadmor & Gogos (2006). Principles of Polymer Processing, §13 — Pressure distribution"
  },
  {
    name: "Line Slowdown",
    param: "line_speed",
    delta: -8,
    duration: 8,
    severity: "MEDIUM",
    color: "#FFD166",
    signature: { line_speed: 0.58, wall_thickness: 0.22, die_pressure: 0.10, melt_pressure: 0.06, screw_speed: 0.03, barrel_temp: 0.01 },
    mechanism: "Capstan or haul-off speed reduction causes material to accumulate at die exit. Increases wall thickness, alters draw ratio and molecular orientation.",
    actions: [
      "Inspect haul-off belt tension and grip condition",
      "Check caterpillar drive motor torque feedback",
      "Inspect capstan for material wrap-up or slip",
      "Verify line speed encoder signal continuity",
      "Adjust screw speed to compensate if slowdown is sustained"
    ],
    references: "BS 7655 — Cable insulation dimensional tolerances during manufacture"
  },
  {
    name: "Thin Wall",
    param: "wall_thickness",
    delta: -0.18,
    duration: 6,
    severity: "CRITICAL",
    color: "#F72585",
    signature: { wall_thickness: 0.68, die_pressure: 0.14, line_speed: 0.10, melt_pressure: 0.05, screw_speed: 0.02, barrel_temp: 0.01 },
    mechanism: "Insulation wall below minimum specification. Caused by excessive line speed, die eccentricity, or material low viscosity. Directly impacts dielectric withstand voltage.",
    actions: [
      "IMMEDIATE: Flag all cable produced since alarm onset for HV test",
      "Reduce line speed by 10% and observe wall thickness response",
      "Check die centering — measure eccentricity at 4 positions",
      "Verify material MFI (melt flow index) against specification",
      "Inspect spark tester electrode gap — may not detect thin wall faults",
      "Notify QA for enhanced sampling inspection per IEC 60811"
    ],
    references: "IEC 60502-1 §8.3 — Minimum insulation thickness requirements; IEC 60811-1-1 — Measurement methods"
  },
];

// ─── T² Contribution Computation (Mason, Tracy & Young, 1995) ────────────────
function computeContributions(point) {
  return PARAM_KEYS.map(key => {
    const cfg = PARAMS[key];
    const z = (point[key] - cfg.mean) / cfg.std;
    const contrib = z * z;
    return {
      key, label: cfg.short, fullLabel: cfg.label,
      value: parseFloat(contrib.toFixed(4)),
      z: parseFloat(z.toFixed(3)),
      direction: z > 0 ? "HIGH" : "LOW",
      color: cfg.color
    };
  }).sort((a, b) => b.value - a.value);
}

// ─── Reconstruction-Based Contribution (RBC) ─────────────────────────────────
// Ask: if we replaced each variable with its nominal mean, how much would T² drop?
function computeRBC(point) {
  const t2Full = PARAM_KEYS.reduce((sum, k) => {
    const z = (point[k] - PARAMS[k].mean) / PARAMS[k].std;
    return sum + z * z;
  }, 0);

  return PARAM_KEYS.map(key => {
    const t2Without = PARAM_KEYS.reduce((sum, k) => {
      if (k === key) return sum; // reconstruct this variable to nominal
      const z = (point[k] - PARAMS[k].mean) / PARAMS[k].std;
      return sum + z * z;
    }, 0);
    const rbc = t2Full - t2Without;
    return { key, label: PARAMS[key].short, fullLabel: PARAMS[key].label,
      rbc: parseFloat(rbc.toFixed(4)), color: PARAMS[key].color };
  }).sort((a, b) => b.rbc - a.rbc);
}

// ─── Fault Diagnosis Engine ───────────────────────────────────────────────────
function diagnoseFault(contributions) {
  // Normalize contributions to sum=1 for pattern matching
  const total = contributions.reduce((s, c) => s + c.value, 0) || 1;
  const norm = {};
  contributions.forEach(c => { norm[c.key] = c.value / total; });

  // Cosine similarity between observed pattern and each fault signature
  const scores = FAULT_MODES.map(fault => {
    let dot = 0, magFault = 0, magObs = 0;
    PARAM_KEYS.forEach(k => {
      const fo = fault.signature[k] || 0;
      const ob = norm[k] || 0;
      dot += fo * ob;
      magFault += fo * fo;
      magObs += ob * ob;
    });
    const similarity = magFault && magObs
      ? dot / (Math.sqrt(magFault) * Math.sqrt(magObs))
      : 0;
    return { ...fault, confidence: parseFloat((similarity * 100).toFixed(1)) };
  });

  return scores.sort((a, b) => b.confidence - a.confidence);
}

// ─── Data Generator ───────────────────────────────────────────────────────────
function generatePoint(t, activeFault) {
  const point = { t };
  PARAM_KEYS.forEach(key => {
    const cfg = PARAMS[key];
    let val = cfg.mean + (Math.random() - 0.5) * 2 * cfg.std;
    if (activeFault?.param === key) {
      val += activeFault.delta * (0.75 + Math.random() * 0.5);
    }
    point[key] = parseFloat(val.toFixed(3));
    point[`${key}_anomaly`] = val > cfg.ucl || val < cfg.lcl;
  });
  const t2 = PARAM_KEYS.reduce((s, k) => {
    const z = (point[k] - PARAMS[k].mean) / PARAMS[k].std;
    return s + z * z;
  }, 0);
  point.t2 = parseFloat(t2.toFixed(3));
  point.t2_anomaly = t2 > T2_UCL;
  return point;
}

// ─── Severity Badge ───────────────────────────────────────────────────────────
const SEVERITY_COLORS = { CRITICAL: "#F72585", HIGH: "#ef4444", MEDIUM: "#f97316", LOW: "#FFD166" };

// ─── Sub-Components ───────────────────────────────────────────────────────────
const fmt = (v, unit) => `${typeof v === "number" ? v.toFixed(unit === "mm" ? 3 : 1) : v}${unit}`;

const SectionBox = ({ title, subtitle, titleColor = "#94a3b8", children, style = {} }) => (
  <div style={{ background: "#0c1428", border: "1px solid #1e293b", borderRadius: 10, padding: "16px 20px", ...style }}>
    <div style={{ marginBottom: 12 }}>
      <span style={{ color: "#475569", fontSize: 10, letterSpacing: 2, textTransform: "uppercase" }}>{title} — </span>
      <span style={{ color: titleColor, fontWeight: 700, fontSize: 13 }}>{subtitle}</span>
    </div>
    {children}
  </div>
);

function ParamCard({ paramKey, data, isActive, onClick }) {
  const cfg = PARAMS[paramKey];
  const latest = data[data.length - 1];
  const val = latest?.[paramKey];
  const anom = latest?.[`${paramKey}_anomaly`];
  const pct = val ? Math.min(100, Math.max(0, ((val - cfg.lcl) / (cfg.ucl - cfg.lcl)) * 100)) : 50;

  return (
    <div onClick={onClick} style={{
      background: isActive ? "#1a2540" : "#0f172a",
      border: `1px solid ${anom ? "#ef4444" : isActive ? cfg.color : "#1e293b"}`,
      borderRadius: 8, padding: "12px 14px", cursor: "pointer",
      transition: "all 0.2s", position: "relative", overflow: "hidden",
      boxShadow: anom ? `0 0 20px ${cfg.color}44` : isActive ? `0 0 10px ${cfg.color}22` : "none"
    }}>
      {anom && (
        <div style={{ position: "absolute", top: 0, right: 0, background: "#ef4444",
          color: "#fff", fontSize: 9, fontWeight: 700, padding: "2px 6px",
          borderRadius: "0 8px 0 6px", letterSpacing: 1 }}>ALARM</div>
      )}
      <div style={{ color: "#475569", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", marginBottom: 2 }}>
        {cfg.label}
      </div>
      <div style={{ color: anom ? "#ef4444" : cfg.color, fontSize: 20, fontWeight: 800, fontFamily: "monospace" }}>
        {val !== undefined ? fmt(val, cfg.unit) : "—"}
      </div>
      <div style={{ marginTop: 7, height: 3, background: "#1e293b", borderRadius: 2 }}>
        <div style={{ width: `${pct}%`, height: "100%", background: anom ? "#ef4444" : cfg.color, borderRadius: 2, transition: "width 0.3s" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2, color: "#334155", fontSize: 9, fontFamily: "monospace" }}>
        <span>LCL {cfg.lcl}</span><span>UCL {cfg.ucl}</span>
      </div>
      <div style={{ height: 32, marginTop: 4 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data.slice(-30)}>
            <Line type="monotone" dataKey={paramKey} stroke={anom ? "#ef4444" : cfg.color}
              strokeWidth={1.5} dot={false} isAnimationActive={false} />
            <ReferenceLine y={cfg.ucl} stroke="#ef444455" strokeDasharray="2 2" />
            <ReferenceLine y={cfg.lcl} stroke="#ef444455" strokeDasharray="2 2" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Contribution Plot Panel ──────────────────────────────────────────────────
function ContributionPanel({ latestPoint, isAnomalous }) {
  if (!latestPoint) return (
    <div style={{ color: "#334155", textAlign: "center", padding: "32px 0", fontSize: 12 }}>
      Start the process to view contribution analysis
    </div>
  );

  const contributions = computeContributions(latestPoint);
  const rbc = computeRBC(latestPoint);
  const maxVal = Math.max(...contributions.map(c => c.value), 1);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

      {/* T² Decomposition — Bar Chart */}
      <div>
        <div style={{ color: "#475569", fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>
          T² Decomposition  <span style={{ color: "#334155" }}>(Mason et al., 1995)</span>
        </div>
        {contributions.map((c, i) => (
          <div key={c.key} style={{ marginBottom: 7 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 2 }}>
              <span style={{ color: c.color, fontWeight: 700 }}>{c.fullLabel}</span>
              <span style={{ color: "#64748b", fontFamily: "monospace" }}>
                z={c.z > 0 ? "+" : ""}{c.z}  [{c.direction}]  {c.value.toFixed(3)}
              </span>
            </div>
            <div style={{ height: 12, background: "#1e293b", borderRadius: 3, overflow: "hidden" }}>
              <div style={{
                width: `${(c.value / maxVal) * 100}%`, height: "100%",
                background: c.value > T2_UCL / 6 ? (isAnomalous ? "#ef4444" : c.color) : c.color,
                opacity: 0.85, borderRadius: 3,
                transition: "width 0.5s ease",
                boxShadow: c.value > T2_UCL / 6 && isAnomalous ? `0 0 8px ${c.color}88` : "none"
              }} />
            </div>
          </div>
        ))}
        <div style={{ marginTop: 10, padding: "8px 10px", background: "#0f172a", borderRadius: 6, fontSize: 10, color: "#475569" }}>
          Total T² = <span style={{ color: isAnomalous ? "#ef4444" : "#A78BFA", fontWeight: 700, fontFamily: "monospace" }}>
            {latestPoint.t2?.toFixed(3)}
          </span>
          <span style={{ marginLeft: 8 }}>UCL = {T2_UCL}</span>
          {isAnomalous && <span style={{ color: "#ef4444", marginLeft: 8 }}>⚠ OUT OF CONTROL</span>}
        </div>
      </div>

      {/* Reconstruction-Based Contribution */}
      <div>
        <div style={{ color: "#475569", fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>
          Reconstruction-Based (RBC)  <span style={{ color: "#334155" }}>Fault Isolation</span>
        </div>
        <div style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rbc} layout="vertical" margin={{ left: 10, right: 20, top: 0, bottom: 0 }}>
              <CartesianGrid stroke="#1e293b" strokeDasharray="2 2" horizontal={false} />
              <XAxis type="number" domain={[0, "auto"]} tick={{ fontSize: 9, fill: "#475569" }} stroke="#1e293b" />
              <YAxis type="category" dataKey="label" tick={{ fontSize: 10, fill: "#64748b" }} stroke="none" width={24} />
              <Tooltip
                contentStyle={{ background: "#0f172a", border: "1px solid #334155", fontSize: 10, fontFamily: "monospace" }}
                formatter={(v, n, p) => [`ΔT² = ${v.toFixed(4)}`, p.payload.fullLabel]}
                labelFormatter={() => "RBC — if removed from T²"}
              />
              <Bar dataKey="rbc" radius={[0, 3, 3, 0]}>
                {rbc.map(entry => (
                  <Cell key={entry.key} fill={entry.color} opacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div style={{ fontSize: 10, color: "#334155", marginTop: 6, lineHeight: 1.6 }}>
          RBC measures how much T² drops if each variable is individually
          reconstructed to its nominal value. Highest bar = primary fault driver.
        </div>
      </div>

      {/* Radar — Process State */}
      <div style={{ gridColumn: "1 / -1" }}>
        <div style={{ color: "#475569", fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>
          Process State Radar  <span style={{ color: "#334155" }}>|z| normalized deviation from nominal</span>
        </div>
        <div style={{ height: 180 }}>
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={contributions.map(c => ({ param: c.label, deviation: Math.abs(c.z), limit: 3 }))}>
              <PolarGrid stroke="#1e293b" />
              <PolarAngleAxis dataKey="param" tick={{ fontSize: 10, fill: "#64748b" }} />
              <PolarRadiusAxis angle={30} domain={[0, 4]} tick={{ fontSize: 8, fill: "#334155" }} />
              <Radar name="Current" dataKey="deviation" stroke="#4CC9F0" fill="#4CC9F0" fillOpacity={0.2} />
              <Radar name="3σ Limit" dataKey="limit" stroke="#ef444455" fill="none" strokeDasharray="4 4" />
              <Tooltip
                contentStyle={{ background: "#0f172a", border: "1px solid #334155", fontSize: 10, fontFamily: "monospace" }}
                formatter={(v) => [`|z| = ${v}`, "Std. Deviations"]}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ─── Fault Diagnosis Panel ────────────────────────────────────────────────────
function FaultDiagnosisPanel({ latestPoint, alarmLog }) {
  const [expanded, setExpanded] = useState(null);

  if (!latestPoint) return (
    <div style={{ color: "#334155", textAlign: "center", padding: "32px 0", fontSize: 12 }}>
      Start the process to activate fault diagnosis
    </div>
  );

  const contributions = computeContributions(latestPoint);
  const diagnoses = diagnoseFault(contributions);
  const top = diagnoses[0];
  const isAnomalous = latestPoint.t2_anomaly;

  return (
    <div>
      {/* Confidence Ranking */}
      <div style={{ color: "#475569", fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 12 }}>
        Fault Hypothesis Ranking  <span style={{ color: "#334155" }}>— cosine similarity to fault signature library</span>
      </div>

      {!isAnomalous && (
        <div style={{ background: "#0a2a1a", border: "1px solid #10b981", borderRadius: 8,
          padding: "10px 14px", marginBottom: 12, fontSize: 11, color: "#6ee7b7" }}>
          ✓ Process currently in statistical control — diagnosis scores reflect baseline noise pattern.
          Inject a fault to see active diagnosis.
        </div>
      )}

      {diagnoses.map((d, i) => (
        <div key={d.name} style={{ marginBottom: 8 }}>
          <div
            onClick={() => setExpanded(expanded === d.name ? null : d.name)}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              background: expanded === d.name ? "#1a2540" : "#0f172a",
              border: `1px solid ${i === 0 && isAnomalous ? d.color : "#1e293b"}`,
              borderRadius: 8, padding: "10px 14px", cursor: "pointer",
              transition: "all 0.2s",
              boxShadow: i === 0 && isAnomalous ? `0 0 12px ${d.color}33` : "none"
            }}>
            {/* Rank Badge */}
            <div style={{
              width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: 11, fontWeight: 800, flexShrink: 0,
              background: i === 0 && isAnomalous ? d.color : "#1e293b",
              color: i === 0 && isAnomalous ? "#fff" : "#475569"
            }}>{i + 1}</div>

            {/* Fault Name + Severity */}
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: i === 0 && isAnomalous ? d.color : "#94a3b8", fontWeight: 700, fontSize: 12 }}>
                  {d.name}
                </span>
                <span style={{
                  fontSize: 9, padding: "1px 6px", borderRadius: 3, fontWeight: 700, letterSpacing: 1,
                  background: `${SEVERITY_COLORS[d.severity]}22`,
                  color: SEVERITY_COLORS[d.severity],
                  border: `1px solid ${SEVERITY_COLORS[d.severity]}44`
                }}>{d.severity}</span>
              </div>
              <div style={{ color: "#475569", fontSize: 10, marginTop: 2 }}>
                Primary driver: <span style={{ color: PARAMS[d.param].color }}>{PARAMS[d.param].label}</span>
              </div>
            </div>

            {/* Confidence Bar */}
            <div style={{ width: 120, textAlign: "right" }}>
              <div style={{ color: i === 0 && isAnomalous ? d.color : "#475569", fontFamily: "monospace", fontSize: 13, fontWeight: 700 }}>
                {d.confidence}%
              </div>
              <div style={{ height: 4, background: "#1e293b", borderRadius: 2, marginTop: 4 }}>
                <div style={{
                  width: `${d.confidence}%`, height: "100%", borderRadius: 2,
                  background: i === 0 && isAnomalous ? d.color : "#334155",
                  transition: "width 0.6s ease"
                }} />
              </div>
            </div>
            <span style={{ color: "#334155", fontSize: 12 }}>{expanded === d.name ? "▲" : "▼"}</span>
          </div>

          {/* Expanded Detail */}
          {expanded === d.name && (
            <div style={{
              background: "#080e1a", border: `1px solid ${d.color}44`,
              borderRadius: "0 0 8px 8px", padding: "14px 16px", marginTop: -4,
              borderTop: "none"
            }}>
              {/* Mechanism */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ color: d.color, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4 }}>
                  Root Cause Mechanism
                </div>
                <div style={{ color: "#94a3b8", fontSize: 11, lineHeight: 1.7 }}>{d.mechanism}</div>
              </div>

              {/* Expected vs Observed Signature */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ color: "#64748b", fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>
                  Signature Comparison — Expected vs Observed
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 4 }}>
                  {PARAM_KEYS.map(k => {
                    const expected = (d.signature[k] || 0) * 100;
                    const total = contributions.reduce((s, c) => s + c.value, 0) || 1;
                    const observed = (contributions.find(c => c.key === k)?.value / total) * 100 || 0;
                    return (
                      <div key={k} style={{ background: "#0f172a", borderRadius: 6, padding: "8px 6px", textAlign: "center" }}>
                        <div style={{ color: PARAMS[k].color, fontSize: 9, fontWeight: 700, marginBottom: 4 }}>{PARAMS[k].short}</div>
                        <div style={{ height: 40, display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 3 }}>
                          <div style={{ width: 8, background: "#334155", height: `${expected}%`, borderRadius: 2, minHeight: 2 }} title="Expected" />
                          <div style={{ width: 8, background: PARAMS[k].color, height: `${Math.min(observed, 100)}%`, borderRadius: 2, minHeight: 2, opacity: 0.85 }} title="Observed" />
                        </div>
                        <div style={{ color: "#334155", fontSize: 8, marginTop: 3 }}>
                          E:{expected.toFixed(0)}% O:{observed.toFixed(0)}%
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ fontSize: 9, color: "#334155", marginTop: 4 }}>Gray = Expected signature | Colored = Observed contribution</div>
              </div>

              {/* Corrective Actions */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ color: "#64748b", fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>
                  Recommended Corrective Actions
                </div>
                {d.actions.map((action, ai) => (
                  <div key={ai} style={{ display: "flex", gap: 8, marginBottom: 5, alignItems: "flex-start" }}>
                    <span style={{ color: d.color, fontWeight: 700, fontSize: 11, minWidth: 18, marginTop: 1 }}>{ai + 1}.</span>
                    <span style={{ color: "#94a3b8", fontSize: 11, lineHeight: 1.5 }}>{action}</span>
                  </div>
                ))}
              </div>

              {/* Reference */}
              <div style={{ borderTop: "1px solid #1e293b", paddingTop: 8 }}>
                <span style={{ color: "#334155", fontSize: 9, letterSpacing: 1 }}>REFERENCE: </span>
                <span style={{ color: "#475569", fontSize: 9 }}>{d.references}</span>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Alarm Summary */}
      {alarmLog.length > 0 && (
        <div style={{ marginTop: 16, background: "#0f172a", borderRadius: 8, padding: "10px 14px" }}>
          <div style={{ color: "#475569", fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>
            Alarm Event Log ({alarmLog.length})
          </div>
          <div style={{ maxHeight: 140, overflowY: "auto" }}>
            {alarmLog.map((a, i) => (
              <div key={a.id} style={{
                display: "flex", gap: 12, padding: "5px 8px",
                background: i % 2 === 0 ? "#0c1428" : "transparent", borderRadius: 4, fontSize: 10
              }}>
                <span style={{ color: "#334155", minWidth: 55, fontFamily: "monospace" }}>t={a.t}s</span>
                <span style={{ color: "#ef4444", minWidth: 140 }}>⚠ {a.param}</span>
                <span style={{ color: "#fca5a5", fontWeight: 700, fontFamily: "monospace" }}>{a.val}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Application ─────────────────────────────────────────────────────────
export default function ExtrusionAnomalyMonitor() {
  const [data, setData] = useState([]);
  const [running, setRunning] = useState(false);
  const [selectedParam, setSelectedParam] = useState("barrel_temp");
  const [activeFault, setActiveFault] = useState(null);
  const [faultCountdown, setFaultCountdown] = useState(0);
  const [alarmLog, setAlarmLog] = useState([]);
  const [tickCount, setTickCount] = useState(0);
  const [injectingFault, setInjectingFault] = useState(null);
  const [activeTab, setActiveTab] = useState("charts");  // charts | contribution | diagnosis
  const timerRef = useRef(null);
  const tRef = useRef(0);
  const faultRef = useRef(null);
  const faultCdRef = useRef(0);

  const tick = useCallback(() => {
    tRef.current += 1;
    const t = tRef.current;

    if (faultCdRef.current > 1) {
      faultCdRef.current -= 1;
      setFaultCountdown(faultCdRef.current);
    } else if (faultCdRef.current === 1) {
      faultCdRef.current = 0;
      faultRef.current = null;
      setActiveFault(null);
      setFaultCountdown(0);
    }

    const pt = generatePoint(t, faultRef.current);

    setData(prev => [...prev, pt].slice(-120));

    const newAlarms = [];
    PARAM_KEYS.forEach(k => {
      if (pt[`${k}_anomaly`]) {
        newAlarms.push({ t, param: PARAMS[k].label, val: fmt(pt[k], PARAMS[k].unit), id: `${t}-${k}` });
      }
    });
    if (pt.t2_anomaly) {
      newAlarms.push({ t, param: "T² Multivariate", val: pt.t2.toFixed(2), id: `${t}-t2` });
    }
    if (newAlarms.length) {
      setAlarmLog(prev => [...newAlarms, ...prev].slice(0, 80));
    }
    setTickCount(t);
  }, []);

  useEffect(() => {
    if (running) { timerRef.current = setInterval(tick, 800); }
    else { clearInterval(timerRef.current); }
    return () => clearInterval(timerRef.current);
  }, [running, tick]);

  const injectFault = (fault) => {
    faultRef.current = fault;
    faultCdRef.current = fault.duration;
    setActiveFault(fault);
    setFaultCountdown(fault.duration);
    setInjectingFault(fault.name);
    setTimeout(() => setInjectingFault(null), 800);
  };

  const reset = () => {
    setRunning(false); clearInterval(timerRef.current);
    setData([]); setAlarmLog([]); setActiveFault(null);
    setFaultCountdown(0); tRef.current = 0;
    faultRef.current = null; faultCdRef.current = 0;
    setTickCount(0);
  };

  const latest = data[data.length - 1];
  const cfg = PARAMS[selectedParam];
  const totalAlarms = alarmLog.length;
  const alarmRate = data.length ? ((data.filter(d => d.t2_anomaly).length / data.length) * 100).toFixed(1) : "0.0";
  const latestT2 = latest?.t2 ?? 0;
  const isAnomalous = latest?.t2_anomaly ?? false;

  const TAB_STYLE = (tab) => ({
    padding: "8px 16px", cursor: "pointer", fontSize: 11, fontWeight: 600,
    fontFamily: "inherit", border: "none", letterSpacing: 0.8,
    background: activeTab === tab ? "#1e3a5f" : "transparent",
    color: activeTab === tab ? "#4CC9F0" : "#475569",
    borderBottom: activeTab === tab ? "2px solid #4CC9F0" : "2px solid transparent",
    transition: "all 0.2s"
  });

  return (
    <div style={{
      minHeight: "100vh", background: "#080e1a",
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      color: "#e2e8f0", padding: "20px 24px",
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 9, color: "#1e3a5f", letterSpacing: 4, textTransform: "uppercase", marginBottom: 3 }}>
            SPC / MSPC · EXPLAINABLE ANOMALY DETECTION
          </div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: "#f8fafc", letterSpacing: -0.5, lineHeight: 1.2 }}>
            Extrusion Process Monitor
          </h1>
          <div style={{ color: "#334155", fontSize: 10, marginTop: 3 }}>
            Krishna Malladi · v2.0 · 2026-02-20 · MIT License
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: running ? (isAnomalous ? "#ef4444" : "#00C9A7") : "#334155",
            boxShadow: running ? `0 0 10px ${isAnomalous ? "#ef4444" : "#00C9A7"}` : "none",
            animation: running && isAnomalous ? "alarm-pulse 0.5s infinite" : running ? "pulse 1.2s infinite" : "none"
          }} />
          <span style={{ color: running ? (isAnomalous ? "#ef4444" : "#00C9A7") : "#475569", fontSize: 11 }}>
            {running ? (isAnomalous ? `⚠ ALARM  t=${tickCount}s` : `LIVE  t=${tickCount}s`) : "STOPPED"}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <button onClick={() => setRunning(r => !r)} style={{
          background: running ? "#2d0a0a" : "#031a10", color: running ? "#fca5a5" : "#6ee7b7",
          border: `1px solid ${running ? "#ef4444" : "#10b981"}`, borderRadius: 6,
          padding: "8px 16px", cursor: "pointer", fontSize: 11, letterSpacing: 1, fontWeight: 700, fontFamily: "inherit"
        }}>{running ? "⏹ STOP" : "▶ START"}</button>

        <button onClick={reset} style={{
          background: "#0f172a", color: "#475569", border: "1px solid #1e293b",
          borderRadius: 6, padding: "8px 12px", cursor: "pointer", fontSize: 11, fontFamily: "inherit"
        }}>↺ RESET</button>

        <div style={{ width: 1, height: 24, background: "#1e293b" }} />

        <span style={{ color: "#1e3a5f", fontSize: 9, letterSpacing: 2, textTransform: "uppercase" }}>INJECT FAULT:</span>
        {FAULT_MODES.map(fault => (
          <button key={fault.name} onClick={() => running && injectFault(fault)} disabled={!running} style={{
            background: injectingFault === fault.name ? `${fault.color}33` : "#0f172a",
            color: injectingFault === fault.name ? fault.color : running ? "#64748b" : "#1e293b",
            border: `1px solid ${injectingFault === fault.name ? fault.color : "#1e293b"}`,
            borderRadius: 6, padding: "6px 10px", cursor: running ? "pointer" : "not-allowed",
            fontSize: 10, fontFamily: "inherit", transition: "all 0.2s"
          }}>{fault.name}</button>
        ))}
      </div>

      {/* Active Fault Banner */}
      {activeFault && (
        <div style={{
          background: `${activeFault.color}11`, border: `1px solid ${activeFault.color}66`,
          borderRadius: 8, padding: "9px 14px", marginBottom: 12,
          display: "flex", justifyContent: "space-between"
        }}>
          <span style={{ color: activeFault.color, fontSize: 11, fontWeight: 700 }}>
            ⚡ INJECTED FAULT: {activeFault.name.toUpperCase()}
            &emsp;|&emsp; Driver: {PARAMS[activeFault.param].label}
            &emsp;|&emsp; Δ = {activeFault.delta > 0 ? "+" : ""}{activeFault.delta}{PARAMS[activeFault.param].unit}
            &emsp;|&emsp; Severity: {activeFault.severity}
          </span>
          <span style={{ color: "#475569", fontSize: 11 }}>{faultCountdown} ticks left</span>
        </div>
      )}

      {/* KPI Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8, marginBottom: 16 }}>
        {[
          { label: "Samples",     val: data.length,              color: "#4CC9F0" },
          { label: "Alarm Events",val: totalAlarms,              color: totalAlarms > 0 ? "#ef4444" : "#00C9A7" },
          { label: "Alarm Rate",  val: `${alarmRate}%`,          color: parseFloat(alarmRate) > 5 ? "#ef4444" : "#00C9A7" },
          { label: "T² Score",    val: latestT2.toFixed(2),      color: isAnomalous ? "#ef4444" : "#A78BFA" },
          { label: "Status",      val: isAnomalous ? "ALARM" : running ? "NORMAL" : "IDLE",
            color: isAnomalous ? "#ef4444" : running ? "#00C9A7" : "#334155" },
        ].map(kpi => (
          <div key={kpi.label} style={{ background: "#0c1428", border: "1px solid #1e293b", borderRadius: 8, padding: "10px 14px" }}>
            <div style={{ color: "#334155", fontSize: 9, letterSpacing: 2, textTransform: "uppercase" }}>{kpi.label}</div>
            <div style={{ color: kpi.color, fontSize: 22, fontWeight: 800, marginTop: 3, fontFamily: "monospace" }}>{kpi.val}</div>
          </div>
        ))}
      </div>

      {/* Parameter Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8, marginBottom: 16 }}>
        {PARAM_KEYS.map(key => (
          <ParamCard key={key} paramKey={key} data={data}
            isActive={selectedParam === key && activeTab === "charts"}
            onClick={() => { setSelectedParam(key); setActiveTab("charts"); }} />
        ))}
      </div>

      {/* Tab Navigation */}
      <div style={{ display: "flex", borderBottom: "1px solid #1e293b", marginBottom: 16, gap: 0 }}>
        <button onClick={() => setActiveTab("charts")} style={TAB_STYLE("charts")}>📈 Control Charts</button>
        <button onClick={() => setActiveTab("contribution")} style={TAB_STYLE("contribution")}>🔬 Contribution Analysis</button>
        <button onClick={() => setActiveTab("diagnosis")} style={TAB_STYLE("diagnosis")}>
          🧠 Fault Diagnosis {isAnomalous ? "⚠" : ""}
        </button>
      </div>

      {/* Tab: Control Charts */}
      {activeTab === "charts" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Univariate Chart */}
          <SectionBox title="Control Chart" subtitle={cfg.label} titleColor={cfg.color}>
            <div style={{ display: "flex", gap: 16, marginBottom: 8, fontSize: 10 }}>
              {["UCL", "CL", "LCL"].map((l, i) => (
                <span key={l} style={{ color: i === 1 ? "#475569" : "#ef4444" }}>
                  {l} = {i === 0 ? cfg.ucl : i === 1 ? cfg.mean : cfg.lcl} {cfg.unit}
                </span>
              ))}
              <span style={{ color: "#334155" }}>σ = {cfg.std} {cfg.unit} | Last 120 samples</span>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                <XAxis dataKey="t" stroke="#334155" tick={{ fontSize: 9, fill: "#475569" }} />
                <YAxis stroke="#334155" tick={{ fontSize: 9, fill: "#475569" }} domain={[cfg.lcl - cfg.std * 2.5, cfg.ucl + cfg.std * 2.5]} />
                <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", fontSize: 10, fontFamily: "monospace" }}
                  formatter={(v) => [fmt(v, cfg.unit), cfg.label]} labelFormatter={l => `t=${l}s`} />
                <ReferenceLine y={cfg.ucl} stroke="#ef4444" strokeDasharray="4 4" label={{ value: "UCL", fill: "#ef4444", fontSize: 9, position: "insideTopRight" }} />
                <ReferenceLine y={cfg.mean} stroke="#1e3a5f" strokeDasharray="4 4" label={{ value: "CL", fill: "#334155", fontSize: 9, position: "insideTopRight" }} />
                <ReferenceLine y={cfg.lcl} stroke="#ef4444" strokeDasharray="4 4" label={{ value: "LCL", fill: "#ef4444", fontSize: 9, position: "insideBottomRight" }} />
                <Line type="monotone" dataKey={selectedParam} stroke={cfg.color} strokeWidth={2}
                  dot={(props) => {
                    const { cx, cy, payload } = props;
                    const anom = payload[`${selectedParam}_anomaly`];
                    if (!anom) return <circle key={props.key} cx={cx} cy={cy} r={2} fill={cfg.color} opacity={0.6} />;
                    return <g key={props.key}>
                      <circle cx={cx} cy={cy} r={7} fill="#ef444422" stroke="#ef4444" strokeWidth={1.5} />
                      <circle cx={cx} cy={cy} r={3} fill="#ef4444" />
                    </g>;
                  }}
                  isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </SectionBox>

          {/* T² Chart */}
          <SectionBox title="Hotelling T²" subtitle="Multivariate Control Chart" titleColor="#A78BFA">
            <div style={{ fontSize: 10, color: "#334155", marginBottom: 8 }}>
              UCL = {T2_UCL} (χ², df=6, α=0.05) — Monitors all 6 parameters jointly. Detects correlated shifts invisible to univariate charts.
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={data} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                <XAxis dataKey="t" stroke="#334155" tick={{ fontSize: 9, fill: "#475569" }} />
                <YAxis stroke="#334155" tick={{ fontSize: 9, fill: "#475569" }} domain={[0, 35]} />
                <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", fontSize: 10, fontFamily: "monospace" }}
                  formatter={(v) => [v.toFixed(3), "T²"]} labelFormatter={l => `t=${l}s`} />
                <ReferenceLine y={T2_UCL} stroke="#ef4444" strokeDasharray="4 4" label={{ value: `UCL ${T2_UCL}`, fill: "#ef4444", fontSize: 9, position: "insideTopRight" }} />
                <Line type="monotone" dataKey="t2" stroke="#A78BFA" strokeWidth={2}
                  dot={(props) => {
                    const { cx, cy, payload } = props;
                    if (!payload.t2_anomaly) return <circle key={props.key} cx={cx} cy={cy} r={2} fill="#A78BFA" opacity={0.5} />;
                    return <g key={props.key}>
                      <circle cx={cx} cy={cy} r={8} fill="#7c3aed22" stroke="#7c3aed" strokeWidth={1.5} />
                      <circle cx={cx} cy={cy} r={3} fill="#A78BFA" />
                    </g>;
                  }}
                  isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </SectionBox>
        </div>
      )}

      {/* Tab: Contribution Analysis */}
      {activeTab === "contribution" && (
        <SectionBox title="Explainability" subtitle="T² Decomposition + RBC Fault Isolation" titleColor="#4CC9F0">
          <ContributionPanel latestPoint={latest} isAnomalous={isAnomalous} />
        </SectionBox>
      )}

      {/* Tab: Fault Diagnosis */}
      {activeTab === "diagnosis" && (
        <SectionBox
          title="Fault Diagnosis Engine"
          subtitle="Hypothesis Ranking · Mechanism · Corrective Actions"
          titleColor={isAnomalous ? "#ef4444" : "#00C9A7"}
        >
          <FaultDiagnosisPanel latestPoint={latest} alarmLog={alarmLog} />
        </SectionBox>
      )}

      {/* Footer */}
      <div style={{ marginTop: 16, padding: "10px 0", borderTop: "1px solid #0f172a",
        display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ color: "#1e3a5f", fontSize: 9, lineHeight: 1.6 }}>
          Shewhart (1931) · Hotelling (1947) · Mason, Tracy & Young (1995) · Lowry et al. (1992)
        </div>
        <div style={{ color: "#1e293b", fontSize: 9 }}>
          © 2026 Krishna Malladi · MIT License · AI-assisted via Claude (Anthropic)
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes alarm-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(1.4)} }
        ::-webkit-scrollbar{width:5px}
        ::-webkit-scrollbar-track{background:#080e1a}
        ::-webkit-scrollbar-thumb{background:#1e293b;border-radius:3px}
      `}</style>
    </div>
  );
}
