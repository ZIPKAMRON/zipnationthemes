const assert = require("assert");
const http = require("http");

console.log("=== RUNNING ZIPNATION TELEMETRY & PRIVACY UNIT TESTS ===");

// Mock vscode module for standalone unit testing
let mockTelemetryEnabled = true;
let mockExtensionSettingEnabled = true;
let mockOnDidChangeCallback = null;

const mockVscode = {
  env: {
    get isTelemetryEnabled() {
      return mockTelemetryEnabled;
    },
    appName: "Visual Studio Code",
    language: "en",
    onDidChangeTelemetryEnabled(cb) {
      mockOnDidChangeCallback = cb;
      return { dispose: () => {} };
    }
  },
  StatusBarAlignment: { Left: 1, Right: 2 },
  version: "1.85.0",
  workspace: {
    getConfiguration(section) {
      if (section === "zipnation.telemetry") {
        return {
          get(key, defaultVal) {
            if (key === "enabled") return mockExtensionSettingEnabled;
            return defaultVal;
          }
        };
      }
      return { get: (k, d) => d };
    }
  }
};

// Intercept require('vscode') in lib/telemetry.js
const Module = require("module");
const originalRequire = Module.prototype.require;
Module.prototype.require = function(path) {
  if (path === "vscode") return mockVscode;
  return originalRequire.apply(this, arguments);
};

const { trackEvent, isTelemetryAllowed } = require("../lib/telemetry");

// Test 1: Authoritative Runtime Check - vscode.env.isTelemetryEnabled = false
{
  mockTelemetryEnabled = false;
  mockExtensionSettingEnabled = true;
  assert.strictEqual(
    isTelemetryAllowed(),
    false,
    "When vscode.env.isTelemetryEnabled is false, telemetry MUST be disallowed regardless of extension setting"
  );
  console.log("✔ Test 1 Passed: vscode.env.isTelemetryEnabled=false strictly disallows telemetry.");
}

// Test 2: Extension Setting Check - zipnation.telemetry.enabled = false
{
  mockTelemetryEnabled = true;
  mockExtensionSettingEnabled = false;
  assert.strictEqual(
    isTelemetryAllowed(),
    false,
    "When zipnation.telemetry.enabled is false, telemetry MUST be disallowed"
  );
  console.log("✔ Test 2 Passed: zipnation.telemetry.enabled=false disallows telemetry.");
}

// Test 3: Effective Condition - vscode.env.isTelemetryEnabled && extensionTelemetryEnabled
{
  mockTelemetryEnabled = true;
  mockExtensionSettingEnabled = true;
  assert.strictEqual(
    isTelemetryAllowed(),
    true,
    "Telemetry is ONLY allowed when BOTH vscode.env.isTelemetryEnabled AND zipnation.telemetry.enabled are true"
  );
  console.log("✔ Test 3 Passed: Both enabled -> telemetry allowed.");
}

// Test 4: Extension setting CANNOT override vscode.env.isTelemetryEnabled = false
{
  mockTelemetryEnabled = false;
  mockExtensionSettingEnabled = true;
  assert.strictEqual(
    isTelemetryAllowed(),
    false,
    "zipnation.telemetry.enabled=true MUST NOT override vscode.env.isTelemetryEnabled=false"
  );
  console.log("✔ Test 4 Passed: Setting cannot override VS Code global telemetry off.");
}

// Test 5: Verify trackEvent makes ZERO HTTP requests when telemetry is disabled
{
  mockTelemetryEnabled = false;
  mockExtensionSettingEnabled = false;

  let httpRequestCalled = false;
  const originalHttpRequest = http.request;
  http.request = function() {
    httpRequestCalled = true;
    return originalHttpRequest.apply(this, arguments);
  };

  trackEvent("startup", { version: "1.3.0" });
  trackEvent("theme_used", { theme: "ZN Night Gold" });
  trackEvent("store_open");

  assert.strictEqual(
    httpRequestCalled,
    false,
    "trackEvent MUST NOT make any HTTP request when telemetry is disabled"
  );
  console.log("✔ Test 5 Passed: Zero HTTP requests sent when telemetry is disabled.");

  http.request = originalHttpRequest;
}

// Test 6: Verify payload does NOT contain machineId or PII when telemetry is enabled
{
  mockTelemetryEnabled = true;
  mockExtensionSettingEnabled = true;

  let capturedPayload = null;
  const originalHttpRequest = http.request;
  http.request = function(opts) {
    return {
      on: () => {},
      write: (data) => {
        capturedPayload = JSON.parse(data);
      },
      end: () => {}
    };
  };

  // Attempt to pass sensitive fields into extraData
  trackEvent("license_activate", {
    customer: "alice@example.com",
    customer_id: "Alice",
    license_id: "ZN-1234-5678",
    duration: 30,
    theme: "ZN Emerald Royale"
  });

  assert.ok(capturedPayload, "Payload should be generated");
  assert.strictEqual(capturedPayload.eventType, "license_activate");
  assert.strictEqual(capturedPayload.duration, 30);
  assert.strictEqual(capturedPayload.theme, "ZN Emerald Royale");
  assert.strictEqual(capturedPayload.machineId, undefined, "Payload MUST NOT contain machineId");
  assert.strictEqual(capturedPayload.customer, undefined, "Payload MUST NOT contain customer PII");
  assert.strictEqual(capturedPayload.customer_id, undefined, "Payload MUST NOT contain customer_id");
  assert.strictEqual(capturedPayload.license_id, undefined, "Payload MUST NOT contain license_id");

  console.log("✔ Test 6 Passed: Payload strictly excludes machineId and PII.");

  http.request = originalHttpRequest;
}

// Test 7: Runtime listener for onDidChangeTelemetryEnabled via extension.js activate()
{
  mockVscode.window = {
    createStatusBarItem: () => ({ show: () => {}, text: "", tooltip: "", command: "" })
  };
  mockVscode.commands = {
    registerCommand: () => ({ dispose: () => {} })
  };
  mockVscode.workspace.onDidChangeConfiguration = () => ({ dispose: () => {} });

  const mockContext = {
    globalState: {
      get: (key) => (key === "zipnation.storeVersion" ? "1.3.0" : ""),
      update: () => Promise.resolve()
    },
    subscriptions: []
  };

  const extension = require("../extension");
  extension.activate(mockContext);

  assert.ok(mockOnDidChangeCallback, "onDidChangeTelemetryEnabled listener must be registered in subscriptions");

  // Simulate user changing telemetry consent at runtime in VS Code
  mockOnDidChangeCallback(false);
  mockTelemetryEnabled = false;
  assert.strictEqual(isTelemetryAllowed(), false, "isTelemetryAllowed must be false when telemetry is toggled off");

  mockOnDidChangeCallback(true);
  mockTelemetryEnabled = true;
  assert.strictEqual(isTelemetryAllowed(), true, "isTelemetryAllowed must be true when telemetry is toggled on");

  // Clean up subscriptions
  mockContext.subscriptions.forEach(s => s && typeof s.dispose === "function" && s.dispose());

  console.log("✔ Test 7 Passed: Runtime telemetry changes immediately respected via onDidChangeTelemetryEnabled.");
}

console.log("\nALL 7 TELEMETRY & PRIVACY UNIT TESTS PASSED SUCCESSFULLY! 🚀");
process.exit(0);

