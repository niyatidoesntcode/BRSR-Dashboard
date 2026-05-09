import React, { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  PieChart,
  Pie,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const METRICS = [
  { key: "TOS_P3", label: "Principle 3 - Employee Wellbeing", color: "#2563eb" },
  { key: "TOS_P5", label: "Principle 5 - Human Rights", color: "#10b981" },
  { key: "TOS_P8", label: "Principle 8 - Inclusive Growth", color: "#f59e0b" },
  { key: "TOS_P9", label: "Principle 9 - Consumer Value", color: "#ef4444" },
];

const CHART_SERIES = [
  { key: "TOS_P3", short: "P3", label: "Principle 3" },
  { key: "TOS_P5", short: "P5", label: "Principle 5" },
  { key: "TOS_P8", short: "P8", label: "Principle 8" },
  { key: "TOS_P9", short: "P9", label: "Principle 9" },
];

function parseNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function normalizeCompany(name) {
  return String(name || "").trim().toLowerCase();
}

function shortLabel(value) {
  return String(value || "Unknown").replace(/_/g, " ");
}

function formatCompanyName(companyStr) {
  if (!companyStr) return "—";
  const cleaned = String(companyStr).replace(/_2024$|_2023_2024$|_2022_2023$|_2021_2022$/i, "");
  return cleaned
    .replace(/_/g, " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function loadRows(csvText) {
  return Papa.parse(csvText, { header: true, skipEmptyLines: true }).data || [];
}

function average(values) {
  const clean = values.filter((value) => Number.isFinite(value));
  if (!clean.length) return null;
  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}

function median(values) {
  const clean = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!clean.length) return null;
  const middle = Math.floor(clean.length / 2);
  if (clean.length % 2 === 0) {
    return (clean[middle - 1] + clean[middle]) / 2;
  }
  return clean[middle];
}

function round(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return Number(value).toFixed(digits);
}

function KpiCard({ label, value, sublabel, color }) {
  return (
    <div className="bg-white border rounded-lg" style={{ borderColor: "#e2e8f0", padding: "18px 22px" }}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.07em]" style={{ color: "#94a3b8" }}>
        {label}
      </div>
      <div className="mt-1 text-[26px] font-bold leading-tight" style={{ color: color || "#176fb3" }}>
        {value}
      </div>
      {sublabel ? (
        <div className="mt-1 text-xs" style={{ color: "#94a3b8" }}>
          {sublabel}
        </div>
      ) : null}
    </div>
  );
}

function Panel({ title, subtitle, children, minHeight = 0, headerRight = null }) {
  return (
    <div className="bg-white border rounded-lg overflow-hidden" style={{ borderColor: "#e2e8f0", minHeight }}>
      <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: "#e2e8f0" }}>
        <div>
          <div className="text-[13px] font-semibold" style={{ color: "#1a2333" }}>
            {title}
          </div>
          {subtitle ? (
            <div className="text-[11px] mt-0.5" style={{ color: "#94a3b8" }}>
              {subtitle}
            </div>
          ) : null}
        </div>
        {headerRight}
      </div>
      <div className="p-4" style={{ minHeight: minHeight ? Math.max(0, minHeight - 56) : undefined }}>
        {children}
      </div>
    </div>
  );
}

function EmptyState({ label = "No data available" }) {
  return <div className="flex items-center justify-center h-full text-sm text-slate-400">{label}</div>;
}

function OverallTOSBreakdownChart({ rows }) {
  if (!rows.length) return <EmptyState />;

  const chartRows = METRICS.map((metric) => ({
    metric: metric.key,
    label: metric.label,
    value: average(rows.map((row) => parseNumber(row[metric.key]))),
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartRows}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="metric" tick={{ fontSize: 11 }} />
        <YAxis domain={[0, 1]} tick={{ fontSize: 11 }} />
        <Tooltip
          formatter={(value) => (Number.isFinite(Number(value)) ? Number(value).toFixed(3) : value)}
          labelFormatter={(label, payload) => payload?.[0]?.payload?.label || label}
        />
        <Legend />
        <Bar dataKey="value" name="Average TOS" radius={[4, 4, 0, 0]}>
          {chartRows.map((row, index) => (
            <Cell key={row.metric} fill={METRICS[index % METRICS.length].color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function OverallSRSBreakdownChart({ rows }) {
  if (!rows.length) return <EmptyState />;

  const chartRows = CHART_SERIES.map((metric) => ({
    metric: metric.short,
    label: metric.label,
    value: average(rows.map((row) => parseNumber(row[metric.key]))),
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartRows}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="metric" tick={{ fontSize: 11 }} />
        <YAxis domain={[0, 1]} tick={{ fontSize: 11 }} />
        <Tooltip
          formatter={(value) => (Number.isFinite(Number(value)) ? Number(value).toFixed(3) : value)}
          labelFormatter={(label, payload) => payload?.[0]?.payload?.label || label}
        />
        <Legend />
        <Bar dataKey="value" name="Average TOS" radius={[4, 4, 0, 0]}>
          {chartRows.map((row, index) => (
            <Cell key={row.metric} fill={METRICS[index % METRICS.length].color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function SectorTOSChart({ rows }) {
  if (!rows.length) return <EmptyState />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" domain={[0, 1]} tick={{ fontSize: 11 }} />
        <YAxis type="category" dataKey="sector" width={170} tick={{ fontSize: 10 }} />
        <Tooltip formatter={(value) => round(value, 3)} />
        <Bar dataKey="avgTOS" name="Avg TOS" fill="#176fb3" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function OverallSRSRadarChart({ company, sectorRows }) {
  if (!company) return <EmptyState label="Select a company to view the radar chart" />;

  const width = 360;
  const height = 320;
  const cx = 140;
  const cy = 130;
  const maxRadius = 92;
  const count = 4;
  const angle = (index) => (index / count) * 2 * Math.PI - Math.PI / 2;

  const pointFor = (score, index) => {
    const radius = ((score ?? 0) / 1) * maxRadius;
    return [cx + radius * Math.cos(angle(index)), cy + radius * Math.sin(angle(index))];
  };

  const sectorPoints = CHART_SERIES.map((metric, index) => {
    const values = sectorRows.map((row) => row[metric.key]).filter((value) => value !== null);
    const mean = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
    return pointFor(mean, index);
  });

  const companyPoints = CHART_SERIES.map((metric, index) => pointFor(company[metric.key] ?? 0, index));

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="320" style={{ display: "block" }}>
        {[25, 50, 75, 100].map((radiusValue) => {
          const ringPoints = CHART_SERIES.map((_, index) => {
            const r = (radiusValue / 100) * maxRadius;
            return [cx + r * Math.cos(angle(index)), cy + r * Math.sin(angle(index))];
          });
          return <polygon key={radiusValue} points={ringPoints.map((point) => point.join(",")).join(" ")} fill="none" stroke="#e2e8f0" strokeWidth="0.8" />;
        })}
        {CHART_SERIES.map((metric, index) => {
          const [axisX, axisY] = pointFor(1, index);
          const [labelX, labelY] = [cx + (maxRadius + 16) * Math.cos(angle(index)), cy + (maxRadius + 16) * Math.sin(angle(index))];
          return (
            <g key={metric.key}>
              <line x1={cx} y1={cy} x2={axisX} y2={axisY} stroke="#e2e8f0" strokeWidth="0.8" />
              <text x={labelX} y={labelY + 3} textAnchor="middle" fontSize="8.5" fill="#64748b">
                {metric.short}
              </text>
            </g>
          );
        })}
        <polygon points={sectorPoints.map((point) => point.join(",")).join(" ")} fill="none" stroke="#176fb3" strokeWidth="1.5" strokeDasharray="4 3" />
        <polygon points={companyPoints.map((point) => point.join(",")).join(" ")} fill="#ef4444" fillOpacity="0.15" stroke="#ef4444" strokeWidth="2" />
        {companyPoints.map((point, index) => (
          <circle key={index} cx={point[0]} cy={point[1]} r="3" fill="#ef4444" stroke="#fff" strokeWidth="1" />
        ))}
      </svg>
      <div className="px-1 pb-2 text-[11px] text-slate-500 flex flex-wrap gap-4">
        <span><span className="inline-block w-3 h-0.5 align-middle mr-2" style={{ background: "#ef4444" }} />Company</span>
        <span><span className="inline-block w-3 h-0.5 align-middle mr-2" style={{ background: "#176fb3" }} />Sector median</span>
      </div>
    </div>
  );
}

function OverallSRSLineChart({ company, sectorRows }) {
  if (!company) return <EmptyState label="Select a company to view comparison" />;

  const chartRows = CHART_SERIES.map((metric) => {
    const sectorValues = sectorRows.map((row) => row[metric.key]).filter((value) => Number.isFinite(value));
    const sectorMedian = median(sectorValues);
    const companyValue = company[metric.key] ?? null;
    const delta = companyValue !== null && sectorMedian !== null ? companyValue - sectorMedian : null;
    return {
      metric: metric.short,
      label: metric.label,
      companyValue,
      sectorMedian,
      deltaLabel: delta === null ? "" : `${delta > 0 ? "+" : ""}${round(delta, 2)}`,
    };
  });

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartRows} margin={{ top: 20, right: 18, left: 6, bottom: 6 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="metric" tick={{ fontSize: 11 }} />
        <YAxis domain={[0, 1]} tick={{ fontSize: 11 }} />
        <Tooltip
          formatter={(value, name, entry) => {
            if (name === "Sector Median") return [round(value, 3), "Sector median"];
            const deltaText = entry?.payload?.deltaLabel;
            return [round(value, 3), `Company ${deltaText ? `(Δ ${deltaText})` : ""}`];
          }}
        />
        <Legend />
        <Line type="monotone" dataKey="sectorMedian" name="Sector Median" stroke="#176fb3" strokeWidth={2} dot={{ r: 3 }} />
        <Line type="monotone" dataKey="companyValue" name="Company" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 4 }}>
          <LabelList dataKey="deltaLabel" position="top" fill="#334155" fontSize={10} />
        </Line>
      </LineChart>
    </ResponsiveContainer>
  );
}

function SectorComparisonRanking({ sectors, rows, metric }) {
  if (!sectors || !sectors.length) return <EmptyState label="Select sectors to compare" />;

  const comparisonData = sectors
    .map((sectorName) => {
      const sectorRows = rows.filter((row) => row.Sector === sectorName);
      const values = sectorRows.map((row) => row[metric]).filter((v) => v !== null);
      const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
      return { sector: sectorName, value: avg, count: sectorRows.length };
    })
    .sort((a, b) => b.value - a.value);

  return (
    <div>
      <div className="mb-4">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={comparisonData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" domain={[0, 1]} tick={{ fontSize: 10 }} />
            <YAxis type="category" dataKey="sector" width={140} tick={{ fontSize: 10 }} />
            <Tooltip formatter={(value) => round(value, 3)} />
            <Bar dataKey="value" name={metric} fill="#176fb3" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-slate-50">
            <tr className="text-left text-slate-500 uppercase tracking-wide">
              <th className="py-2 pr-2">Rank</th>
              <th className="py-2 pr-2">Sector</th>
              <th className="py-2 pr-2">{metric} Score</th>
              <th className="py-2 pr-2">Companies</th>
            </tr>
          </thead>
          <tbody>
            {comparisonData.map((row, idx) => (
              <tr key={row.sector} className="border-t">
                <td className="py-2 pr-2 font-medium">{idx + 1}</td>
                <td className="py-2 pr-2">{row.sector}</td>
                <td className="py-2 pr-2 font-semibold" style={{ color: "#176fb3" }}>{round(row.value, 3)}</td>
                <td className="py-2 pr-2">{row.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CompanyComparisonRanking({ companies, rows }) {
  if (!companies || !companies.length) return <EmptyState label="Select companies to compare" />;

  const comparisonData = companies
    .map((companyName) => {
      const row = rows.find((r) => r.Company === companyName);
      return row
        ? { company: companyName, overallTOS: row.Overall_TOS, srs: row.SRS, sector: row.Sector, riskLevel: row.Risk_Level }
        : null;
    })
    .filter(Boolean)
    .sort((a, b) => (b?.srs || 0) - (a?.srs || 0));

  if (!comparisonData.length) return <EmptyState label="No data for selected companies" />;

  return (
    <div>
      <div className="mb-4">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={comparisonData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" domain={[0, 1]} tick={{ fontSize: 10 }} />
            <YAxis type="category" dataKey="company" width={170} tick={{ fontSize: 10 }} />
            <Tooltip formatter={(value) => round(value, 3)} />
            <Bar dataKey="srs" name="Overall SRS" fill="#10b981" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-slate-50">
            <tr className="text-left text-slate-500 uppercase tracking-wide">
              <th className="py-2 pr-2">Rank</th>
              <th className="py-2 pr-2">Company</th>
              <th className="py-2 pr-2">Overall SRS</th>
              <th className="py-2 pr-2">Overall TOS</th>
              <th className="py-2 pr-2">Sector</th>
            </tr>
          </thead>
          <tbody>
            {comparisonData.map((row, idx) => (
              <tr key={row.company} className="border-t">
                <td className="py-2 pr-2 font-medium">{idx + 1}</td>
                <td className="py-2 pr-2">{formatCompanyName(row.company)}</td>
                <td className="py-2 pr-2 font-semibold" style={{ color: "#10b981" }}>{round(row.srs, 2)}</td>
                <td className="py-2 pr-2">{round(row.overallTOS, 3)}</td>
                <td className="py-2 pr-2">{row.sector}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RiskLevelDistributionChart({ rows }) {
  if (!rows.length) return <EmptyState />;

  const riskCounts = { Low: 0, Medium: 0, High: 0, Critical: 0 };
  rows.forEach((row) => {
    const risk = row.Risk_Level || "Unknown";
    if (riskCounts.hasOwnProperty(risk)) {
      riskCounts[risk]++;
    }
  });

  const chartData = Object.entries(riskCounts).map(([key, value]) => ({
    name: key,
    value,
    fill: key === "Low" ? "#10b981" : key === "Medium" ? "#f59e0b" : key === "High" ? "#ef4444" : "#8b5cf6",
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.fill} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

export async function loadData({ isOverallSRS = false, globalRankingPath = "/global_ranking_2024.csv", sectorSummaryPath = "/sector_summary_2024.csv" } = {}) {
  if (!isOverallSRS) {
    throw new Error("OverallSRSHandler requires isOverallSRS flag");
  }

  const [globalRes, sectorRes] = await Promise.all([
    fetch(globalRankingPath, { cache: "no-store" }),
    fetch(sectorSummaryPath, { cache: "no-store" }),
  ]);

  const [globalText, sectorText] = await Promise.all([
    globalRes.ok ? globalRes.text() : Promise.resolve(""),
    sectorRes.ok ? sectorRes.text() : Promise.resolve(""),
  ]);

  const globalRows = loadRows(globalText).map((row) => ({
    Rank: parseNumber(row.Global_SRS_Rank),
    Company: row.Company,
    Sector: row.Sector,
    SRS: parseNumber(row.SRS),
    Risk_Level: row.Risk_Level || "Unknown",
    Overall_TOS: parseNumber(row.Overall_TOS),
    TOS_P3: parseNumber(row.TOS_P3),
    TOS_P5: parseNumber(row.TOS_P5),
    TOS_P8: parseNumber(row.TOS_P8),
    TOS_P9: parseNumber(row.TOS_P9),
    Sector_SRS_Rank: parseNumber(row.Sector_SRS_Rank),
  }));

  const sectorRows = loadRows(sectorText);

  return {
    rows: globalRows,
    sectorRows,
    metricDefs: METRICS,
  };
}

export function QuestionPage({ data, filters = {}, setFilters = () => {} }) {
  const [selectedMetric, setSelectedMetric] = useState("TOS_P3");
  const [selectedSector, setSelectedSector] = useState("All");
  const [comparisonMode, setComparisonMode] = useState("companies");
  const [comparisonMetric, setComparisonMetric] = useState("SRS");
  const [selectedCompaniesForComparison, setSelectedCompaniesForComparison] = useState([]);
  const [selectedSectorsForComparison, setSelectedSectorsForComparison] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState("");

  const rows = data?.rows || [];

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (selectedSector && selectedSector !== "All" && row.Sector !== selectedSector) return false;
      return true;
    });
  }, [rows, selectedSector]);

  const sectorSummary = useMemo(() => {
    const map = new Map();
    filteredRows.forEach((row) => {
      const sector = row.Sector || "Unknown";
      if (!map.has(sector)) {
        map.set(sector, {
          sector,
          tosValues: [],
          srsValues: [],
          companies: 0,
        });
      }
      const entry = map.get(sector);
      entry.tosValues.push(row.Overall_TOS);
      entry.srsValues.push(row.SRS);
      entry.companies += 1;
    });

    return [...map.values()]
      .map((entry) => ({
        sector: entry.sector,
        avgTOS: average(entry.tosValues),
        avgSRS: average(entry.srsValues),
        companies: entry.companies,
      }))
      .sort((a, b) => (b.avgTOS || 0) - (a.avgTOS || 0));
  }, [filteredRows]);

  const availableSectors = useMemo(() => {
    return ["All", ...Array.from(new Set(rows.map((row) => row.Sector).filter(Boolean))).sort()];
  }, [rows]);

  const companyOptions = useMemo(() => filteredRows.map((row) => row.Company).filter(Boolean).sort(), [filteredRows]);

  const selectedCompanyRow = useMemo(() => {
    if (!filteredRows.length) return null;
    const match = filteredRows.find((row) => row.Company === selectedCompany);
    return match || filteredRows[0];
  }, [filteredRows, selectedCompany]);

  const companySectorRows = useMemo(() => {
    if (!selectedCompanyRow?.Sector) return filteredRows;
    return filteredRows.filter((row) => row.Sector === selectedCompanyRow.Sector);
  }, [filteredRows, selectedCompanyRow]);

  const overallMetricAverages = useMemo(() => {
    return CHART_SERIES.map((metric) => ({
      metric: metric.short,
      label: metric.label,
      value: average(filteredRows.map((row) => row[metric.key])),
    }));
  }, [filteredRows]);

  const selectedPrincipleMetric = useMemo(() => {
    const row = selectedCompanyRow || filteredRows[0];
    if (!row) return { key: "TOS_P3", label: "Principle 3" };
    return METRICS.find((metric) => metric.key === selectedMetric) || METRICS[0];
  }, [filteredRows, selectedCompanyRow, selectedMetric]);

  const sectorComparisonRows = useMemo(() => {
    return selectedSectorsForComparison.map((sectorName) => {
      const sectorRows = filteredRows.filter((row) => row.Sector === sectorName);
      return {
        sector: sectorName,
        TOS_P3: average(sectorRows.map((row) => row.TOS_P3)),
        TOS_P5: average(sectorRows.map((row) => row.TOS_P5)),
        TOS_P8: average(sectorRows.map((row) => row.TOS_P8)),
        TOS_P9: average(sectorRows.map((row) => row.TOS_P9)),
      };
    });
  }, [filteredRows, selectedSectorsForComparison]);

  useEffect(() => {
    if (!selectedCompanyRow) return;
    if (!selectedCompany || !companyOptions.includes(selectedCompany)) {
      setSelectedCompany(selectedCompanyRow.Company || "");
    }
  }, [companyOptions, selectedCompany, selectedCompanyRow]);

  const avgOverallTOS = average(filteredRows.map((row) => row.Overall_TOS));
  const avgSRS = average(filteredRows.map((row) => row.SRS));
  const avgP3TOS = average(filteredRows.map((row) => row.TOS_P3));

  if (!data) {
    return <div className="p-6 bg-white border rounded text-center text-slate-500">Loading Overall SRS data…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border rounded-lg p-4" style={{ borderColor: "#e2e8f0" }}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: "#176fb3" }}>
              Global Overview
            </div>
            <h2 className="mt-1 text-lg font-bold text-slate-900">Overall Social Risk Scores (Global)</h2>
            <div className="text-sm text-slate-500 mt-1 max-w-3xl">
              Overall SRS combines the four principle TOS scores into a company-level view. Use the controls below to compare companies, sectors, and the sector median against one selected company.
            </div>
          </div>

          <div className="min-w-[260px] flex-1 max-w-md flex flex-col gap-3">
            <div>
              <div className="text-xs font-medium text-slate-600 mb-1">Sector</div>
              <select
                value={selectedSector}
                onChange={(e) => setSelectedSector(e.target.value)}
                className="w-full border border-slate-300 p-2 rounded-lg text-sm bg-white focus:ring-2 focus:ring-sky-500"
              >
                {availableSectors.map((sector) => (
                  <option key={sector} value={sector}>{sector}</option>
                ))}
              </select>
            </div>

            <div>
              <div className="text-xs font-medium text-slate-600 mb-1">Company</div>
              <select
                value={selectedCompanyRow?.Company || ""}
                onChange={(event) => setSelectedCompany(event.target.value)}
                className="w-full border border-slate-300 p-2 rounded-lg text-sm bg-white focus:ring-2 focus:ring-sky-500"
              >
                {companyOptions.length ? null : <option value="">No companies available</option>}
                {companyOptions.map((companyName) => (
                  <option key={companyName} value={companyName}>
                    {formatCompanyName(companyName)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {METRICS.map((metric) => {
            const active = selectedMetric === metric.key;
            return (
              <button
                key={metric.key}
                onClick={() => setSelectedMetric(metric.key)}
                className="px-3 py-1 text-xs rounded-full border transition-all"
                style={{
                  background: active ? metric.color : "#ffffff",
                  color: active ? "#ffffff" : "#475569",
                  borderColor: active ? metric.color : "#cbd5e1",
                  fontWeight: active ? 600 : 400,
                }}
              >
                {metric.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Companies" value={filteredRows.length} sublabel="filtered in current view" color="#1a2333" />
        <KpiCard label="Avg Overall TOS" value={round(avgOverallTOS, 3)} sublabel="text outcome score" color="#176fb3" />
        <KpiCard label="Avg SRS" value={round(avgSRS, 2)} sublabel="social risk score" color="#10b981" />
        <KpiCard label="Avg P3 TOS" value={round(avgP3TOS, 3)} sublabel="employee wellbeing" color="#dc2626" />
      </div>

      <Panel title="Overall Breakdown" subtitle="Average Text Outcome Score by principle across the current view" minHeight={320}>
        <div style={{ height: 280 }}>
          <OverallSRSBreakdownChart rows={filteredRows} />
        </div>
      </Panel>

      <Panel title="Comparison Analysis" subtitle="Compare companies or sectors on overall social risk metrics" minHeight={480}>
        <div className="space-y-4">
          <div className="flex items-end gap-3 flex-wrap">
            <div>
              <div className="text-xs font-medium text-slate-600 mb-1">Compare</div>
              <div className="flex rounded-md border overflow-hidden" style={{ borderColor: "#e2e8f0" }}>
                {[
                  ["companies", "Companies"],
                  ["sectors", "Sectors"],
                ].map(([mode, label]) => (
                  <button
                    key={mode}
                    onClick={() => {
                      setComparisonMode(mode);
                      if (mode === "companies") {
                        setSelectedSectorsForComparison([]);
                      } else {
                        setSelectedCompaniesForComparison([]);
                      }
                    }}
                    className="px-3 py-2 text-sm"
                    style={{
                      fontWeight: comparisonMode === mode ? 600 : 400,
                      background: comparisonMode === mode ? "#176fb3" : "#ffffff",
                      color: comparisonMode === mode ? "#ffffff" : "#1a2333",
                      borderRight: mode === "companies" ? "1px solid #e2e8f0" : "none",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 min-w-[250px]">
              <div className="text-xs font-medium text-slate-600 mb-1">
                {comparisonMode === "companies" ? "Select upto 5 Companies from the Table Below" : "Select upto 5 Sectors from the Table Below"}
              </div>
              {comparisonMode === "companies" ? (
                <div className="border rounded-md bg-white overflow-hidden" style={{ borderColor: "#e2e8f0" }}>
                  <div className="max-h-[220px] overflow-auto">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-slate-50 z-10">
                        <tr className="text-left text-slate-500 uppercase tracking-wide">
                          <th className="py-2 pl-3 pr-2 w-10">Pick</th>
                          <th className="py-2 pr-2">Rank</th>
                          <th className="py-2 pr-2">Company</th>
                          <th className="py-2 pr-2">Sector</th>
                          <th className="py-2 pr-3 text-right">SRS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRows.map((row) => {
                          const selected = selectedCompaniesForComparison.includes(row.Company);
                          const disabled = !selected && selectedCompaniesForComparison.length >= 5;
                          return (
                            <tr
                              key={row.Company}
                              onClick={() => {
                                setSelectedCompaniesForComparison((prev) => {
                                  if (prev.includes(row.Company)) return prev.filter((item) => item !== row.Company);
                                  if (prev.length < 5) return [...prev, row.Company];
                                  return prev;
                                });
                              }}
                              className="border-t cursor-pointer hover:bg-blue-50 transition-colors"
                              style={{
                                background: selected ? "#eff6ff" : "transparent",
                                borderColor: "#e2e8f0",
                                opacity: disabled ? 0.55 : 1,
                              }}
                            >
                              <td className="py-2 pl-3 pr-2">
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  onChange={() => {}}
                                  disabled={disabled}
                                  className="h-3.5 w-3.5"
                                  style={{ accentColor: "#176fb3" }}
                                />
                              </td>
                              <td className="py-2 pr-2">{row.Rank ?? "—"}</td>
                              <td className="py-2 pr-2 font-medium" style={{ color: selected ? "#176fb3" : "#1a2333" }}>
                                {formatCompanyName(row.Company)}
                              </td>
                              <td className="py-2 pr-2">{row.Sector}</td>
                              <td className="py-2 pr-3 text-right font-medium">{round(row.SRS, 2)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="px-3 py-2 text-[11px] text-slate-500 border-t bg-slate-50" style={{ borderColor: "#e2e8f0" }}>
                    {selectedCompaniesForComparison.length}/5 selected
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-1 border rounded-md p-2 bg-white min-h-[36px]" style={{ borderColor: "#e2e8f0" }}>
                  {availableSectors.filter((s) => s !== "All").map((sector) => (
                    <button
                      key={sector}
                      onClick={() => {
                        setSelectedSectorsForComparison((prev) => {
                          if (prev.includes(sector)) return prev.filter((item) => item !== sector);
                          if (prev.length < 5) return [...prev, sector];
                          return prev;
                        });
                      }}
                      className="px-2 py-1 text-xs rounded-full border transition-all"
                      style={{
                        background: selectedSectorsForComparison.includes(sector) ? "#176fb3" : "#ffffff",
                        color: selectedSectorsForComparison.includes(sector) ? "#ffffff" : "#1a2333",
                        borderColor: selectedSectorsForComparison.includes(sector) ? "#176fb3" : "#cbd5e1",
                        fontWeight: selectedSectorsForComparison.includes(sector) ? 600 : 400,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {sector}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="text-xs font-medium text-slate-600 mb-1">Metric</div>
              <select
                value={comparisonMetric}
                onChange={(e) => setComparisonMetric(e.target.value)}
                className="px-2 py-1 rounded-md border bg-white text-xs"
                style={{ borderColor: "#e2e8f0", color: "#1a2333" }}
              >
                {METRICS.map((metric) => (
                  <option key={metric.key} value={metric.key}>
                    {metric.key}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {comparisonMode === "companies" ? (
            <CompanyComparisonRanking companies={selectedCompaniesForComparison} rows={filteredRows} metric={comparisonMetric} />
          ) : (
            <SectorComparisonRanking sectors={selectedSectorsForComparison} rows={filteredRows} metric={comparisonMetric} />
          )}
        </div>
      </Panel>

      <Panel title="Company Performance Analysis" subtitle="Compare the selected company against its sector median" minHeight={520}>
        <div>
          <div className="mb-4 pb-4 border-b" style={{ borderColor: "#e2e8f0" }}>
            <div className="text-sm font-semibold" style={{ color: "#1a2333" }}>
              {formatCompanyName(selectedCompanyRow?.Company) || "Select a Company"}
            </div>
            <div className="text-xs mt-1" style={{ color: "#94a3b8" }}>
              {selectedCompanyRow?.Sector || "—"} • Overall SRS: {round(selectedCompanyRow?.SRS, 2) || "—"}
            </div>
          </div>

          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-12 lg:col-span-6">
              <Panel title="Radar View" subtitle="Company vs sector median across the 4 principle TOS scores" minHeight={420}>
                <OverallSRSRadarChart company={selectedCompanyRow} sectorRows={companySectorRows} />
              </Panel>
            </div>
            <div className="col-span-12 lg:col-span-6">
              <Panel title="Score Comparison vs Sector Median" subtitle="Line comparison across principle-level scores" minHeight={420}>
                <div style={{ height: 360 }}>
                  <OverallSRSLineChart company={selectedCompanyRow} sectorRows={companySectorRows} />
                </div>
              </Panel>
            </div>
          </div>
        </div>
      </Panel>

      <Panel title="Filtered Company Table" subtitle="Raw rows from the overall ranking file" minHeight={300}>
        <div className="overflow-auto h-full max-h-[320px]">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-50">
              <tr className="text-left text-slate-500 uppercase tracking-wide">
                <th className="py-2 pr-2">Rank</th>
                <th className="py-2 pr-2">Company</th>
                <th className="py-2 pr-2">Sector</th>
                <th className="py-2 pr-2">Overall TOS</th>
                <th className="py-2 pr-2">SRS</th>
                <th className="py-2 pr-2">Risk Level</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, idx) => (
                <tr
                  key={row.Company}
                  onClick={() => setSelectedCompany(row.Company)}
                  className="border-t cursor-pointer hover:bg-blue-50 transition-colors"
                  style={{
                    background: selectedCompanyRow?.Company === row.Company ? "#eff6ff" : "transparent",
                    borderColor: "#e2e8f0",
                  }}
                >
                  <td className="py-2 pr-2">{idx + 1}</td>
                  <td className="py-2 pr-2 font-medium" style={{ color: selectedCompanyRow?.Company === row.Company ? "#176fb3" : "#1a2333" }}>
                    {formatCompanyName(row.Company)}
                  </td>
                  <td className="py-2 pr-2">{row.Sector}</td>
                  <td className="py-2 pr-2">{round(row.Overall_TOS, 3)}</td>
                  <td className="py-2 pr-2">{round(row.SRS, 2)}</td>
                  <td className="py-2 pr-2">{row.Risk_Level}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
