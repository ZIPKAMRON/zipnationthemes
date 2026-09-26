# ZIPNATION VIP Themes · v1.3.1

[![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/zipnation.zipnation-vip-themes?color=d2ad37&label=VS%20Code%20Marketplace)](https://marketplace.visualstudio.com/items?itemName=zipnation.zipnation-vip-themes)
[![Open VSX](https://img.shields.io/badge/Open%20VSX-v1.0.0-orange)](https://open-vsx.org/extension/zipnation/zipnation-vip-themes)
[![License](https://img.shields.io/badge/License-VIP%20Commercial-blue.svg)](LICENSE.txt)

> **The definitive luxury theme collection for modern code editors.**  
> Crafted by **ZIPNATION** with meticulously calibrated syntax contrast, warm radiant gold accents, deep OLED surfaces, and architectural color balance.

---

## 🎨 Theme Collection (10 Themes)

### 🌟 2 Free Themes (Included Forever)
1. **ZN Night Gold** — *Signature black canvas, warm radiant gold syntax and ivory text. Classic, warm, and easy on the eyes.*
2. **ZN Ivory** — *Clean, minimalist light aesthetic with warm champagne cream accents and balanced daytime contrast.*

### 👑 8 VIP Premium Themes (Universal VIP Access)
3. **ZN Emerald Royale** — *Rich royal emerald green surface with regal gold accents and vivid keyword highlights.*
4. **ZN Rose Royale** — *Deep plum and velvet dark surfaces with warm champagne rose-gold accents.*
5. **ZN Midnight Spire** — *Architectural midnight blue canvas with glowing gold highlights and crisp syntax.*
6. **ZN Obsidian** — *True OLED pitch black background with shimmering volcanic obsidian sheen.*
7. **ZN Solar Flare** — *High-contrast volcanic charcoal with vivid solar flame and ember accents.*
8. **ZN Nordic** — *Crisp Arctic daylight atmosphere with balanced syntax contrast and cool slate tones.*
9. **ZN Nordic Dark** — *Deep polar night palette with frosted cyan and ice blue highlights.*
10. **ZN Cyberpunk** — *High-voltage neon pink and electric synthwave cyan on an ultra-deep void black.*

---

## ✨ Features in v1.3.0

### 🌍 Multilingual Theme Store (EN / RU / UZ)
- The built-in visual Theme Store defaults to **English (`EN`)**.
- Instant, zero-flicker language switcher at the top: **`[ EN ]` `[ RU ]` `[ UZ ]`**.
- Full translations for all theme cards, buttons, badges, license prompts, and feedback dialogs.
- Your language preference is saved automatically across restarts.

### 💬 In-Store Feedback & Bug Report Drawer
- Send suggestions, feature requests, new theme ideas, or bug reports directly from inside the editor.
- Click **`💬 Feedback`** in the top bar of the Theme Store.
- Categorize your message: 💡 *Suggestion / Idea*, 🐛 *Bug Report*, or 💬 *Feedback*.
- Delivered directly to the developer team.

### 🔐 Universal VIP Licensing (Ed25519)
- **Production-grade asymmetric cryptography**: High-security offline license verification using public-key cryptography.
- **Cross-IDE Compatibility**: Works seamlessly across **VS Code**, **Cursor**, **Windsurf**, **Google Antigravity IDE**, and **VSCodium**.
- **Flexible Durations**: 7-day, 30-day, 90-day, and 365-day licenses.
- **Graceful Expiration**: If a license expires, the editor gracefully reverts to the free `ZN Night Gold` theme without interrupting your workflow.

---

## 🚀 How to Use

### 1. Open the Theme Store
The store opens automatically after installation or update. You can reopen it at any time:
- Click **`$(paintcan) ZN Themes`** in the bottom-right Status Bar.
- Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and run:
  ```
  ZIPNATION: Theme Store
  ```

### 2. Activate VIP Access
1. Open the Theme Store.
2. In the VIP unlock field, enter your license code (`ZN-XXXX-XXXX-XXXX`) or raw `ZNLIC...` token.
3. Click **🔓 Unlock VIP**. All 8 VIP themes will unlock instantly!

Alternatively, activate via Command Palette:
```
Ctrl+Shift+P → ZIPNATION: Enter VIP License
```

---

## ⌨️ Extension Commands

| Command | Identifier | Description |
|---|---|---|
| **ZIPNATION: Theme Store** | `zipnation.openThemeStore` | Opens the visual interactive Theme Store |
| **ZIPNATION: Enter VIP License** | `zipnation.enterLicense` | Prompts for a license code or token to unlock VIP |
| **ZIPNATION: View License Status** | `zipnation.licenseStatus` | Displays remaining license duration and active plan |

---

## 🛡️ Security, Privacy & Telemetry Compliance

ZIPNATION is committed to complete user privacy and transparency:

- **Strict Telemetry Consent Gating**:
  - Telemetry is **strictly optional** and respects VS Code's global telemetry setting via the authoritative API: `vscode.env.isTelemetryEnabled`.
  - If you disable telemetry in your editor (e.g. `telemetry.telemetryLevel: "off"` or `"crash"`), **absolutely NO optional telemetry or analytics event is ever sent**.
  - Immediate runtime adaptation: Listens for `vscode.env.onDidChangeTelemetryEnabled` to apply changes instantly.
- **Dedicated Extension Setting**:
  - You can also selectively disable telemetry for this extension at any time via:
    ```json
    "zipnation.telemetry.enabled": false
    ```
  - Effective condition: `vscode.env.isTelemetryEnabled && zipnation.telemetry.enabled`. (The extension setting can never override VS Code's global disabled state).
- **Zero Personally Identifiable Information (PII)**:
  - We do **NOT** collect machine identifiers (`machineId`), device fingerprints, or hardware hashes.
  - We do **NOT** collect usernames, email addresses, or IP addresses for analytics.
  - We do **NOT** collect file contents, workspace paths, project names, or source code.
- **Clear Architectural Separation**:
  - Required license verification (cryptographic signature verification and explicit activation lookup) is completely separate from optional usage analytics.
  - Transparent manifest: See [`telemetry.json`](telemetry.json) for the full list of anonymous events and metadata.
- **Zero Client Secrets**:
  - No private keys, Lemon Squeezy secrets, or admin credentials exist in the extension package.
- **Lightweight**: Zero third-party npm dependencies. Fast startup and minimal memory footprint.

---

© 2026 **ZIPNATION**. All rights reserved.