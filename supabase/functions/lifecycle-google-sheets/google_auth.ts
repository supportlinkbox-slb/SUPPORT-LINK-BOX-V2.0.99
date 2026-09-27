/**
 * PRODUCTION GOOGLE SERVICE ACCOUNT AUTHENTICATION (RS256 JWT)
 * Parses standard PEM PKCS#8 Private Key and generates valid OAuth2 Bearer Access Token for Google Sheets API
 */

function pemToBinary(pem: string): Uint8Array {
  const cleanPem = pem
    .replace(/-----BEGIN[ A-Z0-9_-]+-----/g, '')
    .replace(/-----END[ A-Z0-9_-]+-----/g, '')
    .replace(/\s+/g, '');
  
  const raw = atob(cleanPem);
  const binary = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    binary[i] = raw.charCodeAt(i);
  }
  return binary;
}

function base64UrlEncode(data: Uint8Array | string): string {
  let str = '';
  if (typeof data === 'string') {
    str = data;
  } else {
    for (let i = 0; i < data.length; i++) {
      str += String.fromCharCode(data[i]);
    }
  }
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function createGoogleAccessToken(): Promise<string> {
  const email = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  const rawKey = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY");

  if (!email || !rawKey) {
    throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY environment variables");
  }

  const formattedKey = rawKey.replace(/\\n/g, "\n");
  const keyDer = pemToBinary(formattedKey);

  // Import PKCS#8 RSA Private Key
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyDer.buffer,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: { name: "SHA-256" },
    },
    false,
    ["sign"]
  );

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const signatureInput = `${headerB64}.${payloadB64}`;

  const encoder = new TextEncoder();
  const signatureBytes = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    encoder.encode(signatureInput)
  );

  const signatureB64 = base64UrlEncode(new Uint8Array(signatureBytes));
  const assertionJwt = `${signatureInput}.${signatureB64}`;

  // Exchange JWT Assertion for Google Access Token
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: assertionJwt,
    }),
  });

  if (!tokenRes.ok) {
    const errBody = await tokenRes.text();
    throw new Error(`Google OAuth2 Token Exchange Failed: ${tokenRes.status} ${errBody}`);
  }

  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}
