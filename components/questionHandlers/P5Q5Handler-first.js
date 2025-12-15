// ./questionHandlers/P5Q5Handler.js
import React, { useMemo, useState } from "react";
import Papa from "papaparse";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

/* -----------------------------------------------------
   SECTOR SHORT NAMES
------------------------------------------------------ */
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
  return SECTOR_SHORT_NAMES[name] || name;
}

/**
 * Normalize mechanism type (sort alphabetically so Policy+Whistleblower = Whistleblower+Policy)
 */
function normalizeMechanismType(type) {
  if (!type || type === "Not Specified") return "Not Specified";
  return type.split(",").map(t => t.trim()).sort().join(", ");
}

/**
 * Normalize status/effectiveness
 */
function normalizeStatus(status) {
  if (!status) return "Not Specified";
  const s = String(status).toLowerCase();
  if (s.includes("active")) return "Active";
  if (s.includes("robust")) return "Robust";
  if (s.includes("effective")) return "Effective";
  if (s.includes("in place") || s.includes("implemented")) return "In Place";
  if (s.includes("ongoing") || s.includes("monitored")) return "Ongoing";
  return "Other";
}

/**
 * Classify actions taken
 */
function classifyAction(actionText) {
  if (!actionText) return "Not Specified";
  const text = String(actionText).toLowerCase();
  
  const categories = [];
  
  if (text.match(/\b(prevent|mitigat|avoid|safeguard|protect|uphold|ensure|foster)\b/)) 
    categories.push("Preventive");
  
  if (text.match(/\b(address|resolv|rectif|correct|remedial|fix|action|disciplin)\b/)) 
    categories.push("Corrective");
  
  if (text.match(/\b(report|lodg|disclose|complaint|grievance|escalat|channel|hotline)\b/)) 
    categories.push("Reporting");
  
  if (text.match(/\b(committee|oversee|monitor|governance|review|audit|accountab)\b/)) 
    categories.push("Accountability");
  
  if (text.match(/\b(support|assist|counsel|guidance|help|facilitat)\b/)) 
    categories.push("Support");
  
  if (text.match(/\b(protect|confidential|anonymi|safeguard|dignity|rights|non-retali)\b/)) 
    categories.push("Protection");
  
  return categories.length > 0 ? categories.join(", ") : "General";
}

/**
 * loadData
 */
export async function loadData({
  generalCsvPath = "/GeneralDisclosures_df.csv",
  questionCsvPath = "/P5_Q5.csv",
} = {}) {
  const [gRes, qRes] = await Promise.all([fetch(generalCsvPath), fetch(questionCsvPath)]);
  const [gText, qText] = await Promise.all([gRes.text(), qRes.text()]);

  const gCsv = Papa.parse(gText, { header: true, skipEmptyLines: true });
  const qCsv = Papa.parse(qText, { header: true, skipEmptyLines: true });

  const generalDf = gCsv.data.filter((r) => r.NameOfTheCompany);
  const rawQ = qCsv.data.filter((r) => typeof r.doc_index !== "undefined" && r.doc_index !== null);

  const bucketize = (nw) => {
    if (!nw && nw !== 0) return "Unknown";
    const v = parseFloat(nw);
    if (isNaN(v)) return "Unknown";
    if (v < 5000) return "Small Cap";
    if (v < 20000) return "Mid Cap";
    return "Large Cap";
  };

  const enriched = rawQ.map((row) => {
    const idx = parseInt(row.doc_index, 10);
    const match = !isNaN(idx) && idx >= 0 && idx < generalDf.length ? generalDf[idx] : null;
    
    return {
      ...row,
      Company: match?.NameOfTheCompany || "Unknown",
      Sector: match?.Sector || "Unknown",
      NetWorth: match?.NetWorth_DCYMain || null,
      CapBucket: bucketize(match?.NetWorth_DCYMain),
      // Normalized fields
      mechanism_type_normalized: normalizeMechanismType(row.mechanism_type),
      status_normalized: normalizeStatus(row.status_or_effectiveness),
      action_category: classifyAction(row.actions_taken),
    };
  });

  const sectors = ["All", ...Array.from(new Set(enriched.map((r) => r.Sector).filter(Boolean)))].sort();
  const capBuckets = ["All", "Large Cap", "Mid Cap", "Small Cap", "Unknown"];

  return {
    generalDf,
    enriched,
    sectors: sectors.sort(),
    capBuckets,
  };
}

/* -----------------------------------------------------
   Processing functions
------------------------------------------------------ */

function computeMechanismTypeDistribution(rows) {
  const counts = {};
  rows.forEach((r) => {
    const type = r.mechanism_type_normalized || "Not Specified";
    counts[type] = (counts[type] || 0) + 1;
  });
  
  return Object.entries(counts)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8); // Top 8 to avoid overcrowding
}

function computeActionCategoryDistribution(rows) {
  const counts = {};
  
  rows.forEach((r) => {
    if (!r.action_category) return;
    const categories = String(r.action_category).split(",").map(c => c.trim());
    categories.forEach(cat => {
      counts[cat] = (counts[cat] || 0) + 1;
    });
  });
  
  return Object.entries(counts)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
}

function computeTopPolicyReferences(rows) {
  const policies = {};
  
  rows.forEach((r) => {
    if (!r.policy_reference || String(r.policy_reference).toLowerCase() === 'nan') return;
    
    const policy = String(r.policy_reference).trim();
    if (policy.length > 5) {
      policies[policy] = (policies[policy] || 0) + 1;
    }
  });
  
  return Object.entries(policies)
    .map(([policy, count]) => ({ policy, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);
}

function computeStatusDistribution(rows) {
  const counts = {};
  
  rows.forEach((r) => {
    const status = r.status_normalized || "Not Specified";
    counts[status] = (counts[status] || 0) + 1;
  });
  
  return Object.entries(counts)
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);
}

function computeScopeAnalysis(rows) {
  const scopeMap = {};

  rows.forEach((r) => {
    if (!r.scope) return;
    const scopes = String(r.scope)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    scopes.forEach((scope) => {
      scopeMap[scope] = (scopeMap[scope] || 0) + 1;
    });
  });

  return Object.entries(scopeMap)
    .map(([scope, count]) => ({ scope, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

function computeSectorMechanismMatrix(rows) {
  const matrix = {};

  rows.forEach((r) => {
    const sector = shortSectorName(r.Sector || "Unknown");
    const type = r.mechanism_type_normalized || "Not Specified";

    if (!matrix[sector]) matrix[sector] = {};
    matrix[sector][type] = (matrix[sector][type] || 0) + 1;
  });

  // Get top mechanism types
  const typeTotals = {};
  Object.values(matrix).forEach((sectorData) => {
    Object.entries(sectorData).forEach(([type, count]) => {
      typeTotals[type] = (typeTotals[type] || 0) + count;
    });
  });

  const topTypes = Object.entries(typeTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([t]) => t);

  // Build chart data
  const chartData = Object.entries(matrix)
    .map(([sector, types]) => {
      const row = { sector };
      topTypes.forEach((t) => {
        row[t] = types[t] || 0;
      });
      return row;
    })
    .sort((a, b) => {
      const sumA = topTypes.reduce((acc, t) => acc + (a[t] || 0), 0);
      const sumB = topTypes.reduce((acc, t) => acc + (b[t] || 0), 0);
      return sumB - sumA;
    })
    .slice(0, 8);

  return { data: chartData, types: topTypes };
}

/* -----------------------------------------------------
   QuestionPage component
------------------------------------------------------ */
export function QuestionPage({ data = {}, filters = {}, setFilters = () => {}, onBack = () => {} }) {
  if (!data || !data.enriched) {
    return (
      <div className="p-6 bg-white border rounded shadow-sm text-center">
        <div className="text-slate-500">Loading data...</div>
      </div>
    );
  }

  const rows = data.enriched ?? [];
  const [selectedCompanies, setSelectedCompanies] = useState([]);

  React.useEffect(() => {
    setSelectedCompanies([]);
  }, [filters.sector, filters.capBucket]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (!r) return false;
      if (filters.sector && filters.sector !== "All" && r.Sector !== filters.sector) return false;
      if (filters.capBucket && filters.capBucket !== "All" && r.CapBucket !== filters.capBucket) return false;
      if (selectedCompanies.length > 0 && !selectedCompanies.includes(r.Company)) return false;
      return true;
    });
  }, [rows, filters, selectedCompanies]);

  const availableCompanies = useMemo(() => {
    const baseFiltered = rows.filter((r) => {
      if (!r) return false;
      if (filters.sector && filters.sector !== "All" && r.Sector !== filters.sector) return false;
      if (filters.capBucket && filters.capBucket !== "All" && r.CapBucket !== filters.capBucket) return false;
      return true;
    });

    const companies = new Set(
      baseFiltered.map((r) => r.Company).filter((c) => c && c !== "Unknown")
    );
    return Array.from(companies).sort();
  }, [rows, filters.sector, filters.capBucket]);

  // Computed visualizations
  const mechanismDist = useMemo(() => computeMechanismTypeDistribution(filtered), [filtered]);
  const actionDist = useMemo(() => computeActionCategoryDistribution(filtered), [filtered]);
  const policyRefs = useMemo(() => computeTopPolicyReferences(filtered), [filtered]);
  const statusDist = useMemo(() => computeStatusDistribution(filtered), [filtered]);
  const scopeAnalysis = useMemo(() => computeScopeAnalysis(filtered), [filtered]);
  const sectorMatrix = useMemo(() => computeSectorMechanismMatrix(filtered), [filtered]);

  const PALETTE = {
    themes: ["#2b83ba", "#abdda4", "#fdae61", "#d7191c", "#b35806", "#1f78b4", "#33a02c", "#fb9a99", "#e31a1c", "#b2df8a", "#a6cee3", "#cab2d6"],
    actions: ["#f6b26b", "#f79a4a", "#e76f51", "#c0392b", "#999999", "#14b8a6"],
    status: ["#e76f51", "#c0392b", "#999999", "#14b8a6", "#f6b26b", "#f79a4a"],
    orange: "#FFA500",
    activeBlue: "#176fb3",
  };

  return (
    <div className="space-y-8">
      {/* KPI Row */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-white border rounded-lg shadow-sm text-center">
          <div className="text-sm text-slate-500">Total companies</div>
          <div className="text-2xl font-semibold">{data.generalDf?.length ?? 0}</div>
        </div>
        <div className="p-4 bg-white border rounded-lg shadow-sm text-center">
          <div className="text-sm text-slate-500">Companies with responses</div>
          <div className="text-2xl font-semibold">
            {new Set(rows.filter((r) => r.Company !== "Unknown").map((r) => r.Company)).size}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="p-4 bg-white border rounded-lg shadow-sm space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm mb-1 text-slate-600">Sector</div>
            <select
              value={filters.sector || "All"}
              onChange={(e) => setFilters((p) => ({ ...p, sector: e.target.value }))}
              className="w-full border border-slate-300 p-2 rounded-lg focus:ring-2 focus:ring-sky-500"
            >
              {(data.sectors || ["All"]).map((s) => (
                <option key={s} value={s}>
                  {shortSectorName(s)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="text-sm mb-1 text-slate-600">Market cap</div>
            <select
              value={filters.capBucket || "All"}
              onChange={(e) => setFilters((p) => ({ ...p, capBucket: e.target.value }))}
              className="w-full border border-slate-300 p-2 rounded-lg focus:ring-2 focus:ring-sky-500"
            >
              {(data.capBuckets || ["All"]).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="text-sm text-slate-500">
          {filtered.length} mechanisms from {availableCompanies.length} companies match the filters!
        </div>
      </div>

      {/* Row 1: Mechanism Type + Actions Taken */}
      <div className="grid grid-cols-12 gap-4">
        {/* Mechanism Type Pie */}
        <div className="col-span-12 lg:col-span-6 bg-white border rounded shadow-sm p-4">
          <h3 className="text-sm font-semibold mb-3">Mechanism Type Distribution</h3>
          <div style={{ height: 320 }}>
            {mechanismDist.length > 0 ? (
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={mechanismDist}
                    dataKey="count"
                    nameKey="type"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                  >
                    {mechanismDist.map((entry, i) => (
                      <Cell key={i} fill={PALETTE.themes[i % PALETTE.themes.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend layout="vertical" verticalAlign="middle" align="right" />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-sm text-slate-500 flex items-center justify-center h-full">
                No data available.
              </div>
            )}
          </div>
        </div>

        {/* Actions Taken Classification */}
        <div className="col-span-12 lg:col-span-6 bg-white border rounded shadow-sm p-4">
          <h3 className="text-sm font-semibold mb-3">Actions Taken Classification</h3>
          <div style={{ height: 320 }}>
            {actionDist.length > 0 ? (
              <ResponsiveContainer>
                <BarChart data={actionDist}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="category"
                    tick={{ fontSize: 11 }}
                    angle={-45}
                    textAnchor="end"
                    height={90}
                    interval={0}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count">
                    {actionDist.map((entry, idx) => (
                      <Cell key={`cell-${idx}`} fill={PALETTE.actions[idx % PALETTE.actions.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-sm text-slate-500 flex items-center justify-center h-full">
                No data available.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 2: Policy References + Status */}
      <div className="grid grid-cols-12 gap-4">
        {/* Top Policy References */}
        <div className="col-span-12 lg:col-span-7 bg-white border rounded shadow-sm p-4">
          <h3 className="text-sm font-semibold mb-3">Top Policy References</h3>
          <div style={{ height: 320 }}>
            {policyRefs.length > 0 ? (
              <ResponsiveContainer>
                <BarChart data={policyRefs} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis
                    type="category"
                    dataKey="policy"
                    width={200}
                    fontSize={10}
                    tick={{ fill: "#475569" }}
                  />
                  <Tooltip />
                  <Bar dataKey="count" fill="#1a89e3" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-sm text-slate-500 flex items-center justify-center h-full">
                No policy data available.
              </div>
            )}
          </div>
        </div>

        {/* Status/Effectiveness */}
        <div className="col-span-12 lg:col-span-5 bg-white border rounded shadow-sm p-4">
          <h3 className="text-sm font-semibold mb-3">Status/Effectiveness</h3>
          <div style={{ height: 320 }}>
            {statusDist.length > 0 ? (
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={statusDist}
                    dataKey="count"
                    nameKey="status"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    innerRadius={50}
                    paddingAngle={2}
                  >
                    {statusDist.map((entry, i) => (
                      <Cell key={i} fill={PALETTE.status[i % PALETTE.status.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend layout="vertical" verticalAlign="middle" align="right" />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-sm text-slate-500 flex items-center justify-center h-full">
                No data available.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 3: Scope Coverage */}
      <div className="bg-white border rounded shadow-sm p-4">
        <h3 className="text-sm font-semibold mb-3">Scope Coverage Analysis</h3>
        <div style={{ height: 320 }}>
          {scopeAnalysis.length > 0 ? (
            <ResponsiveContainer>
              <BarChart data={scopeAnalysis} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis
                  type="category"
                  dataKey="scope"
                  width={150}
                  fontSize={12}
                />
                <Tooltip />
                <Bar dataKey="count" fill="#e31a56" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-sm text-slate-500 flex items-center justify-center h-full">
              No data available.
            </div>
          )}
        </div>
      </div>

      {/* Row 4: Sector-wise Mechanism Adoption */}
      <div className="bg-white border rounded shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Sector-wise Mechanism Adoption</h3>
          <div className="text-xs text-slate-500 italic">Top 8 sectors by response count</div>
        </div>
        <div style={{ height: 380 }}>
          {sectorMatrix.data.length > 0 ? (
            <ResponsiveContainer>
              <BarChart data={sectorMatrix.data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="sector"
                  angle={-45}
                  textAnchor="end"
                  height={120}
                  interval={0}
                  fontSize={11}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                {sectorMatrix.types.map((type, idx) => (
                  <Bar
                    key={type}
                    dataKey={type}
                    stackId="a"
                    fill={PALETTE.themes[idx % PALETTE.themes.length]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-sm text-slate-500 flex items-center justify-center h-full">
              No sector data available.
            </div>
          )}
        </div>
      </div>

      {/* Company Filter */}
      <div className="bg-white border rounded shadow-sm p-4">
        <div className="text-sm font-semibold mb-2">Filter by Company</div>

        <details className="border p-2 rounded bg-slate-50">
          <summary className="cursor-pointer text-sm text-slate-700">
            {`Selected Companies: ${selectedCompanies.length === 0 ? "All" : selectedCompanies.length}`}
          </summary>

          <div className="mt-3 max-h-60 overflow-auto space-y-3">
            <button
              onClick={(e) => {
                e.preventDefault();
                setSelectedCompanies([]);
              }}
              className="px-3 py-1.5 text-xs font-medium rounded-md border"
              style={{
                color: PALETTE.activeBlue,
                borderColor: PALETTE.activeBlue,
                background: "#ffffff",
              }}
            >
              Clear all
            </button>

            <div className="space-y-1">
              {availableCompanies.map((companyName) => (
                <label key={companyName} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedCompanies.includes(companyName)}
                    onChange={() => {
                      setSelectedCompanies((prev) => {
                        if (prev.includes(companyName)) {
                          return prev.filter((x) => x !== companyName);
                        } else {
                          return [...prev, companyName];
                        }
                      });
                    }}
                  />
                  {companyName}
                </label>
              ))}
              {availableCompanies.length === 0 && (
                <div className="text-sm text-slate-500 py-2">
                  No companies match the current filters.
                </div>
              )}
            </div>
          </div>
        </details>
      </div>

      {/* Company Responses Table */}
      <div className="bg-white border rounded shadow-sm p-4">
        <div className="text-sm font-semibold mb-3">Company-level responses (filtered)</div>
        <table className="w-full border-collapse">
          <thead className="bg-slate-50">
            <tr>
              <th className="p-3 text-xs text-left text-slate-500">Company</th>
              <th className="p-3 text-xs text-left text-slate-500">Sector</th>
              <th className="p-3 text-xs text-left text-slate-500">Cap</th>
              <th className="p-3 text-xs text-left text-slate-500">Mechanism Type</th>
              <th className="p-3 text-xs text-left text-slate-500">Status</th>
            </tr>
          </thead>
          <tbody>
            {Array.from(
              filtered
                .reduce((map, row) => {
                  if (!map.has(row.Company)) {
                    map.set(row.Company, row);
                  }
                  return map;
                }, new Map())
                .values()
            ).map((r, i) => (
              <tr key={i} className="hover:bg-slate-50">
                <td className="p-3 text-sm">{r.Company}</td>
                <td className="p-3 text-sm">{r.Sector}</td>
                <td className="p-3 text-sm">{r.CapBucket}</td>
                <td className="p-3 text-sm">{r.mechanism_type_normalized || "N/A"}</td>
                <td className="p-3 text-sm">{r.status_normalized || "N/A"}</td>
              </tr>
            ))}
            {Array.from(
              filtered
                .reduce((map, row) => {
                  if (!map.has(row.Company)) map.set(row.Company, row);
                  return map;
                }, new Map())
                .values()
            ).length === 0 && (
              <tr>
                <td colSpan={5} className="p-4 text-center text-slate-500">
                  No companies match current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}