import { create } from "https://deno.land/x/djwt@v2.7/mod.ts";

export async function createGoogleAccessToken() {
  const email = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_EMAIL")!;
  const privateKey = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY")!.replace(/\\n/g, "\n");

  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const key = await crypto.subtle.importKey(
    "jwk",
    {
      kty: "RSA",
      alg: "RS256",
      ext: true,
      // NOTE: Real implementation needs JWK conversion from PEM
      // This is conceptual for Edge Function logic
      ... /* PEM to JWK converter needed */
    },
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const jwt = await create(header, payload, key);
  
  // Exchange JWT for Access Token
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  
  const { access_token } = await res.json();
  return access_token;
}
