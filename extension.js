const vscode = require("vscode");
const crypto = require("crypto");
const { verifyLicenseToken, getDaysRemaining, formatExpiration, fetchLicenseByCode } = require("./lib/license");
const { trackEvent } = require("./lib/telemetry");

const FREE_THEME = "ZN Night Gold";
const THEMES = [
  {
    name: "ZN Night Gold", vip: false, price: "BEPUl", file: "zn-night-gold.svg", tone: "Gold",
    accent: "#D6A85A", bg: "#0A0A0A", desc: "Qora fon, oltin sintaksis — klassik va issiq."
  },
  {
    name: "ZN Ivory", vip: false, price: "BEPUl", file: "zn-ivory.svg", tone: "Ivory",
    accent: "#B09060", bg: "#F5F1E8", desc: "Toza, minimalist yorug' estetika, krema aksent."
  },
  {
    name: "ZN Emerald Royale", vip: true, price: "$4", file: "zn-emerald-royale.svg", tone: "Emerald",
    accent: "#2ECC71", bg: "#0D1F15", desc: "Chuqur yashil sirt, oltin aksent bilan."
  },
  {
    name: "ZN Rose Royale", vip: true, price: "$4", file: "zn-rose-royale.svg", tone: "Rose",
    accent: "#E88FA0", bg: "#1A0D12", desc: "Qoʻngʻir gul va roʻzgʻor aksent."
  },
  {
    name: "ZN Midnight Spire", vip: true, price: "$4", file: "zn-midnight-spire.svg", tone: "Midnight",
    accent: "#5B8CDB", bg: "#090E1A", desc: "Tungi ko'k sirt, me'moriy oltin aksent."
  },
  {
    name: "ZN Obsidian", vip: true, price: "$4", file: "zn-obsidian.svg", tone: "Obsidian",
    accent: "#9B9B9B", bg: "#000000", desc: "OLED qora, obsidian parlanishi."
  },
  {
    name: "ZN Solar Flare", vip: true, price: "$4", file: "zn-solar-flare.svg", tone: "Solar",
    accent: "#FF7043", bg: "#140A04", desc: "Qoʻngʻir koʻmirda yorqin olov aksenti."
  },
  {
    name: "ZN Nordic", vip: true, price: "$4", file: "zn-nordic.svg", tone: "Nordic",
    accent: "#81A1C1", bg: "#ECEFF4", desc: "Arktik kun yorugʻi, muvozanatli sintaksis."
  },
  {
    name: "ZN Nordic Dark", vip: true, price: "$4", file: "zn-nordic-dark.svg", tone: "Nordic Dark",
    accent: "#88C0D0", bg: "#0E1117", desc: "Qutb tuni estetikasi, muzli aksent."
  },
  {
    name: "ZN Cyberpunk", vip: true, price: "$4", file: "zn-cyberpunk.svg", tone: "Cyberpunk",
    accent: "#FF2D9B", bg: "#030412", desc: "Neyon pushti va elektr ko'k kontrast."
  }
];
const VIP_THEMES = new Set(THEMES.filter(t => t.vip).map(t => t.name));
const VERSION = "1.2.0";

// ──────────────────────── LICENSE HELPERS ────────────────────────

function getLicenseInfo(context) {
  const token = context.globalState.get("vipLicenseToken", "");
  if (!token) return { active: false, state: "FREE", payload: null, daysRemaining: 0, formattedExpires: "" };
  const result = verifyLicenseToken(token);
  if (result.valid && result.payload) {
    return {
      active: true, state: "ACTIVE", payload: result.payload,
      daysRemaining: getDaysRemaining(result.payload.expires_at),
      formattedExpires: formatExpiration(result.payload.expires_at)
    };
  }
  if (result.state === "EXPIRED") {
    return {
      active: false, state: "EXPIRED", payload: result.payload, daysRemaining: 0,
      formattedExpires: result.payload ? formatExpiration(result.payload.expires_at) : "Muddati o'tgan"
    };
  }
  if (result.state === "REVOKED") {
    return { active: false, state: "REVOKED", payload: result.payload, daysRemaining: 0, formattedExpires: "Bekor qilingan" };
  }
  return { active: false, state: "INVALID", payload: null, daysRemaining: 0, formattedExpires: "" };
}

function vipActivated(context) {
  return getLicenseInfo(context).active === true;
}

async function useTheme(themeName) {
  await vscode.workspace.getConfiguration("workbench").update("colorTheme", themeName, vscode.ConfigurationTarget.Global);
}

async function useFreeTheme() {
  await useTheme(FREE_THEME);
}

async function activateWithToken(context, rawInput) {
  const input = String(rawInput || "").trim();
  if (!input) {
    vscode.window.showWarningMessage("ZIPNATION: Litsenziya kodingizni kiriting.");
    return false;
  }

  let tokenToVerify = input;

  if (input.toUpperCase().startsWith("ZN-") && !input.startsWith("ZNLIC.")) {
    vscode.window.showInformationMessage("ZIPNATION: Server tekshirilmoqda...");
    const lookup = await fetchLicenseByCode(input);
    if (!lookup.success || !lookup.token) {
      vscode.window.showErrorMessage(`ZIPNATION: ${lookup.error || "Litsenziya topilmadi yoki nofaol."}`);
      return false;
    }
    tokenToVerify = lookup.token;
  }

  const result = verifyLicenseToken(tokenToVerify);
  if (!result.valid) {
    if (result.state === "EXPIRED") {
      vscode.window.showErrorMessage(`ZIPNATION: Litsenziya muddati o'tgan — ${result.payload ? formatExpiration(result.payload.expires_at) : ""}.`);
    } else if (result.state === "REVOKED") {
      vscode.window.showErrorMessage("ZIPNATION: Bu litsenziya bekor qilingan.");
    } else {
      vscode.window.showErrorMessage(`ZIPNATION: Noto'g'ri litsenziya. ${result.reason || ""}`);
    }
    return false;
  }

  const payload = result.payload;
  const daysLeft = getDaysRemaining(payload.expires_at);
  const formattedDate = formatExpiration(payload.expires_at);

  await context.globalState.update("vipLicenseToken", tokenToVerify);
  await context.globalState.update("vipLicenseId", payload.license_id);
  await context.globalState.update("vipCustomer", payload.customer_id);

  trackEvent("license_activate", { license_id: payload.license_id, customer: payload.customer_id, duration: payload.duration_days });
  vscode.window.showInformationMessage(`ZIPNATION VIP faol! Xush kelibsiz, ${payload.customer_id}. Muddati: ${formattedDate} (${daysLeft} kun).`);
  return true;
}

async function activateVip(context) {
  const code = await vscode.window.showInputBox({
    title: "ZIPNATION VIP Faollashtirish",
    prompt: "VIP Litsenziya kodi (ZN-XXXX-XXXX-XXXX) yoki Token kiriting",
    placeHolder: "ZN-XXXX-XXXX-XXXX yoki ZNLIC...",
    ignoreFocusOut: true,
    validateInput(value) {
      const v = String(value || "").trim();
      if (!v) return "Maydon bo'sh bo'lmasligi kerak.";
      if (v.startsWith("ZNLIC.") || v.toUpperCase().startsWith("ZN-")) return undefined;
      return "Litsenziya 'ZN-' yoki 'ZNLIC.' bilan boshlanishi kerak";
    }
  });
  if (code === undefined) return false;
  return activateWithToken(context, code);
}

async function deactivateVip(context) {
  await context.globalState.update("vipLicenseToken", "");
  await context.globalState.update("vipLicenseId", "");
  await context.globalState.update("vipCustomer", "");
  await useFreeTheme();
  vscode.window.showInformationMessage("ZIPNATION: VIP o'chirildi. Bepul rejaga qaytildi.");
}

async function showLicenseStatus(context) {
  const info = getLicenseInfo(context);
  if (info.active && info.payload) {
    vscode.window.showInformationMessage(
      `ZIPNATION VIP FAOL\nMijoz: ${info.payload.customer_id}\nLitsenziya: ${info.payload.license_id}\nMuddati: ${info.formattedExpires} (${info.daysRemaining} kun qoldi)`
    );
  } else if (info.state === "EXPIRED") {
    vscode.window.showWarningMessage(`ZIPNATION VIP MUDDATI O'TGAN\nMuddati ${info.formattedExpires}da tugagan. Yangi litsenziya kiriting.`);
  } else {
    vscode.window.showInformationMessage("ZIPNATION: Bepul reja (ZN Night Gold va ZN Ivory).");
  }
}

async function applyTheme(context, themeName) {
  if (!THEMES.some(t => t.name === themeName)) return;
  const licInfo = getLicenseInfo(context);
  if (VIP_THEMES.has(themeName) && !licInfo.active) {
    const promptMsg = licInfo.state === "EXPIRED"
      ? `${themeName} uchun faol VIP kerak. Litsenziya ${licInfo.formattedExpires}da tugagan.`
      : `${themeName} ZIPNATION VIP to'plamiga kiradi.`;
    const action = await vscode.window.showInformationMessage(promptMsg, "Litsenziya kiriting", "Night Gold ishlatish");
    if (action === "Litsenziya kiriting") {
      const ok = await activateVip(context);
      if (ok) { await useTheme(themeName); trackEvent("theme_used", { theme: themeName }); return; }
    }
    await useFreeTheme();
    return;
  }
  await useTheme(themeName);
  trackEvent("theme_used", { theme: themeName });
  vscode.window.showInformationMessage(`${themeName} joriy qilindi.`);
}

async function guardTheme(context) {
  const current = vscode.workspace.getConfiguration("workbench").get("colorTheme");
  if (!vipActivated(context) && VIP_THEMES.has(current)) await useFreeTheme();
}

// ──────────────────────── STORE HTML ────────────────────────

function storeHtml(context, webview) {
  const info = getLicenseInfo(context);
  const active = info.active;
  const nonce = crypto.randomBytes(16).toString("hex");
  const csp = `default-src 'none'; img-src ${webview.cspSource}; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';`;
  const currentTheme = vscode.workspace.getConfiguration("workbench").get("colorTheme");

  // Theme-aware palette from selected theme
  const selectedThemeObj = THEMES.find(t => t.name === currentTheme) || THEMES[0];
  const uiAccent = selectedThemeObj.accent;
  const uiBg = selectedThemeObj.bg;
  const isLight = selectedThemeObj.name.includes("Ivory") || selectedThemeObj.name.includes("Nordic") && !selectedThemeObj.name.includes("Dark");
  const textPrimary = isLight ? "#1a1a1a" : "#eceae4";
  const textMuted = isLight ? "#6b6b6b" : "#9d9990";
  const cardBg = isLight ? "#f8f5ef" : "#0e0f0e";
  const borderColor = isLight ? "#e0d9ce" : "#252520";

  // Real ZIPNATION icon.png
  const znIconUri = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, "assets", "icon.png"));
  const znLogo = `<img src="${znIconUri}" class="brand-img" alt="ZIPNATION" style="width:38px;height:38px;border-radius:10px;object-fit:cover;box-shadow:0 4px 12px rgba(0,0,0,0.3);border:1.5px solid ${uiAccent}66;" />`;

  // Badge colors per theme (inline in card header)
  function themeAccentStyle(theme) {
    return `background:${theme.accent}18; border-color:${theme.accent}40; color:${theme.accent}`;
  }

  const cards = THEMES.map(theme => {
    const img = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, "assets", "previews", theme.file));
    const locked = theme.vip && !active;
    const selected = currentTheme === theme.name;

    const cardAccent = theme.accent;
    const cardBgDark = isLight ? `${cardAccent}08` : `${cardAccent}08`;

    // ZN official icon with theme accent border
    const themeIcon = `<img src="${znIconUri}" style="width:28px;height:28px;border-radius:7px;object-fit:cover;border:1.5px solid ${cardAccent}77;box-shadow:0 2px 6px ${cardAccent}22;" alt="ZN" />`;

    return `
      <article class="theme-card${selected ? " selected" : ""}${locked ? " locked" : ""}" style="${selected ? `border-color:${cardAccent}55;box-shadow:0 0 0 1px ${cardAccent}22,0 8px 32px ${cardAccent}14` : ""}">
        <div class="card-img-wrap">
          <img src="${img}" alt="${theme.name} ko'rinishi" loading="lazy">
          <div class="card-badges">
            <span class="badge-pill" style="${themeAccentStyle(theme)}">${theme.vip ? "VIP" : "BEPUL"}</span>
            ${selected ? `<span class="badge-active">✓ FAOL</span>` : ""}
            ${locked ? `<span class="badge-lock">🔒</span>` : ""}
          </div>
        </div>
        <div class="card-body">
          <div class="card-head-row">
            <div class="card-icon">${themeIcon}</div>
            <div class="card-meta">
              <div class="card-tone" style="color:${cardAccent}">${theme.tone}</div>
              <div class="card-name">${theme.name}</div>
            </div>
            <div class="card-price" style="color:${cardAccent}">${theme.price}</div>
          </div>
          <div class="card-desc">${theme.desc}</div>
          <button class="card-btn${locked ? " btn-outline" : selected ? " btn-active" : " btn-primary"}"
                  style="${!locked && !selected ? `background:${cardAccent};color:${isLight ? "#fff" : "#080909"};border-color:${cardAccent}` : locked ? `border-color:${cardAccent}55;color:${cardAccent}` : ""}"
                  data-action="apply"
                  data-theme="${theme.name}"
                  ${selected && !locked ? "" : ""}>
            ${locked ? "🔓 VIP Ochish" : selected ? "✓ Joriy Mavzu" : "Ishlatish"}
          </button>
        </div>
      </article>
    `;
  }).join("");

  // Header state
  let heroTitle, heroCopy, statusClass, statusText, statusDot;
  if (active && info.payload) {
    statusClass = "badge-vip"; statusText = "VIP FAOL"; statusDot = "🟢";
    heroTitle = `VIP Faol — Xush kelibsiz, ${info.payload.customer_id}!`;
    heroCopy = `Litsenziya: ${info.payload.license_id} · Muddati: ${info.formattedExpires} · ${info.daysRemaining} kun qoldi`;
  } else if (info.state === "EXPIRED") {
    statusClass = "badge-expired"; statusText = "MUDDATI O'TGAN"; statusDot = "🔴";
    heroTitle = "VIP Litsenziyangiz muddati tugagan";
    heroCopy = `${info.formattedExpires}da tugagan. Yangi litsenziya kodi kiriting.`;
  } else {
    statusClass = "badge-free"; statusText = "BEPUL REJA"; statusDot = "⚪";
    heroTitle = "VIP To'plam: 8 Premium Mavzu";
    heroCopy = "ZN Night Gold va ZN Ivory bepul. VIP barcha premium mavzularni ochadi.";
  }

  return `<!doctype html>
<html lang="uz">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
/* ── RESET & TOKENS ── */
*{box-sizing:border-box;margin:0;padding:0}
:root{
  --accent:${uiAccent};
  --bg:${uiBg};
  --text:${textPrimary};
  --muted:${textMuted};
  --card:${cardBg};
  --border:${borderColor};
  --radius:14px;
  color-scheme:${isLight ? "light" : "dark"};
}
body{
  background:var(--bg);
  color:var(--text);
  font-family:'Segoe UI','Inter',-apple-system,Arial,sans-serif;
  font-size:14px;
  line-height:1.5;
  min-height:100vh;
}

/* ── PAGE ── */
.page{max-width:1080px;margin:0 auto;padding:28px 28px 56px}

/* ── TOP BAR ── */
.topbar{
  display:flex;align-items:center;justify-content:space-between;
  gap:16px;margin-bottom:24px;
}
.brand{display:flex;align-items:center;gap:10px}
.brand-text{
  display:flex;flex-direction:column;gap:1px
}
.brand-name{
  font-size:18px;font-weight:900;letter-spacing:3px;
  color:var(--accent);line-height:1
}
.brand-sub{
  font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:2px
}
.status-badge{
  display:flex;align-items:center;gap:5px;
  padding:6px 14px;border-radius:999px;font-size:10px;font-weight:800;
  border:1px solid;white-space:nowrap;text-transform:uppercase;letter-spacing:1.5px;
}
.badge-vip{background:#0d2117;color:#83dc94;border-color:#1e4a2d}
.badge-free{background:${uiAccent}15;color:${uiAccent};border-color:${uiAccent}40}
.badge-expired{background:#2d1313;color:#f87171;border-color:#5a2020}

/* ── HERO ── */
.hero{
  background:${isLight ? `linear-gradient(135deg,#faf7f0,#f0ebe0)` : `linear-gradient(135deg,${uiAccent}0a 0%,transparent 60%)`};
  border:1px solid ${uiAccent}30;
  border-radius:18px;
  padding:22px 24px;
  margin-bottom:24px;
  position:relative;
  overflow:hidden;
}
.hero::before{
  content:'';position:absolute;top:-40px;right:-40px;
  width:180px;height:180px;border-radius:50%;
  background:${uiAccent};opacity:.05;
  pointer-events:none;
}
.hero-row{display:flex;align-items:center;justify-content:space-between;gap:20px;flex-wrap:wrap}
.hero-left{display:flex;align-items:center;gap:14px}
.hero-logo{
  width:48px;height:48px;border-radius:12px;
  background:${uiAccent}18;border:1px solid ${uiAccent}35;
  display:grid;place-items:center;flex-shrink:0;
}
.hero-logo-text{
  font-size:16px;font-weight:900;color:${uiAccent};letter-spacing:1px
}
.hero-title{font-size:15px;font-weight:800;margin-bottom:3px}
.hero-copy{font-size:12px;color:var(--muted)}
.hero-actions{display:flex;gap:8px;flex-wrap:wrap}

/* ── LICENSE INPUT ── */
.license-row{
  display:flex;gap:8px;margin-top:18px;flex-wrap:wrap;
  padding-top:16px;border-top:1px solid ${uiAccent}20;
}
.lic-input{
  flex:1;min-width:240px;
  background:${isLight ? "#fff" : "#080909"};
  border:1.5px solid var(--border);
  border-radius:10px;color:var(--text);
  padding:10px 14px;outline:none;
  font-size:12px;font-family:inherit;
  transition:border-color .15s;
}
.lic-input:focus{border-color:var(--accent)}
.lic-input::placeholder{color:var(--muted)}
.lic-hint{font-size:10px;color:var(--muted);margin-top:7px}

/* ── BUTTONS ── */
button{
  font:inherit;font-size:12px;font-weight:800;
  border-radius:10px;padding:9px 16px;
  border:1.5px solid var(--border);
  background:${isLight ? "#f0ebe0" : "#131411"};
  color:var(--text);cursor:pointer;
  transition:all .15s;white-space:nowrap;
}
button:hover{border-color:var(--accent);color:var(--accent)}
button:active{transform:scale(.98)}
.btn-gold{
  background:var(--accent)!important;
  color:${isLight ? "#fff" : "#080909"}!important;
  border-color:var(--accent)!important;
}
.btn-gold:hover{filter:brightness(1.12)}
.btn-sm{padding:7px 12px;font-size:11px}

/* ── THEME GRID ── */
.grid-head{
  display:flex;align-items:center;justify-content:space-between;
  margin-bottom:14px;
}
.grid-label{font-size:11px;text-transform:uppercase;letter-spacing:2px;color:var(--muted);font-weight:700}
.free-count{
  font-size:10px;padding:3px 10px;border-radius:999px;
  background:${uiAccent}15;color:${uiAccent};border:1px solid ${uiAccent}30;
  font-weight:700;letter-spacing:1px;
}
.grid{
  display:grid;
  grid-template-columns:repeat(auto-fill,minmax(300px,1fr));
  gap:16px;
}

/* ── THEME CARD ── */
.theme-card{
  border-radius:var(--radius);
  border:1.5px solid var(--border);
  background:var(--card);
  overflow:hidden;
  transition:transform .15s,border-color .2s,box-shadow .2s;
  cursor:default;
}
.theme-card:hover{
  transform:translateY(-3px);
  box-shadow:0 12px 40px rgba(0,0,0,.25);
}
.theme-card.selected{border-width:2px}
.theme-card.locked{opacity:.88}

/* Card image */
.card-img-wrap{position:relative;background:#050505;border-bottom:1px solid var(--border)}
.card-img-wrap img{display:block;width:100%;height:auto;aspect-ratio:16/9;object-fit:cover}
.card-badges{
  position:absolute;top:10px;width:100%;
  display:flex;justify-content:space-between;align-items:flex-start;
  padding:0 10px;pointer-events:none;
}
.badge-pill{
  padding:4px 10px;border-radius:999px;
  font-size:9px;font-weight:900;letter-spacing:1px;
  text-transform:uppercase;border:1px solid;
  backdrop-filter:blur(8px);
}
.badge-active{
  padding:4px 10px;border-radius:999px;font-size:9px;font-weight:900;
  background:#0d2117;color:#83dc94;border:1px solid #1e4a2d;
  letter-spacing:.5px;
}
.badge-lock{
  font-size:13px;
  background:rgba(0,0,0,.5);padding:3px 7px;border-radius:7px;
}

/* Card body */
.card-body{padding:14px}
.card-head-row{display:flex;align-items:center;gap:10px;margin-bottom:8px}
.card-icon{flex-shrink:0}
.card-meta{flex:1;min-width:0}
.card-tone{font-size:9px;text-transform:uppercase;letter-spacing:2px;font-weight:700;margin-bottom:1px}
.card-name{font-size:15px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.card-price{font-size:13px;font-weight:900;flex-shrink:0}
.card-desc{font-size:12px;color:var(--muted);line-height:1.5;margin-bottom:12px;min-height:36px}

/* Card button */
.card-btn{
  width:100%;text-align:center;padding:10px;
  border-radius:10px;font-size:12px;font-weight:800;
  transition:all .15s;
}
.btn-primary{}
.btn-outline{
  background:transparent;
  border:1.5px solid var(--border);
}
.btn-outline:hover{border-color:var(--accent)!important;color:var(--accent)!important}
.btn-active{
  background:transparent!important;
  border-color:${uiAccent}40!important;
  color:var(--muted)!important;
  cursor:default!important;
}
.btn-active:hover{transform:none}

/* ── FOOTER ── */
.footer{
  display:flex;justify-content:space-between;align-items:center;
  gap:12px;margin-top:24px;padding-top:16px;
  border-top:1px solid var(--border);
  color:var(--muted);font-size:11px;flex-wrap:wrap;
}
.footer-brand{color:var(--accent);font-weight:800;letter-spacing:1px}
.footer-links{display:flex;gap:14px}

/* ── SECTION DIVIDER ── */
.divider{
  display:flex;align-items:center;gap:12px;
  margin:24px 0 16px;
}
.divider-line{flex:1;height:1px;background:var(--border)}
.divider-label{
  font-size:9px;text-transform:uppercase;letter-spacing:2.5px;
  color:var(--muted);font-weight:700;white-space:nowrap;
}

/* ── RESPONSIVE ── */
@media(max-width:620px){
  .page{padding:16px 14px 40px}
  .topbar{flex-direction:column;align-items:flex-start}
  .hero-row{flex-direction:column}
  .hero-actions{width:100%}
  .hero-actions button{flex:1}
  .license-row{flex-direction:column}
  .grid{grid-template-columns:1fr}
  .footer{flex-direction:column;text-align:center}
}
</style>
</head>
<body>
<div class="page">

  <!-- TOP BAR -->
  <div class="topbar">
    <div class="brand">
      ${znLogo}
      <div class="brand-text">
        <div class="brand-name">ZIPNATION</div>
        <div class="brand-sub">Mavzu Do'koni · v${VERSION}</div>
      </div>
    </div>
    <div class="status-badge ${statusClass}">${statusDot} ${statusText}</div>
  </div>

  <!-- HERO -->
  <section class="hero">
    <div class="hero-row">
      <div class="hero-left">
        <div class="hero-logo"><div class="hero-logo-text">ZN</div></div>
        <div>
          <div class="hero-title">${heroTitle}</div>
          <div class="hero-copy">${heroCopy}</div>
        </div>
      </div>
      <div class="hero-actions">
        <button class="btn-gold btn-sm" data-action="focusCode">${active ? "Litsenziya Ma'lumoti" : "VIP Faollashtirish"}</button>
        <button class="btn-sm" data-action="free">Night Gold</button>
        ${active ? `<button class="btn-sm" data-action="deactivate">O'chirish</button>` : ""}
      </div>
    </div>

    ${!active ? `
      <div class="license-row">
        <input id="code" class="lic-input" autocomplete="off" spellcheck="false"
               placeholder="ZN-XXXX-XXXX-XXXX yoki ZNLIC... token kiriting">
        <button class="btn-gold" data-action="activateInline">🔓 VIP Ochish</button>
      </div>
      <div class="lic-hint">Universal VIP litsenziya VS Code, Cursor, Windsurf, Antigravity va VSCodium'da ishlaydi. 7 / 30 / 90 / 365 kunlik.</div>
    ` : ""}
  </section>

  <!-- FREE THEMES -->
  <div class="divider">
    <div class="divider-line"></div>
    <div class="divider-label">Bepul Mavzular</div>
    <div class="free-count">2 ta bepul</div>
    <div class="divider-line"></div>
  </div>

  <div class="grid">
    ${THEMES.filter(t => !t.vip).map(theme => {
      const img = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, "assets", "previews", theme.file));
      const selected = currentTheme === theme.name;
      const cardAccent = theme.accent;
      const themeIcon = `<svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="28" height="28" rx="7" fill="${cardAccent}" fill-opacity="0.18"/><circle cx="14" cy="14" r="5" fill="${cardAccent}" fill-opacity="0.9"/><circle cx="14" cy="14" r="8" stroke="${cardAccent}" stroke-opacity="0.35" stroke-width="1.5" fill="none"/></svg>`;
      return `
        <article class="theme-card${selected ? " selected" : ""}" style="${selected ? `border-color:${cardAccent}55;box-shadow:0 0 0 1px ${cardAccent}22,0 8px 32px ${cardAccent}14` : ""}">
          <div class="card-img-wrap">
            <img src="${img}" alt="${theme.name}" loading="lazy">
            <div class="card-badges">
              <span class="badge-pill" style="background:${cardAccent}18;border-color:${cardAccent}40;color:${cardAccent}">BEPUL</span>
              ${selected ? `<span class="badge-active">✓ FAOL</span>` : ""}
            </div>
          </div>
          <div class="card-body">
            <div class="card-head-row">
              <div class="card-icon">${themeIcon}</div>
              <div class="card-meta">
                <div class="card-tone" style="color:${cardAccent}">${theme.tone}</div>
                <div class="card-name">${theme.name}</div>
              </div>
              <div class="card-price" style="color:${cardAccent}">${theme.price}</div>
            </div>
            <div class="card-desc">${theme.desc}</div>
            <button class="${selected ? "card-btn btn-active" : "card-btn"}"
                    style="${!selected ? `background:${cardAccent};color:${isLight ? "#fff" : "#080909"};border-color:${cardAccent}` : ""}"
                    data-action="apply" data-theme="${theme.name}">
              ${selected ? "✓ Joriy Mavzu" : "Ishlatish"}
            </button>
          </div>
        </article>`;
    }).join("")}
  </div>

  <!-- VIP THEMES -->
  <div class="divider">
    <div class="divider-line"></div>
    <div class="divider-label">VIP Premium To'plam</div>
    <div class="free-count" style="color:${uiAccent}">${VIP_THEMES.size} ta premium</div>
    <div class="divider-line"></div>
  </div>

  <div class="grid">
    ${THEMES.filter(t => t.vip).map(theme => {
      const img = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, "assets", "previews", theme.file));
      const locked = !active;
      const selected = currentTheme === theme.name;
      const cardAccent = theme.accent;
      const themeIcon = `<svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="28" height="28" rx="7" fill="${cardAccent}" fill-opacity="0.18"/><circle cx="14" cy="14" r="5" fill="${cardAccent}" fill-opacity="0.9"/><circle cx="14" cy="14" r="8" stroke="${cardAccent}" stroke-opacity="0.35" stroke-width="1.5" fill="none"/></svg>`;
      return `
        <article class="theme-card${selected ? " selected" : ""}${locked ? " locked" : ""}" style="${selected ? `border-color:${cardAccent}55;box-shadow:0 0 0 1px ${cardAccent}22,0 8px 32px ${cardAccent}14` : ""}">
          <div class="card-img-wrap">
            <img src="${img}" alt="${theme.name}" loading="lazy">
            <div class="card-badges">
              <span class="badge-pill" style="background:${cardAccent}18;border-color:${cardAccent}40;color:${cardAccent}">VIP</span>
              ${selected ? `<span class="badge-active">✓ FAOL</span>` : locked ? `<span class="badge-lock">🔒</span>` : ""}
            </div>
          </div>
          <div class="card-body">
            <div class="card-head-row">
              <div class="card-icon">${themeIcon}</div>
              <div class="card-meta">
                <div class="card-tone" style="color:${cardAccent}">${theme.tone}</div>
                <div class="card-name">${theme.name}</div>
              </div>
              <div class="card-price" style="color:${cardAccent}">${theme.price}</div>
            </div>
            <div class="card-desc">${theme.desc}</div>
            <button class="card-btn ${locked ? "btn-outline" : selected ? "btn-active" : "btn-primary"}"
                    style="${locked ? `border-color:${cardAccent}50;color:${cardAccent}` : !selected ? `background:${cardAccent};color:${isLight ? "#fff" : "#080909"};border-color:${cardAccent}` : ""}"
                    data-action="apply" data-theme="${theme.name}">
              ${locked ? "🔓 VIP Ochish" : selected ? "✓ Joriy Mavzu" : "Ishlatish"}
            </button>
          </div>
        </article>`;
    }).join("")}
  </div>

  <!-- FOOTER -->
  <div class="footer">
    <div>
      <span class="footer-brand">ZIPNATION</span> ·
      <span>${THEMES.filter(t => !t.vip).length} ta bepul</span> ·
      <span>${VIP_THEMES.size} ta VIP premium mavzu</span>
    </div>
    <div class="footer-links">
      <span>v${VERSION}</span>
      <span>·</span>
      <span style="color:var(--accent)">zipnation.dev</span>
    </div>
  </div>

</div>

<script nonce="${nonce}">
const vscode = acquireVsCodeApi();

document.addEventListener("click", e => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const action = btn.dataset.action;
  if (action === "apply") {
    vscode.postMessage({ type: "applyTheme", theme: btn.dataset.theme });
  } else if (action === "activateInline") {
    const input = document.getElementById("code");
    vscode.postMessage({ type: "activateCode", code: input ? input.value : "" });
  } else if (action === "focusCode") {
    const input = document.getElementById("code");
    if (input) { input.focus(); input.select(); }
    else vscode.postMessage({ type: "showStatus" });
  } else {
    vscode.postMessage({ type: action });
  }
});

// Enter tugmasini qo'llab-quvvatlash
const codeInput = document.getElementById("code");
if (codeInput) {
  codeInput.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      vscode.postMessage({ type: "activateCode", code: codeInput.value });
    }
  });
}
</script>
</body>
</html>`;
}

// ──────────────────────── OPEN STORE ────────────────────────

let currentStorePanel = null;

async function openThemeStore(context) {
  trackEvent("store_open");
  if (currentStorePanel) {
    currentStorePanel.reveal(vscode.ViewColumn.One);
    return;
  }
  const panel = vscode.window.createWebviewPanel(
    "zipnationThemeStore", "ZIPNATION Mavzu Do'koni",
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, "assets")]
    }
  );
  currentStorePanel = panel;
  panel.onDidDispose(() => { currentStorePanel = null; });

  const render = () => {
    if (panel && panel.webview) panel.webview.html = storeHtml(context, panel.webview);
  };
  render();

  panel.webview.onDidReceiveMessage(async message => {
    if (message.type === "activate") await activateVip(context);
    if (message.type === "activateCode") {
      const ok = await activateWithToken(context, message.code);
      if (ok) render();
    }
    if (message.type === "showStatus") await showLicenseStatus(context);
    if (message.type === "free") { await useFreeTheme(); render(); }
    if (message.type === "deactivate") { await deactivateVip(context); render(); }
    if (message.type === "applyTheme") {
      await applyTheme(context, message.theme);
      render();
    }
  });
}

// ──────────────────────── ACTIVATE ────────────────────────

function activate(context) {
  const seenVersion = context.globalState.get("zipnation.storeVersion");
  if (!seenVersion) trackEvent("install", { firstVersion: VERSION });
  trackEvent("startup", { version: VERSION });

  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  status.text = "$(paintcan) ZN Mavzular";
  status.tooltip = "ZIPNATION Mavzu Do'konini ochish";
  status.command = "zipnation.openThemeStore";
  status.show();

  context.subscriptions.push(
    status,
    vscode.commands.registerCommand("zipnation.openThemeStore", () => openThemeStore(context)),
    vscode.commands.registerCommand("zipnation.enterLicense", () => activateVip(context)),
    vscode.commands.registerCommand("zipnation.licenseStatus", () => showLicenseStatus(context)),
    vscode.workspace.onDidChangeConfiguration(async event => {
      if (event.affectsConfiguration("workbench.colorTheme")) {
        await guardTheme(context);
        if (currentStorePanel && currentStorePanel.webview) {
          currentStorePanel.webview.html = storeHtml(context, currentStorePanel.webview);
        }
      }
    })
  );

  guardTheme(context);

  if (seenVersion !== VERSION) {
    context.globalState.update("zipnation.storeVersion", VERSION);
    setTimeout(() => openThemeStore(context), 700);
  }
}

function deactivate() {}

module.exports = { activate, deactivate, getLicenseInfo, vipActivated, activateWithToken };