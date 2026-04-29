"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";

// NOTE: handlers are expected at ./handlers/Q5Handler.js etc.
// Each handler should export:
//  - async function loadData(opts) { return dataObject; }
//  - React component QuestionPage({ data, filters, onBack, onGoToQuestion, handlersRegistry })
//
// Example:
// export async function loadData() { ... }
// export function QuestionPage(props) { return <div>...</div> }

import * as Q5Handler from "./questionHandlers/Q5Handler";
import * as Q6Handler from "./questionHandlers/Q6Handler";
import * as P1Handler from "./principleHandlers/P1Handler";
import * as P2Handler from "./principleHandlers/P2Handler";
import * as P3Handler from "./principleHandlers/P3Handler";
import * as P4Handler from "./principleHandlers/P4Handler";
import * as P5Handler from "./principleHandlers/P5Handler";
import * as P6Handler from "./principleHandlers/P6Handler";
import * as P7Handler from "./principleHandlers/P7Handler";
import * as P8Handler from "./principleHandlers/P8Handler";
import * as P9Handler from "./principleHandlers/P9Handler";

import * as P5Q5Handler from "./questionHandlers/P5Q5Handler";
import * as P5Q8Handler from "./questionHandlers/P5Q8Handler";
import * as P5Q1Handler from "./questionHandlers/P5Q1Handler";
import * as P5Q2Handler from "./questionHandlers/P5Q2Handler";
import * as P3QuantHandler from "./questionHandlers/P3QuantHandler";
import * as P3QuantTrialHandler from "./questionHandlers/P3QuantTrialHandler";

// Build a registry mapping qids -> handler module
const HANDLERS = {
  "5": Q5Handler,
  // add others as you implement them:
  "6": Q6Handler,
  // "7": Q7Handler,
  // ...
  "P1": P1Handler,
  "P2": P2Handler,
  "P3": P3Handler,
  "P4": P4Handler,
  "P5": P5Handler,
  "P6": P6Handler,
  "P7": P7Handler,
  "P8": P8Handler,
  "P9": P9Handler,
  "P5_Q5": P5Q5Handler,
  "P5_Q8": P5Q8Handler,
  "P5_Q1": P5Q1Handler,
  "P5_Q2": P5Q2Handler,
  "P3_Quant": P3QuantHandler,
  "P3_Quant_Trial": P3QuantTrialHandler,
};

const LOGO_PATH = "/logo.png";
const HEADER_HEIGHT = 72;
const SIDEBAR_WIDTH = 256;
const PALETTE = { activeBlue: "#176fb3" };

const PRINCIPLES = [
  { id: "P1", short: "Ethics & Transparency", name: "Businesses should conduct and govern themselves with integrity, and in a manner that is Ethical, Transparent and Accountable." },
  { id: "P2", short: "Sustainable & Safe Goods", name: "Businesses should provide goods and services in a manner that is sustainable and safe." },
  { id: "P3", short: "Employee Well-being", name: "Businesses should respect and promote the well-being of all employees, including those in their value chains." },
  { id: "P4", short: "Stakeholder Engagement", name: "Businesses should respect the interests of and be responsive to all its stakeholders." },
  { id: "P5", short: "Human Rights", name: "Businesses should respect and promote human rights." },
  { id: "P6", short: "Environment Protection", name: "Businesses should respect and make efforts to protect and restore the environment." },
  { id: "P7", short: "Public Policy", name: "Businesses, when engaging in influencing public and regulatory policy, should do so in a manner that is responsible and transparent." },
  { id: "P8", short: "Inclusive Growth", name: "Businesses should promote inclusive growth and equitable development." },
  { id: "P9", short: "Customer Value", name: "Businesses should engage with and provide value to their consumers in a responsible manner." },
];

const GD_QUESTIONS = [
  { id: "5", group: "Policy and management processes", title: "Specific commitments, goals and targets set by the entity with defined timelines, if any." },
  { id: "6", group: "Policy and management processes", title: "Performance of the entity against the specific commitments, goals and targets along-with reasons in case the same are not met." },
  { id: "7", group: "Governance, leadership and oversight", title: "Statement by director responsible for the business responsibility report, highlighting ESG related challenges, targets and achievements (listed entity has flexibility regarding the placement of this disclosure)" },
  { id: "8", group: "Governance, leadership and oversight", title: "Details of the highest authority responsible for implementation and oversight of the Business Responsibility policy(ies)." },
  { id: "9", group: "Governance, leadership and oversight", title: "Does the entity have a specified Committee of the Board/ Director responsible for decision making on sustainability related issues? If yes, provide details." },
];

export default function DashboardPrototype() {
  // Shell UI state
  const [selected, setSelected] = useState("gd-b");
  const [collapsed, setCollapsed] = useState(false);
  const [selectedPrinciple, setSelectedPrinciple] = useState("P1");

  // QUESTION handler state
  const [selectedQuestion, setSelectedQuestion] = useState(null); // "5", "6", ...
  const [handlerData, setHandlerData] = useState(null);
  const [handlerLoading, setHandlerLoading] = useState(false);
  const [handlerError, setHandlerError] = useState(null);

  // Common "filters" object passed to handlers (you can extend)
  const [filters, setFilters] = useState({
    sector: "All",
    capBucket: "All",
    ngramSize: 1,
    selectedCompanies: [],
    selectedTheme: null,
    themeCompareMode: "total",
    search: "",
  });

  // Font injection (keeps your previous font logic)
  useEffect(() => {
    const id = "ibm-plex-sans-css";
    if (!document.getElementById(id)) {
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;600;700&display=swap";
      document.head.appendChild(link);
    }
    document.documentElement.style.setProperty(
      "--dashboard-font-family",
      "'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', Roboto, Arial"
    );
  }, []);

  // When selectedQuestion changes, load data from its handler
  useEffect(() => {
    if (!selectedQuestion) {
      setHandlerData(null);
      setHandlerError(null);
      setHandlerLoading(false);
      return;
    }

    const handler = HANDLERS[selectedQuestion];
    if (!handler || typeof handler.loadData !== "function") {
      setHandlerData(null);
      setHandlerError(`No handler implemented for question ${selectedQuestion}`);
      setHandlerLoading(false);
      return;
    }

    let cancelled = false;
    setHandlerLoading(true);
    setHandlerError(null);
    setHandlerData(null);

    (async () => {
      try {
        // Allow handler to accept options if it needs (paths etc.)
        const data = await handler.loadData({
          // You can provide defaults here or let the handler decide
          generalCsvPath: "/GeneralDisclosures_df.csv",
          questionCsvPath: `/${selectedQuestion}.csv`,
        });
        if (!cancelled) {
          setHandlerData(data || {});
          setHandlerLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Handler load error:", err);
          setHandlerError(err?.message || String(err));
          setHandlerLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedQuestion]);

  function navTo(item) {
    setSelected(item);
    if (item?.startsWith?.("P")) setSelectedPrinciple(item);
    setSelectedQuestion(null);
  }

  function goToQuestion(qid) {
    setSelectedQuestion(qid);
    setSelected("gd-b");
    // reset handler states; loader will run via useEffect
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function backToSectionB() {
    setSelectedQuestion(null);
    setSelected("gd-b");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // UI helpers
  const activeBlue = PALETTE.activeBlue;
  const bannerColor = "#f1f6fb";
  // Determine which handler component to render
const HandlerComp =
selectedQuestion &&
HANDLERS[selectedQuestion] &&
HANDLERS[selectedQuestion].QuestionPage
  ? HANDLERS[selectedQuestion].QuestionPage
  : null;


  return (
    <div style={{ fontFamily: "var(--dashboard-font-family)" }} className="min-h-screen relative bg-slate-50 text-slate-800">
      {/* Header */}
      <header
        className="fixed left-0 right-0 top-0 z-50 flex items-center gap-4 px-4"
        style={{ height: HEADER_HEIGHT, background: "#ffffff", borderBottom: "1px solid rgba(226,232,240,0.9)" }}
      >
        <button
          aria-label="Toggle sidebar"
          title="Toggle sidebar"
          onClick={() => setCollapsed((prev) => !prev)}
          className="flex items-center justify-center p-2 rounded hover:bg-slate-100 transition"
          style={{ width: 44, height: 44 }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
            <rect x="3" y="6" width="18" height="2" rx="1" fill="#1f2937" />
            <rect x="3" y="11" width="18" height="2" rx="1" fill="#1f2937" />
            <rect x="3" y="16" width="18" height="2" rx="1" fill="#1f2937" />
          </svg>
        </button>

        <div className="flex items-center gap-3">
          <div style={{ width: 40, height: 40, position: "relative" }} className="rounded-md overflow-hidden bg-white">
            <Image src={LOGO_PATH} alt="logo" fill style={{ objectFit: "contain", padding: 4 }} />
          </div>

          <div>
            <div className="text-lg font-semibold text-slate-900">ESG Analytics Dashboard</div>
            <div className="text-xs text-slate-500 italic">Business Responsibility & Sustainability Reporting</div>
          </div>
        </div>
      </header>

      {/* layout */}
      <div style={{ paddingTop: HEADER_HEIGHT }} className="flex transition-all duration-300 ease-in-out">
        {/* Sidebar */}
        <aside
          className="bg-white border-r border-slate-200 overflow-hidden"
          style={{
            width: collapsed ? 0 : SIDEBAR_WIDTH,
            transition: "width 300ms cubic-bezier(.2,.9,.2,1)",
          }}
        >
          <div className="h-full flex flex-col p-4" style={{ minHeight: `calc(100vh - ${HEADER_HEIGHT}px)` }}>
            <div className={`transition-opacity duration-200 ease-in-out ${collapsed ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
              <div className="mb-6">
                <div className="text-sm text-slate-500 mb-2 font-medium">Main</div>

                <nav className="mb-4">
                  <button
                    onClick={() => navTo("overview")}
                    className={`w-full text-left py-2 pl-3 rounded-l-md ${selected === "overview" ? "bg-slate-100 text-[#176fb3] font-semibold" : "hover:bg-slate-50"}`}
                    style={selected === "overview" ? { borderLeft: `4px solid ${activeBlue}` } : {}}
                  >
                    <span className="text-[0.9rem]">Data Overview</span>
                  </button>

                  <button
                    onClick={() => navTo("gd-a")}
                    className={`w-full text-left py-2 pl-3 rounded-l-md mt-1 ${selected === "gd-a" ? "bg-slate-100 text-[#176fb3] font-semibold" : "hover:bg-slate-50"}`}
                    style={selected === "gd-a" ? { borderLeft: `4px solid ${activeBlue}` } : {}}
                  >
                    <span className="text-[0.9rem]">General Disclosures (Section A)</span>
                  </button>

                  <button
                    onClick={() => navTo("gd-b")}
                    className={`w-full text-left py-2 pl-3 rounded-l-md mt-1 ${selected === "gd-b" ? "bg-slate-100 text-[#176fb3] font-semibold" : "hover:bg-slate-50"}`}
                    style={selected === "gd-b" ? { borderLeft: `4px solid ${activeBlue}` } : {}}
                  >
                    <span className="text-[0.9rem]">Management &amp; Process Disclosures (Section B)</span>
                  </button>
                </nav>

                <div className="text-sm text-slate-500 mb-3 font-medium">Principles</div>
              </div>

              <nav className="flex-1 overflow-auto pr-2">
                {PRINCIPLES.map((p) => {
                  const active = selected === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => p.id === "P3" ? navTo(p.id) : goToQuestion(p.id)}
                      className={`w-full text-left py-3 pl-3 pr-2 rounded-l-md mb-1 ${active ? "bg-slate-100" : "hover:bg-slate-50"}`}
                      style={active ? { borderLeft: `4px solid ${activeBlue}` } : {}}
                    >
                      <div className="text-sm font-semibold flex items-center">
                        <span className={active ? "text-[#176fb3]" : "text-slate-800"}>{p.id}</span>
                        <span className="ml-2 text-sm font-medium text-slate-600 italic">– {p.short}</span>
                      </div>
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>
        </aside>

        {/* main content */}
        <main className="flex-1 min-h-[calc(100vh-72px)] overflow-auto transition-all duration-300 ease-in-out">
          <div style={{ background: bannerColor }} className="p-6 border-b border-slate-200">
            {selectedQuestion ? (
              <>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <button onClick={backToSectionB} className="inline-flex items-center gap-1 px-3 py-1 rounded-md text-[#176fb3] border hover:bg-blue-50 transition text-sm">← Back</button>
                    <div className="text-sm text-slate-500">Management &amp; Process Disclosures › Q{selectedQuestion}</div>
                  </div>
                </div>
                <h1 className="text-xl font-bold text-slate-900">{`${selectedQuestion} — ${GD_QUESTIONS.find(q => q.id === selectedQuestion)?.title || ""}`}</h1>
              </>
            ) : (
              <>
                {selected.startsWith("P") ? (
                  <>
                    <h1 className="text-xl font-bold text-slate-900">{selectedPrinciple} — {PRINCIPLES.find((x) => x.id === selectedPrinciple)?.name}</h1>
                    <div className="text-sm text-slate-600 mt-1">Explore quantitative and qualitative disclosures</div>
                  </>
                ) : selected === "gd-b" ? (
                  <>
                    <h1 className="text-xl font-bold text-slate-900">Management &amp; Process Disclosures (Section B)</h1>
                    <div className="text-sm text-slate-600 mt-1">Questions 5–9: commitments, performance, director's statement, oversight, committee</div>
                  </>
                ) : selected === "gd-a" ? (
                  <>
                    <h1 className="text-xl font-bold text-slate-900">General Disclosures (Section A)</h1>
                    <div className="text-sm text-slate-600 mt-1">Placeholder: core company info, operations, products and CSR.</div>
                  </>
                ) : (
                  <>
                    <h1 className="text-xl font-bold text-slate-900">Data Overview</h1>
                    <div className="text-sm text-slate-600 mt-1">Dataset summary & global KPIs</div>
                  </>
                )}
              </>
            )}
          </div>

          <div className="p-6">
            {selectedQuestion ? (
              // Render handler-provided page
              <>
                {handlerLoading && (
                  <div className="p-6 bg-white border rounded shadow-sm text-center">
                    Loading question {selectedQuestion}...
                  </div>
                )}

                {handlerError && (
                  <div className="p-6 bg-white border rounded shadow-sm text-red-600">
                    {handlerError}
                  </div>
                )}

                {!handlerLoading && !handlerError && HANDLERS[selectedQuestion] && HANDLERS[selectedQuestion].QuestionPage && (
                  // Render the handler's React component
                  <div>
                    {HandlerComp && (
                      <HandlerComp
                        data={handlerData}
                        filters={filters}
                        setFilters={setFilters}
                        onBack={backToSectionB}
                        onGoToQuestion={goToQuestion}
                        handlersRegistry={HANDLERS}
                      />
                    )}
                  </div>
                )}

                {!handlerLoading && !handlerError && !HANDLERS[selectedQuestion] && (
                  <div className="p-6 bg-white border rounded shadow-sm">
                    No handler implemented yet for Q{selectedQuestion}. Create <code>./handlers/Q{selectedQuestion}Handler.js</code> and export <code>loadData</code> and <code>QuestionPage</code>.
                  </div>
                )}
              </>
            ) : (
              // Normal non-question pages (overview, gd-a, gd-b, P*)
              <>
                {selected === "overview" && (
                  <div className="grid grid-cols-4 gap-4 mb-6">
                    <div className="p-4 bg-white rounded shadow-sm border border-slate-100">
                      <div className="text-sm text-slate-500">Companies</div>
                      <div className="text-2xl font-semibold">—</div>
                    </div>
                    <div className="p-4 bg-white rounded shadow-sm border border-slate-100">
                      <div className="text-sm text-slate-500">Years</div>
                      <div className="text-2xl font-semibold">—</div>
                    </div>
                    <div className="p-4 bg-white rounded shadow-sm border border-slate-100">
                      <div className="text-sm text-slate-500">Responses</div>
                      <div className="text-2xl font-semibold">—</div>
                    </div>
                    <div className="p-4 bg-white rounded shadow-sm border border-slate-100">
                      <div className="text-sm text-slate-500">Sectors</div>
                      <div className="text-2xl font-semibold">—</div>
                    </div>
                  </div>
                )}

                {selected === "gd-b" && (
                  <div className="space-y-8">
                    <div>
                      <h2 className="text-sm font-semibold text-slate-700 mb-3">Policy and management processes</h2>
                      <div className="space-y-3">
                        {GD_QUESTIONS.filter((q) => q.group === "Policy and management processes").map((q) => (
                          <div
                            key={q.id}
                            onClick={() => goToQuestion(q.id)}
                            className="w-full rounded-lg p-4 cursor-pointer flex items-center justify-between hover:shadow-md hover:bg-slate-50 transition"
                            style={{ background: "#ffffff", border: "1px solid transparent" }}
                          >
                            <div className="text-sm text-slate-800 leading-snug">{`${q.id}. ${q.title}`}</div>
                            <div className="text-slate-400 text-lg">›</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h2 className="text-sm font-semibold text-slate-700 mb-3">Governance, leadership and oversight</h2>
                      <div className="space-y-3">
                        {GD_QUESTIONS.filter((q) => q.group === "Governance, leadership and oversight").map((q) => (
                          <div
                            key={q.id}
                            onClick={() => goToQuestion(q.id)}
                            className="w-full rounded-lg p-4 cursor-pointer flex items-center justify-between hover:shadow-md hover:bg-slate-50 transition"
                            style={{ background: "#ffffff", border: "1px solid transparent" }}
                          >
                            <div className="text-sm text-slate-800 leading-snug">{`${q.id}. ${q.title}`}</div>
                            <div className="text-slate-400 text-lg">›</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {selected === "gd-a" && (
                  <div className="space-y-6">
                    <div className="p-4 bg-white rounded shadow-sm border border-slate-100">
                      <div className="text-sm text-slate-700 font-semibold mb-2">Section A — General Disclosures (placeholder)</div>
                      <div className="text-sm text-slate-600">This page is intentionally left as a structural placeholder. We'll add the A1–A7 items from the BRSR PDF here when you're ready.</div>
                    </div>
                  </div>
                )}

                {selected.startsWith("P") && (
                  <>
                    {HANDLERS[selected] && HANDLERS[selected].QuestionPage ? (
                      <div>
                        {React.createElement(HANDLERS[selected].QuestionPage, {
                          onGoToQuestion: goToQuestion,
                          data: null,
                          filters,
                          setFilters,
                        })}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="p-4 bg-white rounded shadow-sm border border-slate-100">
                          <div className="text-sm text-slate-500 mb-2">Summary</div>
                          <div className="text-lg font-semibold">{PRINCIPLES.find((p) => p.id === selectedPrinciple)?.short}</div>
                          <div className="text-sm text-slate-600 mt-1">{PRINCIPLES.find((p) => p.id === selectedPrinciple)?.name}</div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
