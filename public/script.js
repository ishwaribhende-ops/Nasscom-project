const API = window.API_BASE || "";
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const inr = n => "₹" + Math.round(n).toLocaleString("en-IN");
const esc = s => String(s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

/* ---------- Navigation ---------- */
$$(".nav button").forEach(b => b.onclick = () => {
  $$(".nav button,.tab").forEach(x => x.classList.remove("active"));
  b.classList.add("active"); $("#" + b.dataset.tab).classList.add("active");
});

/* ---------- Form builder + validation ---------- */
const F = {
  elig: [
    ["name", "Full name", "text"], ["age", "Age", "number", 18, 80], ["income", "Monthly income (₹)", "number", 1, 10000000],
    ["emp", "Employment type", ["Salaried", "Self-employed", "Business"]], ["emis", "Existing EMIs / month (₹)", "number", 0, 10000000],
    ["type", "Loan type", ["Personal", "Home", "Car", "Education"]], ["amount", "Loan amount (₹)", "number", 10000, 500000000],
    ["tenure", "Tenure (years)", "number", 1, 30], ["score", "Credit score (300-900)", "number", 300, 900]],
  credit: [
    ["pay", "Payment history", [["1", "Always on time"], ["0.7", "1-2 late payments"], ["0.4", "Several late payments"], ["0.1", "Defaults / settlements"]]],
    ["util", "Credit utilization (%)", "number", 0, 100], ["age", "Credit age (years)", "number", 0, 50],
    ["inq", "Hard inquiries (last 2 yrs)", "number", 0, 50],
    ["mix", "Credit mix", [["1", "Cards + secured loans"], ["0.6", "Only one type"], ["0.3", "Very limited"]]]],
  emi: [["p", "Principal (₹)", "number", 1000, 500000000], ["r", "Interest rate (% p.a.)", "number", 0.1, 40], ["t", "Tenure (years)", "number", 1, 30]],
};
function build(id, label) {
  const f = $("#f-" + id);
  f.innerHTML = F[id].map(([k, l, t, min, max]) => `<div><label>${l}</label>` + (Array.isArray(t)
    ? `<select name="${k}">${t.map(o => Array.isArray(o) ? `<option value="${o[0]}">${o[1]}</option>` : `<option>${o}</option>`).join("")}</select>`
    : `<input name="${k}" type="${t}" ${min !== undefined ? `min="${min}" max="${max}" step="any"` : ""} data-l="${l}">`) + `<small class="err"></small></div>`).join("")
    + `<button class="btn">${label}</button>`;
  f.onsubmit = e => { e.preventDefault(); if (validate(f)) handlers[id](Object.fromEntries(new FormData(f))); };
}
function validate(f) {
  let ok = true;
  f.querySelectorAll("input").forEach(i => {
    const v = i.value.trim(); let m = "";
    if (!v) m = "Required";
    else if (i.type === "number") { const n = +v; if (isNaN(n)) m = "Enter a number"; else if (n < +i.min) m = `Minimum is ${i.min}`; else if (n > +i.max) m = `Maximum is ${i.max}`; }
    else if (v.length < 2) m = "Enter at least 2 characters";
    i.nextElementSibling.textContent = m; if (m) ok = false;
  });
  return ok;
}
build("elig", "Check Eligibility"); build("credit", "Analyze Score"); build("emi", "Calculate EMI");

/* ---------- Helpers ---------- */
function countUp(el, to, fmt = inr, ms = 1200) {
  const t0 = performance.now();
  (function step(t) { const p = Math.min((t - t0) / ms, 1); el.textContent = fmt(to * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(step); })(t0);
}
const emiOf = (p, annual, yrs) => { const r = annual / 1200, n = yrs * 12; return r === 0 ? p / n : p * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1); };
const maxLoan = (emi, annual, yrs) => { const r = annual / 1200, n = yrs * 12; return r === 0 ? emi * n : emi * (1 - Math.pow(1 + r, -n)) / r; };

async function ai(type, data) {
  try {
    const res = await fetch(API + "/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, data }) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(res.status === 429 ? "Rate limit reached — please wait a minute and retry." : j.error || "Something went wrong.");
    return j;
  } catch (e) { return { error: e.message === "Failed to fetch" ? "Cannot reach the server. Is the backend running?" : e.message }; }
}
function aiBlock(j) {
  if (j.error) return `<div class="alert">⚠️ ${esc(j.error)}</div>`;
  const s = (j.suggestions || []).map(x => `<li>${esc(x)}</li>`).join("");
  return `<div class="ai"><b>🤖 AI Advisor</b><br>${esc(j.explanation || "")}${s ? `<ul>${s}</ul>` : ""}</div>`;
}
async function withAI(box, type, payload) {
  const slot = box.querySelector(".ai-slot"); slot.innerHTML = `<p class="load">🤖 Analyzing your profile…</p>`;
  slot.innerHTML = aiBlock(await ai(type, payload));
}

/* ---------- 1. Eligibility ---------- */
const BASE = { Personal: 11, Home: 8.5, Car: 9, Education: 9.5 };
const handlers = {};
handlers.elig = d => {
  const n = k => +d[k], income = n("income"), emis = n("emis"), score = n("score"), age = n("age"), amount = n("amount"), yrs = n("tenure");
  let rate = BASE[d.type] + (score >= 800 ? 0 : score >= 750 ? 0.5 : score >= 700 ? 1.25 : 2.5) + (d.emp === "Salaried" ? 0 : 0.75);
  const cap = Math.max(0, income * 0.5 - emis), maxAmt = maxLoan(cap, rate, yrs), emi = emiOf(amount, rate, yrs);
  const foir = (emis + emi) / income * 100;
  const fails = [];
  if (age < 21 || age > 60) fails.push("Age must be between 21 and 60");
  if (income < 15000) fails.push("Minimum monthly income is ₹15,000");
  if (score < 650) fails.push("Credit score is below 650");
  if (foir > 50) fails.push(`FOIR ${foir.toFixed(1)}% exceeds the 50% limit`);
  if (yrs * 12 + age * 12 > 65 * 12) fails.push("Loan would end after age 65");
  const eligible = !fails.length, max = (age < 21 || age > 60 || income < 15000 || score < 650) ? 0 : maxAmt;
  const r = $("#r-elig");
  r.innerHTML = `<div class="glass"><span class="badge ${eligible ? "ok" : "no"}">${eligible ? "✅ Eligible" : "❌ Not Eligible"}</span>
    <div class="stats"><div class="stat"><small>Max eligible amount</small><b id="c1">0</b></div><div class="stat"><small>Est. interest rate</small><b id="c2">0</b></div>
    <div class="stat"><small>Estimated EMI</small><b id="c3">0</b></div><div class="stat"><small>FOIR</small><b id="c4">0</b></div></div>
    <small>FOIR usage (limit 50%)</small><div class="bar"><i id="fb"></i></div>
    ${fails.length ? `<ul>${fails.map(f => `<li>${f}</li>`).join("")}</ul>` : ""}<div class="ai-slot"></div></div>`;
  countUp($("#c1"), max); countUp($("#c2"), rate, v => v.toFixed(2) + "%"); countUp($("#c3"), emi); countUp($("#c4"), foir, v => v.toFixed(1) + "%");
  requestAnimationFrame(() => $("#fb").style.width = Math.min(foir / 50 * 100, 100) + "%");
  withAI(r, "eligibility", { ...d, name: undefined, eligible, reasons: fails, maxEligibleAmount: Math.round(max), estimatedRate: rate, foirPercent: +foir.toFixed(1) });
};

/* ---------- 2. Credit score ---------- */
handlers.credit = d => {
  const util = +d.util, age = +d.age, inq = +d.inq;
  const u = util <= 10 ? 1 : util <= 30 ? .85 : util <= 50 ? .6 : util <= 75 ? .3 : .1;
  const a = Math.min(age / 10, 1), q = Math.max(1 - inq * .15, 0);
  const w = .35 * +d.pay + .30 * u + .15 * a + .10 * q + .10 * +d.mix;
  const score = Math.round(300 + 600 * w);
  const band = score >= 800 ? ["Excellent", "#34d399"] : score >= 750 ? ["Very Good", "#86efac"] : score >= 650 ? ["Good", "#fbbf24"] : score >= 550 ? ["Fair", "#fb923c"] : ["Poor", "#f87171"];
  const pct = (score - 300) / 600 * 100, r = $("#r-credit");
  r.innerHTML = `<div class="glass"><div class="flex"><svg viewBox="0 0 200 120" width="280"><path d="M10 100A90 90 0 0 1 190 100" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="16" stroke-linecap="round" pathLength="100"/>
    <path class="arc" id="g" d="M10 100A90 90 0 0 1 190 100" fill="none" stroke="${band[1]}" stroke-width="16" stroke-linecap="round" pathLength="100" stroke-dasharray="0 100"/>
    <text id="gs" x="100" y="90" text-anchor="middle" fill="#fff" font-size="30" font-weight="700">300</text><text x="100" y="110" text-anchor="middle" fill="${band[1]}" font-size="13">${band[0]}</text></svg>
    <div><span class="badge" style="background:${band[1]}33;color:${band[1]}">${band[0]}</span><p style="color:var(--mut)">Estimated score (300–900). Actual bureau scores may differ.</p></div></div><div class="ai-slot"></div></div>`;
  requestAnimationFrame(() => $("#g").setAttribute("stroke-dasharray", `${pct} 100`));
  countUp($("#gs"), score, v => Math.round(v));
  withAI(r, "credit", { ...d, estimatedScore: score, band: band[0] });
};

/* ---------- 3. EMI ---------- */
handlers.emi = d => {
  const p = +d.p, rate = +d.r, n = +d.t * 12, emi = emiOf(p, rate, +d.t), total = emi * n, int = total - p, pp = p / total * 100;
  let bal = p, rows = "";
  for (let i = 1; i <= n; i++) { const it = bal * rate / 1200, pr = emi - it; bal = Math.max(bal - pr, 0); rows += `<tr><td>${i}</td><td>${inr(pr)}</td><td>${inr(it)}</td><td>${inr(bal)}</td></tr>`; }
  $("#r-emi").innerHTML = `<div class="glass"><div class="flex"><svg viewBox="0 0 42 42" width="190"><circle cx="21" cy="21" r="15.9" fill="none" stroke="#f472b6" stroke-width="6"/>
    <circle class="arc" id="dn" cx="21" cy="21" r="15.9" fill="none" stroke="#7c5cff" stroke-width="6" stroke-dasharray="0 100" transform="rotate(-90 21 21)"/></svg>
    <div class="stats" style="flex:1"><div class="stat"><small>Monthly EMI</small><b id="e1">0</b></div><div class="stat"><small>Total interest</small><b id="e2" style="color:#f472b6">0</b></div>
    <div class="stat"><small>Total payable</small><b id="e3">0</b></div></div></div>
    <small>🟣 Principal ${pp.toFixed(1)}% &nbsp; 🩷 Interest ${(100 - pp).toFixed(1)}%</small>
    <div class="tbl"><table><thead><tr><th>Month</th><th>Principal</th><th>Interest</th><th>Balance</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
  countUp($("#e1"), emi); countUp($("#e2"), int); countUp($("#e3"), total);
  requestAnimationFrame(() => $("#dn").setAttribute("stroke-dasharray", `${pp} ${100 - pp}`));
};

/* ---------- 4. Chat ---------- */
["How to improve my CIBIL score?", "Home loan vs personal loan?", "What is FOIR?", "Should I prepay my loan?", "How much emergency fund do I need?"]
  .forEach(t => { const b = document.createElement("button"); b.textContent = t; b.onclick = () => ask(t); $("#chips").append(b); });
async function ask(text) {
  text = text.trim(); if (!text) return;
  const log = $("#log"), add = (c, t) => { const m = document.createElement("div"); m.className = "msg " + c; m.textContent = t; log.append(m); log.scrollTop = log.scrollHeight; return m; };
  add("u", text); $("#q").value = ""; $("#send").disabled = true;
  const m = add("a", "Thinking…"); m.classList.add("load");
  const j = await ai("chat", text);
  m.classList.remove("load"); m.textContent = j.error ? "⚠️ " + j.error : j.explanation;
  $("#send").disabled = false;
}
$("#send").onclick = () => ask($("#q").value);
$("#q").onkeydown = e => { if (e.key === "Enter") ask($("#q").value); };
