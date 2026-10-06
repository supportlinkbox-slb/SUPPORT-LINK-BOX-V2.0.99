// ============================================================================
// lifecycle-google-sheets — weekly Google Sheets archive (v2, rebuilt + C8 fix)
// Policy (owner-approved):
//   BACKUP to Sheets, NEVER deleted : daily_links, all_done, point_transactions
//   BACKUP + DELETE after VERIFIED    : support_records only (heavy raw table)
// Safety: cleanup RPC deletes only when the batch status = 'VERIFIED'.
// Duplicate-safe: each run exports only rows newer than the last successful
//   batch's cutoff (backup-only tables are never deleted, so without this
//   they would be re-exported every week).
// Designed against the ACTUAL live schema (v18 + RECONCILE_SCHEMA_V18).
//
// C8 SECURITY FIXES (2026-10-06):
//   (a) ADMIN/DEVELOPER + ACTIVE gate: the caller's JWT is resolved via
//       auth.getUser and the members table (service_role) before ANY work.
//       Non-admin callers get {success:false, error:'Unauthorized'} (401)
//       with no data disclosure. The service_role key itself is also honored
//       so the scheduled pg_cron job (no user JWT) keeps working — anyone
//       holding that key already has full DB access, so no extra privilege.
//   (b) cutoff_date is clamped to <= now(); future dates are rejected (400).
//   (c) execute_cleanup additionally requires body.human_verified === true
//       AND the latest archive_batches row for the cutoff to be VERIFIED
//       (re-read from the table here — the request is never trusted).
// ============================================================================
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const GOOGLE_CLIENT_EMAIL = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_EMAIL")!;
const GOOGLE_PRIVATE_KEY = (Deno.env.get("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY") || "").replace(/\\n/g, "\n");
const SPREADSHEET_ID = Deno.env.get("GOOGLE_SHEETS_SPREADSHEET_ID")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

// --- Google service-account auth (JWT bearer flow) ---------------------------
function base64UrlEncode(input: Uint8Array | string): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const base64 = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function createGoogleAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64UrlEncode(
    JSON.stringify({
      iss: GOOGLE_CLIENT_EMAIL,
      scope: SHEETS_SCOPE,
      aud: GOOGLE_TOKEN_URL,
      iat: now,
      exp: now + 3600,
    })
  );
  const unsignedToken = `${header}.${payload}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(GOOGLE_PRIVATE_KEY),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsignedToken)
  );
  const jwt = `${unsignedToken}.${base64UrlEncode(new Uint8Array(signature))}`;

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=${encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer")}&assertion=${encodeURIComponent(jwt)}`,
  });
  if (!response.ok) throw new Error(`Google OAuth failed: ${await response.text()}`);
  const data = await response.json();
  return data.access_token;
}

// --- Sheets append ----------------------------------------------------------
async function appendToSheet(accessToken: string, sheetName: string, rows: unknown[][]): Promise<number> {
  if (!rows.length) return 0;
  const encodedRange = encodeURIComponent(`${sheetName}!A1`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodedRange}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ majorDimension: "ROWS", values: rows }),
  });
  if (!response.ok) throw new Error(`Google Sheets append failed on ${sheetName}: ${await response.text()}`);
  const res = await response.json();
  return res.updates?.updatedRows ?? rows.length;
}

// --- Row helpers ------------------------------------------------------------
function normalizeValue(value: unknown): string | number | boolean {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date) return value.toISOString();
  return JSON.stringify(value);
}

function mapRows(records: Record<string, unknown>[], columns: string[], batchId: string): unknown[][] {
  // NOTE: first sheet column must be the batch id (header: export_batch_id)
  return records.map((record) => [batchId, ...columns.map((col) => normalizeValue(record[col]))]);
}

// Columns verified against the live schema (v18 + RECONCILE_SCHEMA_V18).
const EXPORT_COLUMNS: Record<string, string[]> = {
  daily_links: [
    "id", "community_id", "owner_id", "member_id", "date",
    "serial_number", "link_number", "serial_display", "part_number",
    "post_type", "category", "caption", "instruction", "fb_link",
    "submitted_at", "is_approved", "total_supports_count", "status",
    "owner_name", "owner_member_number", "created_at", "updated_at",
  ],
  support_records: [
    "id", "community_id", "link_id", "supporter_id", "receiver_id",
    "date", "supported_at", "points_awarded", "created_at",
  ],
  all_done: [
    "id", "community_id", "member_id", "date", "completed_at",
    "total_supports_given", "required_supports_count", "points_awarded",
    "fastest_bonus_points", "total_points", "fastest_rank", "status",
    "member_name", "member_number", "created_at", "updated_at",
  ],
  point_transactions: [
    "id", "member_id", "activity_type", "points", "date",
    "reference_id", "description", "created_at",
  ],
};

const SHEET_TABS: Record<string, string> = {
  daily_links: "Daily Links Archive",
  support_records: "Support Records Archive",
  all_done: "All Done Archive",
  point_transactions: "Points Archive",
};

async function fetchEligible(
  table: string,
  cutoffIso: string,
  sinceIso: string | null
): Promise<Record<string, unknown>[]> {
  const columns = EXPORT_COLUMNS[table];
  const allRecords: Record<string, unknown>[] = [];
  let from = 0;
  const step = 1000;

  while (true) {
    let query = supabase
      .from(table)
      .select(columns.join(","))
      .lt("created_at", cutoffIso)
      .order("created_at", { ascending: true });
    if (sinceIso) query = query.gte("created_at", sinceIso);

    const { data, error } = await query.range(from, from + step - 1);
    if (error) throw new Error(`Failed reading ${table}: ${error.message}`);
    if (!data || data.length === 0) break;

    allRecords.push(...(data as Record<string, unknown>[]));
    if (data.length < step) break;
    from += step;
  }
  return allRecords;
}

// --- Main handler -----------------------------------------------------------
Deno.serve(async (req) => {
  let batchRecordId: string | null = null;
  const json = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });

  try {
    if (req.method !== "POST") {
      return json({ ok: false, error: "POST method required" }, 405);
    }

    // --- C8(a): ADMIN / DEVELOPER + ACTIVE gate ---------------------------
    // The service_role bearer itself is honored so the scheduled pg_cron job
    // (which calls with the service_role key, no user JWT) keeps working.
    // Holding that key already means full DB access, so this grants nothing
    // extra. Every other caller must present a user JWT belonging to an
    // ACTIVE ADMIN or DEVELOPER member — otherwise 401 with no disclosure.
    const authHeader = req.headers.get("Authorization") ?? "";
    const bearerToken = authHeader.replace(/^Bearer\s+/i, "");
    const isServiceRoleCall = !!bearerToken && bearerToken === SUPABASE_SERVICE_ROLE_KEY;

    if (!isServiceRoleCall) {
      const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData, error: userError } = await supabaseAnon.auth.getUser();
      if (userError || !userData?.user) {
        return json({ success: false, error: "Unauthorized" }, 401);
      }
      const { data: caller } = await supabase
        .from("members")
        .select("role, status")
        .eq("auth_user_id", userData.user.id)
        .maybeSingle();
      const roleOk = !!caller && (caller.role === "ADMIN" || caller.role === "DEVELOPER");
      if (!roleOk || caller!.status !== "ACTIVE") {
        return json({ success: false, error: "Unauthorized" }, 401);
      }
    }

    const body = await req.json().catch(() => ({}));
    const cutoffDate =
      body.cutoff_date || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // --- C8(b): clamp cutoff_date to <= now ---------------------------------
    const cutoffMs = Date.parse(cutoffDate);
    if (Number.isNaN(cutoffMs)) {
      return json({ ok: false, error: "cutoff_date সঠিক তারিখ নয়।" }, 400);
    }
    if (cutoffMs > Date.now()) {
      return json({ ok: false, error: "cutoff_date ভবিষ্যতের তারিখ হতে পারবে না।" }, 400);
    }

    const executeCleanup = body.execute_cleanup === true;
    const humanVerified = body.human_verified === true;

    // Duplicate-safe lower bound: continue where the last successful batch stopped.
    const { data: lastOk } = await supabase
      .from("archive_batches")
      .select("cutoff_date")
      .in("status", ["VERIFIED", "CLEANED"])
      .order("cutoff_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    const sinceIso: string | null = lastOk?.cutoff_date ?? null;

    const todayStr = new Date().toISOString().slice(0, 10);
    const { data: batch, error: batchErr } = await supabase
      .from("archive_batches")
      .insert({
        batch_date: todayStr,
        cutoff_date: cutoffDate,
        period_start: sinceIso,
        period_end: cutoffDate,
        community_id: "main",
        source_table: "multi",
        archive_type: "GOOGLE_SHEETS_WEEKLY",
        status: "RUNNING",
      })
      .select("id")
      .single();
    if (batchErr) throw new Error(`Could not initialize batch: ${batchErr.message}`);
    batchRecordId = batch.id;

    const accessToken = await createGoogleAccessToken();

    const exported: Record<string, number> = {};
    for (const table of Object.keys(EXPORT_COLUMNS)) {
      const records = await fetchEligible(table, cutoffDate, sinceIso);
      const appended = await appendToSheet(
        accessToken,
        SHEET_TABS[table],
        mapRows(records, EXPORT_COLUMNS[table], batchRecordId)
      );
      if (appended !== records.length) {
        throw new Error(
          `Row count mismatch on ${table}: fetched ${records.length}, appended ${appended}`
        );
      }
      exported[table] = records.length;
    }

    await supabase
      .from("archive_batches")
      .update({
        status: "VERIFIED",
        exported_counts: {
          ...exported,
          period_start: sinceIso,
          period_end: cutoffDate,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", batchRecordId);

    // --- C8(c): human-verification gate for cleanup -------------------------
    // Cleanup runs ONLY when: execute_cleanup === true AND the caller
    // explicitly confirmed human_verified === true AND the latest batch row
    // for this cutoff is VERIFIED in the table (re-read here — the request
    // body is never trusted for this). Otherwise nothing is deleted and the
    // response says so explicitly.
    let cleanupSummary: unknown = null;
    let cleanupDone = false;
    let cleanupBlocked: string | null = null;
    if (executeCleanup) {
      if (!humanVerified) {
        cleanupBlocked = "human_verified=true পাওয়া যায়নি — কিছু ডিলিট করা হয়নি।";
      } else {
        const { data: latestBatch } = await supabase
          .from("archive_batches")
          .select("id, status")
          .eq("cutoff_date", cutoffDate)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!latestBatch || latestBatch.status !== "VERIFIED") {
          cleanupBlocked = "এই cutoff-এর সর্বশেষ batch VERIFIED নয় — কিছু ডিলিট করা হয়নি।";
        } else {
          // Deletes ONLY support_records, and ONLY because the batch is VERIFIED
          // (enforced again inside the RPC).
          const { data: cleanRes, error: cleanErr } = await supabase.rpc(
            "cleanup_archived_lifecycle_data",
            { p_batch_id: batchRecordId, p_cutoff_date: cutoffDate }
          );
          if (cleanErr) throw new Error(`Cleanup RPC failed: ${cleanErr.message}`);
          cleanupSummary = cleanRes;
          cleanupDone = true;
        }
      }
    }

    return json({
      ok: true,
      batch_id: batchRecordId,
      status: executeCleanup
        ? cleanupDone
          ? "CLEANED"
          : "VERIFIED_CLEANUP_BLOCKED"
        : "VERIFIED_NOT_DELETED",
      cleanup_policy: "support_records only; daily_links/all_done/point_transactions are backup-only",
      exported,
      cleanup: cleanupSummary,
      ...(cleanupBlocked ? { cleanup_blocked_reason: cleanupBlocked } : {}),
    });
  } catch (err) {
    if (batchRecordId) {
      await supabase
        .from("archive_batches")
        .update({
          status: "FAILED",
          error_message: (err as Error).message,
          updated_at: new Date().toISOString(),
        })
        .eq("id", batchRecordId);
    }
    return json({ ok: false, error: (err as Error).message }, 500);
  }
});
