const http = require("http");
const vscode = require("vscode");

const DEFAULT_SERVER = "http://144.91.84.9:8088";

let extVersion = "1.3.1";
try {
  const pkg = require("../package.json");
  if (pkg && pkg.version) extVersion = pkg.version;
} catch (e) {}

/**
 * Determine whether optional telemetry is permitted by the user.
 *
 * TELEMETRY CONSENT POLICY & RUNTIME GATING:
 * 1. Authoritative Runtime Check: vscode.env.isTelemetryEnabled
 *    In VS Code / Open VSX environments, the user's global telemetry setting
 *    (e.g., telemetry.telemetryLevel set to "off" or "crash") determines
 *    vscode.env.isTelemetryEnabled. If vscode.env.isTelemetryEnabled is false,
 *    NO telemetry or analytics request is ever sent.
 *
 * 2. Extension-Specific Setting: zipnation.telemetry.enabled
 *    Users may also opt out of ZIPNATION telemetry specifically via settings.
 *    CRITICAL: This setting CANNOT override vscode.env.isTelemetryEnabled.
 *    If vscode.env.isTelemetryEnabled is false, telemetry remains strictly off
 *    even if zipnation.telemetry.enabled is set to true.
 *
 * Effective Condition:
 *    vscode.env.isTelemetryEnabled && extensionTelemetryEnabled
 *
 * @returns {boolean} True only if both VS Code global telemetry and extension setting allow it.
 */
function isTelemetryAllowed() {
  // 1. Authoritative check: VS Code runtime consent
  if (typeof vscode !== "undefined" && vscode.env && typeof vscode.env.isTelemetryEnabled === "boolean") {
    if (!vscode.env.isTelemetryEnabled) {
      return false;
    }
  } else {
    // If running in an environment without VS Code API, default to disabled for safety
    return false;
  }

  // 2. Extension-level setting: zipnation.telemetry.enabled
  try {
    const config = vscode.workspace.getConfiguration("zipnation.telemetry");
    const extensionTelemetryEnabled = config.get("enabled", true);
    if (!extensionTelemetryEnabled) {
      return false;
    }
  } catch (err) {
    // If configuration cannot be read, default to disabled
    return false;
  }

  return true;
}

/**
 * Send non-blocking anonymous telemetry ping to ZIPNATION Analytics.
 *
 * PRIVACY RULES & BOUNDARIES:
 * - Gated strictly by isTelemetryAllowed() (vscode.env.isTelemetryEnabled && zipnation.telemetry.enabled).
 * - If telemetry is disabled, this function exits immediately with zero network activity.
 * - Absolutely NO personally identifiable information (PII) is collected or sent.
 * - Absolutely NO machine identifiers (machineId removed), device fingerprints, or hardware hashes.
 * - Absolutely NO file contents, project names, workspace paths, source code, usernames, or email addresses.
 * - Only high-level anonymous feature usage metrics (e.g. theme applied, store opened).
 *
 * @param {string} eventType e.g. 'startup', 'theme_used', 'store_open'
 * @param {object} [extraData] Additional anonymous metadata (e.g. theme name)
 * @param {string} [serverUrl] Central server endpoint
 */
function trackEvent(eventType, extraData = {}, serverUrl = DEFAULT_SERVER) {
  // MANDATORY CONSENT CHECK: If telemetry is disabled, exit immediately without doing anything
  if (!isTelemetryAllowed()) {
    return;
  }

  try {
    // Sanitize extraData: only permit strictly non-sensitive, non-PII enum/numeric properties
    const cleanExtraData = {};
    if (extraData && typeof extraData === "object") {
      const allowedKeys = ["theme", "reason", "version", "firstVersion", "duration"];
      for (const [key, val] of Object.entries(extraData)) {
        if (allowedKeys.includes(key) && (typeof val === "string" || typeof val === "number" || typeof val === "boolean")) {
          cleanExtraData[key] = val;
        }
      }
    }

    // Build anonymous payload: NO machineId, NO usernames, NO hardware IDs
    const payload = JSON.stringify({
      eventType: String(eventType || "unknown"),
      ideName: (vscode.env && vscode.env.appName) || "Unknown IDE",
      ideVersion: (vscode && vscode.version) || "0.0.0",
      extensionVersion: extVersion,
      os: process.platform || "unknown",
      arch: process.arch || "unknown",
      locale: (vscode.env && vscode.env.language) || "en",
      timestamp: new Date().toISOString(),
      ...cleanExtraData
    });

    const url = new URL(`${serverUrl}/api/telemetry`);
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload)
      },
      timeout: 4000
    });

    req.on("error", () => {
      // Silently ignore telemetry network failures - never disrupt user
    });

    req.on("timeout", () => {
      req.destroy();
    });

    req.write(payload);
    req.end();
  } catch (err) {
    // Non-blocking catch
  }
}

module.exports = { trackEvent, isTelemetryAllowed };

