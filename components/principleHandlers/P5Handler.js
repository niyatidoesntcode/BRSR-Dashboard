// ./principleHandlers/P5Handler.js
import React, { useMemo } from "react";
import Papa from "papaparse";

/**
 * Load general disclosures only (P5 landing doesn’t need Q CSVs).
 */
export async function loadData({ generalCsvPath = "/GeneralDisclosures_df.csv" } = {}) {
  const res = await fetch(generalCsvPath);
  const text = await res.text();
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });

  const rows = parsed.data.filter(r => r.NameOfTheCompany || r.Sector);

  const sectors = ["All", ...new Set(rows.map(r => r.Sector).filter(Boolean))].sort();

  return { rows, sectors };
}

/**
 * Principle 5 Landing Page
 */
export function QuestionPage({ data = {}, filters = {}, setFilters = () => {}, onGoToQuestion = () => {} }) {
  if (!data || !data.rows || !Array.isArray(data.rows)) {
    return (
      <div className="p-6 bg-white rounded border text-center text-slate-500">
        Loading Principle 5...
      </div>
    );
  }

  const rows = data.rows;

  /** filtering (sector + search) */
  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (filters.sector !== "All" && r.Sector !== filters.sector) return false;

      if (filters.search?.trim()) {
        const s = filters.search.toLowerCase();
        const txt = String(r.NameOfTheCompany || r.Sector || "").toLowerCase();
        if (!txt.includes(s)) return false;
      }
      return true;
    });
  }, [rows, filters.sector, filters.search]);

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="bg-white p-4 border rounded">
        <h1 className="text-xl font-bold">Principle 5 — Human Rights</h1>
        <p className="text-sm text-slate-600 mt-1">
          Businesses should respect and promote human rights.
        </p>
      </div>
      {/* --- CLICKABLE CARDS (Section-B style) --- */}
      <div className="space-y-6">

        <div className="text-sm font-semibold text-slate-700">
          Essential Indicators
        </div>

        {/* EI5 */}
        <div
          onClick={() => onGoToQuestion("P5_Q5")}
          className="w-full rounded-lg p-4 cursor-pointer flex items-center justify-between hover:shadow-md hover:bg-slate-50 transition bg-white border"
        >
          <div className="text-sm text-slate-800 leading-snug">
            5. Describe the internal mechanisms in place to redress grievances related to human rights issues.
          </div>
          <div className="text-slate-400 text-lg">›</div>
        </div>

        {/* EI8 */}
        <div
          onClick={() => onGoToQuestion("P5_Q8")}
          className="w-full rounded-lg p-4 cursor-pointer flex items-center justify-between hover:shadow-md hover:bg-slate-50 transition bg-white border"
        >
          <div className="text-sm text-slate-800 leading-snug">
            8. Mechanisms to prevent adverse consequences to the complainant in discrimination and harassment cases.
          </div>
          <div className="text-slate-400 text-lg">›</div>
        </div>

        <div className="text-sm font-semibold text-slate-700 mt-4">
          Leadership Indicators
        </div>

        {/* LI1 */}
        <div
          onClick={() => onGoToQuestion("P5_Q1")}
          className="w-full rounded-lg p-4 cursor-pointer flex items-center justify-between hover:shadow-md hover:bg-slate-50 transition bg-white border"
        >
          <div className="text-sm text-slate-800 leading-snug">
            1. Details of a business process modified / introduced as a result of addressing human rights grievances.
          </div>
          <div className="text-slate-400 text-lg">›</div>
        </div>

        {/* LI2 */}
        <div
          onClick={() => onGoToQuestion("P5_Q2")}
          className="w-full rounded-lg p-4 cursor-pointer flex items-center justify-between hover:shadow-md hover:bg-slate-50 transition bg-white border"
        >
          <div className="text-sm text-slate-800 leading-snug">
            2. Details of the scope and coverage of any human rights due-diligence conducted.
          </div>
          <div className="text-slate-400 text-lg">›</div>
        </div>
      </div>
    </div>
  );
}
