const assert = require("assert");
const crypto = require("crypto");
const { verifyLicenseToken, getDaysRemaining, parseToken } = require("../lib/license");
const { PUBLIC_KEY } = require("../lib/public-key");

function base64UrlEncode(buf) {
  return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function createSignedTestToken(payload, privateKey) {
  const payloadStr = JSON.stringify(payload);
  const sig = crypto.sign(null, Buffer.from(payloadStr, "utf8"), privateKey);
  return `ZNLIC.${base64UrlEncode(payloadStr)}.${base64UrlEncode(sig)}`;
}

console.log("=== RUNNING ZIPNATION LICENSE UNIT TESTS ===");

// Generate a test Ed25519 keypair
const testKeyPair = crypto.generateKeyPairSync("ed25519", {
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" }
});

const now = new Date();

// Test 1: Valid 30-day license
{
  const payload = {
    license_id: "ZN-7K4P-X9QM-2L8A",
    customer_id: "Ali",
    product: "zipnation-vip-themes",
    issued_at: now.toISOString(),
    expires_at: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    duration_days: 30,
    status: "ACTIVE",
    allowed_themes: ["*"],
    version: "1.1.0"
  };
  const token = createSignedTestToken(payload, testKeyPair.privateKey);
  const result = verifyLicenseToken(token, testKeyPair.publicKey);

  assert.strictEqual(result.valid, true, "Valid license should return valid=true");
  assert.strictEqual(result.state, "VALID", "Valid license should return state=VALID");
  assert.strictEqual(result.payload.customer_id, "Ali");
  assert.strictEqual(result.payload.license_id, "ZN-7K4P-X9QM-2L8A");
  console.log("✔ Test 1 Passed: Valid 30-day license accepted.");
}

// Test 2: Expired license
{
  const payload = {
    license_id: "ZN-EXPD-0000-0000",
    customer_id: "Vali",
    product: "zipnation-vip-themes",
    issued_at: new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000).toISOString(),
    expires_at: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    duration_days: 30,
    status: "ACTIVE",
    allowed_themes: ["*"],
    version: "1.1.0"
  };
  const token = createSignedTestToken(payload, testKeyPair.privateKey);
  const result = verifyLicenseToken(token, testKeyPair.publicKey);

  assert.strictEqual(result.valid, false, "Expired license must not be valid");
  assert.strictEqual(result.state, "EXPIRED", "Expired license should return state=EXPIRED");
  console.log("✔ Test 2 Passed: Expired license properly rejected with state=EXPIRED.");
}

// Test 3: Revoked license
{
  const payload = {
    license_id: "ZN-REVK-0000-0000",
    customer_id: "BadActor",
    product: "zipnation-vip-themes",
    issued_at: now.toISOString(),
    expires_at: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    duration_days: 30,
    status: "REVOKED",
    allowed_themes: ["*"],
    version: "1.1.0"
  };
  const token = createSignedTestToken(payload, testKeyPair.privateKey);
  const result = verifyLicenseToken(token, testKeyPair.publicKey);

  assert.strictEqual(result.valid, false, "Revoked license must not be valid");
  assert.strictEqual(result.state, "REVOKED", "Revoked license should return state=REVOKED");
  console.log("✔ Test 3 Passed: Revoked license properly rejected with state=REVOKED.");
}

// Test 4: Tampered payload (Signature mismatch)
{
  const payload = {
    license_id: "ZN-HACK-0000-0000",
    customer_id: "Hacker",
    product: "zipnation-vip-themes",
    issued_at: now.toISOString(),
    expires_at: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    duration_days: 30,
    status: "ACTIVE",
    allowed_themes: ["*"],
    version: "1.1.0"
  };
  const token = createSignedTestToken(payload, testKeyPair.privateKey);

  // Alter payload without re-signing
  const parts = token.split(".");
  const alteredPayload = { ...payload, customer_id: "AlteredName" };
  const alteredToken = `${parts[0]}.${base64UrlEncode(JSON.stringify(alteredPayload))}.${parts[2]}`;

  const result = verifyLicenseToken(alteredToken, testKeyPair.publicKey);
  assert.strictEqual(result.valid, false, "Tampered token must fail signature check");
  assert.strictEqual(result.state, "INVALID", "Tampered token should return state=INVALID");
  console.log("✔ Test 4 Passed: Tampered payload caught by signature verification.");
}

// Test 5: Wrong product
{
  const payload = {
    license_id: "ZN-7K4P-X9QM-2L8A",
    customer_id: "Sardor",
    product: "some-other-extension",
    issued_at: now.toISOString(),
    expires_at: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    duration_days: 30,
    status: "ACTIVE",
    allowed_themes: ["*"],
    version: "1.1.0"
  };
  const token = createSignedTestToken(payload, testKeyPair.privateKey);
  const result = verifyLicenseToken(token, testKeyPair.publicKey);

  assert.strictEqual(result.valid, false, "Wrong product must not be valid");
  assert.strictEqual(result.state, "INVALID");
  console.log("✔ Test 5 Passed: Wrong product license rejected.");
}

// Test 6: Durations (7, 30, 90, 365 days)
{
  const durations = [7, 30, 90, 365];
  for (const d of durations) {
    const payload = {
      license_id: `ZN-${d}D-0000-0000`,
      customer_id: `User_${d}`,
      product: "zipnation-vip-themes",
      issued_at: now.toISOString(),
      expires_at: new Date(now.getTime() + d * 24 * 60 * 60 * 1000).toISOString(),
      duration_days: d,
      status: "ACTIVE",
      allowed_themes: ["*"],
      version: "1.1.0"
    };
    const token = createSignedTestToken(payload, testKeyPair.privateKey);
    const result = verifyLicenseToken(token, testKeyPair.publicKey);
    assert.strictEqual(result.valid, true);
    const daysLeft = getDaysRemaining(payload.expires_at);
    assert(daysLeft >= d - 1 && daysLeft <= d, `Remaining days for ${d}d must match`);
  }
  console.log("✔ Test 6 Passed: 7, 30, 90, 365 day durations verified.");
}

// Test 7: Malformed token
{
  assert.strictEqual(verifyLicenseToken("not.a.valid.token").valid, false);
  assert.strictEqual(verifyLicenseToken("").valid, false);
  assert.strictEqual(verifyLicenseToken(null).valid, false);
  console.log("✔ Test 7 Passed: Malformed tokens gracefully handled.");
}

console.log("\nALL 7 UNIT TESTS PASSED SUCCESSFULLY! 🚀");
