// questionHandlers/P5SRSHandler.js
// Social Risk Scoring view for Principle 5 (Human Rights)
// Extracted from P5Q5Handler — loads SRS_P5_Q5.csv and renders the full scoring dashboard

import React, { useMemo, useState } from "react";
import Papa from "papaparse";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from "recharts";

/* ─────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────── */

const SECTOR_SHORT_NAMES = {
  Construction: "Construction",
  Education: "Education",
  "Electricity, Gas, Steam and Air Conditioning Supply": "Electricity & Gas",
  "Financial and Insurance Activities": "Finance",
  "Human Health and Social Work Activities": "Health & Social",
  "Information and Communication": "Information & Comm",
  Manufacturing: "Manufacturing",
  "Professional, Scientific and Technical Activities": "Professional Services",
  "Transportation and Storage": "Transportation",
  "Water Supply; Sewerage, Waste Management and Remediation Activities": "Utilities & Waste",
  "Wholesale and Retail Trade; Repair of Motor Vehicles and Motorcycles": "Wholesale & Retail",
};

function shortSectorName(name) {
  return SECTOR_SHORT_NAMES[name] || name || "Unknown";
}

const RISK_COLORS = {
  "Very Low Risk": "#10b981",
  "Low Risk":      "#34d399",
  "Medium Risk":   "#fbbf24",
  "High Risk":     "#f59e0b",
  "Very High Risk":"#dc2626",
};

const DIM_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

const ALL_RISKS = ["Very Low Risk", "Low Risk", "Medium Risk", "High Risk", "Very High Risk"];

const DIMENSIONS = [
  "specificity",
  "actionability",
  "compliance",
  "outcome_evidence",
  "risk_tone",
  "transparency",
];

/* ─────────────────────────────────────────────
   DATA LOADING
───────────────────────────────────────────── */

function bucketize(nw) {
  if (!nw && nw !== 0) return "Unknown";
  const v = parseFloat(nw);
  if (isNaN(v)) return "Unknown";
  if (v < 5000)  return "Small Cap";
  if (v < 20000) return "Mid Cap";
  return "Large Cap";
}

export async function loadData({
  generalCsvPath = "/GeneralDisclosures_df.csv",
  tosCsvPath     = "/SRS_P5_Q5.csv",
} = {}) {
  const [gRes, tosRes] = await Promise.all([
    fetch(generalCsvPath),
    fetch(tosCsvPath),
  ]);

  if (!gRes.ok)   throw new Error("Failed to load GeneralDisclosures_df.csv");
  if (!tosRes.ok) throw new Error("Failed to load SRS_P5_Q5.csv");

  const [gText, tosText] = await Promise.all([gRes.text(), tosRes.text()]);

  const generalDf = Papa.parse(gText,   { header: true, skipEmptyLines: true }).data.filter(r => r.NameOfTheCompany);
  const tosCsv    = Papa.parse(tosText, { header: true, skipEmptyLines: true, dynamicTyping: true });

  const tosData = tosCsv.data.filter(r => {
    const hasIndex = r[""] !== undefined || r["TOS_finaldoc_index"] !== undefined;
    return hasIndex && r.NameOfTheCompany;
  });

  const parseNum = v => (typeof v === "number" ? v : isNaN(parseFloat(v)) ? 0 : parseFloat(v));

  const enrichedTOS = tosData.map(row => {
    const idx   = parseInt(row[""] ?? row["TOS_finaldoc_index"], 10);
    const match = !isNaN(idx) && idx >= 0 && idx < generalDf.length ? generalDf[idx] : null;

    return {
      ...row,
      Company:          row.NameOfTheCompany || match?.NameOfTheCompany || "Unknown",
      Sector:           row.Sector           || match?.Sector           || "Unknown",
      NetWorth:         match?.NetWorth_DCYMain || null,
      CapBucket:        bucketize(match?.NetWorth_DCYMain),
      specificity:      parseNum(row.specificity),
      actionability:    parseNum(row.actionability),
      compliance:       parseNum(row.compliance),
      outcome_evidence: parseNum(row.outcome_evidence),
      risk_tone:        parseNum(row.risk_tone),
      transparency:     parseNum(row.transparency),
      SRS:              parseNum(row.SRS),
      Risk_Category:    row.Risk_Category || "Unknown",
    };
  });

  const sectorSet = new Set(enrichedTOS.map(r => r.Sector).filter(Boolean));
  const sectors   = ["All", ...Array.from(sectorSet).sort()];
  const capBuckets = ["All", "Large Cap", "Mid Cap", "Small Cap", "Unknown"];

  return { enrichedTOS, sectors, capBuckets, generalDf };
}

/* ─────────────────────────────────────────────
   COMPUTE HELPERS
───────────────────────────────────────────── */

function computeSectorSRSDistribution(rows) {
  const map = {};
  rows.forEach(r => {
    const s = shortSectorName(r.Sector || "Unknown");
    if (!map[s]) map[s] = [];
    map[s].push(r.SRS);
  });

  return Object.entries(map)
    .map(([sector, scores]) => {
      const sorted = [...scores].sort((a, b) => a - b);
      const q = p => {
        const pos   = (sorted.length - 1) * p;
        const lo    = Math.floor(pos);
        const hi    = Math.ceil(pos);
        return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
      };
      return {
        sector,
        count:  scores.length,
        mean:   scores.reduce((a, b) => a + b, 0) / scores.length,
        median: q(0.5),
        q1:     q(0.25),
        q3:     q(0.75),
        min:    sorted[0],
        max:    sorted[sorted.length - 1],
      };
    })
    .sort((a, b) => b.count - a.count);
}

function computeRiskCategoryBySector(rows) {
  const matrix = {};
  rows.forEach(r => {
    const s = shortSectorName(r.Sector || "Unknown");
    if (!matrix[s]) matrix[s] = {};
    matrix[s][r.Risk_Category] = (matrix[s][r.Risk_Category] || 0) + 1;
  });

  const chartData = Object.entries(matrix)
    .map(([sector, risks]) => {
      const row = { sector, total: 0 };
      ALL_RISKS.forEach(risk => {
        row[risk]  = risks[risk] || 0;
        row.total += row[risk];
      });
      return row;
    })
    .sort((a, b) => b.total - a.total);

  return { data: chartData, risks: ALL_RISKS };
}

function computeTopBottom(rows, top = true, limit = 10) {
  return [...rows]
    .sort((a, b) => top ? b.SRS - a.SRS : a.SRS - b.SRS)
    .slice(0, limit)
    .map(r => ({
      company: r.Company,
      srs:     r.SRS,
      risk:    r.Risk_Category,
      sector:  shortSectorName(r.Sector),
    }));
}

function computeSectorDimensions(rows, selectedSectors) {
  const map = {};
  rows.forEach(r => {
    const s = shortSectorName(r.Sector || "Unknown");
    if (selectedSectors.length > 0 && !selectedSectors.includes(s)) return;
    if (!map[s]) map[s] = Object.fromEntries(DIMENSIONS.map(d => [d, []]));
    DIMENSIONS.forEach(d => map[s][d].push(r[d]));
  });

  const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  return Object.entries(map).map(([sector, dims]) => {
    const row = { sector };
    DIMENSIONS.forEach(d => { row[d] = +(avg(dims[d]) * 100).toFixed(1); });
    return row;
  });
}

/* ─────────────────────────────────────────────
   SUB-COMPONENTS
───────────────────────────────────────────── */

function SectorSRSChart({ data }) {
  if (!data.length) return <Empty />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="sector"
          angle={-40}
          textAnchor="end"
          height={100}
          interval={0}
          tick={{ fontSize: 10 }}
        />
        <YAxis domain={[0, 100]} label={{ value: "Avg SRS", angle: -90, position: "insideLeft", fontSize: 11 }} />
        <Tooltip
          content={({ payload }) => {
            if (!payload?.length) return null;
            const d = payload[0].payload;
            return (
              <div className="bg-white border rounded shadow-sm p-2 text-xs">
                <div className="font-semibold mb-1">{d.sector}</div>
                <div>Mean: <b>{d.mean.toFixed(1)}</b></div>
                <div>Median: {d.median.toFixed(1)}</div>
                <div>Q1 – Q3: {d.q1.toFixed(1)} – {d.q3.toFixed(1)}</div>
                <div>Range: {d.min.toFixed(1)} – {d.max.toFixed(1)}</div>
                <div>n = {d.count}</div>
              </div>
            );
          }}
        />
        <Bar dataKey="mean" radius={[3, 3, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={DIM_COLORS[i % DIM_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function RiskBySectorChart({ data, risks }) {
  if (!data.length) return <Empty />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="sector"
          angle={-40}
          textAnchor="end"
          height={100}
          interval={0}
          tick={{ fontSize: 10 }}
        />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {risks.map(risk => (
          <Bar key={risk} dataKey={risk} stackId="a" fill={RISK_COLORS[risk] || "#94a3b8"} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

function HorizontalRankChart({ companies, label }) {
  if (!companies.length) return <Empty />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={companies} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
        <YAxis type="category" dataKey="company" width={160} tick={{ fontSize: 10 }} />
        <Tooltip
          content={({ payload }) => {
            if (!payload?.length) return null;
            const d = payload[0].payload;
            return (
              <div className="bg-white border rounded shadow-sm p-2 text-xs">
                <div className="font-semibold">{d.company}</div>
                <div>SRS: <b>{d.srs.toFixed(1)}</b></div>
                <div>Risk: {d.risk}</div>
                <div>Sector: {d.sector}</div>
              </div>
            );
          }}
        />
        <Bar dataKey="srs" radius={[0, 3, 3, 0]}>
          {companies.map((entry, i) => (
            <Cell key={i} fill={RISK_COLORS[entry.risk] || "#3b82f6"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function DimensionComparisonChart({ data }) {
  if (!data.length) return (
    <div className="flex items-center justify-center h-full text-sm text-slate-400 italic">
      Select sectors above to compare dimensions
    </div>
  );
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={DIMENSIONS.map(dim => {
        const point = { dimension: dim.replace("_", " ") };
        data.forEach((s, i) => { point[s.sector] = s[dim]; });
        return point;
      })}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="dimension" angle={-20} textAnchor="end" height={70} tick={{ fontSize: 11 }} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {data.map((s, i) => (
          <Bar key={s.sector} dataKey={s.sector} fill={DIM_COLORS[i % DIM_COLORS.length]} radius={[3, 3, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

function Empty() {
  return (
    <div className="flex items-center justify-center h-full text-sm text-slate-400">
      No data available
    </div>
  );
}

function KpiCard({ label, value, color }) {
  return (
    <div className="p-4 bg-white border rounded-lg shadow-sm text-center" style={{ borderColor: "#e2e8f0" }}>
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className="text-2xl font-semibold" style={{ color: color || "#1a2333" }}>{value}</div>
    </div>
  );
}

function ChartCard({ title, height = 350, children }) {
  return (
    <div className="bg-white border rounded-lg shadow-sm p-4" style={{ borderColor: "#e2e8f0" }}>
      <h3 className="text-sm font-semibold text-slate-700 mb-3">{title}</h3>
      <div style={{ height }}>{children}</div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   MAIN PAGE COMPONENT
───────────────────────────────────────────── */

export function QuestionPage({ data, filters = {}, setFilters = () => {} }) {
  const [selectedSectors, setSelectedSectors] = useState([]);

  const tosRows = data?.enrichedTOS ?? [];

  // ── filtered rows ──
  const filtered = useMemo(() => {
    return tosRows.filter(r => {
      if (!r) return false;
      if (filters.sector    && filters.sector    !== "All" && r.Sector    !== filters.sector)    return false;
      if (filters.capBucket && filters.capBucket !== "All" && r.CapBucket !== filters.capBucket) return false;
      return true;
    });
  }, [tosRows, filters]);

  // ── computed data ──
  const srsDist    = useMemo(() => computeSectorSRSDistribution(filtered), [filtered]);
  const riskBySec  = useMemo(() => computeRiskCategoryBySector(filtered),  [filtered]);
  const topCos     = useMemo(() => computeTopBottom(filtered, true,  10),   [filtered]);
  const bottomCos  = useMemo(() => computeTopBottom(filtered, false, 10),   [filtered]);
  const dimData    = useMemo(() => computeSectorDimensions(filtered, selectedSectors), [filtered, selectedSectors]);

  // ── KPIs ──
  const avgSRS = filtered.length
    ? (filtered.reduce((s, r) => s + r.SRS, 0) / filtered.length).toFixed(1)
    : "—";

  const riskCounts = filtered.reduce((acc, r) => {
    acc[r.Risk_Category] = (acc[r.Risk_Category] || 0) + 1;
    return acc;
  }, {});

  const lowCount  = (riskCounts["Low Risk"]  || 0) + (riskCounts["Very Low Risk"]  || 0);
  const highCount = (riskCounts["High Risk"] || 0) + (riskCounts["Very High Risk"] || 0);

  // sector selector for dimension chart
  const availableSectors = useMemo(() => {
    return Array.from(new Set(filtered.map(r => shortSectorName(r.Sector)))).sort();
  }, [filtered]);

  function toggleSector(s) {
    setSelectedSectors(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : prev.length < 4 ? [...prev, s] : prev
    );
  }

  if (!data) {
    return (
      <div className="p-6 bg-white border rounded text-center text-slate-500">
        Loading SRS data…
      </div>
    );
  }

  return (
    <div className="space-y-8">

      {/* ── Filters ── */}
      <div className="p-4 bg-white border rounded-lg shadow-sm" style={{ borderColor: "#e2e8f0" }}>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs font-medium text-slate-600 mb-1">Sector</div>
            <select
              value={filters.sector || "All"}
              onChange={e => setFilters(p => ({ ...p, sector: e.target.value }))}
              className="w-full border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-sky-500"
            >
              {(data.sectors || ["All"]).map(s => (
                <option key={s} value={s}>
                  {s === "All" ? "All Sectors" : shortSectorName(s)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="text-xs font-medium text-slate-600 mb-1">Market Cap</div>
            <select
              value={filters.capBucket || "All"}
              onChange={e => setFilters(p => ({ ...p, capBucket: e.target.value }))}
              className="w-full border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-sky-500"
            >
              {(data.capBuckets || ["All"]).map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Average SRS"     value={avgSRS}                    color="#2563eb" />
        <KpiCard label="Total Companies" value={filtered.length}            color="#1a2333" />
        <KpiCard label="Low / Very Low Risk"  value={lowCount}             color="#10b981" />
        <KpiCard label="High / Very High Risk" value={highCount}           color="#dc2626" />
      </div>

      {/* ── Row 1: Sector SRS Distribution + Risk by Sector ── */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-7">
          <ChartCard title="Sector-wise Average SRS Score" height={360}>
            <SectorSRSChart data={srsDist} />
          </ChartCard>
        </div>
        <div className="col-span-12 lg:col-span-5">
          <ChartCard title="Risk Category by Sector" height={360}>
            <RiskBySectorChart data={riskBySec.data} risks={riskBySec.risks} />
          </ChartCard>
        </div>
      </div>

      {/* ── Row 2: Top 10 + Bottom 10 ── */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-6">
          <ChartCard title="Top 10 Companies — Highest SRS" height={360}>
            <HorizontalRankChart companies={topCos} label="top" />
          </ChartCard>
        </div>
        <div className="col-span-12 lg:col-span-6">
          <ChartCard title="Bottom 10 Companies — Lowest SRS" height={360}>
            <HorizontalRankChart companies={bottomCos} label="bottom" />
          </ChartCard>
        </div>
      </div>

      {/* ── Row 3: 6-Dimension Sector Comparison ── */}
      <div className="bg-white border rounded-lg shadow-sm p-4" style={{ borderColor: "#e2e8f0" }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-700">6-Dimension Sector Comparison</h3>
          <span className="text-xs text-slate-400 italic">Select up to 4 sectors</span>
        </div>

        {/* Sector toggle pills */}
        <div className="flex flex-wrap gap-2 mb-4 p-3 bg-slate-50 border rounded-lg" style={{ borderColor: "#e2e8f0" }}>
          {availableSectors.map(s => {
            const on = selectedSectors.includes(s);
            return (
              <button
                key={s}
                onClick={() => toggleSector(s)}
                className="px-3 py-1 text-xs rounded-full border transition-all"
                style={{
                  background:   on ? "#2563eb" : "#ffffff",
                  color:        on ? "#ffffff" : "#475569",
                  borderColor:  on ? "#2563eb" : "#cbd5e1",
                  fontWeight:   on ? 600 : 400,
                  cursor:       !on && selectedSectors.length >= 4 ? "not-allowed" : "pointer",
                  opacity:      !on && selectedSectors.length >= 4 ? 0.45 : 1,
                }}
              >
                {s}
              </button>
            );
          })}
          {availableSectors.length === 0 && (
            <span className="text-xs text-slate-400">No sectors in current filter</span>
          )}
        </div>

        <div style={{ height: 400 }}>
          <DimensionComparisonChart data={dimData} />
        </div>
      </div>

      {/* ── Row 4: Company-level table ── */}
      <div className="bg-white border rounded-lg shadow-sm p-4" style={{ borderColor: "#e2e8f0" }}>
        <h3 className="text-sm font-semibold text-slate-700 mb-3">
          All Companies — SRS Detail ({filtered.length})
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 text-left">
                {["Company", "Sector", "Cap", "SRS", "Risk Category", "Spec.", "Action.", "Comply", "Outcome", "Tone", "Transp."].map(h => (
                  <th key={h} className="px-3 py-2 text-xs font-semibold text-slate-500 whitespace-nowrap border-b" style={{ borderColor: "#e2e8f0" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered
                .slice()
                .sort((a, b) => b.SRS - a.SRS)
                .map((r, i) => (
                  <tr key={i} className="hover:bg-slate-50 border-b" style={{ borderColor: "#f1f5f9" }}>
                    <td className="px-3 py-2 text-slate-800 font-medium max-w-[180px] truncate">{r.Company}</td>
                    <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{shortSectorName(r.Sector)}</td>
                    <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{r.CapBucket}</td>
                    <td className="px-3 py-2 font-semibold" style={{ color: "#2563eb" }}>{r.SRS.toFixed(1)}</td>
                    <td className="px-3 py-2">
                      <span
                        className="px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
                        style={{
                          background: (RISK_COLORS[r.Risk_Category] || "#94a3b8") + "22",
                          color:       RISK_COLORS[r.Risk_Category] || "#64748b",
                        }}
                      >
                        {r.Risk_Category}
                      </span>
                    </td>
                    {[r.specificity, r.actionability, r.compliance, r.outcome_evidence, r.risk_tone, r.transparency].map((v, j) => (
                      <td key={j} className="px-3 py-2 text-slate-600 text-center">{(v * 100).toFixed(0)}</td>
                    ))}
                  </tr>
                ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-3 py-6 text-center text-slate-400">
                    No companies match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}