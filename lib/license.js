const crypto = require("crypto");
const http = require("http");
const { PUBLIC_KEY } = require("./public-key");

const DEFAULT_SERVER = "http://144.91.84.9:8088";

function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  return Buffer.from(base64, "base64");
}

function parseToken(tokenStr) {
  if (typeof tokenStr !== "string") return null;
  const trimmed = tokenStr.trim();
  const parts = trimmed.split(".");
  if (parts.length !== 3 || parts[0] !== "ZNLIC") {
    return null;
  }

  try {
    const rawPayload = base64UrlDecode(parts[1]).toString("utf8");
    const payload = JSON.parse(rawPayload);
    const signature = base64UrlDecode(parts[2]);
    return { rawPayload, payload, signature };
  } catch (err) {
    return null;
  }
}

/**
 * Cryptographically verify a license token using the embedded public key.
 * @param {string} tokenStr The ZNLIC token string
 * @param {string} [publicKeyPem] Optional public key (defaults to production key)
 * @returns {{ valid: boolean, state: 'VALID' | 'EXPIRED' | 'REVOKED' | 'INVALID', payload: object | null, reason?: string }}
 */
function verifyLicenseToken(tokenStr, publicKeyPem = PUBLIC_KEY) {
  const parsed = parseToken(tokenStr);
  if (!parsed) {
    return { valid: false, state: "INVALID", payload: null, reason: "Malformed license token format." };
  }

  const { rawPayload, payload, signature } = parsed;

  // 1. Verify digital signature
  let isSignatureValid = false;
  try {
    isSignatureValid = crypto.verify(
      null,
      Buffer.from(rawPayload, "utf8"),
      publicKeyPem,
      signature
    );
  } catch (err) {
    return { valid: false, state: "INVALID", payload: null, reason: `Cryptographic check failed: ${err.message}` };
  }

  if (!isSignatureValid) {
    return { valid: false, state: "INVALID", payload: null, reason: "Digital signature is invalid or license has been altered." };
  }

  // 2. Validate product
  if (payload.product !== "zipnation-vip-themes") {
    return { valid: false, state: "INVALID", payload, reason: "License is not valid for ZIPNATION VIP Themes." };
  }

  // 3. Check status flag
  if (payload.status === "REVOKED") {
    return { valid: false, state: "REVOKED", payload, reason: "This license has been revoked by ZIPNATION administrator." };
  }

  if (payload.status !== "ACTIVE") {
    return { valid: false, state: "INVALID", payload, reason: `License status is ${payload.status}.` };
  }

  // 4. Validate expiration timestamp
  const now = Date.now();
  const expiresAtMs = new Date(payload.expires_at).getTime();

  if (isNaN(expiresAtMs)) {
    return { valid: false, state: "INVALID", payload, reason: "Invalid expiration date." };
  }

  if (now > expiresAtMs) {
    return { valid: false, state: "EXPIRED", payload, reason: `License expired on ${new Date(expiresAtMs).toLocaleDateString()}.` };
  }

  return { valid: true, state: "VALID", payload };
}

/**
 * Calculate remaining days for an active license
 */
function getDaysRemaining(expiresAt) {
  const diffMs = new Date(expiresAt).getTime() - Date.now();
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Format expiration date nicely
 */
function formatExpiration(expiresAt) {
  try {
    const d = new Date(expiresAt);
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch (e) {
    return String(expiresAt);
  }
}

/**
 * Fetch signed license token from server using a license ID like ZN-XXXX-XXXX-XXXX
 */
function fetchLicenseByCode(licenseCode, serverUrl = DEFAULT_SERVER) {
  return new Promise((resolve, reject) => {
    const cleanCode = (licenseCode || "").trim().toUpperCase();
    const endpoint = `${serverUrl}/api/license/lookup?id=${encodeURIComponent(cleanCode)}`;
    const url = new URL(endpoint);

    const req = http.get(url, { timeout: 7000 }, res => {
      let body = "";
      res.on("data", chunk => body += chunk);
      res.on("end", () => {
        try {
          const json = JSON.parse(body);
          if (res.statusCode === 200 && json.token) {
            resolve({ success: true, token: json.token, data: json });
          } else {
            resolve({ success: false, error: json.error || `Server returned ${res.statusCode}` });
          }
        } catch (err) {
          resolve({ success: false, error: "Invalid server response" });
        }
      });
    });

    req.on("error", err => {
      resolve({ success: false, error: `Connection failed: ${err.message}` });
    });

    req.on("timeout", () => {
      req.destroy();
      resolve({ success: false, error: "Connection timed out" });
    });
  });
}

module.exports = {
  verifyLicenseToken,
  getDaysRemaining,
  formatExpiration,
  fetchLicenseByCode,
  parseToken,
  DEFAULT_SERVER
};
