"use strict";

/* =====================================================
   Cotação — conversor e lista de moedas
   Fonte dos dados: currency-api (@fawazahmed0), cotações diárias
   com histórico por data. Gratuita e sem chave.
   ===================================================== */

/* ---------- Moedas suportadas -> país da bandeira (ISO 3166-1 alpha-2) ---------- */
const FLAGS = {
  usd: "us", eur: "eu", gbp: "gb", jpy: "jp", cad: "ca", aud: "au", chf: "ch",
  cny: "cn", inr: "in", mxn: "mx", zar: "za", sek: "se", nok: "no", dkk: "dk",
  nzd: "nz", sgd: "sg", hkd: "hk", krw: "kr", thb: "th", myr: "my", php: "ph",
  idr: "id", vnd: "vn", clp: "cl", cop: "co", pen: "pe", ars: "ar", uyu: "uy",
  pyg: "py", bob: "bo", ves: "ve", aed: "ae", sar: "sa", qar: "qa", kwd: "kw",
  bhd: "bh", omr: "om", jod: "jo", ils: "il", try: "tr", rub: "ru", uah: "ua",
  pkr: "pk", bdt: "bd", lkr: "lk", npr: "np", bgn: "bg", czk: "cz", huf: "hu",
  pln: "pl", ron: "ro", isk: "is", rsd: "rs", gel: "ge", kzt: "kz", uzs: "uz",
  azn: "az", amd: "am", brl: "br", crc: "cr", dop: "do", gtq: "gt", hnl: "hn",
  nio: "ni", pab: "pa", jmd: "jm", ttd: "tt", bbd: "bb", bsd: "bs", cup: "cu",
  egp: "eg", ngn: "ng", ghs: "gh", kes: "ke", ugx: "ug", tzs: "tz", mad: "ma",
  dzd: "dz", tnd: "tn", etb: "et", twd: "tw", mop: "mo", mmk: "mm", khr: "kh",
  lak: "la", mnt: "mn", iqd: "iq", irr: "ir", lbp: "lb", afn: "af", all: "al",
  mkd: "mk", mdl: "md", byn: "by", bam: "ba",
};

const DESTAQUES = ["usd", "eur", "gbp", "ars", "jpy", "cad", "chf", "cny"];

/* ---------- APIs (com plano B) ---------- */
const API = {
  latest: [
    "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json",
    "https://latest.currency-api.pages.dev/v1/currencies/usd.json",
  ],
  dated: (d) => [
    `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${d}/v1/currencies/usd.json`,
    `https://${d}.currency-api.pages.dev/v1/currencies/usd.json`,
  ],
};
const DIAS_HISTORICO = 7;
const CACHE_KEY = "cotacao:v1";
const CACHE_MS = 15 * 60 * 1000;

/* ---------- Utilidades ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const nf = (min, max) => new Intl.NumberFormat("pt-BR", { minimumFractionDigits: min, maximumFractionDigits: max });
const nfPct = nf(2, 2);
const displayNames = (() => {
  try { return new Intl.DisplayNames(["pt-BR"], { type: "currency" }); } catch { return null; }
})();

function nomeMoeda(code) {
  try {
    const n = displayNames && displayNames.of(code.toUpperCase());
    if (n && n !== code.toUpperCase()) return n.charAt(0).toUpperCase() + n.slice(1);
  } catch { /* ignora */ }
  return code.toUpperCase();
}

function fmtValor(v, { minimo = 2 } = {}) {
  if (!Number.isFinite(v)) return "—";
  const max = Math.abs(v) >= 100 ? 2 : Math.abs(v) >= 1 ? 4 : 6;
  return nf(minimo, Math.max(max, minimo)).format(v);
}

function fmtData(iso) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function deslocarData(iso, dias) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + dias));
  return dt.toISOString().slice(0, 10);
}

function lerNumero(texto) {
  let t = String(texto).trim().replace(/\s/g, "");
  if (!t) return NaN;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  return Number(t);
}

/* ---------- Ícones (SVG inline) ---------- */
const ICON = {
  up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
  down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>',
  flat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"/></svg>',
};

/* ---------- Rede ---------- */
async function buscarPrimeiro(urls, ms = 8000) {
  let ultimoErro;
  for (const url of urls) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), ms);
    try {
      const r = await fetch(url, { signal: ctl.signal });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) {
      ultimoErro = e;
    } finally {
      clearTimeout(timer);
    }
  }
  throw ultimoErro || new Error("Falha de rede");
}

function lerCache() {
  try {
    const c = JSON.parse(sessionStorage.getItem(CACHE_KEY));
    if (c && Date.now() - c.t < CACHE_MS) return c.m;
  } catch { /* sem cache */ }
  return null;
}
function gravarCache(m) {
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), m })); } catch { /* ok */ }
}

/** Carrega a cotação mais recente + os últimos dias (do mais antigo para o mais novo). */
async function carregarMercado() {
  const cache = lerCache();
  if (cache) return cache;

  const hoje = await buscarPrimeiro(API.latest);
  if (!hoje || !hoje.usd) throw new Error("Resposta inesperada da API");

  const datas = Array.from({ length: DIAS_HISTORICO }, (_, i) => deslocarData(hoje.date, -(i + 1)));
  const antigos = await Promise.allSettled(datas.map((d) => buscarPrimeiro(API.dated(d), 6000)));

  const porData = new Map();
  for (const p of antigos) {
    if (p.status === "fulfilled" && p.value && p.value.usd) porData.set(p.value.date, p.value.usd);
  }
  porData.set(hoje.date, hoje.usd);

  const dias = [...porData.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, rates]) => ({ date, rates: { ...rates, usd: 1 } }));

  const atual = dias[dias.length - 1].rates;
  const codigos = Object.keys(FLAGS)
    .filter((c) => Number.isFinite(atual[c]) && atual[c] > 0)
    .sort((a, b) => nomeMoeda(a).localeCompare(nomeMoeda(b), "pt-BR"));

  const mercado = { data: hoje.date, dias, codigos };
  gravarCache(mercado);
  return mercado;
}

/* ---------- Cálculos ---------- */
const taxa = (rates, de, para) => rates[para] / rates[de];

function serie(m, de, para) {
  return m.dias.map((d) => taxa(d.rates, de, para)).filter(Number.isFinite);
}
function variacao(s) {
  if (s.length < 2) return null;
  return s[s.length - 1] / s[s.length - 2] - 1;
}
function direcao(v) {
  if (v == null || Math.abs(v) < 0.00005) return "flat";
  return v > 0 ? "up" : "down";
}

/* ---------- Componentes visuais ---------- */
function bandeira(code, cls = "") {
  const pais = FLAGS[code];
  if (!pais) return `<span class="flag flag--fallback ${cls}">${code.toUpperCase()}</span>`;
  return `<img class="flag ${cls}" src="https://flagcdn.com/w80/${pais}.png"
    srcset="https://flagcdn.com/w80/${pais}.png 1x, https://flagcdn.com/w160/${pais}.png 2x"
    alt="" width="36" height="36" loading="lazy" data-code="${code.toUpperCase()}" />`;
}

// Se a imagem da bandeira não carregar, mostra a sigla da moeda no lugar.
document.addEventListener(
  "error",
  (e) => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement) || !img.classList.contains("flag")) return;
    const span = document.createElement("span");
    span.className = img.className + " flag--fallback";
    span.textContent = img.dataset.code || "";
    img.replaceWith(span);
  },
  true
);

function selo(v, { sufixo = "" } = {}) {
  const dir = direcao(v);
  if (v == null) return `<span class="chg chg--flat" title="Sem dado do dia anterior">${ICON.flat}—</span>`;
  const txt = (dir === "up" ? "+" : dir === "down" ? "−" : "") + nfPct.format(Math.abs(v) * 100) + "%";
  const leitor = { up: "valorizou", down: "desvalorizou", flat: "estável" }[dir];
  return `<span class="chg chg--${dir}" title="Variação em relação ao dia anterior">${ICON[dir]}${txt}${sufixo}<span class="sr-only"> (${leitor} no dia)</span></span>`;
}

function minigrafico(s) {
  if (s.length < 2) return "";
  const w = 84, h = 28;
  const min = Math.min(...s), max = Math.max(...s), faixa = max - min || 1;
  const pts = s
    .map((v, i) => `${((i / (s.length - 1)) * w).toFixed(1)},${(h - 3 - ((v - min) / faixa) * (h - 6)).toFixed(1)}`)
    .join(" ");
  const dir = direcao(s[s.length - 1] / s[0] - 1);
  return `<svg class="spark spark--${dir}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

/* ---------- Tema claro/escuro ---------- */
function iniciarTema() {
  const btn = $("#tema");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const root = document.documentElement;
    const atual =
      root.dataset.theme || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    const novo = atual === "dark" ? "light" : "dark";
    root.dataset.theme = novo;
    try { localStorage.setItem("cotacao:tema", novo); } catch { /* ok */ }
  });
}

/* ---------- Estados de carregamento / erro ---------- */
function mostrarErro(el, retry) {
  el.innerHTML = `<div class="state">Não consegui carregar as cotações agora.<br />Verifique a conexão e tente de novo.<br /><button type="button">Tentar novamente</button></div>`;
  $("button", el).addEventListener("click", retry);
}

/* =====================================================
   Página: Conversor
   ===================================================== */
function iniciarConversor(m) {
  const valor = $("#valor");
  const de = $("#from");
  const para = $("#to");
  const resultado = $("#resultado");
  const atual = m.dias[m.dias.length - 1].rates;

  const opcoes = m.codigos
    .map((c) => `<option value="${c}">${c.toUpperCase()} — ${nomeMoeda(c)}</option>`)
    .join("");
  de.innerHTML = opcoes;
  para.innerHTML = opcoes;
  de.value = "usd";
  para.value = "brl";

  const flagDe = $("#flag-from");
  const flagPara = $("#flag-to");

  function calcular() {
    flagDe.innerHTML = bandeira(de.value);
    flagPara.innerHTML = bandeira(para.value);

    const n = lerNumero(valor.value);
    const t = taxa(atual, de.value, para.value);
    const v = variacao(serie(m, de.value, para.value));
    const ehNumero = Number.isFinite(n) && n >= 0;
    const qtd = ehNumero ? n : 1;
    const conv = qtd * t;

    resultado.innerHTML = `
      <div class="result__from">${nf(2, 6).format(qtd)} ${de.value.toUpperCase()} =</div>
      <div class="result__to">${nf(2, conv < 1 ? 6 : 2).format(conv)}<small>${para.value.toUpperCase()}</small></div>
      <div class="result__meta">
        <span>1 ${de.value.toUpperCase()} = ${fmtValor(t, { minimo: 2 })} ${para.value.toUpperCase()}</span>
        ${selo(v)}
        <span>no dia</span>
      </div>`;
  }

  valor.addEventListener("input", calcular);
  de.addEventListener("change", calcular);
  para.addEventListener("change", calcular);
  $("#swap").addEventListener("click", () => {
    [de.value, para.value] = [para.value, de.value];
    calcular();
  });
  $("#form-conv").addEventListener("submit", (e) => { e.preventDefault(); calcular(); });

  calcular();
}

function iniciarDestaques(m) {
  const alvo = $("#destaques");
  if (!alvo) return;
  const atual = m.dias[m.dias.length - 1].rates;
  alvo.innerHTML = DESTAQUES.filter((c) => atual[c])
    .map((c) => {
      const s = serie(m, c, "brl");
      const v = variacao(s);
      return `
      <a class="card quote" href="moedas.html?q=${c}">
        <div class="quote__top">
          ${bandeira(c)}
          <div class="quote__name">
            <div class="quote__code">${c.toUpperCase()}</div>
            <div class="quote__label">${nomeMoeda(c)}</div>
          </div>
        </div>
        <div class="quote__bottom">
          <div class="quote__value"><small>R$</small>${fmtValor(atual.brl / atual[c])}</div>
          <div class="quote__side">${selo(v)}${minigrafico(s)}</div>
        </div>
      </a>`;
    })
    .join("");
}

/* =====================================================
   Página: Lista de moedas
   ===================================================== */
function iniciarLista(m) {
  const corpo = $("#currency-table-body");
  const busca = $("#busca");
  const ordem = $("#ordem");
  const atual = m.dias[m.dias.length - 1].rates;

  const itens = m.codigos
    .filter((c) => c !== "brl")
    .map((c) => {
      const s = serie(m, c, "brl");
      return { c, nome: nomeMoeda(c), valor: atual.brl / atual[c], v: variacao(s), s };
    });

  const q0 = new URLSearchParams(location.search).get("q");
  if (q0) busca.value = q0;

  function normalizar(t) {
    return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  }

  function desenhar() {
    const termo = normalizar(busca.value.trim());
    let lista = itens.filter((i) => !termo || normalizar(i.nome).includes(termo) || i.c.includes(termo));

    const ord = ordem.value;
    lista.sort((a, b) => {
      if (ord === "valor") return b.valor - a.valor;
      if (ord === "alta") return (b.v ?? -Infinity) - (a.v ?? -Infinity);
      if (ord === "queda") return (a.v ?? Infinity) - (b.v ?? Infinity);
      return a.nome.localeCompare(b.nome, "pt-BR");
    });

    $("#contagem").textContent = `${lista.length} ${lista.length === 1 ? "moeda" : "moedas"}`;

    if (!lista.length) {
      corpo.innerHTML = `<tr><td colspan="4" class="empty">Nenhuma moeda encontrada para “${busca.value.replace(/[<>&"]/g, "")}”.</td></tr>`;
      return;
    }
    corpo.innerHTML = lista
      .map(
        (i) => `
      <tr>
        <td><div class="coin">${bandeira(i.c, "flag--sm")}<div><strong>${i.nome}</strong><span>${i.c.toUpperCase()}</span></div></div></td>
        <td class="num price">R$ ${fmtValor(i.valor, { minimo: 2 })}</td>
        <td class="num">${selo(i.v)}</td>
        <td class="num hide-sm">${minigrafico(i.s)}</td>
      </tr>`
      )
      .join("");
  }

  busca.addEventListener("input", desenhar);
  ordem.addEventListener("change", desenhar);
  desenhar();
}

/* =====================================================
   Início
   ===================================================== */
async function iniciar() {
  iniciarTema();
  const pagina = document.body.dataset.page;
  const area = $("#conteudo");

  async function carregar() {
    try {
      const m = await carregarMercado();
      const info = $("#atualizado");
      if (info) info.textContent = `Cotações de ${fmtData(m.data)} · variação comparada ao dia anterior`;
      if (pagina === "conversor") {
        iniciarConversor(m);
        iniciarDestaques(m);
      } else if (pagina === "moedas") {
        iniciarLista(m);
      }
    } catch (e) {
      console.error("Erro ao carregar cotações:", e);
      if (area) mostrarErro(area, () => { try { sessionStorage.removeItem(CACHE_KEY); } catch {} location.reload(); });
    }
  }
  carregar();
}

iniciar();
