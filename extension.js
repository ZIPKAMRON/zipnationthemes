const vscode = require("vscode");
const crypto = require("crypto");
const { verifyLicenseToken, getDaysRemaining, formatExpiration, fetchLicenseByCode } = require("./lib/license");
const { trackEvent } = require("./lib/telemetry");

const FREE_THEME = "ZN Night Gold";
const THEMES = [
  { name: "ZN Night Gold", vip: false, price: "FREE", file: "zn-night-gold.svg", tone: "Gold" },
  { name: "ZN Ivory", vip: false, price: "FREE", file: "zn-ivory.svg", tone: "Ivory" },
  { name: "ZN Emerald Royale", vip: true, price: "$4", file: "zn-emerald-royale.svg", tone: "Emerald" },
  { name: "ZN Rose Royale", vip: true, price: "$4", file: "zn-rose-royale.svg", tone: "Rose" },
  { name: "ZN Midnight Spire", vip: true, price: "$4", file: "zn-midnight-spire.svg", tone: "Midnight" },
  { name: "ZN Obsidian", vip: true, price: "$4", file: "zn-obsidian.svg", tone: "Obsidian" },
  { name: "ZN Solar Flare", vip: true, price: "$4", file: "zn-solar-flare.svg", tone: "Solar" },
  { name: "ZN Nordic", vip: true, price: "$4", file: "zn-nordic.svg", tone: "Nordic" },
  { name: "ZN Nordic Dark", vip: true, price: "$4", file: "zn-nordic-dark.svg", tone: "Nordic Dark" },
  { name: "ZN Cyberpunk", vip: true, price: "$4", file: "zn-cyberpunk.svg", tone: "Cyberpunk" }
];
const VIP_THEMES = new Set(THEMES.filter(t => t.vip).map(t => t.name));
const VERSION = "1.1.0";

/**
 * Get comprehensive license details and active state
 */
function getLicenseInfo(context) {
  const token = context.globalState.get("vipLicenseToken", "");
  if (!token) {
    return { active: false, state: "FREE", payload: null, daysRemaining: 0, formattedExpires: "" };
  }

  const result = verifyLicenseToken(token);
  if (result.valid && result.payload) {
    return {
      active: true,
      state: "ACTIVE",
      payload: result.payload,
      daysRemaining: getDaysRemaining(result.payload.expires_at),
      formattedExpires: formatExpiration(result.payload.expires_at)
    };
  }

  if (result.state === "EXPIRED") {
    return {
      active: false,
      state: "EXPIRED",
      payload: result.payload,
      daysRemaining: 0,
      formattedExpires: result.payload ? formatExpiration(result.payload.expires_at) : "Expired"
    };
  }

  if (result.state === "REVOKED") {
    return {
      active: false,
      state: "REVOKED",
      payload: result.payload,
      daysRemaining: 0,
      formattedExpires: "Revoked"
    };
  }

  return { active: false, state: "INVALID", payload: null, daysRemaining: 0, formattedExpires: "" };
}

function vipActivated(context) {
  return getLicenseInfo(context).active === true;
}

async function useTheme(themeName) {
  await vscode.workspace.getConfiguration("workbench")
    .update("colorTheme", themeName, vscode.ConfigurationTarget.Global);
}

async function useFreeTheme() {
  await useTheme(FREE_THEME);
}

/**
 * Activate VIP with a full signed token or formatted code ZN-XXXX-XXXX-XXXX
 */
async function activateWithToken(context, rawInput) {
  const input = String(rawInput || "").trim();
  if (!input) {
    vscode.window.showWarningMessage("ZIPNATION: Please enter your VIP code or token.");
    return false;
  }

  let tokenToVerify = input;

  // If user entered a short code like ZN-XXXX-XXXX-XXXX (16-19 chars)
  if (input.toUpperCase().startsWith("ZN-") && !input.startsWith("ZNLIC.")) {
    vscode.window.showInformationMessage("ZIPNATION: Contacting license server...");
    const lookup = await fetchLicenseByCode(input);
    if (!lookup.success || !lookup.token) {
      vscode.window.showErrorMessage(`ZIPNATION: ${lookup.error || "License not found or inactive."}`);
      return false;
    }
    tokenToVerify = lookup.token;
  }

  const result = verifyLicenseToken(tokenToVerify);

  if (!result.valid) {
    if (result.state === "EXPIRED") {
      vscode.window.showErrorMessage(`ZIPNATION: This license has expired on ${result.payload ? formatExpiration(result.payload.expires_at) : "past date"}.`);
    } else if (result.state === "REVOKED") {
      vscode.window.showErrorMessage("ZIPNATION: This license has been revoked.");
    } else {
      vscode.window.showErrorMessage(`ZIPNATION: Invalid license. ${result.reason || "Cryptographic check failed."}`);
    }
    return false;
  }

  const payload = result.payload;
  const daysLeft = getDaysRemaining(payload.expires_at);
  const formattedDate = formatExpiration(payload.expires_at);

  await context.globalState.update("vipLicenseToken", tokenToVerify);
  await context.globalState.update("vipLicenseId", payload.license_id);
  await context.globalState.update("vipCustomer", payload.customer_id);

  trackEvent("license_activate", {
    license_id: payload.license_id,
    customer: payload.customer_id,
    duration: payload.duration_days
  });

  vscode.window.showInformationMessage(
    `ZIPNATION VIP Unlocked! Welcome, ${payload.customer_id}. Active until ${formattedDate} (${daysLeft} days).`
  );
  return true;
}

async function activateVip(context) {
  const code = await vscode.window.showInputBox({
    title: "ZIPNATION VIP Activation",
    prompt: "Enter your VIP License Code (ZN-XXXX-XXXX-XXXX) or Signed Token",
    placeHolder: "ZN-XXXX-XXXX-XXXX or ZNLIC...",
    ignoreFocusOut: true,
    validateInput(value) {
      const v = String(value || "").trim();
      if (!v) return "Input cannot be empty.";
      if (v.startsWith("ZNLIC.") || v.toUpperCase().startsWith("ZN-")) return undefined;
      return "License must begin with 'ZN-' or 'ZNLIC.'";
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
  vscode.window.showInformationMessage("ZIPNATION: VIP deactivated. Free plan restored.");
}

async function showLicenseStatus(context) {
  const info = getLicenseInfo(context);
  if (info.active && info.payload) {
    vscode.window.showInformationMessage(
      `ZIPNATION VIP ACTIVE\nCustomer: ${info.payload.customer_id}\nLicense: ${info.payload.license_id}\nExpires: ${info.formattedExpires} (${info.daysRemaining} days left)`
    );
  } else if (info.state === "EXPIRED") {
    vscode.window.showWarningMessage(
      `ZIPNATION VIP EXPIRED\nYour license expired on ${info.formattedExpires}. Please renew to use VIP themes.`
    );
  } else {
    vscode.window.showInformationMessage("ZIPNATION: Currently on FREE plan (ZN Night Gold & ZN Ivory).");
  }
}

async function applyTheme(context, themeName) {
  if (!THEMES.some(t => t.name === themeName)) return;

  const licInfo = getLicenseInfo(context);

  if (VIP_THEMES.has(themeName) && !licInfo.active) {
    const promptMsg = licInfo.state === "EXPIRED"
      ? `${themeName} requires active VIP. Your license expired on ${licInfo.formattedExpires}.`
      : `${themeName} is included in ZIPNATION VIP.`;

    const action = await vscode.window.showInformationMessage(
      promptMsg,
      "Enter License",
      "Use Night Gold"
    );

    if (action === "Enter License") {
      const ok = await activateVip(context);
      if (ok) {
        await useTheme(themeName);
        trackEvent("theme_used", { theme: themeName });
        return;
      }
    }

    await useFreeTheme();
    return;
  }

  await useTheme(themeName);
  trackEvent("theme_used", { theme: themeName });
  vscode.window.showInformationMessage(`${themeName} applied.`);
}

async function guardTheme(context) {
  const current = vscode.workspace.getConfiguration("workbench").get("colorTheme");
  if (!vipActivated(context) && VIP_THEMES.has(current)) {
    await useFreeTheme();
  }
}

function description(name) {
  if (name === "ZN Night Gold") return "Black canvas, warm ivory syntax and signature gold.";
  if (name === "ZN Ivory") return "Clean, minimal light aesthetic with champagne accents.";
  if (name === "ZN Emerald Royale") return "Deep emerald surfaces with refined gold accents.";
  if (name === "ZN Rose Royale") return "Dark plum surfaces with rose-metal highlights.";
  if (name === "ZN Midnight Spire") return "Midnight blue surfaces with architectural gold accents.";
  if (name === "ZN Obsidian") return "True pitch-black OLED surfaces with obsidian luster.";
  if (name === "ZN Solar Flare") return "High contrast ember accents on deep charcoal.";
  if (name === "ZN Nordic") return "Crisp arctic daylight palette with balanced syntax.";
  if (name === "ZN Nordic Dark") return "Sub-zero polar night aesthetic with glacial highlights.";
  if (name === "ZN Cyberpunk") return "High-voltage neon pink and electric cyan contrast.";
  return "Premium color palette crafted for long coding sessions.";
}

function storeHtml(context, webview) {
  const info = getLicenseInfo(context);
  const active = info.active;
  const nonce = crypto.randomBytes(16).toString("hex");
  const csp = `default-src 'none'; img-src ${webview.cspSource}; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';`;

  const currentTheme = vscode.workspace.getConfiguration("workbench").get("colorTheme");

  const cards = THEMES.map(theme => {
    const img = webview.asWebviewUri(
      vscode.Uri.joinPath(context.extensionUri, "assets", "previews", theme.file)
    );
    const locked = theme.vip && !active;
    const selected = currentTheme === theme.name;

    return `
      <article class="theme-card ${selected ? "selected" : ""}">
        <div class="shot">
          <img src="${img}" alt="${theme.name} preview">
          <span class="pill ${theme.vip ? "vip-pill" : "free-pill"}">${theme.vip ? "VIP · $4" : "FREE"}</span>
          ${selected ? `<span class="selected-pill">✓ ACTIVE</span>` : ""}
        </div>
        <div class="card-content">
          <div class="eyebrow">${theme.tone}</div>
          <div class="theme-title">${theme.name}</div>
          <div class="theme-desc">${description(theme.name)}</div>
          <button class="${locked ? "outline" : "gold"}"
                  data-action="apply"
                  data-theme="${theme.name}">
            ${locked ? "Unlock & Use" : selected ? "Active Theme" : "Use Theme"}
          </button>
        </div>
      </article>
    `;
  }).join("");

  let heroTitle = "VIP Collection: 8 Premium Themes. $4 Bundle.";
  let heroCopy = "ZN Night Gold and ZN Ivory are free. VIP unlocks Emerald, Rose, Midnight, Obsidian and more.";
  let statusBadgeClass = "free";
  let statusBadgeText = "● FREE PLAN";

  if (active && info.payload) {
    statusBadgeClass = "vip";
    statusBadgeText = "● VIP ACTIVE";
    heroTitle = `ZIPNATION VIP Unlocked — ${info.payload.customer_id}`;
    heroCopy = `License: ${info.payload.license_id} · Expires: ${info.formattedExpires} (${info.daysRemaining} days left)`;
  } else if (info.state === "EXPIRED") {
    statusBadgeClass = "expired";
    statusBadgeText = "● LICENSE EXPIRED";
    heroTitle = "Your VIP License has expired";
    heroCopy = `Expired on ${info.formattedExpires}. Enter a renewed license code to restore VIP themes.`;
  }

  return `<!doctype html>
<html>
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{box-sizing:border-box}
:root{color-scheme:dark}
body{margin:0;background:#090a09;color:#eceae4;font-family:Segoe UI,Inter,-apple-system,Arial,sans-serif}
.page{max-width:1120px;margin:0 auto;padding:30px 30px 48px}
.top{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;margin-bottom:22px}
.brand{font-size:22px;letter-spacing:4px;font-weight:900;color:#e9c34a}
.kicker{font-size:11px;color:#77746e;text-transform:uppercase;letter-spacing:2px;margin-bottom:5px}
.title{font-size:27px;font-weight:800}
.subtitle{color:#85827b;font-size:13px;margin-top:5px}
.status{padding:8px 14px;border-radius:999px;font-size:11px;font-weight:850;border:1px solid #37342d;white-space:nowrap}
.status.vip{background:#102719;color:#83dc94;border-color:#285637}
.status.free{background:#211c10;color:#e9c34a;border-color:#594719}
.status.expired{background:#301313;color:#ff7d7d;border-color:#652828}
.hero{border:1px solid #2e2b23;border-radius:16px;background:linear-gradient(135deg,#13140f,#0d0e0d);padding:19px;margin-bottom:18px}
.hero-row{display:flex;align-items:center;justify-content:space-between;gap:20px}
.hero-main{display:flex;align-items:center;gap:13px}
.mark{width:40px;height:40px;border-radius:10px;display:grid;place-items:center;background:#211c0d;color:#e9c34a;font-weight:900}
.hero-title{font-size:15px;font-weight:800}
.hero-copy{font-size:12px;color:#85827b;margin-top:4px}
.actions{display:flex;gap:7px;flex-wrap:wrap}
button{font:inherit;font-size:12px;font-weight:800;border-radius:8px;padding:9px 13px;border:1px solid #49412c;background:#151611;color:#eee;cursor:pointer;transition:all .15s}
button:hover{border-color:#c8a83f}
button:disabled{opacity:.65;cursor:default}
.gold{background:#d2ad37;color:#090909;border-color:#d2ad37}
.gold:hover{background:#e2bc43;border-color:#e2bc43}
.outline{background:#11130f}
.codebar{display:flex;gap:7px;margin-top:14px}
input{flex:1;min-width:220px;background:#090a09;border:1px solid #34342e;border-radius:8px;color:#fff;padding:10px 14px;outline:none;font-size:12px}
input:focus{border-color:#b99631}
.codehint{font-size:11px;color:#69665f;margin-top:7px}
.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
.theme-card{overflow:hidden;border:1px solid #282820;border-radius:14px;background:#101110;transition:.15s;border-top:2px solid transparent}
.theme-card:hover{border-color:#4b4636;transform:translateY(-1px)}
.theme-card.selected{border-color:#806923;border-top-color:#d2ad37}
.shot{position:relative;background:#050505}
.shot img{display:block;width:100%;height:auto}
.pill,.selected-pill{position:absolute;top:10px;padding:5px 9px;border-radius:999px;font-size:9px;font-weight:900;backdrop-filter:blur(8px)}
.pill{right:10px}
.selected-pill{left:10px;background:#14311e;color:#83dc94;border:1px solid #2c6540}
.vip-pill{background:#18150e;color:#e9c34a;border:1px solid #6a531d}
.free-pill{background:#14301d;color:#83dc94;border:1px solid #2b5c38}
.card-content{padding:14px}
.eyebrow{font-size:9px;color:#77746d;letter-spacing:1.5px;text-transform:uppercase}
.theme-title{font-size:16px;font-weight:800;margin-top:4px}
.theme-desc{font-size:12px;color:#85827b;line-height:1.45;min-height:35px;margin:5px 0 11px}
.theme-card button{width:100%}
.bottom{display:flex;justify-content:space-between;gap:15px;margin-top:18px;padding-top:15px;border-top:1px solid #23231e;color:#68665f;font-size:11px}
.bottom b{color:#9d9990}
@media(max-width:780px){.page{padding:20px}.top,.hero-row{align-items:flex-start;flex-direction:column}.grid{grid-template-columns:1fr}.actions{width:100%}.codebar{flex-direction:column}}
</style>
</head>
<body>
<div class="page">
  <div class="top">
    <div>
      <div class="kicker">ZIPNATION / THEMES</div>
      <div class="title">Theme Store</div>
      <div class="subtitle">Preview, customize and switch your coding environment instantly.</div>
    </div>
    <div class="status ${statusBadgeClass}">${statusBadgeText}</div>
  </div>

  <section class="hero">
    <div class="hero-row">
      <div class="hero-main">
        <div class="mark">ZN</div>
        <div>
          <div class="hero-title">${heroTitle}</div>
          <div class="hero-copy">${heroCopy}</div>
        </div>
      </div>
      <div class="actions">
        <button class="gold" data-action="focusCode">${active ? "License Details" : "Enter License"}</button>
        <button data-action="free">Use Night Gold</button>
        ${active ? `<button data-action="deactivate">Deactivate</button>` : ""}
      </div>
    </div>

    ${!active ? `
      <div class="codebar">
        <input id="code" autocomplete="off" spellcheck="false" placeholder="Enter ZN-XXXX-XXXX-XXXX or ZNLIC token...">
        <button class="gold" data-action="activateInline">Unlock VIP</button>
      </div>
      <div class="codehint">Universal VIP License supports 7, 30, 90 or 365 days across VS Code, Antigravity, Cursor, Windsurf and VSCodium.</div>
    ` : ""}
  </section>

  <section class="grid">${cards}</section>

  <div class="bottom">
    <span><b>FREE</b> · ${THEMES.filter(t => !t.vip).length} themes &nbsp; <b>VIP</b> · ${VIP_THEMES.size} premium themes</span>
    <span>ZIPNATION Themes · v${VERSION}</span>
  </div>
</div>

<script nonce="${nonce}">
const vscode = acquireVsCodeApi();

document.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const action = button.dataset.action;

  if (action === "apply") {
    vscode.postMessage({type:"applyTheme", theme:button.dataset.theme});
  } else if (action === "activateInline") {
    const input = document.getElementById("code");
    vscode.postMessage({type:"activateCode", code:input ? input.value : ""});
  } else if (action === "focusCode") {
    const input = document.getElementById("code");
    if (input) input.focus();
    else vscode.postMessage({type:"showStatus"});
  } else {
    vscode.postMessage({type:action});
  }
});
</script>
</body>
</html>`;
}

async function openThemeStore(context) {
  trackEvent("store_open");

  const panel = vscode.window.createWebviewPanel(
    "zipnationThemeStore",
    "ZIPNATION Theme Store",
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, "assets", "previews")]
    }
  );

  const render = () => { panel.webview.html = storeHtml(context, panel.webview); };
  render();

  panel.webview.onDidReceiveMessage(async message => {
    if (message.type === "activate") await activateVip(context);
    if (message.type === "activateCode") await activateWithToken(context, message.code);
    if (message.type === "showStatus") await showLicenseStatus(context);
    if (message.type === "free") await useFreeTheme();
    if (message.type === "deactivate") await deactivateVip(context);
    if (message.type === "applyTheme") await applyTheme(context, message.theme);
    render();
  });
}

function activate(context) {
  // Fire startup telemetry ping in background
  const seenVersion = context.globalState.get("zipnation.storeVersion");
  if (!seenVersion) {
    trackEvent("install", { firstVersion: VERSION });
  }
  trackEvent("startup", { version: VERSION });

  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  status.text = "$(paintcan) ZN Themes";
  status.tooltip = "Open ZIPNATION Theme Store";
  status.command = "zipnation.openThemeStore";
  status.show();

  context.subscriptions.push(
    status,
    vscode.commands.registerCommand("zipnation.openThemeStore", () => openThemeStore(context)),
    vscode.commands.registerCommand("zipnation.enterLicense", () => activateVip(context)),
    vscode.commands.registerCommand("zipnation.licenseStatus", () => showLicenseStatus(context)),
    vscode.workspace.onDidChangeConfiguration(async event => {
      if (event.affectsConfiguration("workbench.colorTheme")) await guardTheme(context);
    })
  );

  guardTheme(context);

  if (seenVersion !== VERSION) {
    context.globalState.update("zipnation.storeVersion", VERSION);
    setTimeout(() => openThemeStore(context), 700);
  }
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
  getLicenseInfo,
  vipActivated,
  activateWithToken
};