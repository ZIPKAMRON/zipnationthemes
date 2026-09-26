# Changelog

All notable changes to the **ZIPNATION VIP Themes** extension will be documented in this file.

## [1.3.2] - 2026-09-26

### Branding & UI
- **Official Brand Icon Integration in Theme Store**:
  - Replaced text placeholder 'ZN' in the Theme Store hero section with the authentic glowing 3D ZIPNATION logo (`assets/icon.png`).
  - Unified branding across all Theme Store views (header topbar & hero showcase).

## [1.3.1] - 2026-09-26

### Security & Privacy
- **Strict Telemetry Consent & Privacy Compliance**:
  - Gated all optional telemetry behind `vscode.env.isTelemetryEnabled` as the authoritative runtime check.
  - Added dedicated extension setting `zipnation.telemetry.enabled` (which cannot override VS Code global telemetry off).
  - Listens for `vscode.env.onDidChangeTelemetryEnabled` to immediately adapt to user consent changes at runtime.
  - Complete removal of `machineId`, device fingerprints, and PII from all telemetry payloads.
  - Added official `telemetry.json` schema manifest for full registry transparency.
  - Strictly decoupled required license verification endpoints from optional usage analytics.

## [1.3.0] - 2026-09-24

### Added
- **Strict Telemetry Consent & Privacy Compliance**:
  - Gated all optional telemetry behind `vscode.env.isTelemetryEnabled` as authoritative runtime check.
  - Added dedicated extension setting `zipnation.telemetry.enabled` (cannot override global disabled state).
  - Runtime listener for `vscode.env.onDidChangeTelemetryEnabled` to immediately respect user consent changes.
  - Complete removal of `machineId`, device fingerprints, and PII from all telemetry payloads.
  - Transparent event manifest added via `telemetry.json`.
- **Multilingual Theme Store**: Complete localization with instant switcher for English (`EN`, default), Russian (`RU`), and Uzbek (`UZ`).
- **In-Store Feedback & Bug Report System**: Built-in interactive drawer in the Theme Store (`💬 Feedback`) allowing users to submit theme ideas, suggestions, and bug reports directly to the developer team.
- **Active Real-Time License Revocation Enforcement**: Clients dynamically check revocation with the central verification server on startup, theme changes, store opening, and via background intervals; revoked licenses automatically revert to free `ZN Night Gold` with an alert notification.
- **Authentic Multi-Colored Theme Previews**: All 10 theme preview SVGs updated with rich realistic code editor windows, syntax highlighting matching theme definitions, and theme badges.
- **Advanced Admin Dashboard (v1.3.0)**:
  - Added dedicated **Licenses & Subscriptions** management section with 100-per-page pagination and search filter.
  - Added quick 1-click license revocation and status filter tabs (`Barchasi`, `Faol`, `O'chirilganlar`, `Muddati O'tgan`).
  - Added live feedback review table displaying user messages, IDE, and extension version.
  - Cleaned up registry metrics (removed placeholder rating for Microsoft Marketplace).
- **Theme Descriptions Localized**: All 10 themes now feature accurate, handcrafted descriptions in English, Russian, and Uzbek.

### Fixed
- Fixed client-side script syntax in admin dashboard preventing button interaction on certain browsers.
- Improved session authentication fallback for all administrative REST endpoints.
- Enforced automatic reversion to `ZN Night Gold` when a license is cancelled in the admin dashboard.

---

## [1.2.0] - 2026-09-24

### Added
- **Theme Store Visual Redesign**: Dynamic adaptive palette matching the active editor theme, official ZIPNATION branding (`icon.png`), and responsive preview cards.
- **Anonymous Usage Telemetry (Optional)**: Optional telemetry strictly gated by `vscode.env.isTelemetryEnabled` for aggregate metrics (theme usage, active IDE, OS).
- **Online License Lookup**: Instant verification of `ZN-XXXX-XXXX-XXXX` license codes via server lookup with robust cryptographic offline fallback.

---

## [1.1.0] - 2026-09-24

### Added
- **Universal VIP License System**: Production-ready asymmetric cryptography using Ed25519 digital signatures.
- **Flexible License Durations**: Official support for 7-day, 30-day, 90-day, and 365-day license tokens.
- **Cross-IDE Compatibility**: Verified compatibility for VS Code, Google Antigravity, Cursor, Windsurf, and VSCodium.
- **Graceful Expiration Handling**: Automatic detection of expired licenses with seamless fallback to `ZN Night Gold`.
- **New Commands**: `ZIPNATION: Enter VIP License`, `ZIPNATION: View License Status`.

---

## [1.0.0] - 2026-09-20

### Added
- Initial public release on Microsoft VS Code Marketplace and Open VSX Registry.
- 2 Free themes (`ZN Night Gold`, `ZN Ivory`).
- 8 VIP Premium themes (`ZN Emerald Royale`, `ZN Rose Royale`, `ZN Midnight Spire`, `ZN Obsidian`, `ZN Solar Flare`, `ZN Nordic`, `ZN Nordic Dark`, `ZN Cyberpunk`).
- Automatic interactive Theme Store on install.