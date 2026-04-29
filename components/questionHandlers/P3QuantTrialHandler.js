import Papa from "papaparse";
import React, { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
} from "recharts";

const PALETTE = {
  blue: "#176fb3",
  slate: "#64748b",
  red: "#dc2626",
  green: "#16a34a",
  amber: "#d97706",
  purple: "#7c3aed",
  pink: "#db2777",
};

function safeNumber(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function fmt(n, digits = 1) {
  if (n === null || n === undefined || Number.isNaN(n)) return "-";
  return Number(n).toFixed(digits);
}

function titleCase(s) {
  if (!s) return "Unknown";
  return String(s)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function loadData() {
  const res = await fetch("/api/p3-quant", { cache: "no-store" });
  if (!res.ok) {
    throw new Error("Failed to fetch P3 quantitative CSV");
  }

  const text = await res.text();
  const parsed = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
  });

  const rows = (parsed.data || []).map((r) => ({
    ...r,
    valueNum: safeNumber(r.value),
  }));

  const sectors = [
    "All",
    ...new Set(rows.map((r) => r.Sector).filter(Boolean)),
  ].sort();
  const companies = [
    "All",
    ...new Set(rows.map((r) => r.NameOfTheCompany).filter(Boolean)),
  ].sort();
  const years = [
    "All",
    ...new Set(rows.map((r) => r.year).filter(Boolean)),
  ];
  const metrics = [
    "All",
    ...new Set(rows.map((r) => r.metric).filter(Boolean)),
  ].sort();

  return { rows, sectors, companies, years, metrics };
}

export function QuestionPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [sector, setSector] = useState("All");
  const [company, setCompany] = useState("All");
  const [year, setYear] = useState("All");
  const [metric, setMetric] = useState("All");

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const loaded = await loadData();
        if (!cancelled) {
          setData(loaded);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e?.message || "Failed to load data");
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredRows = useMemo(() => {
    if (!data?.rows) return [];
    return data.rows.filter((r) => {
      if (sector !== "All" && r.Sector !== sector) return false;
      if (company !== "All" && r.NameOfTheCompany !== company) return false;
      if (year !== "All" && r.year !== year) return false;
      if (metric !== "All" && r.metric !== metric) return false;
      return true;
    });
  }, [data, sector, company, year, metric]);

  const availableCompanies = useMemo(() => {
    if (!data?.rows) return ["All"];
    const rowsAfterSector = data.rows.filter((r) =>
      sector === "All" ? true : r.Sector === sector
    );
    return [
      "All",
      ...new Set(rowsAfterSector.map((r) => r.NameOfTheCompany).filter(Boolean)),
    ].sort();
  }, [data, sector]);

  const coverageStats = useMemo(() => {
    const total = filteredRows.length;
    const nonNull = filteredRows.filter((r) => r.valueNum !== null).length;
    const missing = total - nonNull;
    const pct = total > 0 ? (missing / total) * 100 : 0;

    const companyCount = new Set(
      filteredRows.map((r) => r.NameOfTheCompany).filter(Boolean)
    ).size;

    return {
      total,
      nonNull,
      missing,
      missingPct: pct,
      companyCount,
    };
  }, [filteredRows]);

  const sectorComparison = useMemo(() => {
    const map = new Map();

    filteredRows.forEach((r) => {
      if (!r.Sector || r.valueNum === null) return;
      if (!map.has(r.Sector)) map.set(r.Sector, { sum: 0, count: 0 });
      const cur = map.get(r.Sector);
      cur.sum += r.valueNum;
      cur.count += 1;
      map.set(r.Sector, cur);
    });

    return [...map.entries()]
      .map(([k, v]) => ({ sector: k, avgValue: v.count ? v.sum / v.count : 0 }))
      .sort((a, b) => b.avgValue - a.avgValue)
      .slice(0, 12);
  }, [filteredRows]);

  const companyLeaderboard = useMemo(() => {
    const map = new Map();

    filteredRows.forEach((r) => {
      if (!r.NameOfTheCompany || r.valueNum === null) return;
      if (!map.has(r.NameOfTheCompany)) {
        map.set(r.NameOfTheCompany, { sum: 0, count: 0, sector: r.Sector || "-" });
      }
      const cur = map.get(r.NameOfTheCompany);
      cur.sum += r.valueNum;
      cur.count += 1;
      map.set(r.NameOfTheCompany, cur);
    });

    return [...map.entries()]
      .map(([companyName, v]) => ({
        companyName,
        sector: v.sector,
        score: v.count ? v.sum / v.count : 0,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }, [filteredRows]);

  const yearSplit = useMemo(() => {
    const map = new Map();

    filteredRows.forEach((r) => {
      if (!r.year || r.valueNum === null) return;
      if (!map.has(r.year)) map.set(r.year, { sum: 0, count: 0 });
      const cur = map.get(r.year);
      cur.sum += r.valueNum;
      cur.count += 1;
      map.set(r.year, cur);
    });

    const base = [...map.entries()].map(([y, v]) => ({
      year: y,
      avgValue: v.count ? v.sum / v.count : 0,
    }));

    return base.sort((a, b) => a.year.localeCompare(b.year));
  }, [filteredRows]);

  const categoryBreakdown = useMemo(() => {
    const map = new Map();

    filteredRows.forEach((r) => {
      const key = r.category || r.subdomain || "uncategorized";
      if (!map.has(key)) map.set(key, { total: 0, nonNull: 0 });
      const cur = map.get(key);
      cur.total += 1;
      if (r.valueNum !== null) cur.nonNull += 1;
      map.set(key, cur);
    });

    return [...map.entries()]
      .map(([k, v]) => ({
        category: titleCase(k),
        completenessPct: v.total ? (v.nonNull / v.total) * 100 : 0,
        rows: v.total,
      }))
      .sort((a, b) => b.rows - a.rows)
      .slice(0, 10);
  }, [filteredRows]);

  const metricMissingFlags = useMemo(() => {
    const map = new Map();

    filteredRows.forEach((r) => {
      if (!r.metric) return;
      if (!map.has(r.metric)) map.set(r.metric, { total: 0, missing: 0 });
      const cur = map.get(r.metric);
      cur.total += 1;
      if (r.valueNum === null) cur.missing += 1;
      map.set(r.metric, cur);
    });

    return [...map.entries()]
      .map(([metricName, v]) => ({
        metricName,
        missingPct: v.total ? (v.missing / v.total) * 100 : 0,
        missing: v.missing,
        total: v.total,
      }))
      .sort((a, b) => b.missingPct - a.missingPct)
      .slice(0, 8);
  }, [filteredRows]);

  if (loading) {
    return (
      <div className="p-6 bg-white rounded border shadow-sm text-slate-600">
        Loading P3 quantitative trial dashboard...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-white rounded border shadow-sm text-red-600">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="p-5 rounded-lg border bg-white shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900 mb-2">
          Principle 3 Quantitative Trial Page
        </h2>
        <p className="text-sm text-slate-600">
          Exploratory page built from flattened P3 quantitative rows with sector comparisons,
          company leaderboard, year split, and missing-data flags.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded border bg-white">
          <div className="text-xs text-slate-500 uppercase tracking-wide">Rows in View</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{coverageStats.total.toLocaleString()}</div>
        </div>
        <div className="p-4 rounded border bg-white">
          <div className="text-xs text-slate-500 uppercase tracking-wide">Companies in View</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{coverageStats.companyCount.toLocaleString()}</div>
        </div>
        <div className="p-4 rounded border bg-white">
          <div className="text-xs text-slate-500 uppercase tracking-wide">Non-null Values</div>
          <div className="text-2xl font-bold mt-1" style={{ color: PALETTE.green }}>
            {coverageStats.nonNull.toLocaleString()}
          </div>
        </div>
        <div className="p-4 rounded border bg-white">
          <div className="text-xs text-slate-500 uppercase tracking-wide">Missing Data</div>
          <div className="text-2xl font-bold mt-1" style={{ color: PALETTE.red }}>
            {fmt(coverageStats.missingPct, 1)}%
          </div>
        </div>
      </div>

      <div className="p-4 rounded border bg-white shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-500">Sector</label>
            <select
              value={sector}
              onChange={(e) => {
                setSector(e.target.value);
                setCompany("All");
              }}
              className="mt-1 w-full border rounded p-2 text-sm"
            >
              {data.sectors.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500">Company</label>
            <select
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="mt-1 w-full border rounded p-2 text-sm"
            >
              {availableCompanies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500">Year</label>
            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="mt-1 w-full border rounded p-2 text-sm"
            >
              {data.years.map((y) => (
                <option key={y} value={y}>
                  {y === "current" ? "Current (2023)" : y === "previous" ? "Previous (2022)" : y}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500">Metric</label>
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value)}
              className="mt-1 w-full border rounded p-2 text-sm"
            >
              {data.metrics.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="p-4 rounded border bg-white shadow-sm">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">Sector-level Comparison (Average Value)</h3>
          <div style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sectorComparison}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="sector" angle={-30} textAnchor="end" height={70} tick={{ fontSize: 11 }} interval={0} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => fmt(v, 2)} />
                <Bar dataKey="avgValue" fill={PALETTE.blue} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="p-4 rounded border bg-white shadow-sm">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">Year Split (Current vs Previous)</h3>
          <div style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={yearSplit}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => fmt(v, 2)} />
                <Legend />
                <Line type="monotone" dataKey="avgValue" stroke={PALETTE.purple} strokeWidth={3} dot={{ r: 4 }} name="Average Value" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="p-4 rounded border bg-white shadow-sm">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">Company Leaderboard (Top 10 by Average Value)</h3>
          <div className="overflow-auto max-h-96">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50">
                <tr>
                  <th className="text-left p-2">Rank</th>
                  <th className="text-left p-2">Company</th>
                  <th className="text-left p-2">Sector</th>
                  <th className="text-right p-2">Score</th>
                </tr>
              </thead>
              <tbody>
                {companyLeaderboard.map((r, idx) => (
                  <tr key={r.companyName} className="border-t">
                    <td className="p-2 font-semibold">#{idx + 1}</td>
                    <td className="p-2">{r.companyName}</td>
                    <td className="p-2 text-slate-600">{r.sector}</td>
                    <td className="p-2 text-right font-semibold" style={{ color: PALETTE.blue }}>
                      {fmt(r.score, 2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="p-4 rounded border bg-white shadow-sm">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">Category/Subdomain Completeness</h3>
          <div style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryBreakdown}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="category" angle={-30} textAnchor="end" height={70} tick={{ fontSize: 10 }} interval={0} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => `${fmt(v, 1)}%`} />
                <Bar dataKey="completenessPct" fill={PALETTE.amber} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="p-4 rounded border bg-white shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-800">Missing Data Flags by Metric</h3>
          <div className="text-xs text-slate-500">Flag threshold shown at 40% missing</div>
        </div>

        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left p-2">Metric</th>
                <th className="text-right p-2">Missing %</th>
                <th className="text-right p-2">Missing</th>
                <th className="text-right p-2">Total</th>
                <th className="text-left p-2">Flag</th>
              </tr>
            </thead>
            <tbody>
              {metricMissingFlags.map((m) => {
                const isHigh = m.missingPct >= 40;
                return (
                  <tr key={m.metricName} className="border-t">
                    <td className="p-2">{m.metricName}</td>
                    <td className="p-2 text-right">{fmt(m.missingPct, 1)}%</td>
                    <td className="p-2 text-right">{m.missing}</td>
                    <td className="p-2 text-right">{m.total}</td>
                    <td className="p-2">
                      <span
                        className="px-2 py-1 rounded text-xs font-semibold"
                        style={{
                          background: isHigh ? "#fee2e2" : "#dcfce7",
                          color: isHigh ? PALETTE.red : PALETTE.green,
                        }}
                      >
                        {isHigh ? "High Missingness" : "Acceptable"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
