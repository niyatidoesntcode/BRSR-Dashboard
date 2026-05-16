import React, { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const PRINCIPLE_META = {
  P3: { title: "P3 - Employee Well-being", csv: "/scores_p3_2024.csv" },
  P5: { title: "P5 - Human Rights", csv: "/scores_p5_2024.csv" },
  P8: { title: "P8 - Inclusive Growth", csv: "/scores_p8_2024.csv" },
  P9: { title: "P9 - Customer Value", csv: "/scores_p9_2024.csv" },
};

const YEAR_PATHS = {
  "FY2021-22": "2022",
  "FY2022-23": "2023",
  "FY2023-24": "2024",
};

const METRICS = [
  { key: "SS", label: "Specificity Score", color: "#2563eb" },
  { key: "AS", label: "Actionability Score", color: "#10b981" },
  { key: "CCS", label: "Compliance Coverage Score", color: "#f59e0b" },
  { key: "OES", label: "Outcome Evidence Score", color: "#ef4444" },
  { key: "RTS", label: "Risk Tone Score", color: "#8b5cf6" },
  { key: "TOS", label: "Text Outcome Score", color: "#14b8a6" },
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
  // Remove year suffix like "2023_2024"
  let cleaned = companyStr.replace(/_2023_2024$|_2022_2023$|_2021_2022$/i, "");
  // Replace underscores with spaces and title case
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

function makeSectorRows(rows, selectedMetric) {
  const map = new Map();

  rows.forEach((row) => {
    const sector = row.Sector || "Unknown";
    if (!map.has(sector)) {
      map.set(sector, { sector, count: 0, _metrics: {}, _overall: [] });
      METRICS.forEach((metric) => {
        map.get(sector)._metrics[metric.key] = [];
      });
    }

    const entry = map.get(sector);
    entry.count += 1;
    METRICS.forEach((metric) => {
      entry._metrics[metric.key].push(row[metric.key]);
    });
    entry._overall.push(row.GlobalSRS);
  });

  return [...map.values()]
    .map((entry) => {
      const out = { sector: entry.sector, count: entry.count, overallSRS: average(entry._overall) };
      METRICS.forEach((metric) => {
        out[metric.key] = average(entry._metrics[metric.key]);
      });
      out.selected = out[selectedMetric];
      return out;
    })
    .sort((a, b) => (b.selected || 0) - (a.selected || 0) || b.count - a.count);
}

function makeCompanyRows(rows, selectedMetric, descending = true) {
  return [...rows]
    .sort((a, b) => {
      const diff = (a[selectedMetric] || 0) - (b[selectedMetric] || 0);
      return descending ? -diff : diff;
    })
    .slice(0, 10)
    .map((row) => ({
      company: row.Company,
      sector: shortLabel(row.Sector),
      selected: row[selectedMetric],
      overallSRS: row.GlobalSRS,
      rank: row.Rank,
      riskLevel: row.RiskLevel,
    }));
}

function resolveYearPath(basePath, reportYear) {
  const yearSuffix = YEAR_PATHS[reportYear] || "2024";
  const yearPattern = /_(2022|2023|2024)(?=\.csv$)/i;
  const yearPath = yearPattern.test(basePath)
    ? basePath.replace(yearPattern, `_${yearSuffix}`)
    : basePath.replace(/\.csv$/i, `_${yearSuffix}.csv`);
  return yearPath === basePath ? [basePath] : [yearPath, basePath];
}

async function fetchCsvText(paths) {
  for (const path of paths) {
    const response = await fetch(path, { cache: "no-store" });
    if (response.ok) {
      return response.text();
    }
  }
  throw new Error(`Failed to load CSV from: ${paths.join(", ")}`);
}

function chartMetricRows(rows) {
  return METRICS.map((metric) => ({
    metric: metric.key,
    label: metric.label,
    value: average(rows.map((row) => row[metric.key])),
  }));
}

function KpiCard({ label, value, sublabel, color }) {
  return (
    <div className="bg-white border rounded-lg overflow-hidden" style={{ borderColor: "#e2e8f0", padding: "18px 22px" }}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.07em] truncate" style={{ color: "#94a3b8" }}>
        {label}
      </div>
      <div className="mt-1 text-[18px] font-bold leading-tight break-words" style={{ color: color || "#176fb3" }}>
        {value}
      </div>
      {sublabel ? (
        <div className="mt-1 text-xs truncate" style={{ color: "#94a3b8" }}>
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

function MetricBreakdownChart({ rows }) {
  if (!rows.length) return <EmptyState />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="metric" tick={{ fontSize: 11 }} />
        <YAxis domain={[0, 1]} tick={{ fontSize: 11 }} />
        <Tooltip
          formatter={(value) => (Number.isFinite(Number(value)) ? Number(value).toFixed(3) : value)}
          labelFormatter={(label, payload) => payload?.[0]?.payload?.label || label}
        />
        <Legend />
        <Bar dataKey="value" name="Average score" radius={[4, 4, 0, 0]}>
          {rows.map((row, index) => (
            <Cell key={row.metric} fill={METRICS[index % METRICS.length].color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function SectorMetricChart({ rows, metric }) {
  if (!rows.length) return <EmptyState />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" domain={[0, 1]} tick={{ fontSize: 11 }} />
        <YAxis type="category" dataKey="sector" width={170} tick={{ fontSize: 10 }} />
        <Tooltip formatter={(value) => round(value, 3)} />
        <Bar dataKey="selected" name={metric} radius={[0, 4, 4, 0]}>
          {rows.map((entry, index) => (
            <Cell key={entry.sector} fill={METRICS[index % METRICS.length].color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function CompanyRankChart({ rows, metric, reverse = false }) {
  if (!rows.length) return <EmptyState />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" domain={[0, 1]} tick={{ fontSize: 11 }} />
        <YAxis type="category" dataKey="company" width={170} tick={{ fontSize: 10 }} />
        <Tooltip
          formatter={(value) => round(value, 3)}
          content={({ payload }) => {
            if (!payload?.length) return null;
            const row = payload[0].payload;
            return (
              <div className="bg-white border rounded shadow-sm p-2 text-xs">
                <div className="font-semibold mb-1">{row.company}</div>
                <div>{metric}: <b>{round(row.selected, 3)}</b></div>
                <div>Overall SRS: {round(row.overallSRS, 3)}</div>
                <div>Sector: {row.sector}</div>
                <div>Risk: {row.riskLevel || "Unknown"}</div>
              </div>
            );
          }}
        />
        <Bar dataKey="selected" name={metric} radius={[0, 4, 4, 0]}>
          {rows.map((entry, index) => (
            <Cell key={entry.company} fill={reverse ? METRICS[(rows.length - 1 - index) % METRICS.length].color : METRICS[index % METRICS.length].color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function SectorSummaryTable({ rows }) {
  if (!rows.length) return <EmptyState label="No sector summary available" />;
  return (
    <div className="overflow-auto h-full">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-slate-50">
          <tr className="text-left text-slate-500 uppercase tracking-wide">
            <th className="py-2 pr-2">Sector</th>
            <th className="py-2 pr-2">Companies</th>
            <th className="py-2 pr-2">Median TOS</th>
            <th className="py-2 pr-2">Median SRS</th>
            <th className="py-2 pr-2">Low</th>
            <th className="py-2 pr-2">Medium</th>
            <th className="py-2 pr-2">High</th>
            <th className="py-2 pr-2">Critical</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 12).map((row) => (
            <tr key={row.Sector || row.sector} className="border-t">
              <td className="py-2 pr-2 font-medium text-slate-700">{row.Sector || row.sector}</td>
              <td className="py-2 pr-2">{row.Companies ?? row.count ?? "—"}</td>
              <td className="py-2 pr-2">{round(parseNumber(row.Median_TOS ?? row.medianTOS), 3)}</td>
              <td className="py-2 pr-2">{round(parseNumber(row.Median_SRS ?? row.medianSRS), 2)}</td>
              <td className="py-2 pr-2">{row.Low_Count ?? "—"}</td>
              <td className="py-2 pr-2">{row.Medium_Count ?? "—"}</td>
              <td className="py-2 pr-2">{row.High_Count ?? "—"}</td>
              <td className="py-2 pr-2">{row.Critical_Count ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SectorMedianChart({ rows }) {
  if (!rows.length) return <EmptyState label="No sector summary available" />;

  const chartRows = rows.slice(0, 10).map((row) => ({
    sector: row.Sector || row.sector,
    Median_SRS: parseNumber(row.Median_SRS ?? row.medianSRS),
    Median_TOS: parseNumber(row.Median_TOS ?? row.medianTOS),
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartRows} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" tick={{ fontSize: 11 }} />
        <YAxis type="category" dataKey="sector" width={170} tick={{ fontSize: 10 }} />
        <Tooltip />
        <Legend />
        <Bar dataKey="Median_SRS" name="Median SRS" fill="#176fb3" radius={[0, 4, 4, 0]} />
        <Bar dataKey="Median_TOS" name="Median TOS" fill="#10b981" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function SelectedMetricVsSRSChart({ rows, metric }) {
  if (!rows.length) return <EmptyState label="No data available" />;

  const chartRows = rows.slice(0, 10).map((row) => ({
    sector: row.sector,
    selectedMetric: row[metric],
    overallSRS: row.overallSRS,
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartRows} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" domain={[0, 1]} tick={{ fontSize: 11 }} />
        <YAxis type="category" dataKey="sector" width={170} tick={{ fontSize: 10 }} />
        <Tooltip formatter={(value) => round(value, 3)} />
        <Legend />
        <Bar dataKey="selectedMetric" name={metric} fill="#176fb3" radius={[0, 4, 4, 0]} />
        <Bar dataKey="overallSRS" name="Overall SRS" fill="#f59e0b" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function CompanyVsSectorLineChart({ company, sectorRows }) {
  if (!company) return <EmptyState label="Select a company to view comparison" />;

  const chartRows = METRICS.map((metric) => {
    const sectorValues = sectorRows.map((row) => row[metric.key]).filter((value) => Number.isFinite(value));
    const sectorMedian = median(sectorValues);
    const companyValue = company[metric.key] ?? null;
    const delta = companyValue !== null && sectorMedian !== null ? companyValue - sectorMedian : null;
    return {
      metric: metric.key,
      label: metric.key,
      companyValue,
      sectorMedian,
      deltaLabel: delta === null ? "" : `${delta > 0 ? "+" : ""}${round(delta, 2)}`,
    };
  });

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartRows} margin={{ top: 20, right: 18, left: 6, bottom: 6 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
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

function SRSRadarChart({ company, sectorRows, selectedMetrics }) {
  const radarMetrics = METRICS.filter((metric) => metric.key !== "TOS");
  const activeMetricKeys = Array.isArray(selectedMetrics) && selectedMetrics.length ? selectedMetrics : radarMetrics.map((metric) => metric.key);
  const visibleMetrics = radarMetrics.filter((metric) => activeMetricKeys.includes(metric.key));
  const metrics = visibleMetrics.length ? visibleMetrics : radarMetrics;

  if (!company) {
    return (
      <Panel title="Company Radar" subtitle="Select a company from the dropdown above" minHeight={420}>
        <EmptyState label="Select a company to view the radar chart" />
      </Panel>
    );
  }

  const width = 360;
  const height = 320;
  const cx = 140;
  const cy = 130;
  const maxRadius = 92;
  const count = Math.max(metrics.length, 3);
  const angle = (index) => (index / count) * 2 * Math.PI - Math.PI / 2;

  const pointFor = (score, index) => {
    const radius = ((score ?? 0) / 1) * maxRadius;
    return [cx + radius * Math.cos(angle(index)), cy + radius * Math.sin(angle(index))];
  };

  const sectorPoints = metrics.map((metric, index) => {
    const values = sectorRows.map((row) => row[metric.key]).filter((value) => value !== null);
    const mean = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
    return pointFor(mean, index);
  });

  const companyPoints = metrics.map((metric, index) => pointFor(company[metric.key] ?? 0, index));

  const tableRows = metrics.map((metric) => {
    const companyValue = company[metric.key];
    const sectorValues = sectorRows.map((row) => row[metric.key]).filter((value) => value !== null);
    const sectorMean = sectorValues.length ? sectorValues.reduce((sum, value) => sum + value, 0) / sectorValues.length : null;
    const delta = companyValue !== null && sectorMean !== null ? companyValue - sectorMean : null;
    return { metric, companyValue, sectorMean, delta };
  });

  return (
    <Panel
      title="Company Radar"
      subtitle={`${company.Company || company.company || "Selected company"} · Higher = further out = higher risk`}
      minHeight={420}
    >
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="overflow-hidden">
          <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="320" style={{ display: "block" }}>
            {[25, 50, 75, 100].map((radiusValue) => {
              const ringPoints = metrics.map((_, index) => {
                const r = (radiusValue / 100) * maxRadius;
                return [cx + r * Math.cos(angle(index)), cy + r * Math.sin(angle(index))];
              });
              return <polygon key={radiusValue} points={ringPoints.map((point) => point.join(",")).join(" ")} fill="none" stroke="#e2e8f0" strokeWidth="0.8" />;
            })}
            {metrics.map((metric, index) => {
              const [axisX, axisY] = pointFor(1, index);
              const [labelX, labelY] = [cx + (maxRadius + 16) * Math.cos(angle(index)), cy + (maxRadius + 16) * Math.sin(angle(index))];
              return (
                <g key={metric.key}>
                  <line x1={cx} y1={cy} x2={axisX} y2={axisY} stroke="#e2e8f0" strokeWidth="0.8" />
                  <text x={labelX} y={labelY + 3} textAnchor="middle" fontSize="8.5" fill="#64748b">
                    <title>{metric.label}</title>
                    {metric.label}
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
            <span><span className="inline-block w-3 h-0.5 align-middle mr-2" style={{ background: "#176fb3" }} />Sector average</span>
          </div>
        </div>

        <div className="overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-50">
              <tr className="text-left text-slate-500 uppercase tracking-wide">
                <th className="py-2 pr-2">Metric</th>
                <th className="py-2 pr-2">Company</th>
                <th className="py-2 pr-2">Sector Avg</th>
                <th className="py-2 pr-2">Delta</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map(({ metric, companyValue, sectorMean, delta }) => (
                <tr key={metric.key} className="border-t">
                  <td className="py-2 pr-2 font-medium text-slate-700">{metric.label}</td>
                  <td className="py-2 pr-2">{round(companyValue, 3)}</td>
                  <td className="py-2 pr-2">{round(sectorMean, 3)}</td>
                  <td className="py-2 pr-2 font-semibold" style={{ color: delta === null ? "#94a3b8" : delta > 0 ? "#10b981" : "#ef4444" }}>
                    {delta === null ? "—" : `${delta > 0 ? "+" : ""}${round(delta, 3)}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <KpiCard label="Selected Company" value={formatCompanyName(company.Company || company.company)} sublabel={company.Sector || "No sector"} color="#176fb3" />
            <KpiCard label="Overall TOS" value={round(company.TOS, 3)} sublabel="text outcome score" color="#10b981" />
          </div>
        </div>
      </div>
    </Panel>
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

function CompanyComparisonRanking({ companies, rows, metric }) {
  if (!companies || !companies.length) return <EmptyState label="Select companies to compare" />;

  const comparisonData = companies
    .map((companyName) => {
      const row = rows.find((r) => r.Company === companyName);
      return row
        ? { company: companyName, value: row[metric], sector: row.Sector, globalSrs: row.GlobalSRS }
        : { company: companyName, value: null, sector: "—", globalSrs: null };
    })
    .filter((r) => r.value !== null)
    .sort((a, b) => b.value - a.value);

  if (!comparisonData.length) return <EmptyState label="No data for selected companies" />;

  return (
    <div>
      <div className="mb-4">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={comparisonData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" domain={[0, 1]} tick={{ fontSize: 10 }} />
            <YAxis type="category" dataKey="company" width={160} tick={{ fontSize: 10 }} />
            <Tooltip formatter={(value) => round(value, 3)} />
            <Bar dataKey="value" name={metric} fill="#10b981" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-slate-50">
            <tr className="text-left text-slate-500 uppercase tracking-wide">
              <th className="py-2 pr-2">Rank</th>
              <th className="py-2 pr-2">Company</th>
              <th className="py-2 pr-2">{metric} Score</th>
              <th className="py-2 pr-2">Sector</th>
              <th className="py-2 pr-2">Global SRS</th>
            </tr>
          </thead>
          <tbody>
            {comparisonData.map((row, idx) => (
              <tr key={row.company} className="border-t">
                <td className="py-2 pr-2 font-medium">{idx + 1}</td>
                <td className="py-2 pr-2">{formatCompanyName(row.company)}</td>
                <td className="py-2 pr-2 font-semibold" style={{ color: "#10b981" }}>{round(row.value, 3)}</td>
                <td className="py-2 pr-2">{row.sector}</td>
                <td className="py-2 pr-2">{round(row.globalSrs, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SectorComparisonChart({ rows }) {
  if (!rows.length) return <EmptyState label="Select up to 4 sectors to compare" />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={METRICS.map((metric) => ({
        metric: metric.key,
        label: metric.label,
        ...rows.reduce((acc, row) => {
          acc[row.sector] = row[metric.key];
          return acc;
        }, {}),
      }))}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="label" angle={-20} textAnchor="end" height={80} tick={{ fontSize: 11 }} />
        <YAxis domain={[0, 1]} tick={{ fontSize: 11 }} />
        <Tooltip formatter={(value) => round(value, 3)} />
        <Legend />
        {rows.map((row, index) => (
          <Bar key={row.sector} dataKey={row.sector} fill={METRICS[index % METRICS.length].color} radius={[4, 4, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

function CompanyComparisonChart({ rows, companies, metric }) {
  if (!rows.length || !companies || !companies.length) return <EmptyState label="No companies selected" />;

  const byCompany = companies.map((c) => {
    const row = rows.find((r) => r.Company === c) || rows.find((r) => r.company === c);
    return {
      company: c,
      value: row ? (row[metric] ?? row.selected ?? null) : null,
    };
  }).filter(r => r.value !== null && r.value !== undefined);

  if (!byCompany.length) return <EmptyState label="No data for selected companies" />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={byCompany} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" domain={[0, 1]} tick={{ fontSize: 11 }} />
        <YAxis type="category" dataKey="company" width={200} tick={{ fontSize: 11 }} />
        <Tooltip formatter={(value) => round(value, 3)} />
        <Bar dataKey="value" name={metric} fill="#176fb3" radius={[0, 4, 4, 0]}>
          {byCompany.map((entry, idx) => (
            <Cell key={entry.company} fill={METRICS[idx % METRICS.length].color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export async function loadData({
  principleId = "P5",
  scoresCsvPath,
  globalRankingPath = "/global_ranking_2024.csv",
  sectorSummaryPath = "/sector_summary_2024.csv",
  reportYear = "FY2023-24",
} = {}) {
  const principle = PRINCIPLE_META[principleId] || PRINCIPLE_META.P5;
  const scorePaths = scoresCsvPath ? [scoresCsvPath] : resolveYearPath(principle.csv, reportYear);
  const globalPaths = resolveYearPath(globalRankingPath, reportYear);
  const sectorPaths = resolveYearPath(sectorSummaryPath, reportYear);

  const [scoresText, globalText, sectorText] = await Promise.all([
    fetchCsvText(scorePaths),
    fetchCsvText(globalPaths).catch(() => ""),
    fetchCsvText(sectorPaths).catch(() => ""),
  ]);

  const scoreRows = loadRows(scoresText)
    .map((row) => ({
      Rank: parseNumber(row.Rank),
      Company: row.Company,
      SS: parseNumber(row.SS),
      AS: parseNumber(row.AS),
      CCS: parseNumber(row.CCS),
      OES: parseNumber(row.OES),
      RTS: parseNumber(row.RTS),
      TOS: parseNumber(row.TOS),
    }))
    .filter((row) => row.Company);

  const globalRows = loadRows(globalText).map((row) => ({
    Company: row.Company,
    Sector: row.Sector,
    GlobalSRS: (() => {
      const v = parseNumber(row.SRS);
      if (v === null) return null;
      return v > 1 ? v / 100 : v;
    })(),
    OverallTOS: parseNumber(row.Overall_TOS),
    RiskLevel: row.Risk_Level || "Unknown",
    GlobalRank: parseNumber(row.Global_SRS_Rank),
  }));

  const sectorByCompany = new Map(globalRows.map((row) => [normalizeCompany(row.Company), row]));

  const mergedRows = scoreRows.map((row) => {
    const global = sectorByCompany.get(normalizeCompany(row.Company)) || {};
    return {
      ...row,
      Sector: global.Sector || "Unknown",
      GlobalSRS: global.GlobalSRS,
      OverallTOS: global.OverallTOS,
      RiskLevel: global.RiskLevel,
      GlobalRank: global.GlobalRank,
    };
  });

  const sectorRows = loadRows(sectorText);
  const sectors = ["All Sectors", ...Array.from(new Set(mergedRows.map((row) => row.Sector).filter(Boolean))).sort()];

  return {
    principleId,
    principleLabel: principle.title,
    rows: mergedRows,
    sectors,
    sectorRows,
    metricDefs: METRICS,
  };
}

export function QuestionPage({
  data,
  filters = {},
  setFilters = () => {},
  sector,
  selectedCompany = "",
  selectedMetrics = [],
  setSelectedCompany = () => {},
  setSelectedMetrics = () => {},
}) {
  const [comparisonMode, setComparisonMode] = useState("companies"); // "companies" or "sectors"
  const [selectedCompaniesForComparison, setSelectedCompaniesForComparison] = useState([]);
  const [selectedSectorsForComparison, setSelectedSectorsForComparison] = useState([]);
  const [comparisonMetric, setComparisonMetric] = useState("TOS");

  const rows = data?.rows || [];
  const activeMetrics = selectedMetrics?.length ? selectedMetrics : METRICS.map((metric) => metric.key);
  const primaryMetric = activeMetrics[0] || "TOS";
  const selectedSector = sector && sector !== "All" && sector !== "All Sectors" ? sector : "All Sectors";

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (selectedSector && selectedSector !== "All Sectors" && row.Sector !== selectedSector) return false;
      return true;
    });
  }, [rows, selectedSector]);

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

  const metricAverages = useMemo(() => {
    return METRICS.filter((metric) => activeMetrics.includes(metric.key)).map((metric) => ({
      metric: metric.key,
      label: metric.label,
      value: average(filteredRows.map((row) => row[metric.key])),
    }));
  }, [filteredRows, activeMetrics]);

  const sectorRows = useMemo(() => makeSectorRows(filteredRows, primaryMetric), [filteredRows, primaryMetric]);
  const topCompanies = useMemo(() => makeCompanyRows(filteredRows, primaryMetric, true), [filteredRows, primaryMetric]);
  const bottomCompanies = useMemo(() => makeCompanyRows(filteredRows, primaryMetric, false), [filteredRows, primaryMetric]);

  const availableSectors = useMemo(() => {
    return ["All Sectors", ...Array.from(new Set(rows.map((row) => row.Sector).filter(Boolean))).sort()];
  }, [filteredRows]);

  const avgTOS = average(filteredRows.map((row) => row.TOS));
  const avgGlobalSRS = average(filteredRows.map((row) => row.GlobalSRS));
  const avgSelected = average(filteredRows.map((row) => row[primaryMetric]));

  useEffect(() => {
    if (!selectedCompanyRow) return;
    if (!selectedCompany || !companyOptions.includes(selectedCompany)) {
      setSelectedCompany(selectedCompanyRow.Company || "");
    }
  }, [companyOptions, selectedCompany, selectedCompanyRow, setSelectedCompany]);

  useEffect(() => {
    if (!selectedMetrics?.length) {
      setSelectedMetrics(METRICS.map((metric) => metric.key));
    }
  }, [selectedMetrics, setSelectedMetrics]);

  if (!data) {
    return <div className="p-6 bg-white border rounded text-center text-slate-500">Loading SRS data…</div>;
  }

  function toggleMetric(metricKey) {
    setSelectedMetrics((current) => {
      const base = Array.isArray(current) && current.length ? current : METRICS.map((metric) => metric.key);
      if (base.includes(metricKey)) {
        if (base.length === 1) return base;
        return base.filter((item) => item !== metricKey);
      }
      return [...base, metricKey];
    });
  }

  function downloadCsv(rows) {
    if (!rows || !rows.length) return;
    const cols = Object.keys(rows[0]);
    const csv = [cols.join(","), ...rows.map(r => cols.map(c => JSON.stringify(r[c] ?? "")).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${data?.principleId || 'P'}_SRS_export.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const currentMetricSummary = METRICS.find((metric) => metric.key === primaryMetric) || METRICS[0];

  return (
    <div className="space-y-6">
      <div className="bg-white border rounded-lg p-4" style={{ borderColor: "#e2e8f0" }}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: "#176fb3" }}>
              {data.principleLabel}
            </div>
            <h2 className="mt-1 text-lg font-bold text-slate-900">SRS Breakdown Dashboard</h2>
            <div className="text-sm text-slate-500 mt-1">
              SRS is computed from five inputs: Specificity Score, Actionability Score, Compliance Coverage Score, Outcome Evidence Score and Risk Tone Score. Their combined Text Outcome Score is normalized by sector to form the final SRS.
            </div>
          </div>

          <div className="min-w-[260px] flex-1 max-w-md flex flex-col gap-3">
            <div>
              <div className="text-xs font-medium text-slate-600 mb-1">Sector</div>
              <select
                value={selectedSector}
                onChange={(event) => setFilters((previous) => ({ ...previous, sector: event.target.value }))}
                className="w-full border border-slate-300 p-2 rounded-lg text-sm bg-white focus:ring-2 focus:ring-sky-500"
              >
                {availableSectors.map((sectorName) => (
                  <option key={sectorName} value={sectorName}>
                    {sectorName}
                  </option>
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
            const active = activeMetrics.includes(metric.key);
            return (
              <button
                key={metric.key}
                onClick={() => toggleMetric(metric.key)}
                title={metric.label}
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
        <KpiCard label={`Avg ${currentMetricSummary.key}`} value={round(avgSelected, 3)} sublabel={currentMetricSummary.label} color="#176fb3" />
        <KpiCard label="Avg TOS" value={round(avgTOS, 3)} sublabel="text outcome score" color="#10b981" />
        <KpiCard label="Avg Global SRS" value={round(avgGlobalSRS, 2)} sublabel="overall company score" color="#dc2626" />
      </div>

      <Panel title="Breakdown Averages" subtitle="Average selected metrics across the current principle view" minHeight={320}>
        <div style={{ height: 280 }}>
          <MetricBreakdownChart rows={metricAverages} />
        </div>
      </Panel>

      <Panel title="Comparison Analysis" subtitle="Compare companies or sectors on any of the 6 SRS metrics" minHeight={480}>
        <div className="space-y-4">
          <div className="flex items-end gap-3 flex-wrap">
            <div>
              <div className="text-xs font-medium text-slate-600 mb-1">Compare</div>
              <div className="flex rounded-md border overflow-hidden" style={{ borderColor: "#e2e8f0" }}>
                {["companies", "sectors"].map((mode) => (
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
                    {mode === "companies" ? "Companies" : "Sectors"}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 min-w-[250px]">
              <div className="text-xs font-medium text-slate-600 mb-1">
                {comparisonMode === "companies" ? "Select upto 5 Companies from the Table Below" : "Select up to 5 sectors from the table below"}
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
                          <th className="py-2 pr-3 text-right">{comparisonMetric}</th>
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
                                  if (prev.includes(row.Company)) {
                                    return prev.filter((c) => c !== row.Company);
                                  }
                                  if (prev.length < 5) {
                                    return [...prev, row.Company];
                                  }
                                  return prev;
                                });
                              }}
                              className="border-t cursor-pointer transition-colors hover:bg-blue-50"
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
                              <td className="py-2 pr-3 text-right font-medium">{round(row[comparisonMetric], 3)}</td>
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
                  {availableSectors.filter((s) => s !== "All Sectors").map((sector) => (
                    <button
                      key={sector}
                      onClick={() => {
                        setSelectedSectorsForComparison((prev) => {
                          if (prev.includes(sector)) {
                            return prev.filter((s) => s !== sector);
                          } else if (prev.length < 5) {
                            return [...prev, sector];
                          }
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
                {METRICS.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.key}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {comparisonMode === "companies" ? (
            <CompanyComparisonRanking
              companies={selectedCompaniesForComparison}
              rows={filteredRows}
              metric={comparisonMetric}
            />
          ) : (
            <SectorComparisonRanking
              sectors={selectedSectorsForComparison}
              rows={filteredRows}
              metric={comparisonMetric}
            />
          )}
        </div>
      </Panel>

      {/* <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-7">
          <Panel
            title={`Sector-wise ${currentMetricSummary.key} Ranking`}
            subtitle="Aggregated from the company-level principle scores"
            minHeight={420}
          >
            <div style={{ height: 380 }}>
              <SectorMetricChart rows={sectorRows.slice(0, 12)} metric={primaryMetric} />
            </div>
          </Panel>
        </div> */}
        {/* <div className="col-span-12 lg:col-span-5">
          <Panel title="Sector Summary Snapshot" subtitle="Overall sector distribution from the generated summary file" minHeight={420}>
            <SectorSummaryTable rows={data.sectorRows || []} />
          </Panel>
        </div> 
      </div>*/}

      <Panel title="Company Performance Analysis" subtitle="Choose a company to compare its SRS profile against its own sector median" minHeight={520}>
        <div>
          <div className="mb-4 pb-4 border-b" style={{ borderColor: "#e2e8f0" }}>
            <div className="text-sm font-semibold" style={{ color: "#1a2333" }}>
              {formatCompanyName(selectedCompanyRow?.Company) || "Select a Company"}
            </div>
            <div className="text-xs mt-1" style={{ color: "#94a3b8" }}>
              {selectedCompanyRow?.Sector || "—"} • Global SRS: {round(selectedCompanyRow?.GlobalSRS, 2) || "—"}
            </div>
          </div>

          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-12 lg:col-span-6">
              <SRSRadarChart company={selectedCompanyRow} sectorRows={companySectorRows} />
            </div>
            <div className="col-span-12 lg:col-span-6">
              <div className="bg-white border rounded-lg h-full overflow-hidden" style={{ borderColor: "#e2e8f0", minHeight: 420 }}>
                <div className="px-4 py-3 border-b" style={{ borderColor: "#e2e8f0", background: "#f9fafb" }}>
                  <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#64748b" }}>Score Comparison vs Sector Median</div>
                </div>
                <div className="p-4" style={{ height: 420 - 56 }}>
                  <CompanyVsSectorLineChart company={selectedCompanyRow} sectorRows={companySectorRows} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </Panel>

      <Panel title="Filtered Company Table" subtitle="Raw rows from the principle CSV with global sector context" minHeight={300} headerRight={(
        <button onClick={() => downloadCsv(filteredRows)} className="text-[12px] px-3 py-1 rounded-md bg-white border" style={{ borderColor: '#e2e8f0' }}>
          Export CSV
        </button>
      )}>
        <div className="overflow-auto h-full max-h-[320px]">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-50">
              <tr className="text-left text-slate-500 uppercase tracking-wide">
                <th className="py-2 pr-2">Rank</th>
                <th className="py-2 pr-2">Company</th>
                <th className="py-2 pr-2">Sector</th>
                {METRICS.map((metric) => (
                  <th key={metric.key} className="py-2 pr-2">{metric.key}</th>
                ))}
                <th className="py-2 pr-2">Global SRS</th>
                <th className="py-2 pr-2">Risk</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr
                  key={row.Company}
                  onClick={() => setSelectedCompany(row.Company)}
                  className="border-t cursor-pointer hover:bg-blue-50 transition-colors"
                  style={{
                    background: selectedCompany === row.Company ? "#eff6ff" : "transparent",
                    borderColor: "#e2e8f0",
                  }}
                >
                  <td className="py-2 pr-2">{row.Rank ?? "—"}</td>
                  <td className="py-2 pr-2 font-medium" style={{ color: selectedCompany === row.Company ? "#176fb3" : "#1a2333" }}>
                    {formatCompanyName(row.Company)}
                  </td>
                  <td className="py-2 pr-2">{row.Sector}</td>
                  {METRICS.map((metric) => (
                    <td key={metric.key} className="py-2 pr-2">{round(row[metric.key], 3)}</td>
                  ))}
                  <td className="py-2 pr-2">{round(row.GlobalSRS, 2)}</td>
                  <td className="py-2 pr-2">{row.RiskLevel || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}