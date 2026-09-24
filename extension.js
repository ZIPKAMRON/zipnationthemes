const vscode = require("vscode");
const crypto = require("crypto");
const http = require("http");
const { verifyLicenseToken, getDaysRemaining, formatExpiration, fetchLicenseByCode, verifyLicenseOnline } = require("./lib/license");
const { trackEvent } = require("./lib/telemetry");

const FREE_THEME = "ZN Night Gold";
const VERSION = "1.3.0";

const THEMES = [
  {
    name: "ZN Night Gold", vip: false, price: "FREE", file: "zn-night-gold.svg", tone: "Gold",
    accent: "#D6A85A", bg: "#0A0A0A",
    desc: {
      en: "Deep black canvas with warm radiant gold syntax — classic & timeless.",
      ru: "Глубокий чёрный холст с тёплым золотым синтаксисом — классика и роскошь.",
      uz: "Qora fon, oltin sintaksis — klassik va issiq."
    }
  },
  {
    name: "ZN Ivory", vip: false, price: "FREE", file: "zn-ivory.svg", tone: "Ivory",
    accent: "#B09060", bg: "#F5F1E8",
    desc: {
      en: "Clean minimalist light aesthetic with warm cream accents.",
      ru: "Чистая минималистичная светлая эстетика с тёплыми кремовыми акцентами.",
      uz: "Toza, minimalist yorug' estetika, krema aksent."
    }
  },
  {
    name: "ZN Emerald Royale", vip: true, price: "$4", file: "zn-emerald-royale.svg", tone: "Emerald",
    accent: "#2ECC71", bg: "#0D1F15",
    desc: {
      en: "Rich royal emerald green surface with regal gold accents.",
      ru: "Королевский изумрудно-зелёный фон с благородным золотым акцентом.",
      uz: "Chuqur yashil sirt, oltin aksent bilan."
    }
  },
  {
    name: "ZN Rose Royale", vip: true, price: "$4", file: "zn-rose-royale.svg", tone: "Rose",
    accent: "#E88FA0", bg: "#1A0D12",
    desc: {
      en: "Warm velvet rose with champagne gold accents.",
      ru: "Тёплая бархатная роза с акцентами цвета шампанского.",
      uz: "Qoʻngʻir gul va roʻzgʻor aksent."
    }
  },
  {
    name: "ZN Midnight Spire", vip: true, price: "$4", file: "zn-midnight-spire.svg", tone: "Midnight",
    accent: "#5B8CDB", bg: "#090E1A",
    desc: {
      en: "Architectural midnight blue canvas with glowing gold highlights.",
      ru: "Архитектурный полуночно-синий холст с сияющими золотыми акцентами.",
      uz: "Tungi ko'k sirt, me'moriy oltin aksent."
    }
  },
  {
    name: "ZN Obsidian", vip: true, price: "$4", file: "zn-obsidian.svg", tone: "Obsidian",
    accent: "#9B9B9B", bg: "#000000",
    desc: {
      en: "True OLED pitch black with shimmering volcanic obsidian sheen.",
      ru: "Настоящий глубокий OLED чёрный с мерцающим обсидиановым блеском.",
      uz: "OLED qora, obsidian parlanishi."
    }
  },
  {
    name: "ZN Solar Flare", vip: true, price: "$4", file: "zn-solar-flare.svg", tone: "Solar",
    accent: "#FF7043", bg: "#140A04",
    desc: {
      en: "Warm volcanic charcoal background with vivid solar flame accents.",
      ru: "Тёплый вулканический уголь с яркими солнечными акцентами пламени.",
      uz: "Qoʻngʻir koʻmirda yorqin olov aksenti."
    }
  },
  {
    name: "ZN Nordic", vip: true, price: "$4", file: "zn-nordic.svg", tone: "Nordic",
    accent: "#81A1C1", bg: "#ECEFF4",
    desc: {
      en: "Crisp Arctic daylight atmosphere with balanced syntax contrast.",
      ru: "Свежая атмосфера арктического дня со сбалансированным контрастом.",
      uz: "Arktik kun yorugʻi, muvozanatli sintaksis."
    }
  },
  {
    name: "ZN Nordic Dark", vip: true, price: "$4", file: "zn-nordic-dark.svg", tone: "Nordic Dark",
    accent: "#88C0D0", bg: "#0E1117",
    desc: {
      en: "Deep polar night palette with frosted cyan and ice blue highlights.",
      ru: "Глубокая полярная ночь с ледяными бирюзовыми и синими оттенками.",
      uz: "Qutb tuni estetikasi, muzli aksent."
    }
  },
  {
    name: "ZN Cyberpunk", vip: true, price: "$4", file: "zn-cyberpunk.svg", tone: "Cyberpunk",
    accent: "#FF2D9B", bg: "#030412",
    desc: {
      en: "Electric neon pink and vibrant synthwave blue on void black.",
      ru: "Электрический неоновый розовый и синтвейв-синий на глубоком чёрном.",
      uz: "Neyon pushti va elektr ko'k kontrast."
    }
  }
];

const VIP_THEMES = new Set(THEMES.filter(t => t.vip).map(t => t.name));

const I18N = {
  en: {
    brandSub: "Theme Store · v" + VERSION,
    statusVip: "VIP ACTIVE",
    statusFree: "FREE PLAN",
    statusExpired: "EXPIRED",
    heroTitleFree: "VIP Collection: 8 Premium Themes",
    heroCopyFree: "ZN Night Gold and ZN Ivory are free forever. VIP unlocks all premium themes.",
    heroTitleVip: "VIP Active — Welcome, {customer}!",
    heroCopyVip: "License: {license} · Expires: {expires} · {days} days left",
    heroTitleExpired: "Your VIP License Has Expired",
    heroCopyExpired: "Expired on {expires}. Please enter a new license code to renew.",
    btnVip: "Unlock VIP",
    btnLicInfo: "License Info",
    btnNightGold: "Night Gold",
    btnDeactivate: "Deactivate",
    licPlaceholder: "Enter ZN-XXXX-XXXX-XXXX or ZNLIC... token",
    licHint: "Universal VIP license works in VS Code, Cursor, Windsurf, Antigravity, and VSCodium. 7 / 30 / 90 / 365 days.",
    freeSection: "Free Themes",
    freeCount: "2 free themes",
    vipSection: "VIP Premium Collection",
    vipCount: "8 premium themes",
    badgeFree: "FREE",
    badgeVip: "VIP",
    badgeActive: "✓ ACTIVE",
    btnApply: "Apply Theme",
    btnActive: "✓ Current Theme",
    btnUnlockVip: "🔓 Unlock VIP",
    feedbackBtn: "💬 Feedback & Report",
    modalTitle: "💬 Send Feedback / Suggestions",
    modalTypeLabel: "Feedback Type",
    typeIdea: "💡 Suggestion / Idea",
    typeBug: "🐛 Bug Report",
    typeFeedback: "💬 General Feedback",
    senderLabel: "Your Name / Telegram (Optional)",
    senderPlaceholder: "e.g. Alex or @username",
    msgLabel: "Message",
    msgPlaceholder: "Suggest new theme ideas, request features, or report any issue...",
    cancelBtn: "Cancel",
    sendBtn: "Send Feedback",
    sendingBtn: "Sending...",
    successMsg: "✅ Thank you! Your feedback has been sent directly to the developer.",
    errorMsg: "❌ Failed to send feedback. Please check your internet connection."
  },
  ru: {
    brandSub: "Магазин тем · v" + VERSION,
    statusVip: "VIP АКТИВЕН",
    statusFree: "БЕСПЛАТНЫЙ ПЛАН",
    statusExpired: "ИСТЁК",
    heroTitleFree: "VIP Коллекция: 8 Премиум тем",
    heroCopyFree: "ZN Night Gold и ZN Ivory бесплатны навсегда. VIP открывает все премиум темы.",
    heroTitleVip: "VIP Активен — Добро пожаловать, {customer}!",
    heroCopyVip: "Лицензия: {license} · Истекает: {expires} · Осталось {days} дн.",
    heroTitleExpired: "Срок действия вашей VIP лицензии истёк",
    heroCopyExpired: "Истёк {expires}. Введите новый код лицензии для продления.",
    btnVip: "Активировать VIP",
    btnLicInfo: "Инфо о лицензии",
    btnNightGold: "Night Gold",
    btnDeactivate: "Отключить",
    licPlaceholder: "Введите ZN-XXXX-XXXX-XXXX или ZNLIC... токен",
    licHint: "Универсальная VIP лицензия работает в VS Code, Cursor, Windsurf, Antigravity и VSCodium. 7 / 30 / 90 / 365 дней.",
    freeSection: "Бесплатные Темы",
    freeCount: "2 бесплатные темы",
    vipSection: "VIP Премиум Коллекция",
    vipCount: "8 премиум тем",
    badgeFree: "БЕСПЛАТНО",
    badgeVip: "VIP",
    badgeActive: "✓ АКТИВНО",
    btnApply: "Применить",
    btnActive: "✓ Активная тема",
    btnUnlockVip: "🔓 Открыть VIP",
    feedbackBtn: "💬 Отзыв & Предложения",
    modalTitle: "💬 Отправить отзыв разработчику",
    modalTypeLabel: "Тип сообщения",
    typeIdea: "💡 Идея / Предложение",
    typeBug: "🐛 Сообщить об ошибке",
    typeFeedback: "💬 Общий отзыв",
    senderLabel: "Ваше имя / Telegram (необязательно)",
    senderPlaceholder: "например, Алекс или @username",
    msgLabel: "Сообщение",
    msgPlaceholder: "Какие новые темы или функции вы хотели бы видеть? Опишите проблему...",
    cancelBtn: "Отмена",
    sendBtn: "Отправить",
    sendingBtn: "Отправка...",
    successMsg: "✅ Спасибо! Ваш отзыв успешно отправлен разработчику.",
    errorMsg: "❌ Ошибка отправки. Проверьте интернет-соединение."
  },
  uz: {
    brandSub: "Mavzu Do'koni · v" + VERSION,
    statusVip: "VIP FAOL",
    statusFree: "BEPUL REJA",
    statusExpired: "MUDDATI O'TGAN",
    heroTitleFree: "VIP To'plam: 8 Premium Mavzu",
    heroCopyFree: "ZN Night Gold va ZN Ivory bepul. VIP barcha premium mavzularni ochadi.",
    heroTitleVip: "VIP Faol — Xush kelibsiz, {customer}!",
    heroCopyVip: "Litsenziya: {license} · Muddati: {expires} · {days} kun qoldi",
    heroTitleExpired: "VIP Litsenziyangiz muddati tugagan",
    heroCopyExpired: "{expires}da tugagan. Yangi litsenziya kodi kiriting.",
    btnVip: "VIP Ochish",
    btnLicInfo: "Litsenziya Ma'lumoti",
    btnNightGold: "Night Gold",
    btnDeactivate: "O'chirish",
    licPlaceholder: "ZN-XXXX-XXXX-XXXX yoki ZNLIC... token kiriting",
    licHint: "Universal VIP litsenziya VS Code, Cursor, Windsurf, Antigravity va VSCodium'da ishlaydi. 7 / 30 / 90 / 365 kunlik.",
    freeSection: "Bepul Mavzular",
    freeCount: "2 ta bepul",
    vipSection: "VIP Premium To'plam",
    vipCount: "8 ta premium",
    badgeFree: "BEPUL",
    badgeVip: "VIP",
    badgeActive: "✓ FAOL",
    btnApply: "Ishlatish",
    btnActive: "✓ Joriy Mavzu",
    btnUnlockVip: "🔓 VIP Ochish",
    feedbackBtn: "💬 Taklif & Fikrlar",
    modalTitle: "💬 Dasturchiga Taklif / Xabar Yuborish",
    modalTypeLabel: "Xabar Turi",
    typeIdea: "💡 G'oya / Taklif",
    typeBug: "🐛 Xatolik Haqida",
    typeFeedback: "💬 Umumiy Fikr",
    senderLabel: "Ismingiz / Telegram (Ixtiyoriy)",
    senderPlaceholder: "masalan, Sardor yoki @username",
    msgLabel: "Xabar",
    msgPlaceholder: "Yana qanday mavzular yoki imkoniyatlar qo'shilishini xohlaysiz?...",
    cancelBtn: "Bekor Qilish",
    sendBtn: "Yuborish",
    sendingBtn: "Yuborilmoqda...",
    successMsg: "✅ Rahmat! Xabaringiz dasturchiga to'g'ridan-to'g'ri yetkazildi.",
    errorMsg: "❌ Yuborishda xatolik yuz berdi. Internetni tekshiring."
  }
};

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
      formattedExpires: result.payload ? formatExpiration(result.payload.expires_at) : "Expired"
    };
  }
  if (result.state === "REVOKED") {
    return { active: false, state: "REVOKED", payload: result.payload, daysRemaining: 0, formattedExpires: "Revoked" };
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
    vscode.window.showWarningMessage("ZIPNATION: Please enter your license code or token.");
    return false;
  }

  let tokenToVerify = input;

  if (input.toUpperCase().startsWith("ZN-") && !input.startsWith("ZNLIC.")) {
    vscode.window.showInformationMessage("ZIPNATION: Verifying license with server...");
    const lookup = await fetchLicenseByCode(input);
    if (!lookup.success || !lookup.token) {
      trackEvent("license_failed", { reason: lookup.error || "not_found", code_prefix: input.slice(0, 8) });
      vscode.window.showErrorMessage(`ZIPNATION: ${lookup.error || "License not found or inactive."}`);
      return false;
    }
    tokenToVerify = lookup.token;
  }

  const result = verifyLicenseToken(tokenToVerify);
  if (!result.valid) {
    trackEvent("license_failed", { reason: result.state || result.reason || "invalid" });
    if (result.state === "EXPIRED") {
      vscode.window.showErrorMessage(`ZIPNATION: License expired on ${result.payload ? formatExpiration(result.payload.expires_at) : ""}.`);
    } else if (result.state === "REVOKED") {
      vscode.window.showErrorMessage("ZIPNATION: This license has been revoked.");
    } else {
      vscode.window.showErrorMessage(`ZIPNATION: Invalid license. ${result.reason || ""}`);
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
  vscode.window.showInformationMessage(`ZIPNATION VIP Active! Welcome, ${payload.customer_id}. Expires: ${formattedDate} (${daysLeft} days left).`);
  return true;
}

async function activateVip(context) {
  const code = await vscode.window.showInputBox({
    title: "ZIPNATION VIP Activation",
    prompt: "Enter VIP License code (ZN-XXXX-XXXX-XXXX) or Token",
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
  vscode.window.showInformationMessage("ZIPNATION: VIP deactivated. Reverted to free theme.");
}

let isCheckingOnline = false;

/**
 * Verify current VIP license status with central server.
 * If server says REVOKED or EXPIRED, clear local token and revert to ZN Night Gold immediately.
 */
async function checkLicenseStatusOnline(context) {
  if (isCheckingOnline) return;
  const token = context.globalState.get("vipLicenseToken", "");
  const licId = context.globalState.get("vipLicenseId", "");
  if (!token && !licId) return;

  isCheckingOnline = true;
  try {
    const res = await verifyLicenseOnline(licId || token);
    if (res.online && (!res.valid || res.status === "REVOKED" || res.status === "EXPIRED")) {
      const currentTheme = vscode.workspace.getConfiguration("workbench").get("colorTheme");
      const wasRevoked = res.status === "REVOKED";

      // Clear local VIP tokens
      await context.globalState.update("vipLicenseToken", "");
      await context.globalState.update("vipLicenseId", "");
      await context.globalState.update("vipCustomer", "");

      // If currently using a VIP theme, revert immediately to free theme
      if (VIP_THEMES.has(currentTheme)) {
        await useFreeTheme();
      }

      if (wasRevoked) {
        trackEvent("license_revoked_enforced", { license_id: licId });
        vscode.window.showWarningMessage(
          'ZIPNATION: VIP Litsenziyangiz bekor qilingan! Standart bepul "ZN Night Gold" mavzusiga qaytarildi.'
        );
      } else {
        trackEvent("license_expired_enforced", { license_id: licId });
        vscode.window.showWarningMessage(
          'ZIPNATION: VIP Litsenziyangiz muddati tugagan! Standart bepul "ZN Night Gold" mavzusiga qaytarildi.'
        );
      }

      if (currentStorePanel && currentStorePanel.webview) {
        currentStorePanel.webview.html = storeHtml(context, currentStorePanel.webview);
      }
    }
  } catch (err) {
    // Network or server temporarily unreachable, keep offline cryptotoken
  } finally {
    isCheckingOnline = false;
  }
}

async function showLicenseStatus(context) {
  await checkLicenseStatusOnline(context);
  const info = getLicenseInfo(context);
  if (info.active && info.payload) {
    vscode.window.showInformationMessage(
      `ZIPNATION VIP ACTIVE\nCustomer: ${info.payload.customer_id}\nLicense: ${info.payload.license_id}\nExpires: ${info.formattedExpires} (${info.daysRemaining} days left)`
    );
  } else if (info.state === "EXPIRED") {
    vscode.window.showWarningMessage(`ZIPNATION VIP EXPIRED\nExpired on ${info.formattedExpires}. Please renew license.`);
  } else if (info.state === "REVOKED") {
    vscode.window.showErrorMessage("ZIPNATION VIP REVOKED\nLitsenziyangiz bekor qilingan.");
  } else {
    vscode.window.showInformationMessage("ZIPNATION: Free plan (ZN Night Gold and ZN Ivory).");
  }
}

async function applyTheme(context, themeName) {
  if (!THEMES.some(t => t.name === themeName)) return;
  if (VIP_THEMES.has(themeName)) {
    await checkLicenseStatusOnline(context);
  }
  const licInfo = getLicenseInfo(context);
  if (VIP_THEMES.has(themeName) && !licInfo.active) {
    trackEvent("vip_blocked", { theme: themeName, reason: "store_click_unlicensed" });
    const promptMsg = licInfo.state === "EXPIRED"
      ? `🔒 "${themeName}" requires active VIP. Your license expired on ${licInfo.formattedExpires}.`
      : `🔒 "${themeName}" is part of ZIPNATION VIP collection!`;
    const action = await vscode.window.showInformationMessage(promptMsg, "Enter License", "Use Night Gold");
    if (action === "Enter License") {
      const ok = await activateVip(context);
      if (ok) { await useTheme(themeName); trackEvent("theme_used", { theme: themeName }); return; }
    }
    await useFreeTheme();
    return;
  }
  await useTheme(themeName);
  trackEvent("theme_used", { theme: themeName });
  vscode.window.showInformationMessage(`ZIPNATION: Applied ${themeName}.`);
}

let isGuardingTheme = false;
async function guardTheme(context) {
  if (isGuardingTheme) return;
  const current = vscode.workspace.getConfiguration("workbench").get("colorTheme");
  if (VIP_THEMES.has(current)) {
    await checkLicenseStatusOnline(context);
    if (!vipActivated(context)) {
      isGuardingTheme = true;
      try {
        await useFreeTheme();
        trackEvent("vip_blocked", { theme: current, reason: "unlicensed_direct_selection" });
        const action = await vscode.window.showErrorMessage(
          `🔒 "${current}" is a ZIPNATION VIP premium theme. Active VIP license required. Reverted to free "ZN Night Gold".`,
          "Enter VIP License",
          "Open Store"
        );
        if (action === "Enter VIP License") {
          await activateVip(context);
        } else if (action === "Open Store") {
          await openThemeStore(context);
        }
      } finally {
        isGuardingTheme = false;
      }
    }
  }
}

// ──────────────────────── STORE HTML ────────────────────────

function storeHtml(context, webview) {
  const info = getLicenseInfo(context);
  const active = info.active;
  const nonce = crypto.randomBytes(16).toString("hex");
  const csp = `default-src 'none'; img-src ${webview.cspSource}; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';`;
  const currentTheme = vscode.workspace.getConfiguration("workbench").get("colorTheme");

  const selectedThemeObj = THEMES.find(t => t.name === currentTheme) || THEMES[0];
  const uiAccent = selectedThemeObj.accent;
  const uiBg = selectedThemeObj.bg;
  const isLight = selectedThemeObj.name.includes("Ivory") || (selectedThemeObj.name.includes("Nordic") && !selectedThemeObj.name.includes("Dark"));
  const textPrimary = isLight ? "#1a1a1a" : "#eceae4";
  const textMuted = isLight ? "#6b6b6b" : "#9d9990";
  const cardBg = isLight ? "#f8f5ef" : "#0e0f0e";
  const borderColor = isLight ? "#e0d9ce" : "#252520";

  const znIconUri = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, "assets", "icon.png"));
  const znLogo = `<img src="${znIconUri}" class="brand-img" alt="ZIPNATION" style="width:38px;height:38px;border-radius:10px;object-fit:cover;box-shadow:0 4px 12px rgba(0,0,0,0.3);border:1.5px solid ${uiAccent}66;" />`;

  // Default is English
  const t = I18N.en;

  let heroTitle, heroCopy, statusClass, statusText, statusDot;
  if (active && info.payload) {
    statusClass = "badge-vip"; statusText = t.statusVip; statusDot = "🟢";
    heroTitle = t.heroTitleVip.replace("{customer}", info.payload.customer_id);
    heroCopy = t.heroCopyVip
      .replace("{license}", info.payload.license_id)
      .replace("{expires}", info.formattedExpires)
      .replace("{days}", info.daysRemaining);
  } else if (info.state === "EXPIRED") {
    statusClass = "badge-expired"; statusText = t.statusExpired; statusDot = "🔴";
    heroTitle = t.heroTitleExpired;
    heroCopy = t.heroCopyExpired.replace("{expires}", info.formattedExpires);
  } else {
    statusClass = "badge-free"; statusText = t.statusFree; statusDot = "⚪";
    heroTitle = t.heroTitleFree;
    heroCopy = t.heroCopyFree;
  }

  // Pre-generate theme cards
  const renderCard = (theme) => {
    const img = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, "assets", "previews", theme.file));
    const locked = theme.vip && !active;
    const selected = currentTheme === theme.name;
    const cardAccent = theme.accent;
    const themeIcon = `<img src="${znIconUri}" style="width:26px;height:26px;border-radius:6px;object-fit:cover;border:1.5px solid ${cardAccent}77;box-shadow:0 2px 6px ${cardAccent}22;" alt="ZN" />`;

    return `
      <article class="theme-card${selected ? " selected" : ""}${locked ? " locked" : ""}" data-theme-name="${theme.name}" style="${selected ? `border-color:${cardAccent}55;box-shadow:0 0 0 1px ${cardAccent}22,0 8px 32px ${cardAccent}14` : ""}">
        <div class="card-img-wrap">
          <img src="${img}" alt="${theme.name}" loading="lazy">
          <div class="card-badges">
            <span class="badge-pill card-badge-type" style="background:${cardAccent}18;border-color:${cardAccent}40;color:${cardAccent}">${theme.vip ? "VIP" : t.badgeFree}</span>
            ${selected ? `<span class="badge-active card-badge-active">${t.badgeActive}</span>` : locked ? `<span class="badge-lock">🔒</span>` : ""}
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
          <div class="card-desc" data-desc-for="${theme.name}">${theme.desc.en}</div>
          <button class="card-btn${locked ? " btn-outline" : selected ? " btn-active" : " btn-primary"}"
                  style="${locked ? `border-color:${cardAccent}50;color:${cardAccent}` : !selected ? `background:${cardAccent};color:${isLight ? "#fff" : "#080909"};border-color:${cardAccent}` : ""}"
                  data-action="apply" data-theme="${theme.name}">
            <span class="card-btn-text">${locked ? t.btnUnlockVip : selected ? t.btnActive : t.btnApply}</span>
          </button>
        </div>
      </article>`;
  };

  const freeCardsHtml = THEMES.filter(t => !t.vip).map(renderCard).join("");
  const vipCardsHtml = THEMES.filter(t => t.vip).map(renderCard).join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>ZIPNATION Theme Store</title>
<style>
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
.page{max-width:1080px;margin:0 auto;padding:26px 28px 56px}

/* TOPBAR */
.topbar{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:24px;flex-wrap:wrap}
.brand{display:flex;align-items:center;gap:10px}
.brand-text{display:flex;flex-direction:column;gap:1px}
.brand-name{font-size:18px;font-weight:900;letter-spacing:3px;color:var(--accent);line-height:1}
.brand-sub{font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:2px}

.topbar-right{display:flex;align-items:center;gap:10px;flex-wrap:wrap}

/* LANGUAGE SWITCHER */
.lang-switch{
  display:inline-flex;align-items:center;background:${isLight ? "#f0ebe0" : "#121412"};
  border:1.5px solid var(--border);border-radius:999px;padding:2px;gap:2px;
}
.lang-btn{
  border:none;background:transparent;color:var(--muted);
  font-size:10px;font-weight:900;letter-spacing:1px;
  padding:4px 9px;border-radius:999px;cursor:pointer;transition:all .15s;
}
.lang-btn:hover{color:var(--text)}
.lang-btn.active{
  background:var(--accent);color:${isLight ? "#fff" : "#080909"};
  box-shadow:0 1px 6px rgba(0,0,0,0.3);
}

.btn-feedback-top{
  background:transparent;border:1.5px solid var(--border);border-radius:999px;
  color:var(--text);font-size:11px;font-weight:800;padding:5px 12px;cursor:pointer;
  display:flex;align-items:center;gap:5px;transition:all .15s;
}
.btn-feedback-top:hover{border-color:var(--accent);color:var(--accent)}

.status-badge{
  display:flex;align-items:center;gap:5px;
  padding:5px 13px;border-radius:999px;font-size:10px;font-weight:800;
  border:1px solid;white-space:nowrap;text-transform:uppercase;letter-spacing:1.5px;
}
.badge-vip{background:#0d2117;color:#83dc94;border-color:#1e4a2d}
.badge-free{background:${uiAccent}15;color:${uiAccent};border-color:${uiAccent}40}
.badge-expired{background:#2d1313;color:#f87171;border-color:#5a2020}

/* HERO */
.hero{
  background:${isLight ? `linear-gradient(135deg,#faf7f0,#f0ebe0)` : `linear-gradient(135deg,${uiAccent}0a 0%,transparent 60%)`};
  border:1px solid ${uiAccent}30;border-radius:18px;padding:22px 24px;margin-bottom:24px;
  position:relative;overflow:hidden;
}
.hero-row{display:flex;align-items:center;justify-content:space-between;gap:20px;flex-wrap:wrap}
.hero-left{display:flex;align-items:center;gap:14px}
.hero-logo{
  width:48px;height:48px;border-radius:12px;background:${uiAccent}18;border:1px solid ${uiAccent}35;
  display:grid;place-items:center;flex-shrink:0;
}
.hero-logo-text{font-size:16px;font-weight:900;color:${uiAccent};letter-spacing:1px}
.hero-title{font-size:15px;font-weight:800;margin-bottom:3px}
.hero-copy{font-size:12px;color:var(--muted)}
.hero-actions{display:flex;gap:8px;flex-wrap:wrap}

/* LICENSE ROW */
.license-row{display:flex;gap:8px;margin-top:18px;flex-wrap:wrap;padding-top:16px;border-top:1px solid ${uiAccent}20}
.lic-input{
  flex:1;min-width:240px;background:${isLight ? "#fff" : "#080909"};
  border:1.5px solid var(--border);border-radius:10px;color:var(--text);
  padding:10px 14px;outline:none;font-size:12px;font-family:inherit;transition:border-color .15s;
}
.lic-input:focus{border-color:var(--accent)}
.lic-input::placeholder{color:var(--muted)}
.lic-hint{font-size:10px;color:var(--muted);margin-top:7px}

/* BUTTONS */
button{
  font:inherit;font-size:12px;font-weight:800;border-radius:10px;padding:9px 16px;
  border:1.5px solid var(--border);background:${isLight ? "#f0ebe0" : "#131411"};
  color:var(--text);cursor:pointer;transition:all .15s;white-space:nowrap;
}
button:hover{border-color:var(--accent);color:var(--accent)}
button:active{transform:scale(.98)}
.btn-gold{background:var(--accent)!important;color:${isLight ? "#fff" : "#080909"}!important;border-color:var(--accent)!important}
.btn-gold:hover{filter:brightness(1.12)}
.btn-sm{padding:7px 12px;font-size:11px}

/* DIVIDER */
.divider{display:flex;align-items:center;gap:12px;margin:24px 0 16px}
.divider-line{flex:1;height:1px;background:var(--border)}
.divider-label{font-size:9px;text-transform:uppercase;letter-spacing:2.5px;color:var(--muted);font-weight:700;white-space:nowrap}
.free-count{
  font-size:10px;padding:3px 10px;border-radius:999px;background:${uiAccent}15;color:${uiAccent};
  border:1px solid ${uiAccent}30;font-weight:700;letter-spacing:1px;
}

/* GRID & CARDS */
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px}
.theme-card{
  border-radius:var(--radius);border:1.5px solid var(--border);background:var(--card);
  overflow:hidden;transition:transform .15s,border-color .2s,box-shadow .2s;cursor:default;
}
.theme-card:hover{transform:translateY(-3px);box-shadow:0 12px 40px rgba(0,0,0,.25)}
.theme-card.selected{border-width:2px}
.theme-card.locked{opacity:.88}
.card-img-wrap{position:relative;background:#050505;border-bottom:1px solid var(--border)}
.card-img-wrap img{display:block;width:100%;height:auto;aspect-ratio:16/9;object-fit:cover}
.card-badges{position:absolute;top:10px;width:100%;display:flex;justify-content:space-between;align-items:flex-start;padding:0 10px;pointer-events:none}
.badge-pill{padding:4px 10px;border-radius:999px;font-size:9px;font-weight:900;letter-spacing:1px;text-transform:uppercase;border:1px solid;backdrop-filter:blur(8px)}
.badge-active{padding:4px 10px;border-radius:999px;font-size:9px;font-weight:900;background:#0d2117;color:#83dc94;border:1px solid #1e4a2d;letter-spacing:.5px}
.badge-lock{font-size:13px;background:rgba(0,0,0,.5);padding:3px 7px;border-radius:7px}

.card-body{padding:14px}
.card-head-row{display:flex;align-items:center;gap:10px;margin-bottom:8px}
.card-icon{flex-shrink:0}
.card-meta{flex:1;min-width:0}
.card-tone{font-size:9px;text-transform:uppercase;letter-spacing:2px;font-weight:700;margin-bottom:1px}
.card-name{font-size:15px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.card-price{font-size:13px;font-weight:900;flex-shrink:0}
.card-desc{font-size:12px;color:var(--muted);line-height:1.5;margin-bottom:12px;min-height:36px}
.card-btn{width:100%;text-align:center;padding:10px;border-radius:10px;font-size:12px;font-weight:800;transition:all .15s}
.btn-outline{background:transparent;border:1.5px solid var(--border)}
.btn-outline:hover{border-color:var(--accent)!important;color:var(--accent)!important}
.btn-active{background:transparent!important;border-color:${uiAccent}40!important;color:var(--muted)!important;cursor:default!important}
.btn-active:hover{transform:none}

/* FOOTER */
.footer{
  display:flex;justify-content:space-between;align-items:center;gap:12px;
  margin-top:24px;padding-top:16px;border-top:1px solid var(--border);
  color:var(--muted);font-size:11px;flex-wrap:wrap;
}
.footer-brand{color:var(--accent);font-weight:800;letter-spacing:1px}
.footer-links{display:flex;gap:14px}

/* MODAL */
.modal-backdrop{
  position:fixed;top:0;left:0;right:0;bottom:0;
  background:rgba(0,0,0,0.7);backdrop-filter:blur(6px);
  display:flex;align-items:center;justify-content:center;
  z-index:9999;padding:16px;
}
.modal-box{
  background:${isLight ? "#fff" : "#101211"};border:1px solid ${uiAccent}40;
  border-radius:16px;width:100%;max-width:440px;box-shadow:0 12px 48px rgba(0,0,0,0.6);
  padding:20px 22px;display:flex;flex-direction:column;gap:14px;position:relative;
}
.modal-header{display:flex;align-items:center;justify-content:space-between}
.modal-title{font-size:14px;font-weight:800;color:var(--accent);display:flex;align-items:center;gap:6px}
.modal-close{
  background:transparent;border:none;color:var(--muted);font-size:20px;
  cursor:pointer;padding:0 4px;line-height:1;border-radius:4px;
}
.modal-close:hover{color:var(--text)}
.form-group{display:flex;flex-direction:column;gap:5px}
.form-group label{font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:var(--muted);font-weight:700}
.type-chips{display:flex;gap:6px;flex-wrap:wrap}
.chip{
  background:transparent;border:1px solid var(--border);color:var(--muted);
  font-size:11px;padding:5px 10px;border-radius:8px;cursor:pointer;transition:all .15s;
}
.chip:hover{border-color:var(--accent);color:var(--text)}
.chip.active{background:${uiAccent}15;border-color:var(--accent);color:var(--accent);font-weight:800}
.fb-textarea{
  width:100%;background:${isLight ? "#f9f6f0" : "#080908"};border:1.5px solid var(--border);
  border-radius:10px;color:var(--text);padding:10px 12px;font-family:inherit;font-size:12px;
  outline:none;resize:vertical;min-height:85px;transition:border-color .15s;
}
.fb-textarea:focus{border-color:var(--accent)}
.modal-footer{display:flex;justify-content:flex-end;gap:8px;margin-top:6px}
.fb-status{padding:8px 12px;border-radius:8px;font-size:11px;font-weight:600}
.fb-success{background:#0d2217;color:#83dc94;border:1px solid #1e4a2d}
.fb-error{background:#2d1313;color:#f87171;border:1px solid #5a2020}

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
        <div class="brand-sub" id="t-brand-sub">${t.brandSub}</div>
      </div>
    </div>

    <div class="topbar-right">
      <button class="btn-feedback-top" id="btn-open-feedback">💬 <span id="t-feedback-btn">${t.feedbackBtn}</span></button>
      <div class="lang-switch">
        <button class="lang-btn active" data-lang="en">EN</button>
        <button class="lang-btn" data-lang="ru">RU</button>
        <button class="lang-btn" data-lang="uz">UZ</button>
      </div>
      <div class="status-badge ${statusClass}">${statusDot} <span id="t-status">${statusText}</span></div>
    </div>
  </div>

  <!-- HERO -->
  <section class="hero">
    <div class="hero-row">
      <div class="hero-left">
        <div class="hero-logo"><div class="hero-logo-text">ZN</div></div>
        <div>
          <div class="hero-title" id="t-hero-title">${heroTitle}</div>
          <div class="hero-copy" id="t-hero-copy">${heroCopy}</div>
        </div>
      </div>
      <div class="hero-actions">
        <button class="btn-gold btn-sm" data-action="focusCode" id="t-btn-vip">${active ? t.btnLicInfo : t.btnVip}</button>
        <button class="btn-sm" data-action="free" id="t-btn-free">${t.btnNightGold}</button>
        ${active ? `<button class="btn-sm" data-action="deactivate" id="t-btn-deactivate">${t.btnDeactivate}</button>` : ""}
      </div>
    </div>

    ${!active ? `
      <div class="license-row">
        <input id="code" class="lic-input" autocomplete="off" spellcheck="false"
               placeholder="${t.licPlaceholder}">
        <button class="btn-gold" data-action="activateInline" id="t-btn-activate-inline">🔓 <span id="t-btn-activate-text">${t.btnVip}</span></button>
      </div>
      <div class="lic-hint" id="t-lic-hint">${t.licHint}</div>
    ` : ""}
  </section>

  <!-- FREE THEMES -->
  <div class="divider">
    <div class="divider-line"></div>
    <div class="divider-label" id="t-free-section">${t.freeSection}</div>
    <div class="free-count" id="t-free-count">${t.freeCount}</div>
    <div class="divider-line"></div>
  </div>

  <div class="grid" id="free-grid">
    ${freeCardsHtml}
  </div>

  <!-- VIP THEMES -->
  <div class="divider">
    <div class="divider-line"></div>
    <div class="divider-label" id="t-vip-section">${t.vipSection}</div>
    <div class="free-count" style="color:${uiAccent}" id="t-vip-count">${t.vipCount}</div>
    <div class="divider-line"></div>
  </div>

  <div class="grid" id="vip-grid">
    ${vipCardsHtml}
  </div>

  <!-- FOOTER -->
  <div class="footer">
    <div>
      <span class="footer-brand">ZIPNATION</span> ·
      <span>2 free themes</span> ·
      <span>8 VIP premium themes</span>
    </div>
    <div class="footer-links">
      <span>v${VERSION}</span>
      <span>·</span>
      <span style="color:var(--accent)">zipnation.dev</span>
    </div>
  </div>

</div>

<!-- FEEDBACK MODAL -->
<div id="feedback-modal" class="modal-backdrop" style="display:none">
  <div class="modal-box">
    <div class="modal-header">
      <div class="modal-title" id="t-modal-title">${t.modalTitle}</div>
      <button class="modal-close" id="btn-close-modal">&times;</button>
    </div>
    <div class="form-group">
      <label id="t-modal-type-label">${t.modalTypeLabel}</label>
      <div class="type-chips">
        <button type="button" class="chip active" data-type="idea" id="chip-idea">${t.typeIdea}</button>
        <button type="button" class="chip" data-type="bug" id="chip-bug">${t.typeBug}</button>
        <button type="button" class="chip" data-type="feedback" id="chip-feedback">${t.typeFeedback}</button>
      </div>
    </div>
    <div class="form-group">
      <label id="t-sender-label">${t.senderLabel}</label>
      <input type="text" id="fb-sender" class="lic-input" placeholder="${t.senderPlaceholder}" autocomplete="off">
    </div>
    <div class="form-group">
      <label id="t-msg-label">${t.msgLabel}</label>
      <textarea id="fb-message" class="fb-textarea" placeholder="${t.msgPlaceholder}"></textarea>
    </div>
    <div id="fb-status" class="fb-status" style="display:none"></div>
    <div class="modal-footer">
      <button class="btn-sm" id="btn-cancel-feedback">${t.cancelBtn}</button>
      <button class="btn-gold btn-sm" id="btn-send-feedback">🚀 <span id="t-send-btn-text">${t.sendBtn}</span></button>
    </div>
  </div>
</div>

<script nonce="${nonce}">
const vscode = acquireVsCodeApi();

const I18N = ${JSON.stringify(I18N)};
const THEME_DESCS = ${JSON.stringify(THEMES.reduce((acc, t) => { acc[t.name] = t.desc; return acc; }, {}))};
const IS_ACTIVE = ${active ? "true" : "false"};
const LIC_CUSTOMER = "${info.payload ? info.payload.customer_id : ""}";
const LIC_ID = "${info.payload ? info.payload.license_id : ""}";
const LIC_EXPIRES = "${info.formattedExpires}";
const LIC_DAYS = ${info.daysRemaining};
const LIC_STATE = "${info.state}";

let currentLang = 'en';

// Restore language preference
try {
  const savedState = vscode.getState();
  if (savedState && savedState.lang && I18N[savedState.lang]) {
    currentLang = savedState.lang;
  }
} catch (e) {}

function applyLanguage(lang) {
  if (!I18N[lang]) return;
  currentLang = lang;
  try { vscode.setState({ lang: lang }); } catch (e) {}

  // Highlight button
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });

  const t = I18N[lang];
  document.getElementById('t-brand-sub').textContent = t.brandSub;
  document.getElementById('t-feedback-btn').textContent = t.feedbackBtn;
  document.getElementById('t-free-section').textContent = t.freeSection;
  document.getElementById('t-free-count').textContent = t.freeCount;
  document.getElementById('t-vip-section').textContent = t.vipSection;
  document.getElementById('t-vip-count').textContent = t.vipCount;

  // Status & Hero
  if (IS_ACTIVE) {
    document.getElementById('t-status').textContent = t.statusVip;
    document.getElementById('t-hero-title').textContent = t.heroTitleVip.replace("{customer}", LIC_CUSTOMER);
    document.getElementById('t-hero-copy').textContent = t.heroCopyVip
      .replace("{license}", LIC_ID).replace("{expires}", LIC_EXPIRES).replace("{days}", LIC_DAYS);
    const btnVip = document.getElementById('t-btn-vip');
    if (btnVip) btnVip.textContent = t.btnLicInfo;
    const btnDeact = document.getElementById('t-btn-deactivate');
    if (btnDeact) btnDeact.textContent = t.btnDeactivate;
  } else if (LIC_STATE === 'EXPIRED') {
    document.getElementById('t-status').textContent = t.statusExpired;
    document.getElementById('t-hero-title').textContent = t.heroTitleExpired;
    document.getElementById('t-hero-copy').textContent = t.heroCopyExpired.replace("{expires}", LIC_EXPIRES);
  } else {
    document.getElementById('t-status').textContent = t.statusFree;
    document.getElementById('t-hero-title').textContent = t.heroTitleFree;
    document.getElementById('t-hero-copy').textContent = t.heroCopyFree;
    const btnVip = document.getElementById('t-btn-vip');
    if (btnVip) btnVip.textContent = t.btnVip;
  }

  const btnFree = document.getElementById('t-btn-free');
  if (btnFree) btnFree.textContent = t.btnNightGold;

  const codeInput = document.getElementById('code');
  if (codeInput) codeInput.placeholder = t.licPlaceholder;
  const licHint = document.getElementById('t-lic-hint');
  if (licHint) licHint.textContent = t.licHint;
  const actText = document.getElementById('t-btn-activate-text');
  if (actText) actText.textContent = t.btnVip;

  // Theme card descriptions & buttons
  document.querySelectorAll('[data-desc-for]').forEach(el => {
    const name = el.dataset.descFor;
    if (THEME_DESCS[name] && THEME_DESCS[name][lang]) {
      el.textContent = THEME_DESCS[name][lang];
    }
  });

  document.querySelectorAll('.theme-card').forEach(card => {
    const isLocked = card.classList.contains('locked');
    const isSelected = card.classList.contains('selected');
    const btnTextEl = card.querySelector('.card-btn-text');
    if (btnTextEl) {
      btnTextEl.textContent = isLocked ? t.btnUnlockVip : isSelected ? t.btnActive : t.btnApply;
    }
    const badgeActive = card.querySelector('.card-badge-active');
    if (badgeActive) badgeActive.textContent = t.badgeActive;
    const badgeType = card.querySelector('.card-badge-type');
    if (badgeType && !card.dataset.themeName.includes('VIP') && !card.classList.contains('locked')) {
      badgeType.textContent = t.badgeFree;
    }
  });

  // Modal texts
  document.getElementById('t-modal-title').textContent = t.modalTitle;
  document.getElementById('t-modal-type-label').textContent = t.modalTypeLabel;
  document.getElementById('chip-idea').textContent = t.typeIdea;
  document.getElementById('chip-bug').textContent = t.typeBug;
  document.getElementById('chip-feedback').textContent = t.typeFeedback;
  document.getElementById('t-sender-label').textContent = t.senderLabel;
  document.getElementById('fb-sender').placeholder = t.senderPlaceholder;
  document.getElementById('t-msg-label').textContent = t.msgLabel;
  document.getElementById('fb-message').placeholder = t.msgPlaceholder;
  document.getElementById('btn-cancel-feedback').textContent = t.cancelBtn;
  document.getElementById('t-send-btn-text').textContent = t.sendBtn;
}

// Language switch buttons
document.querySelectorAll('.lang-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    applyLanguage(btn.dataset.lang);
  });
});

if (currentLang !== 'en') {
  applyLanguage(currentLang);
}

// ── Action clicks ──
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

const codeInput = document.getElementById("code");
if (codeInput) {
  codeInput.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      vscode.postMessage({ type: "activateCode", code: codeInput.value });
    }
  });
}

// ── FEEDBACK MODAL LOGIC ──
const modal = document.getElementById('feedback-modal');
const openModalBtn = document.getElementById('btn-open-feedback');
const closeModalBtn = document.getElementById('btn-close-modal');
const cancelModalBtn = document.getElementById('btn-cancel-feedback');
const sendFeedbackBtn = document.getElementById('btn-send-feedback');
const fbStatus = document.getElementById('fb-status');

let selectedType = 'idea';

function openModal() {
  modal.style.display = 'flex';
  fbStatus.style.display = 'none';
  document.getElementById('fb-message').focus();
}

function closeModal() {
  modal.style.display = 'none';
}

if (openModalBtn) openModalBtn.addEventListener('click', openModal);
if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
if (cancelModalBtn) cancelModalBtn.addEventListener('click', closeModal);

document.querySelectorAll('.type-chips .chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.type-chips .chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    selectedType = chip.dataset.type;
  });
});

if (sendFeedbackBtn) {
  sendFeedbackBtn.addEventListener('click', () => {
    const sender = document.getElementById('fb-sender').value.trim();
    const message = document.getElementById('fb-message').value.trim();
    const t = I18N[currentLang];

    if (!message) {
      fbStatus.textContent = currentLang === 'ru' ? 'Пожалуйста, введите сообщение.' : currentLang === 'uz' ? 'Iltimos, xabar matnini kiriting.' : 'Please enter your message.';
      fbStatus.className = 'fb-status fb-error';
      fbStatus.style.display = 'block';
      document.getElementById('fb-message').focus();
      return;
    }

    sendFeedbackBtn.disabled = true;
    document.getElementById('t-send-btn-text').textContent = t.sendingBtn;
    fbStatus.style.display = 'none';

    vscode.postMessage({
      type: 'sendFeedback',
      feedbackType: selectedType,
      sender: sender,
      message: message
    });
  });
}

// Listen for response from extension host
window.addEventListener('message', event => {
  const msg = event.data;
  const t = I18N[currentLang];
  if (msg.type === 'feedbackResult') {
    sendFeedbackBtn.disabled = false;
    document.getElementById('t-send-btn-text').textContent = t.sendBtn;
    if (msg.success) {
      fbStatus.textContent = t.successMsg;
      fbStatus.className = 'fb-status fb-success';
      fbStatus.style.display = 'block';
      document.getElementById('fb-message').value = '';
      setTimeout(() => {
        closeModal();
        fbStatus.style.display = 'none';
      }, 2400);
    } else {
      fbStatus.textContent = msg.error || t.errorMsg;
      fbStatus.className = 'fb-status fb-error';
      fbStatus.style.display = 'block';
    }
  }
});
</script>
</body>
</html>`;
}

// ──────────────────────── OPEN STORE ────────────────────────

let currentStorePanel = null;

async function openThemeStore(context) {
  trackEvent("store_open");
  checkLicenseStatusOnline(context);
  if (currentStorePanel) {
    currentStorePanel.reveal(vscode.ViewColumn.One);
    return;
  }
  const panel = vscode.window.createWebviewPanel(
    "zipnationThemeStore", "ZIPNATION Theme Store",
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
    if (message.type === "sendFeedback") {
      const info = getLicenseInfo(context);
      const postData = JSON.stringify({
        type: message.feedbackType || "idea",
        message: message.message || "",
        customer_id: message.sender || (info.payload ? info.payload.customer_id : "VS Code User"),
        ide: vscode.env.appName,
        version: VERSION
      });

      const req = http.request({
        hostname: "144.91.84.9",
        port: 8088,
        path: "/api/feedback",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(postData)
        },
        timeout: 7000
      }, res => {
        let b = "";
        res.on("data", c => b += c);
        res.on("end", () => {
          try {
            const json = JSON.parse(b);
            if (res.statusCode === 200 && json.success) {
              vscode.window.showInformationMessage("ZIPNATION: Thank you! Your feedback has been received.");
              if (panel && panel.webview) {
                panel.webview.postMessage({ type: "feedbackResult", success: true });
              }
            } else {
              vscode.window.showErrorMessage(`ZIPNATION: ${json.error || "Failed to submit feedback."}`);
              if (panel && panel.webview) {
                panel.webview.postMessage({ type: "feedbackResult", success: false, error: json.error });
              }
            }
          } catch (e) {
            if (panel && panel.webview) {
              panel.webview.postMessage({ type: "feedbackResult", success: false });
            }
          }
        });
      });

      req.on("error", err => {
        vscode.window.showErrorMessage(`ZIPNATION: Could not reach server: ${err.message}`);
        if (panel && panel.webview) {
          panel.webview.postMessage({ type: "feedbackResult", success: false, error: err.message });
        }
      });

      req.on("timeout", () => {
        req.destroy();
        vscode.window.showErrorMessage("ZIPNATION: Feedback request timed out.");
        if (panel && panel.webview) {
          panel.webview.postMessage({ type: "feedbackResult", success: false, error: "Timed out" });
        }
      });

      req.write(postData);
      req.end();
    }
  });
}

// ──────────────────────── ACTIVATE ────────────────────────

function activate(context) {
  const seenVersion = context.globalState.get("zipnation.storeVersion");
  if (!seenVersion) trackEvent("install", { firstVersion: VERSION });
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
      if (event.affectsConfiguration("workbench.colorTheme")) {
        await guardTheme(context);
        if (currentStorePanel && currentStorePanel.webview) {
          currentStorePanel.webview.html = storeHtml(context, currentStorePanel.webview);
        }
      }
    })
  );

  guardTheme(context);

  // Online revocation verification check
  setTimeout(() => checkLicenseStatusOnline(context), 1200);
  const onlineCheckTimer = setInterval(() => checkLicenseStatusOnline(context), 60 * 1000);
  context.subscriptions.push({ dispose: () => clearInterval(onlineCheckTimer) });

  if (seenVersion !== VERSION) {
    context.globalState.update("zipnation.storeVersion", VERSION);
    setTimeout(() => openThemeStore(context), 700);
  }
}

function deactivate() {}

module.exports = { activate, deactivate, getLicenseInfo, vipActivated, activateWithToken };
