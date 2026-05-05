import { uuid, getAll, getOne, save, remove, getByIndex } from "./db.js";

const app = document.getElementById("app");
const tabSale = document.getElementById("tabSale");
const tabAsset = document.getElementById("tabAsset");

const BLUE = "rgb(0, 70, 145)";

// === Draft per mantenere i dati durante la creazione (evita reset categoria) ===
let draftAsset = null;
let draftSala = null;

/* =========================
   CATEGORIE E CAMPI TECNICI (numerici)
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

// routing
let route = { view: "saleList" }; // saleList | saleDetail | assetList | assetDetail

let assetCategoryFilter = null; // es. "SE", "CDZ", null = nessuna selezione

tabSale.onclick  = () => { route = { view: "saleList" }; setActiveTab("sale"); render(); };
tabAsset.onclick = () => { route = { view: "assetList" }; setActiveTab("asset"); render(); };

setActiveTab("sale");
render();

/* =========================
   UTIL
========================= */
function setActiveTab(which) {
  tabSale.classList.toggle("active", which === "sale");
  tabAsset.classList.toggle("active", which === "asset");
}

async function updateTabCounts() {
  const sale = await getAll("sale");
  const asset = await getAll("asset");
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
  await updateTabCounts();
  if (route.view === "saleList") return renderSaleList();
  if (route.view === "saleDetail") return renderSaleDetail(route.id);
  if (route.view === "assetList") return renderAssetList();
  if (route.view === "assetDetail") return renderAssetDetail(route.id, route.presetSalaId || null);
}

/* =========================
   SALE LIST
========================= */
async function renderSaleList() {
  const sale = (await getAll("sale")).sort((a,b)=> (a.nome||"").localeCompare(b.nome||""));
  const asset = await getAll("asset");

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
   SALE DETAIL (crea/modifica)
========================= */
async function renderSaleDetail(id) {
  const isNew = !id;

  const s = isNew ? (draftSala ?? {
    id: uuid(), nome:"", edificio:"Plana", piano:"", note:""
  }) : await getOne("sale", id);

  if (!s) { route = { view:"saleList" }; return render(); }

  const assets = await getByIndex("asset", "salaId", s.id);

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

  // apri asset
  app.querySelectorAll("[data-open-asset]").forEach(btn => {
    btn.onclick = () => {
      route = { view:"assetDetail", id: btn.dataset.openAsset };
      setActiveTab("asset");
      render();
    };
  });

  // indietro
  document.getElementById("btn_back_sale").onclick = () => {
    draftSala = null;
    route = { view:"saleList" };
    setActiveTab("sale");
    render();
  };

  // crea/salva
  document.getElementById("btn_save_sala").onclick = async () => {
    s.nome = document.getElementById("sd_nome").value.trim();
    s.edificio = document.getElementById("sd_edificio").value;
    s.piano = document.getElementById("sd_piano").value.trim();
    s.note = document.getElementById("sd_note").value;

    if (!s.nome) return alert("Inserisci il nome della sala.");

    await save("sale", s);
    draftSala = null;
    route = { view:"saleDetail", id: s.id };
    setActiveTab("sale");
    render();
  };

  // aggiungi asset in sala
  const btnAdd = document.getElementById("btn_add_asset_from_sala");
  if (btnAdd) {
    btnAdd.onclick = () => {
      draftAsset = null;
      route = { view:"assetDetail", id: null, presetSalaId: s.id };
      setActiveTab("asset");
      render();
    };
  }

  // elimina sala
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
async function renderAssetList() {  const sale = await getAll("sale");
  const asset = await getAll("asset");

  // === conteggio asset per categoria ===
  const countByCat = {};
  for (const a of asset) {
    countByCat[a.categoria] = (countByCat[a.categoria] || 0) + 1;
  }

  const totalCount = asset.length;

  // === categorie con almeno 1 asset ===
  const categories = Object.keys(CATEGORY_DEFS)
    .filter(cat => countByCat[cat]);

  app.innerHTML = `
    <h2>Asset</h2>

    <!-- FILTRI -->
    <div class="cardBox">
      <div class="sectionTitle">Filtra per tipologia</div>
      <div class="rowBtns">

        <!-- TUTTE -->
        <button class="smallBtn ${assetCategoryFilter === "ALL" ? "active" : ""}"
                data-cat-filter="ALL">
          Tutte (${totalCount})
        </button>

        ${categories.map(cat => `
          <button class="smallBtn ${assetCategoryFilter === cat ? "active" : ""}"
                  data-cat-filter="${cat}">
            ${CATEGORY_DEFS[cat].label} (${countByCat[cat]})
          </button>
        `).join("")}

      </div>
    </div>

    <!-- ELENCO -->
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
              .filter(a =>
                assetCategoryFilter === "ALL"
                  ? true
                  : a.categoria === assetCategoryFilter
              )
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

  // === click filtri ===
  app.querySelectorAll("[data-cat-filter]").forEach(btn => {
    btn.onclick = () => {
      assetCategoryFilter = btn.dataset.catFilter;
      renderAssetList();
    };
  });

  // === apri asset ===
  app.querySelectorAll("[data-open-asset]").forEach(btn => {
    btn.onclick = () => {
      route = { view:"assetDetail", id: btn.dataset.openAsset };
      setActiveTab("asset");
      render();
    };
  });

  // === nuovo asset ===
  document.getElementById("btn_new_asset").onclick = () => {
    assetCategoryFilter = "ALL";
    route = { view:"assetDetail", id: null };
    setActiveTab("asset");
    render();
  };
}


/* =========================
   ASSET DETAIL (crea/modifica)
   - BATTERIE: tipo batteria + associazione SE/UPS
   - CDZ: tipologia + mandata
   - SE: potenza e percentuale calcolate
========================= */
async function renderAssetDetail(id, presetSalaId = null) {
  const sale = await getAll("sale");
  const allAssets = await getAll("asset");
  const isNew = !id;

  if (isNew && !draftAsset) {
    draftAsset = {
      id: uuid(),
      nome: "",
      salaId: presetSalaId || (sale[0]?.id || ""),
      categoria: "SE",
      marca: "",
      annoInstallazione: null,
      specs: {},
      // batterie
      battTipo: "ELI",
      seId: null,
      upsId: null,
      // cdz
      cdzTipo: "ED monoblocco",
      cdzMandata: "Dislocamento",
      // qegbt
      breakers: [],
      note: ""
    };
  }

  let a = isNew ? draftAsset : await getOne("asset", id);
  if (!a) { route = { view:"assetList" }; return render(); }

  const saleOptions = sale
    .map(s => `<option value="${s.id}" ${s.id===a.salaId?'selected':''}>${esc(s.nome)}</option>`)
    .join("");

  const catOptions = Object.keys(CATEGORY_DEFS)
    .map(k => `<option value="${k}" ${k===a.categoria?'selected':''}>${esc(CATEGORY_DEFS[k].label)}</option>`)
    .join("");

  const sala = sale.find(s => s.id === a.salaId);
  const ubic = `${sala?.edificio || "—"} · Piano ${sala?.piano || "—"} · ${sala?.nome || "—"}`;

  // liste per batterie owner
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

    <div class="rowBtns">
      <button class="smallBtn" id="btn_back_asset">← Indietro</button>
      <button class="primaryBtn" id="btn_save_asset">Salva</button>
      ${(!isNew) ? `<button class="dangerBtn" id="btn_delete_asset">Elimina</button>` : ``}
    </div>
  `;

  // back
  document.getElementById("btn_back_asset").onclick = () => {
    draftAsset = null;
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

    // SE: riga percentuale utilizzo
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

    // kW = A*V/1000
    let pKW = null;
    if (I != null && V != null) {
      pKW = (I * V) / 1000;
      potEl.value = Number.isFinite(pKW) ? pKW.toFixed(2) : "";
    } else {
      potEl.value = "";
    }

    // %
    let pct = null;
    if (I != null && In != null && In > 0) pct = (I / In) * 100;

    const utilValEl = document.getElementById("se_util_value");
    const utilDotEl = document.getElementById("se_util_dot");
    if (utilValEl && utilDotEl) {
      utilValEl.textContent = (pct == null || !Number.isFinite(pct)) ? "—%" : `${pct.toFixed(1)}%`;
      setDotColor(utilDotEl, (pct == null || !Number.isFinite(pct)) ? null : pct);
    }

    // salva in memoria
    if (!a.specs) a.specs = {};
    if (pKW != null && Number.isFinite(pKW)) a.specs.potenzaKW = Number(pKW.toFixed(2));
  }

  // init specs
  renderSpecEdit(a.categoria);

  // listeners SE live
  if (a.categoria === "SE") {
    recalcSE();
    ["ad_spec_caricoA","ad_spec_tensioneV","ad_spec_tagliaA"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener("input", recalcSE);
    });
  }

  // batteria: popola owner
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

  // QEGBT: interruttori UI
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

  // cambio categoria: non resetta più a SE grazie al draft
  catSel.onchange = () => {
    a.categoria = catSel.value;
    if (!a.specs) a.specs = {};
    renderAssetDetail(null, a.salaId); // rerender completo usando draftAsset (categoria non si perde)
  };

  // SAVE
  document.getElementById("btn_save_asset").onclick = async () => {
    try {
      a.nome = document.getElementById("ad_nome").value.trim();
      a.salaId = document.getElementById("ad_sala").value;
      a.annoInstallazione = (document.getElementById("ad_anno").value === "" ? null : Number(document.getElementById("ad_anno").value));
      a.note = document.getElementById("ad_note").value;

      if (!a.nome) return alert("Inserisci il nome dell’asset.");

      // Marca non richiesta su QEGBT
      if (a.categoria === "QEGBT") {
        a.marca = "";
      } else {
        a.marca = (document.getElementById("ad_marca")?.value || "").trim();
        if (!a.marca) return alert("Inserisci la marca.");
      }

      // CDZ: salva tipologia/mandata
      if (a.categoria === "CDZ") {
        a.cdzTipo = document.getElementById("ad_cdz_tipo").value;
        a.cdzMandata = document.getElementById("ad_cdz_mandata").value;
      } else {
        delete a.cdzTipo; delete a.cdzMandata;
      }

      // BATTERIE: salva tipo + owner
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

      // SPECS numerici
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

      // SE: forza potenza calcolata
      if (a.categoria === "SE") {
        const I = newSpecs.caricoA;
        const V = newSpecs.tensioneV;
        if (I != null && V != null) newSpecs.potenzaKW = Number(((I*V)/1000).toFixed(2));
        else delete newSpecs.potenzaKW;
      }

      a.specs = newSpecs;

      // QEGBT: salva interruttori (da DOM)
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

      await save("asset", a);
      draftAsset = null;

      route = { view:"assetDetail", id: a.id };
      setActiveTab("asset");
      render();
    } catch (e) {
      console.error(e);
      alert(e?.message || "Errore durante il salvataggio.");
    }
  };

  // delete
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
   Stili minimi
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
    .smallBtn.active{ background: rgb(0, 70, 145);color:#fff;}
    .rowBtns{ display:flex; gap:10px; flex-wrap:wrap; margin:10px 0; }
    .sectionTitle{ font-weight:900; margin-bottom:10px; }
    .formRow{ display:flex; flex-direction:column; gap:6px; margin:10px 0; }
    .formRow label{ font-weight:800; font-size:13px; }
    textarea{ min-height:90px; }
    .kv{ display:flex; justify-content:space-between; gap:10px; padding:6px 0; }
    .kv span{ opacity:.85; }
    .listItem{ display:flex; justify-content:space-between; gap:10px; align-items:center; padding:10px; border:1px solid rgba(0,0,0,.08); border-radius:6px; background:#fff; margin:8px 0; }
    .specRow{ display:flex; flex-direction:column; gap:6px; margin:10px 0; }
    .specRow label{ font-weight:800; font-size:13px; }
    .specInput{ display:flex; gap:10px; align-items:center; }
    .specInput input{ flex:1; }
    .unit{ font-weight:900; min-width:44px; text-align:right; color:${BLUE}; opacity:.85; }

    .utilDot{ width:10px; height:10px; border-radius:999px; display:inline-block; border:1px solid rgba(0,0,0,.15); }
    .utilDotGray{ background:#b0b0b0; }
    .utilDotGreen{ background:#2ecc71; }
    .utilDotOrange{ background:#f39c12; }
    .utilDotRed{ background:#e74c3c; }

    .tab-btn{background: ${BLUE};color: #fff;border: 1px solid ${BLUE};}
    .tab-btn.active{ background: #fff !important; color: ${BLUE} !important; border: 1px solid ${BLUE} !important;}

  `;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
}