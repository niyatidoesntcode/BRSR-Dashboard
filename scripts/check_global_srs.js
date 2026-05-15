const fs = require('fs');
const Papa = require('papaparse');

function normalizeCompany(name) {
  return String(name || '').trim().toLowerCase();
}

function parseNumber(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function loadRows(path) {
  const txt = fs.readFileSync(path, 'utf8');
  return Papa.parse(txt, { header: true, skipEmptyLines: true }).data || [];
}

const scorePath = './public/scores_p5_2024.csv';
const globalPath = './public/global_ranking_2024.csv';

const scoreRows = loadRows(scorePath).map(r => ({ Company: r.Company }));
const globalRows = loadRows(globalPath).map(r => {
  const raw = parseNumber(r.SRS);
  const norm = raw === null ? null : raw > 1 ? raw / 100 : raw;
  return { Company: r.Company, SRS: raw, NormalizedSRS: norm };
});

const map = new Map(globalRows.map(r => [normalizeCompany(r.Company), r]));

console.log('Checking first 20 companies from scores_p5_2024.csv for Global SRS mapping:\n');
scoreRows.slice(0, 20).forEach((row, i) => {
  const key = normalizeCompany(row.Company);
  const g = map.get(key);
  console.log(`${i + 1}. ${row.Company} -> GlobalSRS: ${g ? g.SRS : 'MISSING'}  (normalized: ${g ? g.NormalizedSRS : 'MISSING'})`);
});

// Summary stats
const totalScores = scoreRows.length;
const mapped = scoreRows.filter(r => map.has(normalizeCompany(r.Company))).length;
console.log(`\nMapped ${mapped}/${totalScores} companies from scores file to global ranking file.`);
