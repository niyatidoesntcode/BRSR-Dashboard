// components/principleHandlers/P3Handler.js
import React, { useState } from "react";

export function QuestionPage({ onGoToQuestion }) {
  const [activeTab, setActiveTab] = useState("qualitative");

  const PALETTE = {
    activeBlue: "#176fb3",
    lightGray: "#f1f6fb",
  };

  return (
    <div className="space-y-6">
      {/* Tab Buttons */}
      <div className="flex gap-3">
        <button
          onClick={() => setActiveTab("qualitative")}
          className={`px-6 py-3 rounded-lg font-semibold transition ${
            activeTab === "qualitative"
              ? "text-white"
              : "bg-white border border-slate-300 text-slate-700 hover:bg-slate-50"
          }`}
          style={
            activeTab === "qualitative"
              ? { backgroundColor: PALETTE.activeBlue }
              : {}
          }
        >
          Qualitative Data Analysis
        </button>

        <button
          onClick={() => setActiveTab("quantitative")}
          className={`px-6 py-3 rounded-lg font-semibold transition ${
            activeTab === "quantitative"
              ? "text-white"
              : "bg-white border border-slate-300 text-slate-700 hover:bg-slate-50"
          }`}
          style={
            activeTab === "quantitative"
              ? { backgroundColor: PALETTE.activeBlue }
              : {}
          }
        >
          Quantitative Data Visualisation
        </button>
      </div>

      {/* Qualitative Content */}
      {activeTab === "qualitative" && (
        <div className="space-y-4">
          <div
            className="p-6 rounded-lg border"
            style={{ backgroundColor: PALETTE.lightGray }}
          >
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              Qualitative Data Analysis
            </h3>
            <p className="text-slate-700 text-sm mb-4">
              This section contains text-based disclosures and insights extracted
              from langextract processing on employee well-being questions.
            </p>
            <p className="text-slate-600 text-sm mb-4">
              Analysis includes:
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm text-slate-600 ml-2">
              <li>Theme extraction and classification</li>
              <li>Key topic identification</li>
              <li>Company-specific commitments and policies</li>
              <li>Qualitative cross-sector comparisons</li>
            </ul>
            <div className="mt-6 p-4 bg-white rounded border border-slate-200">
              <p className="text-xs text-slate-500 mb-3">
                Qualitative content coming soon...
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Quantitative Content */}
      {activeTab === "quantitative" && (
        <div className="space-y-4">
          <div className="p-6 bg-white rounded-lg border shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              Quantitative Data Visualisation
            </h3>
            <p className="text-slate-700 text-sm mb-4">
              Explore 302 numerical metrics across 1,115 companies and 21 sectors.
              Includes employee counts, percentages, gender diversity, employment
              status breakdowns, and more.
            </p>
            <p className="text-slate-600 text-sm mb-6">
              Features:
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm text-slate-600 ml-2 mb-6">
              <li>Sector-wise filtering and comparison</li>
              <li>Company-level drill-down analysis</li>
              <li>Metric trends and distributions</li>
              <li>Peer benchmarking (company vs sector average)</li>
              <li>Interactive visualizations with Recharts</li>
            </ul>

            <button
              onClick={() => onGoToQuestion("P3_Quant")}
              className="px-6 py-3 rounded-lg font-semibold text-white transition"
              style={{ backgroundColor: PALETTE.activeBlue }}
            >
              Open Quantitative Dashboard →
            </button>

            <button
              onClick={() => onGoToQuestion("P3_Quant_Trial")}
              className="ml-3 px-6 py-3 rounded-lg font-semibold border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 transition"
            >
              Open Trial Quant Page (Flattened CSV) →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
