import { uuid, getAll, getOne, save, remove, getByIndex } from "./db.js";

const PLANIMETRIE_MI_BERSAGLIO = [
  "Piano -2",
  "Piano -1",
  "Piano 0",
  "Piano 1",
  "Piano 2",
  "Piano 3",
  "Piano 4",
  "Piano 5",
  "Piano copertura"
];

const app = document.getElementById("app");
const tabHome = document.getElementById("tabHome");
const tabInfo = document.getElementById("tabInfo");
const tabPlanimetrie = document.getElementById("tabPlanimetrie");
const tabSale = document.getElementById("tabSale");
const tabAsset = document.getElementById("tabAsset");
const tabsBar = document.getElementById("tabs");
const topbarTitle = document.getElementById("topbarTitle");

const BLUE = "rgb(0, 70, 145)";

// ===== PREFERITI =====
function getPreferiti() {
  return JSON.parse(localStorage.getItem("preferiti_centrali") || "[]");
}

function setPreferiti(list) {
  localStorage.setItem("preferiti_centrali", JSON.stringify(list));
}

function isPreferita(id) {
  return getPreferiti().includes(id);
}

function togglePreferita(id) {
  const pref = getPreferiti();

  if (pref.includes(id)) {
    setPreferiti(pref.filter(x => x !== id));
  } else {
    pref.push(id);
    setPreferiti(pref);
  }
}

/* =========================
   ANAGRAFICA CENTRALI (READ-ONLY)
========================= */
let CENTRALI = [];

async function loadCentrali() {
  const res = await fetch("./centrali.json");
  CENTRALI = await res.json();
}

function getCentraleById(id) {
  return CENTRALI.find(c => c.id === id) || null;
}

/* =========================
   STATO APP
========================= */
let currentCentraleId = null; // centrale selezionata per consistenza

// Draft per mantenere i dati durante la creazione
let draftAsset = null;
let draftSala = null;

/* =========================
   CATEGORIE E CAMPI TECNICI
========================= */
const CATEGORY_DEFS = {
  TRASFORMATORE: { label: "Trasformatore", fields: [
    { key: "tagliaKVA", label: "Taglia", unit: "kVA" },
    { key: "tensionePrimV", label: "Tensione primaria", unit: "V" },
    { key: "tensioneSecV", label: "Tensione secondaria", unit: "V" }
  ]},
  QEGBT: { label: "QEGBT", fields: [] },
  GE: { label: "GE", fields: [{ key: "tagliaKVA", label: "Taglia", unit: "kVA" }] },

  SE: { label: "SE", fields: [
    { key: "caricoA", label: "Carico", unit: "A" },
    { key: "tensioneV", label: "Tensione", unit: "V" },
    { key: "tagliaA", label: "Taglia", unit: "A" },
    { key: "potenzaKW", label: "Potenza", unit: "kW" } // calcolata
  ]},

  UPS: { label: "UPS", fields: [
    { key: "caricoKW", label: "Carico", unit: "kW" },
    { key: "tagliaKVA", label: "Taglia", unit: "kVA" }
  ]},

  BATTERIE: { label: "Batterie", fields: [
    { key: "tensioneElemV", label: "Tensione degli elementi", unit: "V" },
    { key: "elementiBatt", label: "Elementi di batteria", unit: "n" },
    { key: "capacitaAh", label: "Capacità", unit: "Ah" }
  ]},

  GF: { label: "GF", fields: [{ key: "tagliaKWf", label: "Taglia", unit: "kWf" }] },
  CDZ: { label: "CDZ", fields: [{ key: "tagliaKWf", label: "Taglia", unit: "kWf" }] },
  FC: { label: "FC", fields: [{ key: "tagliaMCH", label: "Taglia", unit: "mc/h" }] }
};

// Routing
let route = { view: "home" }; // home | centraliList | consistenzaList | info | saleList | saleDetail | assetList | assetDetail
let assetCategoryFilter = null;

/* =========================
   TAB HANDLERS (solo in consistenza)
========================= */
tabHome.onclick = () => { currentCentraleId = null; route = { view: "centraliHome" }; setActiveTab(null); render();};
tabInfo.onclick  = () => { if (!currentCentraleId) return; route = { view: "info" }; setActiveTab("info"); render(); };
tabPlanimetrie.onclick = () => {if (!currentCentraleId) return; route = { view: "planimetrie" }; setActiveTab("planimetrie"); render();};
tabSale.onclick  = () => { if (!currentCentraleId) return; route = { view: "saleList" }; setActiveTab("sale"); render(); };
tabAsset.onclick = () => { if (!currentCentraleId) return; route = { view: "assetList" }; setActiveTab("asset"); render(); };

setActiveTab(null);

loadCentrali().then(() => {
  render();
});

/* =========================
   UTIL
========================= */
function setActiveTab(which) {
  tabInfo.classList.toggle("active", which === "info");
  tabPlanimetrie.classList.toggle("active", which === "planimetrie");
  tabSale.classList.toggle("active", which === "sale");
  tabAsset.classList.toggle("active", which === "asset");
}

function setChrome() {
  const inConsistenza =
    !!currentCentraleId &&
    ["info","planimetrie","saleList","saleDetail","assetList","assetDetail"].includes(route.view);

  // tabs visibili solo in consistenza
  tabsBar.classList.toggle("tabs-hidden", !inConsistenza);

  // ✅ NUOVA LOGICA TITOLO
  if (inConsistenza) {
    const c = getCentraleById(currentCentraleId);
    topbarTitle.textContent = (c?.nome || "").toUpperCase();
  } else {
    topbarTitle.textContent = ""; // 🔴 vuoto fuori dalla consistenza
  }

}


async function updateTabCounts() {
  const inConsistenza =
    !!currentCentraleId &&
    ["info","saleList","saleDetail","assetList","assetDetail"].includes(route.view);
  if (!inConsistenza) return;

  const saleAll = await getAll("sale");
  const assetAll = await getAll("asset");

  const sale = saleAll.filter(s => (s.centraleId || "MI_BERSAGLIO") === currentCentraleId);
  const asset = assetAll.filter(a => (a.centraleId || "MI_BERSAGLIO") === currentCentraleId);

  tabSale.textContent  = `Sale (${sale.length})`;
  tabAsset.textContent = `Asset (${asset.length})`;
}

function parseNumber(value) {
  if (value == null) return null;
  const v = String(value).trim().replace(",", ".");
  if (v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  if (n < 0) return null;
  return n;
}

// =========================
// BATTERIE - Catalogo (da contratto Hoppecke) + Peukert

// =========================
const BATTERY_CATALOG = {
  HOPPECKE: {
    // ELI / Vaso aperto - elementi 2V
    "ELI - Vaso aperto (Elemento 2V)": { unitV: 2, tagsAhC10: [300,600,800,1000,1500,2000,2500,3000,3500] },

    // GEL - elementi 2V
    "GEL (Elemento 2V)": { unitV: 2, tagsAhC10: [300,600,800,1000,1500,2000,2500,3000] },

    // AGM - elementi 2V (anche “per UPS” nel file, ma le taglie sono queste)
    "AGM (Elemento 2V)": { unitV: 2, tagsAhC10: [200,300,500] },

    // AGM - monoblocchi 12V (attacchi standard/superiori)
    "AGM (Monoblocco 12V standard/superiori)": { unitV: 12, tagsAhC10: [25,37,50,75,100,150] },

    // AGM - monoblocchi 12V (attacchi frontali)
    "AGM (Monoblocco 12V frontali)": { unitV: 12, tagsAhC10: [38,60,100,150] },

    // Piombo puro - elementi 2V
    "Piombo puro (Elemento 2V)": { unitV: 2, tagsAhC10: [300,600,800,1000,1500,2000,2500,3000] },

    // Piombo puro - monoblocchi 12V frontali
    "Piombo puro (Monoblocco 12V frontali)": { unitV: 12, tagsAhC10: [100,150] }
  }
};

// Legge di Peukert per ricavare la C10 equivalente richiesta
// Formula usata: C10 = 10 * ((I^n * t) / 10)^(1/n)
// (deriva dall’idea che a C10 la corrente nominale è C10/10 e vale la relazione I^n*t = costante)
function calcC10requiredPeukert(I, tHours, n) {
  if (!Number.isFinite(I) || I <= 0) return null;
  if (!Number.isFinite(tHours) || tHours <= 0) return null;
  if (!Number.isFinite(n) || n < 1) return null;
  return 10 * Math.pow((Math.pow(I, n) * tHours) / 10, 1 / n);
}

function getKfromHours(T) {
  // Tabella K da manuale FiberCop (in base alla durata T) 
  if (T <= 3) return 0.5;
  if (T <= 5) return 0.7;
  if (T < 9) return 0.8;
  return 1;
}

function getElemVoltageByType(tipo) {
  // Solo per output "numero elementi" (tipo batteria NON influenza il calcolo capacità, per scelta A)
  if (tipo === "ELI") return 2;     // elementi 2V tipici
  if (tipo === "AGM") return 12;    // monoblocchi 12V tipici
  if (tipo === "GEL") return 12;    // monoblocchi 12V tipici
  return null;                      // Litio: dipende dal pack/cella → non assumiamo
}

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* =========================
   ROUTER
========================= */
async function render() {
  setChrome();
  await updateTabCounts();

  if (route.view === "home") return renderMainHome();
  if (route.view === "centraliHome") return renderHome();
  if (route.view === "calcoli") return renderCalcoli();
  if (route.view === "calcoliCavi") return renderCalcoliCavi();
  if (route.view === "calcoliCaviImax") return renderCalcoliCaviImax();
  if (route.view === "calcoliBatterie") return renderCalcoliBatterie();
  if (route.view === "centraliList") return renderCentraliList();
  if (route.view === "consistenzaList") return renderConsistenzaList();
  if (route.view === "preferiti") return renderPreferiti();
  if (route.view === "info") return renderInfo();
  if (route.view === "planimetrie") return renderPlanimetrie();
  if (route.view === "saleList") return renderSaleList();
  if (route.view === "saleDetail") return renderSaleDetail(route.id);
  if (route.view === "assetList") return renderAssetList();
  if (route.view === "assetDetail") return renderAssetDetail(route.id, route.presetSalaId || null);
}

function goToMainHome() {
  route = { view: "home" };
  render();
}

function renderMainHome() {
  currentCentraleId = null;
  setActiveTab(null);

  app.innerHTML = `
    <div class="home-wrap">
      <div class="home-actions">

        <button class="home-action" id="btn_centrali">
          <div class="title">Centrali</div>
        </button>

        <button class="home-action" id="btn_calcoli">
          <div class="title">Calcoli</div>
        </button>

      </div>
    </div>
  `;

  document.getElementById("btn_centrali").onclick = () => {
    route = { view: "centraliHome" };   // ✅ entra nella tua home attuale
    render();
  };

  document.getElementById("btn_calcoli").onclick = () => {
    route = { view: "calcoli" };        // ✅ placeholder
    render();
  };
}

function renderCalcoli() {
  app.innerHTML = `
    <div class="header-row">
      <button class="smallBtn" id="btn_back_main">🏠</button>
      <h2>Calcoli</h2>
    </div>

    <div class="cardBox">
      <div class="sectionTitle">Strumenti disponibili</div>

      <div class="listItem">
        <div>
          <div class="cardTitle">Sezione cavi</div>
        </div>
        <button class="smallBtn" id="btn_cavi">Apri</button>
      </div>
      <div class="listItem">
        <div>
          <div class="cardTitle">Corrente massima</div>
        </div>
        <button class="smallBtn" id="btn_cavi_imax">Apri</button>
      </div>
      <div class="listItem">
        <div>
          <div class="cardTitle">Capacità batterie</div>
        </div>
        <button class="smallBtn" id="btn_batt">Apri</button>
      </div>

    </div>
  `;

  document.getElementById("btn_back_main").onclick = goToMainHome;

  document.getElementById("btn_cavi").onclick = () => {
    route = { view: "calcoliCavi" };
    render();
  };
  document.getElementById("btn_cavi_imax").onclick = () => {
    route = { view: "calcoliCaviImax" };
    render();
  };
  document.getElementById("btn_batt").onclick = () => {
    route = { view: "calcoliBatterie" };
    render();
  };
}

function renderCalcoliCavi() {
  app.innerHTML = `
    <div class="header-row">
      <button class="smallBtn" id="btn_back">←</button>
      <button class="smallBtn" id="btn_home">🏠</button>
      <h2>Sezione cavi</h2>
    </div>

    <div class="cardBox">
      <div class="sectionTitle">Input</div>

      <div class="formRow">
        <label>Corrente</label>
        <div class="specInput">
          <input id="cavi_I" type="number" step="any" inputmode="decimal" >
          <span class="unit">A</span>
        </div>
      </div>

      <div class="formRow">
        <label>Lunghezza linea</label>
        <div class="specInput">
          <input id="cavi_L" type="number" step="any" inputmode="decimal" >
          <span class="unit">m</span>
        </div>
      </div>

      <div class="formRow">
        <label>Tensione nominale linea (Vn)</label>
        <div class="specInput">
          <input id="cavi_Vn" type="number" step="any" inputmode="decimal" >
          <span class="unit">V</span>
        </div>
        <div class="cardSub">Serve per calcolare ΔV% e per il warning.</div>
      </div>

      <div class="formRow">
        <label>Materiale</label>
        <select id="cavi_mat">
          <option value="CU">Rame</option>
          <option value="AL">Alluminio</option>
        </select>
      </div>

      <div class="cardBox innerBox">
        <div class="sectionTitle">Limite caduta ammessa</div>

        <div class="formRow">
          <label>Modalità limite</label>
          <select id="cavi_mode">
            <option value="V">ΔV max (V)</option>
            <option value="PCT" selected>ΔV% max</option>
          </select>
        </div>

        <div class="formRow" id="row_dVperc">
          <label>ΔV max</label>
          <div class="specInput">
            <input id="cavi_dVperc" type="number" step="any" inputmode="decimal" >
            <span class="unit">%</span>
          </div>
        </div>

        <div class="formRow" id="row_dVvolt" style="display:none;">
          <label>ΔV max</label>
          <div class="specInput">
            <input id="cavi_dV" type="number" step="any" inputmode="decimal" placeholder="Es. 2">
            <span class="unit">V</span>
          </div>
        </div>
      </div>

      <button class="primaryBtn" id="btn_calc">Calcola</button>
    </div>

    <div class="cardBox" id="result_box" style="display:none;">
      <div class="sectionTitle">Risultato</div>

      <div class="pill" id="warn_pill">—</div>

      <div class="kv">
        <span>Resistività ρ (Ω·mm²/m)</span>
        <b id="res_rho">—</b>
      </div>

      <div class="kv">
        <span>Sezione calcolata (teorica)</span>
        <b id="res_S" style="font-size:18px;">—</b>
      </div>

      <div class="kv">
        <span>Sezione commerciale consigliata</span>
        <b id="res_std" style="color:green;">—</b>
      </div>

      <div class="kv">
        <span>ΔV ammessa</span>
        <b id="res_dVmax">—</b>
      </div>

      <div class="kv">
        <span>ΔV effettiva (su sezione commerciale)</span>
        <b id="res_dVeff">—</b>
      </div>

      <div class="kv">
        <span>ΔV% effettiva</span>
        <b id="res_dVeffPerc">—</b>
      </div>

      <div class="kv">
        <span>Resistenza linea (Ω)</span>
        <b id="res_R">—</b>
      </div>

      <div class="cardSub" id="res_note"></div>
    </div>
  `;

  // NAVIGAZIONE
  document.getElementById("btn_home").onclick = goToMainHome;
  document.getElementById("btn_back").onclick = () => {
    route = { view: "calcoli" };
    render();
  };

  // UI: mostra/nasconde campi ΔV% / ΔV(V)
  function syncModeUI() {
    const mode = document.getElementById("cavi_mode").value;
    const rowPerc = document.getElementById("row_dVperc");
    const rowVolt = document.getElementById("row_dVvolt");
    if (mode === "PCT") {
      rowPerc.style.display = "";
      rowVolt.style.display = "none";
    } else {
      rowPerc.style.display = "none";
      rowVolt.style.display = "";
    }
  }
  document.getElementById("cavi_mode").addEventListener("change", () => {
    syncModeUI();
    calcola(); // ricalcola se possibile
  });
  syncModeUI();

  function setPill(state, text) {
    const pill = document.getElementById("warn_pill");
    pill.classList.remove("pill-ok", "pill-warn", "pill-bad");
    pill.textContent = text;
    if (state === "ok") pill.classList.add("pill-ok");
    else if (state === "warn") pill.classList.add("pill-warn");
    else if (state === "bad") pill.classList.add("pill-bad");
  }

  function calcola() {
    const I  = parseNumber(document.getElementById("cavi_I").value);
    const L  = parseNumber(document.getElementById("cavi_L").value);
    const Vn = parseNumber(document.getElementById("cavi_Vn").value);
    const mat = document.getElementById("cavi_mat").value;

    // Se non ho i dati base, non faccio nulla (evita alert mentre digiti)
    if (I == null || I <= 0) return;
    if (L == null || L <= 0) return;
    if (Vn == null || Vn <= 0) return;

    const mode = document.getElementById("cavi_mode").value;

    // Resistività (Ω·mm²/m @20°C) [2](https://www.prontuarionline.it/resistivita-rame/)[3](https://www.chimica-online.it/fisica/resistivita-alluminio.htm)
    const rho = (mat === "CU") ? 0.0175 : 0.0282;

    // Limiti: ricavo sempre dVmax (V) e dVmax% (%)
    let dVmaxV = null;
    let dVmaxPct = null;

    if (mode === "PCT") {
      dVmaxPct = parseNumber(document.getElementById("cavi_dVperc").value);
      if (dVmaxPct == null || dVmaxPct <= 0) return;
      dVmaxV = (Vn * dVmaxPct) / 100;
    } else {
      dVmaxV = parseNumber(document.getElementById("cavi_dV").value);
      if (dVmaxV == null || dVmaxV <= 0) return;
      dVmaxPct = (dVmaxV / Vn) * 100;
    }

    // Sezione teorica: S = (2 * rho * L * I) / dVmaxV
    const S = (2 * rho * L * I) / dVmaxV;

    // Sezioni standard
    const standard = [1.5,2.5,4,6,10,16,25,35,50,70,95,120,150,185,240,300];
    const Sstd = standard.find(x => x >= S) || null;

    // ΔV effettiva usando la sezione commerciale scelta
    // ΔVeff = 2 * rho * L * I / Sstd
    const Suse = Sstd ?? S; // fallback se >300
    const dVeffV = (2 * rho * L * I) / Suse;
    const dVeffPct = (dVeffV / Vn) * 100;

    // Warning: OK / vicino / fuori
    // "Vicino" = entro +10% del limite (scelta UX, non normativa)
    const nearThreshold = dVmaxPct * 1.10;
    let state = "ok";
    let text = "OK: entro il limite";
    if (dVeffPct > nearThreshold) {
      state = "bad";
      text = "FUORI LIMITE: aumenta sezione o riduci lunghezza/corrente";
    } else if (dVeffPct > dVmaxPct) {
      state = "warn";
      text = "VICINO/FUORI LIMITE: sei oltre il limite impostato";
    }

    document.getElementById("result_box").style.display = "block";
    setPill(state, text);

    document.getElementById("res_rho").textContent = rho.toFixed(4);
    document.getElementById("res_S").textContent = S.toFixed(2) + " mm²";
    document.getElementById("res_std").textContent = (Sstd ? (Sstd + " mm²") : ">300 mm²");

    document.getElementById("res_dVmax").textContent =
      `${dVmaxV.toFixed(2)} V  (${dVmaxPct.toFixed(2)}%)`;

    document.getElementById("res_dVeff").textContent =
      `${dVeffV.toFixed(2)} V`;

    document.getElementById("res_dVeffPerc").textContent =
      `${dVeffPct.toFixed(2)} %`;

    const R = dVeffV / I; // Rline effettiva (Ω)
    document.getElementById("res_R").textContent = R.toFixed(3) + " Ω";

    const marginPct = dVmaxPct - dVeffPct;
    document.getElementById("res_note").textContent =
      `Margine: ${marginPct >= 0 ? "+" : ""}${marginPct.toFixed(2)}% rispetto al limite impostato.`;
  }

  // EVENTI
  document.getElementById("btn_calc").onclick = () => {
    // qui possiamo mostrare alert se mancano campi (solo al click)
    const I  = parseNumber(document.getElementById("cavi_I").value);
    const L  = parseNumber(document.getElementById("cavi_L").value);
    const Vn = parseNumber(document.getElementById("cavi_Vn").value);

    if (I == null || I <= 0) return alert("Inserisci una corrente valida (>0 A).");
    if (L == null || L <= 0) return alert("Inserisci una lunghezza valida (>0 m).");
    if (Vn == null || Vn <= 0) return alert("Inserisci una tensione nominale valida (>0 V).");

    const mode = document.getElementById("cavi_mode").value;
    if (mode === "PCT") {
      const p = parseNumber(document.getElementById("cavi_dVperc").value);
      if (p == null || p <= 0) return alert("Inserisci un ΔV% max valido (>0).");
    } else {
      const v = parseNumber(document.getElementById("cavi_dV").value);
      if (v == null || v <= 0) return alert("Inserisci un ΔV max (V) valido (>0).");
    }

    calcola();
  };

  ["cavi_I","cavi_L","cavi_Vn","cavi_mat","cavi_dVperc","cavi_dV"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", calcola);
  });
}

function renderCalcoliCaviImax() {
  app.innerHTML = `
    <div class="header-row">
      <button class="smallBtn" id="btn_back">←</button>
      <button class="smallBtn" id="btn_home">🏠</button>
      <h2>Corrente massima</h2>
    </div>

    <div class="cardBox">
      <div class="sectionTitle">Input</div>

      <div class="formRow">
        <label>Sezione cavo</label>
        <div class="specInput">
          <input id="imax_S" type="number" step="any" inputmode="decimal" >
          <span class="unit">mm²</span>
        </div>
      </div>

      <div class="formRow">
        <label>Lunghezza linea</label>
        <div class="specInput">
          <input id="imax_L" type="number" step="any" inputmode="decimal" >
          <span class="unit">m</span>
        </div>
      </div>

      <div class="formRow">
        <label>Tensione nominale linea (Vn)</label>
        <div class="specInput">
          <input id="imax_Vn" type="number" step="any" inputmode="decimal" >
          <span class="unit">V</span>
        </div>
      </div>

      <div class="formRow">
        <label>Materiale</label>
        <select id="imax_mat">
          <option value="CU">Rame</option>
          <option value="AL">Alluminio</option>
        </select>
      </div>

      <div class="cardBox innerBox">
        <div class="sectionTitle">Limite caduta ammessa</div>

        <div class="formRow">
          <label>Modalità limite</label>
          <select id="imax_mode">
            <option value="PCT" selected>ΔV% max</option>
            <option value="V">ΔV max (V)</option>
          </select>
        </div>

        <div class="formRow" id="imax_row_pct">
          <label>ΔV max</label>
          <div class="specInput">
            <input id="imax_dVperc" type="number" step="any" inputmode="decimal" >
            <span class="unit">%</span>
          </div>
        </div>

        <div class="formRow" id="imax_row_v" style="display:none;">
          <label>ΔV max</label>
          <div class="specInput">
            <input id="imax_dV" type="number" step="any" inputmode="decimal" >
            <span class="unit">V</span>
          </div>
        </div>
      </div>

      <button class="primaryBtn" id="btn_calc_imax">Calcola</button>
    </div>

    <div class="cardBox" id="imax_out" style="display:none;">
      <div class="sectionTitle">Risultato</div>

      <div class="pill" id="imax_pill">—</div>

      <div class="kv">
        <span>Resistività ρ (Ω·mm²/m)</span>
        <b id="imax_rho">—</b>
      </div>

      <div class="kv">
        <span>ΔV ammessa</span>
        <b id="imax_dVmax">—</b>
      </div>

      <div class="kv">
        <span>Resistenza linea (andata+ritorno)</span>
        <b id="imax_Rline">—</b>
      </div>

      <div class="kv">
        <span>Corrente massima (Imax)</span>
        <b id="imax_I" style="font-size:18px;">—</b>
      </div>

      <div class="cardSub" id="imax_note"></div>
    </div>
  `;

  // NAVIGAZIONE
  document.getElementById("btn_home").onclick = goToMainHome;
  document.getElementById("btn_back").onclick = () => {
    route = { view: "calcoli" };
    render();
  };

  // UI: switch ΔV% / ΔV(V)
  function syncModeUI() {
    const mode = document.getElementById("imax_mode").value;
    document.getElementById("imax_row_pct").style.display = (mode === "PCT") ? "" : "none";
    document.getElementById("imax_row_v").style.display   = (mode === "V") ? "" : "none";
  }
  document.getElementById("imax_mode").addEventListener("change", () => {
    syncModeUI();
    calcola();
  });
  syncModeUI();

  function setPill(state, text) {
    const pill = document.getElementById("imax_pill");
    pill.classList.remove("pill-ok", "pill-warn", "pill-bad");
    pill.textContent = text;
    if (state === "ok") pill.classList.add("pill-ok");
    else if (state === "warn") pill.classList.add("pill-warn");
    else if (state === "bad") pill.classList.add("pill-bad");
  }

  function calcola() {
    const S  = parseNumber(document.getElementById("imax_S").value);
    const L  = parseNumber(document.getElementById("imax_L").value);
    const Vn = parseNumber(document.getElementById("imax_Vn").value);
    const mat = document.getElementById("imax_mat").value;

    if (S == null || S <= 0) return;
    if (L == null || L <= 0) return;
    if (Vn == null || Vn <= 0) return;

    const mode = document.getElementById("imax_mode").value;

    const rho = (mat === "CU") ? 0.0175 : 0.0282;

    let dVmaxV = null;
    let dVmaxPct = null;

    if (mode === "PCT") {
      dVmaxPct = parseNumber(document.getElementById("imax_dVperc").value);
      if (dVmaxPct == null || dVmaxPct <= 0) return;
      dVmaxV = (Vn * dVmaxPct) / 100;
    } else {
      dVmaxV = parseNumber(document.getElementById("imax_dV").value);
      if (dVmaxV == null || dVmaxV <= 0) return;
      dVmaxPct = (dVmaxV / Vn) * 100;
    }

    // Rline andata+ritorno e Imax (inversa)
    const Rline = (2 * rho * L) / S;
    const Imax = dVmaxV / Rline;

    // warning semplice sul valore di ΔV% impostato (solo indicativo)
    let state = "ok", text = "OK";
    if (dVmaxPct > 6) { state = "bad"; text = "Limite molto alto"; }
    else if (dVmaxPct > 4) { state = "warn"; text = "Limite > 4% (attenzione)"; }

    document.getElementById("imax_out").style.display = "block";
    setPill(state, text);

    document.getElementById("imax_rho").textContent = rho.toFixed(4);
    document.getElementById("imax_dVmax").textContent = `${dVmaxV.toFixed(2)} V (${dVmaxPct.toFixed(2)}%)`;
    document.getElementById("imax_Rline").textContent = `${Rline.toFixed(4)} Ω`;
    document.getElementById("imax_I").textContent = `${Imax.toFixed(1)} A`;

    document.getElementById("imax_note").textContent =
      "Nota: Imax è calcolata solo per vincolo di caduta di tensione. Verificare anche portata termica e condizioni di posa.";
  }

  // click con validazione
  document.getElementById("btn_calc_imax").onclick = () => {
    const S  = parseNumber(document.getElementById("imax_S").value);
    const L  = parseNumber(document.getElementById("imax_L").value);
    const Vn = parseNumber(document.getElementById("imax_Vn").value);
    if (S == null || S <= 0) return alert("Inserisci una sezione valida (>0 mm²).");
    if (L == null || L <= 0) return alert("Inserisci una lunghezza valida (>0 m).");
    if (Vn == null || Vn <= 0) return alert("Inserisci una tensione nominale valida (>0 V).");

    const mode = document.getElementById("imax_mode").value;
    if (mode === "PCT") {
      const p = parseNumber(document.getElementById("imax_dVperc").value);
      if (p == null || p <= 0) return alert("Inserisci un ΔV% max valido (>0).");
    } else {
      const v = parseNumber(document.getElementById("imax_dV").value);
      if (v == null || v <= 0) return alert("Inserisci un ΔV max (V) valido (>0).");
    }

    calcola();
  };

  // auto-calc
  ["imax_S","imax_L","imax_Vn","imax_mat","imax_dVperc","imax_dV"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", calcola);
  });
}

function renderCalcoliBatterie() {
  app.innerHTML = `
    <div class="header-row">
      <button class="smallBtn" id="btn_back">←</button>
      <button class="smallBtn" id="btn_home">🏠</button>
      <h2>Capacità batterie</h2>
    </div>

    <div class="cardBox">
      <div class="sectionTitle">Modalità</div>

      <div class="formRow">
        <label>Sistema</label>
        <select id="b_mode">
          <option value="DC" selected>SE</option>
          <option value="UPS">UPS</option>
        </select>
      </div>

      <div class="formRow">
        <label>Fornitore</label>
        <select id="b_vendor">
          <option value="HOPPECKE" selected>Hoppecke (da contratto)</option>
        </select>
      </div>

      <div class="formRow">
        <label>Tecnologia / Formato</label>
        <select id="b_family"></select>
      </div>

      <div class="formRow">
        <label>Esponente di Peukert (n)</label>
        <div class="specInput">
          <input id="b_peukert" type="number" step="any" inputmode="decimal" value="1.12">
          <span class="unit">—</span>
        </div>
        <div class="cardSub">Inserisci n da datasheet (se lo hai). Default 1,12 è un valore tipico per piombo industriale in calcoli preliminari.</div>
      </div>

      <div class="formRow">
        <label>Margine progettuale</label>
        <div class="specInput">
          <input id="b_margin" type="number" step="any" inputmode="decimal">
          <span class="unit">%</span>
        </div>
      </div>
    </div>

    <div class="cardBox" id="box_dc">
      <div class="sectionTitle">Input DC</div>

      <div class="formRow">
        <label>Corrente di carico</label>
        <div class="specInput">
          <input id="dc_I" type="number" step="any" inputmode="decimal" >
          <span class="unit">A</span>
        </div>
      </div>

      <div class="formRow">
        <label>Tensione di sistema</label>
        <div class="specInput">
          <input id="dc_V" type="number" step="any" inputmode="decimal" >
          <span class="unit">V</span>
        </div>
      </div>

      <div class="formRow">
        <label>Autonomia richiesta</label>
        <div class="specInput">
          <input id="dc_T" type="number" step="any" inputmode="decimal" >
          <span class="unit">h</span>
        </div>
      </div>

      <div class="formRow">
        <label>Stringhe in parallelo</label>
        <div class="specInput">
          <input id="dc_npar" type="number" step="1" min="1" value="1">
          <span class="unit">n</span>
        </div>
      </div>

    </div>

    <div class="cardBox" id="box_ups" style="display:none;">
      <div class="sectionTitle">Input UPS</div>

      <div class="formRow">
        <label>Carico UPS</label>
        <div class="specInput">
          <input id="ups_P" type="number" step="any" inputmode="decimal" placeholder="Es. 20">
          <span class="unit">kW</span>
        </div>
      </div>

      <div class="formRow">
        <label>Rendimento UPS</label>
        <div class="specInput">
          <input id="ups_eta" type="number" step="any" inputmode="decimal" value="95">
          <span class="unit">%</span>
        </div>
      </div>

      <div class="formRow">
        <label>Tensione batterie (DC link)</label>
        <div class="specInput">
          <input id="ups_Vdc" type="number" step="any" inputmode="decimal" placeholder="Es. 240 / 384">
          <span class="unit">V</span>
        </div>
      </div>

      <div class="formRow">
        <label>Autonomia richiesta</label>
        <div class="specInput">
          <input id="ups_T" type="number" step="any" inputmode="decimal" placeholder="Es. 0.5">
          <span class="unit">h</span>
        </div>
      </div>

    </div>

    <div class="cardBox">
      <button class="primaryBtn" id="btn_bcalc">Calcola</button>
    </div>

    <div class="cardBox" id="b_out" style="display:none;">
      <div class="sectionTitle">Risultato</div>
      <div class="pill" id="b_pill">—</div>

      <div class="kv"><span>C10 richiesta (Peukert)</span><b id="o_c10">—</b></div>
      <div class="kv"><span>C10 richiesta + margine</span><b id="o_c10m">—</b></div>

      <div class="kv"><span>Taglia scelta (C10 per stringa)</span><b id="o_taglia">—</b></div>
      <div class="kv"><span>Tensione unità (elemento/monoblocco)</span><b id="o_vu">—</b></div>
      <div class="kv"><span>N° elementi in serie</span><b id="o_nser">—</b></div>
      <div class="kv"><span>N° stringhe in parallelo</span><b id="o_npar">—</b></div>

      <div class="kv"><span>C10 installata</span><b id="o_c10inst">—</b></div>
      <div class="kv"><span>Oversize</span><b id="o_over">—</b></div>
      <div class="kv"><span>Totale unità (serie×parallelo)</span><b id="o_ntot">—</b></div>

      <div class="kv" id="row_idc" style="display:none;"><span>Idc (solo UPS)</span><b id="o_idc">—</b></div>
      <div class="kv"><span>Corrente per stringa</span><b id="o_istr">—</b></div>
            
    </div>
  `;

  loadBatteryFamilies();


  // NAV
  document.getElementById("btn_home").onclick = goToMainHome;
  document.getElementById("btn_back").onclick = () => { route = { view: "calcoli" }; render(); };

  function setPill(state, text) {
    const pill = document.getElementById("b_pill");
    pill.classList.remove("pill-ok","pill-warn","pill-bad");
    pill.textContent = text;
    pill.classList.add(state === "ok" ? "pill-ok" : state === "warn" ? "pill-warn" : "pill-bad");
  }

  function loadBatteryFamilies() {
    const vend = document.getElementById("b_vendor").value;
    const famSel = document.getElementById("b_family");

    const fams = Object.keys(BATTERY_CATALOG[vend] || {});

    famSel.innerHTML = fams.map(f =>
      `<option value="${f}">${f}</option>`
    ).join("");

    // ✅ seleziona automaticamente la prima
    if (fams.length > 0) {
      famSel.value = fams[0];
    }
  }

  function pickBestTaglia(C10required, tagsAhC10) {
    // Scelta "migliore":
    // 1) minimizza nPar
    // 2) a pari nPar minimizza oversize (Ah installati - richiesti)
    if (!Number.isFinite(C10required) || C10required <= 0) return null;
    const tags = (tagsAhC10 || []).filter(x => Number.isFinite(x) && x > 0).sort((a,b)=>a-b);
    if (!tags.length) return null;

    let best = null;

    for (const tag of tags) {
      const nPar = Math.ceil(C10required / tag);
      const inst = nPar * tag;
      const over = inst - C10required;

      const cand = { tag, nPar, inst, over };

      if (!best) { best = cand; continue; }

      // 1) meno stringhe
      if (cand.nPar < best.nPar) { best = cand; continue; }
      if (cand.nPar > best.nPar) continue;

      // 2) a pari stringhe, meno oversize
      if (cand.over < best.over) { best = cand; continue; }
      if (cand.over > best.over) continue;

      // 3) tie-break: tag più piccola (più "fine")
      if (cand.tag < best.tag) best = cand;
    }

    return best;
  }

  // Mode UI
  function syncMode() {
    const mode = document.getElementById("b_mode").value;
    document.getElementById("box_dc").style.display = (mode === "DC") ? "" : "none";
    document.getElementById("box_ups").style.display = (mode === "UPS") ? "" : "none";
    document.getElementById("row_idc").style.display = "none";
  }
  document.getElementById("b_mode").addEventListener("change", () => { syncMode(); calcSoft(); });
  syncMode();

  function calcCore(showAlerts) {
    const mode = document.getElementById("b_mode").value;
    const vend = document.getElementById("b_vendor").value;
    const fam = document.getElementById("b_family").value;
    const n = parseNumber(document.getElementById("b_peukert").value);
    const margin = parseNumber(document.getElementById("b_margin").value) ?? 0;
    const unitV = BATTERY_CATALOG[vend]?.[fam]?.unitV;

    if (showAlerts) {
      if (!unitV || unitV <= 0) return alert("Formato batteria non valido."), null;
      if (!n || n < 1) return alert("Inserisci un esponente di Peukert valido (n >= 1)."), null;
      if (margin < 0) return alert("Margine deve essere >= 0."), null;
    } else {
      if (!unitV || unitV <= 0 || !n || n < 1) return null;
    }

    let Vsys = null, T = null, Iload = null, Idc = null;

    if (mode === "DC") {
      Iload = parseNumber(document.getElementById("dc_I").value);
      Vsys  = parseNumber(document.getElementById("dc_V").value);
      T     = parseNumber(document.getElementById("dc_T").value);
      const nParUser = parseNumber(document.getElementById("dc_npar").value);

      if (showAlerts) {
        if (!Iload || Iload <= 0) return alert("Inserisci corrente DC valida (>0 A)."), null;
        if (!Vsys || Vsys <= 0) return alert("Inserisci tensione sistema valida (>0 V)."), null;
        if (!T || T <= 0) return alert("Inserisci autonomia valida (>0 h)."), null;
        if (!nParUser || nParUser <= 0) return alert("Inserisci numero stringhe valido (>0)."), null;
      } else {
        if (!Iload || Iload <= 0 || !Vsys || Vsys <= 0 || !T || T <= 0 || !nParUser || nParUser <= 0) return null;
      }

      // ✅ corrente per stringa
      const Istring = Iload / nParUser;

      // ✅ calcolo C10 SU UNA STRINGA
      const C10_string = calcC10requiredPeukert(Istring, T, n);
      if (!C10_string) return null;

      const C10_string_margin = C10_string * (1 + margin / 100);

      // ✅ scegli taglia migliore per UNA STRINGA
      const tags = BATTERY_CATALOG[vend]?.[fam]?.tagsAhC10 || [];
      const bestTag = tags.find(x => x >= C10_string_margin) || tags[tags.length - 1];

      const C10inst = bestTag * nParUser;

      const nSerReal = Vsys / unitV;
      const nSer = Math.round(nSerReal);
      const nTot = nSer * nParUser;

      return {
        mode,
        unitV,
        tagliaAh: bestTag,
        n,
        margin,
        Vsys,
        T,
        Iload,
        Idc: null,
        C10: C10_string,
        C10m: C10_string_margin,
        nSerReal,
        nSer,
        nPar: nParUser,
        overAh: C10inst - (C10_string_margin * nParUser),
        C10inst,
        nTot,
        IperStringa: Istring
      };
    }

    // C10 richiesta (Peukert) + margine
    const C10 = calcC10requiredPeukert(Iload, T, n);
    if (!C10 || !Number.isFinite(C10)) return null;

    const C10m = C10 * (1 + margin / 100);

    const tags = BATTERY_CATALOG[vend]?.[fam]?.tagsAhC10 || [];
    const best = pickBestTaglia(C10m, tags);
    if (!best) {
      if (showAlerts) alert("Nessuna taglia C10 disponibile nel catalogo per questa tecnologia.");
      return null;
    }
    const tagliaAh = best.tag;
    const nPar = best.nPar;
    const C10inst = best.inst;
    const overAh = best.over;

    // Serie/parallelo
    const nSerReal = Vsys / unitV;
    const nSer = Math.round(nSerReal);
    const nTot = nSer * nPar;
    const IperStringa = (mode === "DC") ? (Iload / nPar) : (Idc / nPar);

    return { mode, fam, unitV, tagliaAh, n, margin, Vsys, T, Iload, Idc, C10, C10m, nSerReal, nSer, nPar, overAh, C10inst, nTot, IperStringa };
  }

  function renderOut(r) {
    document.getElementById("b_out").style.display = "block";

    // warning su serie non intera
    let state = "ok";
    let txt = "OK";
    if (Math.abs(r.nSerReal - r.nSer) > 0.05) { state = "warn"; txt = "Attenzione: Vsys non è multiplo esatto della tensione unità"; }
    if (r.nPar >= 6) { state = (state === "ok" ? "warn" : state); txt = (state === "warn" ? txt : txt); } // solo indicazione

    setPill(state, txt);

    document.getElementById("o_c10").textContent = `${r.C10.toFixed(0)} Ah`;
    document.getElementById("o_c10m").textContent = `${r.C10m.toFixed(0)} Ah`;
    document.getElementById("o_taglia").textContent = `${r.tagliaAh} Ah`;
    document.getElementById("o_vu").textContent = `${r.unitV} V`;
    document.getElementById("o_nser").textContent = `${r.nSer}`;
    document.getElementById("o_npar").textContent = `${r.nPar}`;
    document.getElementById("o_c10inst").textContent = `${r.C10inst.toFixed(0)} Ah`;
    document.getElementById("o_over").textContent = `${r.overAh.toFixed(0)} Ah`;
    document.getElementById("o_ntot").textContent = `${r.nTot}`;

    if (r.mode === "UPS") {
      document.getElementById("row_idc").style.display = "";
      document.getElementById("o_idc").textContent = `${r.Idc.toFixed(1)} A`;
    } else {
      document.getElementById("row_idc").style.display = "none";
    }

    document.getElementById("o_istr").textContent = `${r.IperStringa.toFixed(1)} A`;

    document.getElementById("o_note").textContent =
      "Nota: la scelta della taglia C10 (Ah/10h) è presa dal contratto Hoppecke. [1](https://fiberc.sharepoint.com/sites/NewServer/_layouts/15/Doc.aspx?sourcedoc=%7B5C19B68D-5F4E-4DBC-9027-C367D3572FC7%7D&file=report_chiamate_NORD-OVEST_12-03-2026-DUSSMANN.csv&action=default&mobileredirect=true&DefaultItemOpen=1)";
  }

  function calcSoft() {
    const r = calcCore(false);
    if (!r) return;
    renderOut(r);
  }

  document.getElementById("btn_bcalc").onclick = () => {
    const r = calcCore(true);
    if (!r) return;
    renderOut(r);
  };

  // auto-calc
  [
    "b_mode","b_vendor","b_family","b_peukert","b_margin",
    "dc_I","dc_V","dc_T","dc_npar",
    "ups_P","ups_eta","ups_Vdc","ups_T"
  ].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", calcSoft);
  });
}


/* =========================
   HOME
========================= */
function renderHome() {
  currentCentraleId = null;
  setActiveTab(null);

  app.innerHTML = `
    <div class="header-row">
      <button class="smallBtn" id="btn_back_main">🏠</button>
      <h2>Centrali</h2>
    </div>
  
    <div class="home-wrap">
      <div class="home-actions">

        <button class="home-action pref-btn" id="btn_preferiti" type="button">
          <div class="pref-content">
            <div class="pref-icon">★</div>
            <div>
              <div class="title">Preferiti</div>
            </div>
          </div>
        </button>

        <button class="home-action" id="btn_lista_centrali" type="button">
          <div class="title">Lista centrali</div>
        </button>

        <button class="home-action" id="btn_consistenza" type="button">
          <div class="title">Consistenza centrali</div>
        </button>

      </div>
    </div>
  `;

  document.getElementById("btn_lista_centrali").onclick = () => {
    route = { view: "centraliList" };
    render();
  };

  document.getElementById("btn_preferiti").onclick = () => {
    route = { view: "preferiti" };
    render();
  };

  document.getElementById("btn_consistenza").onclick = () => {
    route = { view: "consistenzaList" };
    render();
  };

  document.getElementById("btn_back_main").onclick = goToMainHome;

}

/* =========================
   LISTA CENTRALI (READ-ONLY)
========================= */
function renderCentraliList() {
  app.innerHTML = `
    <div class="header-row">
      <button class="smallBtn" id="btn_back_home">←</button>
      <h2>Lista centrali</h2>
    </div>

    <div class="cardBox">
      <div class="search-box">
        <input
          id="search_centrali"
          type="text"
          placeholder="Cerca centrale..."
          class="search-input"
        >
        <button id="search_clear" class="search-clear">✖</button>
      </div>
    </div>

    <div id="centrali_list"></div>
  `;

  // Back
  document.getElementById("btn_back_home").onclick = () => {
    route = { view: "home" };
    render();
  };

  const listHost = document.getElementById("centrali_list");
  const searchEl = document.getElementById("search_centrali");
  const clearBtn = document.getElementById("search_clear");

  // nascondi la X se vuoto
  clearBtn.style.display = "none";

  // input typing
  searchEl.addEventListener("input", (e) => {
    const val = e.target.value;

    renderList(val);

    // mostra/nasconde X
    clearBtn.style.display = val ? "block" : "none";
  });

  // click su X
  clearBtn.onclick = () => {
    searchEl.value = "";
    renderList("");
    clearBtn.style.display = "none";
  };

  // Render lista (sempre visibile; filtra solo se scrivi)
  function renderList(filterText = "") {
    const text = filterText.trim().toLowerCase();

    const filtered = CENTRALI.filter(c => {
      if (!text) return true; // campo vuoto => tutte visibili

      const nome = (c.nome || "").toLowerCase();
      const clli = (c.clli || "").toLowerCase();
      const indirizzo = (c.indirizzo || "").toLowerCase();

      // cerca per nome OPPURE CLLI OPPURE indirizzo
      return nome.includes(text) || clli.includes(text) || indirizzo.includes(text);
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, "it", { sensitivity: "base" }));

    listHost.innerHTML = filtered.map(c => `
      <div class="cardBox">
        <div class="cardTitle">${esc(c.nome)}</div>
        <div class="cardSub">
          CLLI: <b>${esc(c.clli || "—")}</b> ·
          Strategicità: <b>${esc(c.strategicita || "—")}</b>
        </div>
        <div class="cardSub">
          Indirizzo: <b>${esc(c.indirizzo || "—")}</b> ·
          Comune: <b>${esc(c.comune || "—")}</b>
        </div>
        <div class="cardSub">
          Progettista: <b>${esc(c.progettista || "—")}</b>
        </div>
        <div class="cardSub">
          Lotto IU: <b>${esc(c.lottoIU || "—")}</b> ·
          Impresa Unica: <b>${esc(c.IU || "—")}</b>
        </div>
        <div class="cardSub">
          POD: <b>${esc(c.pod || "—")}</b> ·
          Potenza contrattualizzata: <b>${esc(c.potenzaContrattualizzata || "—")}</b> kW
        </div>
      </div>
    `).join("");
  }

  // ✅ Mostra SUBITO tutte le centrali
  renderList("");

  // ✅ Filtro live
  searchEl.addEventListener("input", (e) => {
    renderList(e.target.value);
  });
}

/* =========================
   CONSISTENZA CENTRALI
========================= */
function renderConsistenzaList() {
  app.innerHTML = `
    <div class="header-row">
      <button class="smallBtn" id="btn_back_home2">←</button>
      <h2>Consistenza centrali</h2>
    </div
    
    <div class="cardBox">
      <div class="search-box">
        <input
          id="search_consistenza"
          type="text"
          placeholder="Cerca centrale..."
          class="search-input"
        >
        <button id="search_clear_cons" class="search-clear">✖</button>
      </div>
    </div>

    <div id="consistenza_list"></div>

  `;

  const listHost = document.getElementById("consistenza_list");
  const searchEl = document.getElementById("search_consistenza");
  const clearBtn = document.getElementById("search_clear_cons");

  clearBtn.style.display = "none";

  // funzione render lista
  function renderList(filterText = "") {
    const text = filterText.trim().toLowerCase();

    const filtered = CENTRALI
      .filter(c => {
        if (!text) return true;

        const nome = (c.nome || "").toLowerCase();
        const clli = (c.clli || "").toLowerCase();
        const indirizzo = (c.indirizzo || "").toLowerCase();

        return nome.includes(text) || clli.includes(text) || indirizzo.includes(text);
      })
      .sort((a, b) => a.nome.localeCompare(b.nome, "it", { sensitivity: "base" }));

    listHost.innerHTML = filtered.map(c => {
      const enabled = !!c.consistenzaEnabled;

      return `
        <div class="cardBox" style="opacity:${enabled ? 1 : .55}">
          <div class="cardHead">
            <div>
              <div class="cardTitle">
                ${esc(c.nome)}
                <span class="star ${isPreferita(c.id) ? "active" : ""}" data-star="${c.id}">★</span>
              </div>
              <div class="cardSub">
                CLLI: <b>${esc(c.clli || "—")}</b> · 
                Strategicità: <b>${esc(c.strategicita || "—")}</b>
              </div>
              <div class="cardSub">
                Indirizzo: <b>${esc(c.indirizzo || "—")}</b>
              </div>
            </div>

            <button class="smallBtn" data-open-cons="${c.id}" ${enabled ? "" : "disabled"}>
              ${enabled ? "Apri" : "Prossimamente"}
            </button>
          </div>
        </div>
      `;
    }).join("");

    // ricollego eventi ai bottoni
    document.querySelectorAll("[data-open-cons]").forEach(btn => {
      btn.onclick = () => {
        const cid = btn.dataset.openCons;
        const c = getCentraleById(cid);

        if (!c || !c.consistenzaEnabled) return;

        currentCentraleId = cid;
        route = { view: "info" };
        setActiveTab("info");
        render();
      };
    });

    // Click su stellina
    document.querySelectorAll("[data-star]").forEach(el => {
      el.onclick = (e) => {
        e.stopPropagation();
        const id = el.dataset.star;
        togglePreferita(id);
        renderConsistenzaList(); // refresh
      };
    });
  }

  // render iniziale
  renderList();

  // ricerca live
  searchEl.addEventListener("input", (e) => {
    const val = e.target.value;

    renderList(val);
    clearBtn.style.display = val ? "block" : "none";
  });

  // bottone X
  clearBtn.onclick = () => {
    searchEl.value = "";
    renderList("");
    clearBtn.style.display = "none";
  };

  document.getElementById("btn_back_home2").onclick = () => {
    route = { view: "home" };
    render();
  };

  app.querySelectorAll("[data-open-cons]").forEach(btn => {
    btn.onclick = () => {
      const cid = btn.dataset.openCons;
      const c = getCentraleById(cid);
      if (!c || !c.consistenzaEnabled) return;

      currentCentraleId = cid;
      route = { view: "info" };
      setActiveTab("info");
      render();
    };
  });
}

function renderPreferiti() {
  const prefIds = getPreferiti();
  const centrali = CENTRALI.filter(c => prefIds.includes(c.id));

  app.innerHTML = `
    <div class="header-row">
      <button class="smallBtn" id="btn_back_home_pref">←</button>
      <h2>Preferiti</h2>
    </div>

    ${
      centrali.length ? centrali.map(c => `
        <div class="cardBox">
          <div class="cardHead">
            <div>
              <div class="cardTitle">${esc(c.nome)}</div>
              <div class="cardSub">${esc(c.indirizzo || "")}</div>
            </div>
            <button class="smallBtn" data-open-cons="${c.id}">Apri</button>
          </div>
        </div>
      `).join("") : `
        <div class="cardBox">
          <div class="cardSub">Nessun preferito selezionato.</div>
        </div>
      `
    }
  `;

  document.getElementById("btn_back_home_pref").onclick = () => {
    route = { view: "home" };
    render();
  };

  document.querySelectorAll("[data-open-cons]").forEach(btn => {
    btn.onclick = () => {
      currentCentraleId = btn.dataset.openCons;
      route = { view: "info" };
      setActiveTab("info");
      render();
    };
  });
}

/* =========================
   INFO (dinamico per centrale selezionata)
========================= */
function renderInfo() {
  const c = getCentraleById(currentCentraleId);

  app.innerHTML = `
    <h2>Informazioni – ${esc(c?.nome || "Centrale")}</h2>

    <div class="cardBox">
      <div class="kv"><span>CLLI</span><b>${esc(c?.clli || "—")}</b></div>
      <div class="kv"><span>Strategicità</span><b>${esc(c?.strategicita || "—")}</b></div>
      <div class="kv"><span>Indirizzo</span><b>${esc(c?.indirizzo || "—")}</b></div>
      <div class="kv"><span>Comune</span><b>${esc(c?.comune || "—")}</b></div>
      <div class="kv"><span>Regione</span><b>${esc(c?.regione || "—")}</b></div>
      <div class="kv"><span>POD</span><b>${esc(c?.pod || "—")}</b></div>
      <div class="kv"><span>Ente fornitore</span><b>${esc(c?.enteFornitore || "—")}</b></div>
      <div class="kv"><span>Potenza contrattualizzata</span><b> ${c?.potenzaContrattualizzata? esc(c.potenzaContrattualizzata) + " kW": "—"}</b></div>

      <div class="kv"><span>Progettista</span><b>${esc(c?.progettista || "—")}</b></div>
      <div class="kv"><span>Lotto IU</span><b>${esc(c?.lottoIU || "—")}</b></div>
      <div class="kv"><span>Impresa Unica</span><b>${esc(c?.IU || "—")}</b></div>
    </div>

    <div class="rowBtns">
      <button class="smallBtn" id="btn_back_cons">← Consistenza centrali</button>
    </div>
  `;

  document.getElementById("btn_back_cons").onclick = () => {
    currentCentraleId = null;
    setActiveTab(null);
    route = { view: "consistenzaList" };
    render();
  };
}

function renderPlanimetrie() {
  const c = getCentraleById(currentCentraleId);

  const items =
    (c?.id === "MI_BERSAGLIO")
      ? PLANIMETRIE_MI_BERSAGLIO.map(t => {
          let fileName;

          if (t === "Piano copertura") {
            fileName = "piano_copertura.pdf";
          } else {
            const livello = t.replace("Piano ", "").trim();
            fileName = `piano_${livello}.pdf`;
          }

          return {
            titolo: t,
            tipo: "pdf",
            url: `./planimetrie/MI_BERSAGLIO/${fileName}`
          };
        })
      : (Array.isArray(c?.planimetrie) ? c.planimetrie : []);


  app.innerHTML = `
  <h2>Planimetrie</h2>

  ${items.length ? `
    <div>
      ${items.map((p, idx) => `
        <div class="listItem">
          <div>
            <div class="cardTitle">
              ${esc(p.titolo || `Planimetria ${idx+1}`)}
            </div>
            <div class="cardSub">
              ${esc((p.tipo || "").toUpperCase() || "FILE")}
            </div>
          </div>

          ${p.url
            ? `<button class="smallBtn" data-open-url="${esc(p.url)}">Apri</button>`
            : `<button class="smallBtn" disabled style="opacity:.5">Apri</button>`
          }
        </div>
      `).join("")}
    </div>
  ` : `
    <div class="cardBox">
      <div class="cardSub">
        Nessuna planimetria caricata per questa centrale.
      </div>
    </div>
  `}
`;

app.querySelectorAll("[data-open-url]").forEach(btn => {
  btn.onclick = () => {
    const url = btn.dataset.openUrl;
    if (url) window.open(url, "_blank");
  };
});


  setActiveTab("planimetrie");
}

/* =========================
   SALE LIST
========================= */
async function renderSaleList() {
  const saleAll = await getAll("sale");
  const assetAll = await getAll("asset");

  const sale = saleAll
    .filter(s => (s.centraleId || "MI_BERSAGLIO") === currentCentraleId)
    .sort((a,b)=> (a.nome||"").localeCompare(b.nome||""));

  const asset = assetAll
    .filter(a => (a.centraleId || "MI_BERSAGLIO") === currentCentraleId);

  app.innerHTML = `
    <h2>Sale</h2>

    ${sale.map(s => {
      const nAsset = asset.filter(a => a.salaId === s.id).length;
      const ubic = `${s.edificio || "—"} · Piano ${s.piano || "—"}`;
      return `
        <div class="cardBox">
          <div class="cardHead">
            <div>
              <div class="cardTitle">${esc(s.nome)}</div>
              <div class="cardSub">${esc(ubic)} · Asset: <b>${nAsset}</b></div>
            </div>
            <button class="smallBtn" data-open-sale="${s.id}">Apri</button>
          </div>
        </div>
      `;
    }).join("")}

    <div class="cardBox">
      <button class="primaryBtn" id="btn_new_sala">➕ Nuova sala</button>
    </div>
  `;

  app.querySelectorAll("[data-open-sale]").forEach(btn => {
    btn.onclick = () => {
      route = { view:"saleDetail", id: btn.dataset.openSale };
      setActiveTab("sale");
      render();
    };
  });

  document.getElementById("btn_new_sala").onclick = () => {
    draftSala = {
      id: uuid(),
      centraleId: currentCentraleId,
      nome: "",
      edificio: "Plana",
      piano: "",
      note: ""
    };
    route = { view:"saleDetail", id: null };
    setActiveTab("sale");
    render();
  };
}

/* =========================
   SALE DETAIL
========================= */
async function renderSaleDetail(id) {
  const isNew = !id;

  const s = isNew ? (draftSala ?? {
    id: uuid(),
    centraleId: currentCentraleId,
    nome:"", edificio:"Plana", piano:"", note:""
  }) : await getOne("sale", id);

  if (!s) { route = { view:"saleList" }; return render(); }

  // Forza default centrale su dati vecchi
  if (!s.centraleId) s.centraleId = "MI_BERSAGLIO";

  const assetsAll = await getByIndex("asset", "salaId", s.id);
  const assets = assetsAll.filter(a => (a.centraleId || "MI_BERSAGLIO") === currentCentraleId);

  app.innerHTML = `
    <h2>${isNew ? "Nuova sala" : "Sala: " + esc(s.nome)}</h2>

    <div class="cardBox">
      <div class="sectionTitle">Dati sala</div>

      <div class="formRow">
        <label>Nome sala</label>
        <input id="sd_nome" value="${esc(s.nome)}">
      </div>

      <div class="formRow">
        <label>Edificio</label>
        <select id="sd_edificio">
          <option value="Plana" ${s.edificio==="Plana"?"selected":""}>Plana</option>
          <option value="Monte Ceneri" ${s.edificio==="Monte Ceneri"?"selected":""}>Monte Ceneri</option>
        </select>
      </div>

      <div class="formRow">
        <label>Piano</label>
        <input id="sd_piano" value="${esc(s.piano)}" placeholder="Es. PT / -1 / 1 / 2">
      </div>

      <div class="formRow">
        <label>Note</label>
        <textarea id="sd_note">${esc(s.note || "")}</textarea>
      </div>

      <button class="primaryBtn" id="btn_save_sala">${isNew ? "Crea sala" : "Salva sala"}</button>
    </div>

    ${!isNew ? `
      <div class="cardBox">
        <div class="sectionTitle">Asset presenti</div>
        ${assets.length ? assets.map(a => `
          <div class="listItem">
            <div>
              <div class="cardTitle">${esc(a.nome)}</div>
              <div class="cardSub">${esc(CATEGORY_DEFS[a.categoria]?.label || a.categoria || "—")}</div>
            </div>
            <button class="smallBtn" data-open-asset="${a.id}">Apri</button>
          </div>
        `).join("") : `<div class="cardSub">Nessun asset in questa sala.</div>`}
        <button class="primaryBtn" id="btn_add_asset_from_sala">+ Aggiungi asset in questa sala</button>
      </div>
    ` : ``}

    <div class="rowBtns">
      <button class="smallBtn" id="btn_back_sale">← Indietro</button>
      ${!isNew ? `<button class="dangerBtn" id="btn_delete_sala">Elimina sala</button>` : ``}
    </div>
  `;

  app.querySelectorAll("[data-open-asset]").forEach(btn => {
    btn.onclick = () => {
      route = { 
        view: "assetDetail", 
        id: btn.dataset.openAsset,
        from: "sale",            // ✅ nuova info
        salaId: s.id             // ✅ id sala origine
      };
      setActiveTab("asset");
      render();
    };
  });

  document.getElementById("btn_back_sale").onclick = () => {
    draftSala = null;
    route = { view:"saleList" };
    setActiveTab("sale");
    render();
  };

  document.getElementById("btn_save_sala").onclick = async () => {
    s.nome = document.getElementById("sd_nome").value.trim();
    s.edificio = document.getElementById("sd_edificio").value;
    s.piano = document.getElementById("sd_piano").value.trim();
    s.note = document.getElementById("sd_note").value;

    if (!s.nome) return alert("Inserisci il nome della sala.");

    s.centraleId = currentCentraleId;
    await save("sale", s);
    draftSala = null;

    route = { view:"saleDetail", id: s.id };
    setActiveTab("sale");
    render();
  };

  const btnAdd = document.getElementById("btn_add_asset_from_sala");
  if (btnAdd) {
    btnAdd.onclick = () => {
      draftAsset = null;
      route = { view:"assetDetail", id: null, presetSalaId: s.id };
      setActiveTab("asset");
      render();
    };
  }

  const btnDel = document.getElementById("btn_delete_sala");
  if (btnDel) {
    btnDel.onclick = async () => {
      if (!confirm("Eliminare la sala? Verranno eliminati anche gli asset associati.")) return;
      for (const a of assets) await remove("asset", a.id);
      await remove("sale", s.id);
      route = { view:"saleList" };
      setActiveTab("sale");
      render();
    };
  }
}

/* =========================
   ASSET LIST
========================= */
async function renderAssetList() {
  const saleAll = await getAll("sale");
  const assetAll = await getAll("asset");

  const sale = saleAll.filter(s => (s.centraleId || "MI_BERSAGLIO") === currentCentraleId);
  const asset = assetAll.filter(a => (a.centraleId || "MI_BERSAGLIO") === currentCentraleId);

  const countByCat = {};
  for (const a of asset) countByCat[a.categoria] = (countByCat[a.categoria] || 0) + 1;

  const totalCount = asset.length;
  const categories = Object.keys(CATEGORY_DEFS).filter(cat => countByCat[cat]);

  app.innerHTML = `
    <h2>Asset</h2>

    <div class="cardBox">
      <div class="sectionTitle">Filtra per tipologia</div>
      <div class="rowBtns">
        <button class="smallBtn ${assetCategoryFilter === "ALL" ? "active" : ""}" data-cat-filter="ALL">
          Tutte (${totalCount})
        </button>
        ${categories.map(cat => `
          <button class="smallBtn ${assetCategoryFilter === cat ? "active" : ""}" data-cat-filter="${cat}">
            ${CATEGORY_DEFS[cat].label} (${countByCat[cat]})
          </button>
        `).join("")}
      </div>
    </div>

    <div class="cardBox">
      <div class="sectionTitle">
        ${
          assetCategoryFilter === "ALL"
            ? "Tutti gli asset"
            : assetCategoryFilter
              ? `Asset di tipo ${CATEGORY_DEFS[assetCategoryFilter].label}`
              : "Seleziona una tipologia"
        }
      </div>

      ${
        assetCategoryFilter
          ? asset
              .filter(a => assetCategoryFilter === "ALL" ? true : a.categoria === assetCategoryFilter)
              .sort((a,b)=> (a.nome||"").localeCompare(b.nome||""))
              .map(a => {
                const s = sale.find(x => x.id === a.salaId);
                const ubic = `${s?.edificio || "—"} · Piano ${s?.piano || "—"} · ${s?.nome || "Sala —"}`;
                return `
                  <div class="listItem">
                    <div>
                      <div class="cardTitle">${esc(a.nome)}</div>
                      <div class="cardSub">${esc(ubic)}</div>
                    </div>
                    <button class="smallBtn" data-open-asset="${a.id}">Apri</button>
                  </div>
                `;
              }).join("")
          : `<div class="cardSub">Nessuna tipologia selezionata.</div>`
      }
    </div>

    <div class="cardBox">
      <button class="primaryBtn" id="btn_new_asset">➕ Nuovo asset</button>
    </div>
  `;

  app.querySelectorAll("[data-cat-filter]").forEach(btn => {
    btn.onclick = () => {
      assetCategoryFilter = btn.dataset.catFilter;
      renderAssetList();
    };
  });

  app.querySelectorAll("[data-open-asset]").forEach(btn => {
    btn.onclick = () => {
      route = { view:"assetDetail", id: btn.dataset.openAsset };
      setActiveTab("asset");
      render();
    };
  });

  document.getElementById("btn_new_asset").onclick = () => {
    assetCategoryFilter = "ALL";
    route = { view:"assetDetail", id: null };
    setActiveTab("asset");
    render();
  };
}

/* =========================
   ASSET DETAIL (la tua logica completa, con centraleId)
========================= */
async function renderAssetDetail(id, presetSalaId = null) {
  const saleAll = await getAll("sale");
  const allAssetsAll = await getAll("asset");

  const sale = saleAll.filter(s => (s.centraleId || "MI_BERSAGLIO") === currentCentraleId);
  const allAssets = allAssetsAll.filter(a => (a.centraleId || "MI_BERSAGLIO") === currentCentraleId);

  const isNew = !id;

  if (isNew && !draftAsset) {
    draftAsset = {
      centraleId: currentCentraleId,
      id: uuid(),
      nome: "",
      salaId: presetSalaId || (sale[0]?.id || ""),
      categoria: "SE",
      marca: "",
      annoInstallazione: null,
      specs: {},
      battTipo: "ELI",
      seId: null,
      upsId: null,
      cdzTipo: "ED monoblocco",
      cdzMandata: "Dislocamento",
      breakers: [],
      note: ""
    };
  }

  let a = isNew ? draftAsset : await getOne("asset", id);
  if (!a) { route = { view:"assetList" }; return render(); }

  // default per vecchi dati
  if (!a.centraleId) a.centraleId = "MI_BERSAGLIO";
  if (a.centraleId !== currentCentraleId) {
    route = { view:"assetList" };
    return render();
  }

  const saleOptions = sale
    .map(s => `<option value="${s.id}" ${s.id===a.salaId?'selected':''}>${esc(s.nome)}</option>`)
    .join("");

  const catOptions = Object.keys(CATEGORY_DEFS)
    .map(k => `<option value="${k}" ${k===a.categoria?'selected':''}>${esc(CATEGORY_DEFS[k].label)}</option>`)
    .join("");

  const sala = sale.find(s => s.id === a.salaId);
  const ubic = `${sala?.edificio || "—"} · Piano ${sala?.piano || "—"} · ${sala?.nome || "—"}`;

  const seList = allAssets.filter(x => x.categoria === "SE").sort((x,y)=> (x.nome||"").localeCompare(y.nome||""));
  const upsList = allAssets.filter(x => x.categoria === "UPS").sort((x,y)=> (x.nome||"").localeCompare(y.nome||""));

  app.innerHTML = `
    <h2>${isNew ? "Nuovo asset" : "Asset: " + esc(a.nome)}</h2>

    <div class="cardBox">
      <div class="sectionTitle">Ubicazione</div>
      <div class="kv"><span>Ubicazione</span><b>${esc(ubic)}</b></div>
      <div class="formRow">
        <label>Sala</label>
        <select id="ad_sala">${saleOptions}</select>
      </div>

      ${a.categoria === "BATTERIE" ? `
        <div class="formRow">
          <label>Associata a</label>
          <select id="ad_owner_type">
            <option value="SE">SE</option>
            <option value="UPS">UPS</option>
          </select>

          <label style="margin-top:6px;">Seleziona</label>
          <select id="ad_owner_id"></select>
        </div>
      ` : ``}
    </div>

    <div class="cardBox">
      <div class="sectionTitle">Caratteristiche</div>

      <div class="formRow">
        <label>Nome asset</label>
        <input id="ad_nome" value="${esc(a.nome || "")}">
      </div>

      <div class="formRow">
        <label>Categoria</label>
        <select id="ad_cat">${catOptions}</select>
      </div>

      ${a.categoria === "QEGBT" ? `` : `
        <div class="formRow">
          <label>Marca</label>
          <input id="ad_marca" value="${esc(a.marca || "")}">
        </div>
      `}

      ${a.categoria === "BATTERIE" ? `
        <div class="formRow">
          <label>Tipo batteria</label>
          <select id="ad_batt_tipo">
            <option value="ELI" ${a.battTipo==="ELI"?"selected":""}>ELI</option>
            <option value="AGM" ${a.battTipo==="AGM"?"selected":""}>AGM</option>
            <option value="GEL" ${a.battTipo==="GEL"?"selected":""}>GEL</option>
            <option value="Litio" ${a.battTipo==="Litio"?"selected":""}>Litio</option>
          </select>
        </div>
      ` : ``}

      ${a.categoria === "CDZ" ? `
        <div class="formRow">
          <label>Tipologia CDZ</label>
          <select id="ad_cdz_tipo">
            <option value="ED monoblocco" ${a.cdzTipo==="ED monoblocco"?"selected":""}>ED monoblocco</option>
            <option value="ED con condensazione remota" ${a.cdzTipo==="ED con condensazione remota"?"selected":""}>ED con condensazione remota</option>
            <option value="UTA" ${a.cdzTipo==="UTA"?"selected":""}>UTA</option>
          </select>
        </div>

        <div class="formRow">
          <label>Tipo di mandata</label>
          <select id="ad_cdz_mandata">
            <option value="Dislocamento" ${a.cdzMandata==="Dislocamento"?"selected":""}>Dislocamento</option>
            <option value="Under" ${a.cdzMandata==="Under"?"selected":""}>Under</option>
            <option value="Over" ${a.cdzMandata==="Over"?"selected":""}>Over</option>
          </select>
        </div>
      ` : ``}

      <div class="formRow">
        <label>Anno installazione</label>
        <input id="ad_anno" type="number" min="0" step="1" inputmode="numeric" value="${a.annoInstallazione ?? ""}">
      </div>

      <div class="cardBox innerBox">
        <div class="sectionTitle">Dati tecnici</div>
        <div id="ad_spec_host"></div>
      </div>
    </div>

    ${a.categoria === "QEGBT" ? `
      <div class="cardBox">
        <div class="sectionTitle">Interruttori</div>

        <div class="kv"><span>N° interruttori totali</span><b id="brk_tot">0</b></div>
        <div class="kv"><span>N° interruttori utilizzati</span><b id="brk_use">0</b></div>
        <div class="kv"><span>N° interruttori disponibili</span><b id="brk_av">0</b></div>

        <div id="brk_list"></div>

        <div class="cardBox innerBox">
          <div class="sectionTitle">Aggiungi interruttore</div>
          <div class="formRow">
            <label>Nome</label>
            <input id="brk_new_name" placeholder="Es. QF1 – Linea SE 7">
          </div>
          <div class="formRow">
            <label>Taglia (A)</label>
            <input id="brk_new_size" type="number" min="0" step="1" inputmode="numeric" placeholder="Es. 630">
          </div>
          <div class="formRow">
            <label>Stato</label>
            <select id="brk_new_state">
              <option value="disponibile">Disponibile</option>
              <option value="utilizzato">Utilizzato</option>
            </select>
          </div>
          <button class="primaryBtn" id="brk_add_btn">+ Aggiungi</button>
        </div>
      </div>
    ` : ``}

    <div class="cardBox">
      <div class="sectionTitle">Note</div>
      <textarea id="ad_note">${esc(a.note || "")}</textarea>
    </div>

    <div class="rowBtns asset-actions">

      <button class="smallBtn backBtn" id="btn_back_asset" type="button">
        ${route.from === "sale" ? "← Sala" : "← Indietro"}
      </button>

      <div class="rightActions">
        <button class="primaryBtn" id="btn_save_asset" type="button">
          Salva
        </button>

        ${(!isNew) ? `
          <button class="dangerBtn" id="btn_delete_asset" type="button">
            Elimina
          </button>
        ` : ``}
      </div>

    </div>
  `;

  // back
  document.getElementById("btn_back_asset").onclick = () => {
    draftAsset = null;

    // ✅ Se arrivo da una sala → torno alla sala
    if (route.from === "sale" && route.salaId) {
      route = { 
        view: "saleDetail", 
        id: route.salaId 
      };
      setActiveTab("sale");
      render();
      return;
    }

    // comportamento normale
    route = { view:"assetList" };
    setActiveTab("asset");
    render();
  };

  // change sala
  document.getElementById("ad_sala").onchange = () => {
    a.salaId = document.getElementById("ad_sala").value;
  };

  // spec render
  const specHost = document.getElementById("ad_spec_host");
  const catSel = document.getElementById("ad_cat");

  function renderSpecEdit(cat) {
    const def = CATEGORY_DEFS[cat];
    if (!def) { specHost.innerHTML = ""; return; }

    if (!def.fields || def.fields.length === 0) {
      specHost.innerHTML = `<div class="cardSub">Nessun dato tecnico numerico per questa categoria.</div>`;
      return;
    }

    specHost.innerHTML = def.fields.map(f => {
      const val = a.specs?.[f.key];
      const isSE = (cat === "SE");
      const isPower = (isSE && f.key === "potenzaKW");
      const roAttr = isPower ? "readonly" : "";

      return `
        <div class="specRow">
          <label>${esc(f.label)}</label>
          <div class="specInput">
            <input ${roAttr} type="number" step="any" min="0" inputmode="decimal"
                   id="ad_spec_${f.key}" value="${val ?? ""}" placeholder="0">
            <span class="unit">${esc(f.unit)}</span>
          </div>
        </div>
      `;
    }).join("");

    if (cat === "SE") {
      specHost.insertAdjacentHTML("beforeend", `
        <div class="specRow">
          <label>Percentuale di utilizzo</label>
          <div class="specInput">
            <div style="display:flex;align-items:center;gap:10px;">
              <b id="se_util_value">—%</b>
              <span id="se_util_dot" class="utilDot utilDotGray"></span>
            </div>
          </div>
        </div>
      `);
    }
  }

  function setDotColor(dotEl, pct) {
    dotEl.classList.remove("utilDotGreen","utilDotOrange","utilDotRed","utilDotGray");
    if (pct == null) { dotEl.classList.add("utilDotGray"); return; }
    if (pct < 50) dotEl.classList.add("utilDotGreen");
    else if (pct < 70) dotEl.classList.add("utilDotOrange");
    else dotEl.classList.add("utilDotRed");
  }

  function recalcSE() {
    if (a.categoria !== "SE") return;

    const caricoEl = document.getElementById("ad_spec_caricoA");
    const tensEl   = document.getElementById("ad_spec_tensioneV");
    const tagliaEl = document.getElementById("ad_spec_tagliaA");
    const potEl    = document.getElementById("ad_spec_potenzaKW");

    if (!caricoEl || !tensEl || !tagliaEl || !potEl) return;

    const I = parseNumber(caricoEl.value);
    const V = parseNumber(tensEl.value);
    const In = parseNumber(tagliaEl.value);

    let pKW = null;
    if (I != null && V != null) {
      pKW = (I * V) / 1000;
      potEl.value = Number.isFinite(pKW) ? pKW.toFixed(2) : "";
    } else {
      potEl.value = "";
    }

    let pct = null;
    if (I != null && In != null && In > 0) pct = (I / In) * 100;

    const utilValEl = document.getElementById("se_util_value");
    const utilDotEl = document.getElementById("se_util_dot");
    if (utilValEl && utilDotEl) {
      utilValEl.textContent = (pct == null || !Number.isFinite(pct)) ? "—%" : `${pct.toFixed(1)}%`;
      setDotColor(utilDotEl, (pct == null || !Number.isFinite(pct)) ? null : pct);
    }

    if (!a.specs) a.specs = {};
    if (pKW != null && Number.isFinite(pKW)) a.specs.potenzaKW = Number(pKW.toFixed(2));
  }

  renderSpecEdit(a.categoria);

  if (a.categoria === "SE") {
    recalcSE();
    ["ad_spec_caricoA","ad_spec_tensioneV","ad_spec_tagliaA"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener("input", recalcSE);
    });
  }

  if (a.categoria === "BATTERIE") {
    const ownerTypeSel = document.getElementById("ad_owner_type");
    const ownerIdSel = document.getElementById("ad_owner_id");

    ownerTypeSel.value = a.upsId ? "UPS" : "SE";

    function fillOwner() {
      const list = (ownerTypeSel.value === "UPS") ? upsList : seList;
      ownerIdSel.innerHTML = list.length
        ? list.map(o => `<option value="${o.id}">${esc(o.nome)}</option>`).join("")
        : `<option value="">(Nessun asset presente)</option>`;

      const current = (ownerTypeSel.value === "UPS") ? a.upsId : a.seId;
      if (current) ownerIdSel.value = current;
    }

    ownerTypeSel.onchange = fillOwner;
    fillOwner();
  }

  if (a.categoria === "QEGBT") {
    if (!Array.isArray(a.breakers)) a.breakers = [];

    const listEl = document.getElementById("brk_list");
    const totEl  = document.getElementById("brk_tot");
    const useEl  = document.getElementById("brk_use");
    const avEl   = document.getElementById("brk_av");

    function counts(items) {
      const total = items.length;
      const used = items.filter(x => x.state === "utilizzato").length;
      const avail = items.filter(x => x.state === "disponibile").length;
      return { total, used, avail };
    }

    function renderBreakers() {
      listEl.innerHTML = a.breakers.map((b,i) => `
        <div class="listItem" data-brk-row="${i}">
          <div style="width:100%;">
            <div class="formRow" style="margin:0;">
              <label style="margin:0;">Nome</label>
              <input class="brk_name" value="${esc(b.name ?? "")}">
            </div>
            <div class="formRow" style="margin:8px 0 0 0;">
              <label style="margin:0;">Taglia (A)</label>
              <input class="brk_size" type="number" min="0" step="1" inputmode="numeric" value="${b.sizeA ?? ""}">
            </div>
            <div class="formRow" style="margin:8px 0 0 0;">
              <label style="margin:0;">Stato</label>
              <select class="brk_state">
                <option value="disponibile" ${b.state==="disponibile"?"selected":""}>Disponibile</option>
                <option value="utilizzato" ${b.state==="utilizzato"?"selected":""}>Utilizzato</option>
              </select>
            </div>
          </div>
          <button class="dangerBtn" data-brk-del="${i}">X</button>
        </div>
      `).join("");

      listEl.querySelectorAll("[data-brk-del]").forEach(btn => {
        btn.onclick = () => {
          const idx = Number(btn.dataset.brkDel);
          a.breakers.splice(idx,1);
          renderBreakers();
        };
      });

      const c = counts(a.breakers);
      totEl.textContent = c.total;
      useEl.textContent = c.used;
      avEl.textContent = c.avail;
    }

    document.getElementById("brk_add_btn").onclick = () => {
      const name = document.getElementById("brk_new_name").value.trim();
      const sizeRaw = document.getElementById("brk_new_size").value;
      const state = document.getElementById("brk_new_state").value;

      if (!name) return alert("Inserisci il nome dell’interruttore.");
      const sizeA = (String(sizeRaw).trim()==="" ? null : Number(sizeRaw));
      if (String(sizeRaw).trim()!=="" && (!Number.isFinite(sizeA) || sizeA < 0)) return alert("Taglia non valida.");

      a.breakers.push({ name, sizeA, state });

      document.getElementById("brk_new_name").value = "";
      document.getElementById("brk_new_size").value = "";
      document.getElementById("brk_new_state").value = "disponibile";

      renderBreakers();
    };

    renderBreakers();
  }

  // cambio categoria
  catSel.onchange = () => {
    a.categoria = catSel.value;
    if (!a.specs) a.specs = {};
    renderAssetDetail(null, a.salaId); // rerender completo usando draftAsset
  };

  // SAVE
  document.getElementById("btn_save_asset").onclick = async () => {
    try {
      a.nome = document.getElementById("ad_nome").value.trim();
      a.salaId = document.getElementById("ad_sala").value;
      a.annoInstallazione = (document.getElementById("ad_anno").value === "" ? null : Number(document.getElementById("ad_anno").value));
      a.note = document.getElementById("ad_note").value;

      if (!a.nome) return alert("Inserisci il nome dell’asset.");

      if (a.categoria === "QEGBT") {
        a.marca = "";
      } else {
        a.marca = (document.getElementById("ad_marca")?.value || "").trim();
        if (!a.marca) return alert("Inserisci la marca.");
      }

      if (a.categoria === "CDZ") {
        a.cdzTipo = document.getElementById("ad_cdz_tipo").value;
        a.cdzMandata = document.getElementById("ad_cdz_mandata").value;
      } else {
        delete a.cdzTipo; delete a.cdzMandata;
      }

      if (a.categoria === "BATTERIE") {
        a.battTipo = document.getElementById("ad_batt_tipo").value;
        const t = document.getElementById("ad_owner_type").value;
        const oid = document.getElementById("ad_owner_id").value;
        if (!oid) return alert("Seleziona la SE o l’UPS associato.");
        a.seId = (t === "SE") ? oid : null;
        a.upsId = (t === "UPS") ? oid : null;
      } else {
        a.seId = null; a.upsId = null;
      }

      const def = CATEGORY_DEFS[a.categoria];
      const newSpecs = {};
      if (def && def.fields && def.fields.length > 0) {
        for (const f of def.fields) {
          const el = document.getElementById(`ad_spec_${f.key}`);
          if (!el) continue;
          const raw = el.value;
          if (String(raw).trim()==="") continue;
          const n = parseNumber(raw);
          if (n == null) return alert(`Valore non valido per "${f.label}".`);
          newSpecs[f.key] = n;
        }
      }

      if (a.categoria === "SE") {
        const I = newSpecs.caricoA;
        const V = newSpecs.tensioneV;
        if (I != null && V != null) newSpecs.potenzaKW = Number(((I*V)/1000).toFixed(2));
        else delete newSpecs.potenzaKW;
      }

      a.specs = newSpecs;

      if (a.categoria === "QEGBT") {
        const rows = document.querySelectorAll("#brk_list [data-brk-row]");
        const breakers = [];
        rows.forEach(row => {
          const name = (row.querySelector(".brk_name")?.value || "").trim();
          const sizeRaw = row.querySelector(".brk_size")?.value ?? "";
          const state = row.querySelector(".brk_state")?.value || "disponibile";
          if (!name) return;
          let sizeA = null;
          if (String(sizeRaw).trim()!=="") {
            sizeA = Number(sizeRaw);
            if (!Number.isFinite(sizeA) || sizeA < 0) throw new Error("Taglia interruttore non valida.");
          }
          breakers.push({ name, sizeA, state });
        });
        a.breakers = breakers;
      } else {
        delete a.breakers;
      }

      a.centraleId = currentCentraleId;
      // ✅ memorizzo da dove arrivavo PRIMA di cambiare route
      const backFrom = route.from;
      const backSalaId = route.salaId;

      await save("asset", a);
      draftAsset = null;

      // ✅ se arrivo da sala, mantengo il contesto anche dopo il salvataggio
      if (backFrom === "sale" && backSalaId) {
        route = { view: "assetDetail", id: a.id, from: "sale", salaId: backSalaId };
      } else {
        route = { view: "assetDetail", id: a.id };
      }

      setActiveTab("asset");
      render();
    } catch (e) {
      console.error(e);
      alert(e?.message || "Errore durante il salvataggio.");
    }
  };

  const delBtn = document.getElementById("btn_delete_asset");
  if (delBtn) {
    delBtn.onclick = async () => {
      if (!confirm("Eliminare questo asset?")) return;
      await remove("asset", a.id);
      route = { view:"assetList" };
      setActiveTab("asset");
      render();
    };
  }
}

/* =========================
   Stili minimi (mantengo i tuoi layout base)
   NB: NON ridefinisco i tab qui per non confliggere con styles.css
========================= */
injectMiniStyles();
function injectMiniStyles() {
  const css = `
    .cardBox{ background:#fff; color:${BLUE}; border:1px solid rgba(0,0,0,.12); border-radius:6px; padding:12px; margin:12px 0; }
    .innerBox{ background:#f7f9fb; margin-top:10px; }
    .cardHead{ display:flex; align-items:center; justify-content:space-between; gap:10px; }
    .cardTitle{ font-weight:800; font-size:15px; }
    .cardSub{ font-size:13px; opacity:.85; margin-top:2px; }
    .primaryBtn{ background:${BLUE}; color:#fff; border:none; padding:10px 12px; border-radius:6px; font-weight:800; cursor:pointer; margin-top:8px; }
    .dangerBtn{ background:#fff; color:#b00020; border:1px solid #b00020; padding:10px 12px; border-radius:6px; font-weight:800; cursor:pointer; }
    .smallBtn{ background:#fff; color:${BLUE}; border:1px solid ${BLUE}; padding:8px 10px; border-radius:6px; font-weight:800; cursor:pointer; white-space:nowrap; }
    .smallBtn.active{ background:${BLUE}; color:#fff; }
    .rowBtns{ display:flex; gap:10px; flex-wrap:wrap; margin:10px 0; }
    .sectionTitle{ font-weight:900; margin-bottom:10px; }
    .formRow{ display:flex; flex-direction:column; gap:6px; margin:10px 0; }
    .formRow label{ font-weight:800; font-size:13px; }
    .textarea{ min-height:90px; width:100%; }
    .kv{ display:flex; justify-content:space-between; gap:10px; padding:6px 0; }
    .kv span{ opacity:.85; }
    .listItem{ display:flex; justify-content:space-between; gap:10px; align-items:center; padding:10px; border:1px solid rgba(0,0,0,.08); border-radius:6px; background:#fff; margin:8px 0; }
    .specRow{ display:flex; flex-direction:column; gap:6px; margin:10px 0; }
    .specRow label{ font-weight:800; font-size:13px; }
    .specInput{ display:flex; gap:10px; align-items:center; }
    .specInput input{ flex:1; }
    .unit{ font-weight:900; min-width:44px; text-align:right; color:${BLUE}; opacity:.85; }
    .star {margin-left: 8px; cursor: pointer; font-size: 18px; color: #ccc;}
    .star.active { color: gold;}
    .pref-btn { background: linear-gradient(135deg, rgb(0, 70, 145), rgb(0, 90, 180)); color: white; border: none; position: relative; overflow: hidden;}
    .pref-content { display: flex; align-items: center; gap: 12px;}
    .pref-icon { width: 36px; height: 36px; background: white; color: rgb(0, 70, 145); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: bold;}
    .pref-btn .title { color: white;}
    .pref-btn .desc { color: rgba(255,255,255,0.8); font-size: 12px;}
    .pref-btn:active { transform: scale(0.97);}
    .pref-btn:hover { background: linear-gradient(135deg, rgb(0, 60, 130), rgb(0, 80, 160));}
    .home-actions { display: flex; flex-direction: column; gap: 12px;}
    .asset-actions{ display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:nowrap;}
    .asset-actions .backBtn{ flex:0 0 auto; height:44px; padding:0 12px; font-size:13px; white-space:nowrap; display:flex; align-items:center; justify-content:center;}
    .asset-actions .rightActions{ display:flex; gap:10px; margin-left:auto; align-items:center;}
    .asset-actions .rightActions button{ width:110px; height:44px; padding:0; display:flex; align-items:center; justify-content:center;}
    .asset-actions .primaryBtn,
    .asset-actions .dangerBtn,
    .asset-actions .smallBtn{ margin:0 !important;}
    .header-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px;}
    .pill{ display:inline-flex; align-items:center; justify-content:center; padding:6px 10px; border-radius:999px; font-weight:900; font-size:12px; margin-bottom:10px; border:1px solid rgba(0,0,0,.12);}
    .pill-ok{ background:#e7f6ea; color:#1b5e20; border-color:#b7e1c0; }
    .pill-warn{ background:#fff6e5; color:#8a5a00; border-color:#ffd59a; }
    .pill-bad{ background:#fde7e9; color:#b00020; border-color:#f5b5bb; }

  `;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
}
