const vscode = require("vscode");
const crypto = require("crypto");

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
const VERSION = "1.0.0";

function normalize(code) {
  return String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function vipActivated(context) {
  return context.globalState.get("vipActivated", false) === true;
}

function getDevCode(context) {
  if (context && context.extensionMode === vscode.ExtensionMode.Development) {
    return normalize(process.env.ZIPNATION_DEV_CODE || "");
  }
  return "";
}

function isValidCode(context, code) {
  if (context && context.extensionMode === vscode.ExtensionMode.Development) {
    const c = normalize(code);
    const dev = getDevCode(context);
    return !!(dev && c === dev);
  }
  return false;
}

async function useTheme(themeName) {
  await vscode.workspace.getConfiguration("workbench")
    .update("colorTheme", themeName, vscode.ConfigurationTarget.Global);
}

async function useFreeTheme() {
  await useTheme(FREE_THEME);
}

async function activateWithCode(context, code) {
  const normalized = normalize(code);

  if (normalized.length !== 12 || !isValidCode(context, normalized)) {
    await context.globalState.update("vipActivated", false);
    await context.globalState.update("vipCode", "");
    await useFreeTheme();
    vscode.window.showErrorMessage("ZIPNATION: Code rejected. ZN Night Gold restored.");
    return false;
  }

  await context.globalState.update("vipActivated", true);
  await context.globalState.update("vipCode", normalized);
  vscode.window.showInformationMessage("ZIPNATION VIP unlocked.");
  return true;
}

async function activateVip(context) {
  const code = await vscode.window.showInputBox({
    title: "ZIPNATION VIP",
    prompt: "Enter your 12-character VIP code",
    placeHolder: "XXXXXXXXXXXX",
    password: true,
    ignoreFocusOut: true,
    validateInput(value) {
      return normalize(value).length === 12 ? undefined : "Enter exactly 12 characters.";
    }
  });
  if (code === undefined) return false;
  return activateWithCode(context, code);
}

async function deactivateVip(context) {
  await context.globalState.update("vipActivated", false);
  await context.globalState.update("vipCode", "");
  await useFreeTheme();
  vscode.window.showInformationMessage("ZIPNATION: Free plan restored.");
}

async function applyTheme(context, themeName) {
  if (!THEMES.some(t => t.name === themeName)) return;

  if (VIP_THEMES.has(themeName) && !vipActivated(context)) {
    const action = await vscode.window.showInformationMessage(
      `${themeName} is included in ZIPNATION VIP.`,
      "Enter Code",
      "Use Night Gold"
    );

    if (action === "Enter Code") {
      const ok = await activateVip(context);
      if (ok) {
        await useTheme(themeName);
        return;
      }
    }

    await useFreeTheme();
    return;
  }

  await useTheme(themeName);
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
  if (name === "ZN Emerald Royale") return "Deep emerald surfaces with refined gold accents.";
  if (name === "ZN Rose Royale") return "Dark plum surfaces with rose-metal highlights.";
  return "Midnight blue surfaces with architectural gold accents.";
}

function storeHtml(context, webview) {
  const active = vipActivated(context);
  const code = context.globalState.get("vipCode", "");
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

  return `<!doctype html>
<html>
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{box-sizing:border-box}
:root{color-scheme:dark}
body{margin:0;background:#090a09;color:#eceae4;font-family:Segoe UI,Inter,Arial,sans-serif}
.page{max-width:1120px;margin:0 auto;padding:30px 30px 48px}
.top{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;margin-bottom:22px}
.brand{font-size:22px;letter-spacing:4px;font-weight:900;color:#e9c34a}
.kicker{font-size:11px;color:#77746e;text-transform:uppercase;letter-spacing:2px;margin-bottom:5px}
.title{font-size:27px;font-weight:800}
.subtitle{color:#85827b;font-size:13px;margin-top:5px}
.status{padding:8px 12px;border-radius:999px;font-size:11px;font-weight:850;border:1px solid #37342d;white-space:nowrap}
.status.vip{background:#102719;color:#83dc94;border-color:#285637}
.status.free{background:#211c10;color:#e9c34a;border-color:#594719}
.hero{border:1px solid #2e2b23;border-radius:16px;background:linear-gradient(135deg,#13140f,#0d0e0d);padding:19px;margin-bottom:18px}
.hero-row{display:flex;align-items:center;justify-content:space-between;gap:20px}
.hero-main{display:flex;align-items:center;gap:13px}
.mark{width:40px;height:40px;border-radius:10px;display:grid;place-items:center;background:#211c0d;color:#e9c34a;font-weight:900}
.hero-title{font-size:14px;font-weight:800}
.hero-copy{font-size:12px;color:#77746e;margin-top:4px}
.actions{display:flex;gap:7px;flex-wrap:wrap}
button{font:inherit;font-size:12px;font-weight:800;border-radius:8px;padding:9px 13px;border:1px solid #49412c;background:#151611;color:#eee;cursor:pointer}
button:hover{border-color:#c8a83f}
button:disabled{opacity:.65;cursor:default}
.gold{background:#d2ad37;color:#090909;border-color:#d2ad37}
.outline{background:#11130f}
.codebar{display:flex;gap:7px;margin-top:13px}
input{flex:1;min-width:220px;background:#090a09;border:1px solid #34342e;border-radius:8px;color:#fff;padding:10px 12px;outline:none;font-size:12px}
input:focus{border-color:#b99631}
.codehint{font-size:11px;color:#69665f;margin-top:6px}
.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
.theme-card{overflow:hidden;border:1px solid #282820;border-radius:14px;background:#101110;transition:.15s;border-top:2px solid transparent}
.theme-card:hover{border-color:#4b4636;transform:translateY(-1px)}
.theme-card.selected{border-color:#806923;border-top-color:#d2ad37}
.shot{position:relative;background:#050505}
.shot img{display:block;width:100%;height:auto}
.pill,.selected-pill{position:absolute;top:10px;padding:5px 8px;border-radius:999px;font-size:9px;font-weight:900;backdrop-filter:blur(8px)}
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
      <div class="subtitle">Preview and switch your coding environment without leaving VS Code.</div>
    </div>
    <div class="status ${active ? "vip" : "free"}">${active ? "● VIP ACTIVE" : "● FREE PLAN"}</div>
  </div>

  <section class="hero">
    <div class="hero-row">
      <div class="hero-main">
        <div class="mark">ZN</div>
        <div>
          <div class="hero-title">${active ? "ZIPNATION VIP unlocked" : "Three premium themes. One $4 bundle."}</div>
          <div class="hero-copy">${active ? `License ${code}` : "ZN Night Gold is free. VIP unlocks Emerald, Rose and Midnight."}</div>
        </div>
      </div>
      <div class="actions">
        <button class="gold" data-action="focusCode">${active ? "License" : "Enter VIP Code"}</button>
        <button data-action="free">Use Night Gold</button>
        ${active ? `<button data-action="deactivate">Deactivate</button>` : ""}
      </div>
    </div>

    ${!active ? `
      <div class="codebar">
        <input id="code" maxlength="12" autocomplete="off" spellcheck="false" placeholder="12-character VIP code">
        <button class="gold" data-action="activateInline">Unlock VIP</button>
      </div>
      <div class="codehint">VIP activation is validated locally only for development. Production licenses will be checked by ZIPNATION API.</div>
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
    else vscode.postMessage({type:"activate"});
  } else {
    vscode.postMessage({type:action});
  }
});
</script>
</body>
</html>`;
}

async function openThemeStore(context) {
  const panel = vscode.window.createWebviewPanel(
    "zipnationThemeStore",
    "ZIPNATION Theme Store",
    vscode.ViewColumn.One,
    { enableScripts: true, retainContextWhenHidden: true,
      localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, "assets", "previews")] }
  );

  const render = () => { panel.webview.html = storeHtml(context, panel.webview); };
  render();

  panel.webview.onDidReceiveMessage(async message => {
    if (message.type === "activate") await activateVip(context);
    if (message.type === "activateCode") await activateWithCode(context, message.code);
    if (message.type === "free") await useFreeTheme();
    if (message.type === "deactivate") await deactivateVip(context);
    if (message.type === "applyTheme") await applyTheme(context, message.theme);
    render();
  });
}

function activate(context) {
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  status.text = "$(paintcan) ZN Themes";
  status.tooltip = "Open ZIPNATION Theme Store";
  status.command = "zipnation.openThemeStore";
  status.show();

  context.subscriptions.push(
    status,
    vscode.commands.registerCommand("zipnation.openThemeStore", () => openThemeStore(context)),
    vscode.workspace.onDidChangeConfiguration(async event => {
      if (event.affectsConfiguration("workbench.colorTheme")) await guardTheme(context);
    })
  );

  guardTheme(context);

  const seen = context.globalState.get("zipnation.storeVersion");
  if (seen !== VERSION) {
    context.globalState.update("zipnation.storeVersion", VERSION);
    setTimeout(() => openThemeStore(context), 700);
  }
}

function deactivate() {}

module.exports = { activate, deactivate };