# Changelog

All notable changes to the **ZIPNATION VIP Themes** extension will be documented in this file.

## [1.3.0] - 2026-09-24

### Added
- **Multilingual Theme Store**: Complete localization with instant switcher for English (`EN`, default), Russian (`RU`), and Uzbek (`UZ`).
- **In-Store Feedback & Bug Report System**: Built-in interactive drawer in the Theme Store (`💬 Feedback`) allowing users to submit theme ideas, suggestions, and bug reports directly to the developer telemetry server.
- **Advanced Admin Dashboard (v1.3.0)**:
  - Added dedicated **Users & Devices** section with 100-per-page pagination, search filter, and active vs. uninstalled/inactive device tracking.
  - Added quick 1-click license revocation and status filter tabs (`Barchasi`, `Faol`, `O'chirilganlar`, `Muddati O'tgan`).
  - Added live feedback review table displaying user messages, IDE, and extension version.
  - Cleaned up registry metrics (removed placeholder rating for Microsoft Marketplace).
- **Theme Descriptions Localized**: All 10 themes now feature accurate, handcrafted descriptions in English, Russian, and Uzbek.

### Fixed
- Fixed client-side script syntax in admin dashboard preventing button interaction on certain browsers.
- Improved session authentication fallback for all administrative REST endpoints.

---

## [1.2.0] - 2026-09-24

### Added
- **Theme Store Visual Redesign**: Dynamic adaptive palette matching the active editor theme, official ZIPNATION branding (`icon.png`), and responsive preview cards.
- **Real-Time Telemetry & Analytics**: Integrated live event tracking with centralized dashboard for downloads, active IDEs, OS statistics, and theme preferences.
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