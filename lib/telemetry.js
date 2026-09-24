const http = require("http");
const vscode = require("vscode");

const DEFAULT_SERVER = "http://144.91.84.9:8088";

let extVersion = "1.2.0";
try {
  const pkg = require("../package.json");
  if (pkg && pkg.version) extVersion = pkg.version;
} catch (e) {}

/**
 * Send non-blocking anonymous telemetry ping to ZIPNATION Analytics
 * @param {string} eventType e.g. 'startup', 'theme_used', 'store_open', 'license_activate'
 * @param {object} [extraData] Additional metadata like theme name
 * @param {string} [serverUrl] Server endpoint
 */
function trackEvent(eventType, extraData = {}, serverUrl = DEFAULT_SERVER) {
  try {
    const payload = JSON.stringify({
      eventType,
      ideName: vscode.env.appName || "Unknown IDE",
      ideVersion: vscode.version || "0.0.0",
      extensionVersion: extVersion,
      os: process.platform || "unknown",
      arch: process.arch || "unknown",
      machineId: vscode.env.machineId || "anonymous",
      locale: vscode.env.language || "en",
      timestamp: new Date().toISOString(),
      ...extraData
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

module.exports = { trackEvent };
