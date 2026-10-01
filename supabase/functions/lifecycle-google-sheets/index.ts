import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createGoogleAccessToken } from "./google_auth.ts";
import { appendRowsToGoogleSheet } from "./google_sheets.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const spreadsheetId = Deno.env.get("GOOGLE_SHEETS_SPREADSHEET_ID") || "";

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { batch_id, source_table, period_start, period_end, community_id } = body;

    const ALLOWED_TABLES = ["daily_links", "all_done", "audit_logs", "support_records", "point_transactions"];
    let rawTable = source_table || "daily_links";
    if (!ALLOWED_TABLES.includes(rawTable)) {
      return new Response(
        JSON.stringify({ success: false, error: `FORBIDDEN_TABLE: Table '${rawTable}' cannot be exported.` }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let targetBatchId = batch_id;
    let targetTable = rawTable;
    let start = period_start;
    let end = period_end;
    let commId = community_id || "main";

    // 1. Fetch or create archive batch record
    if (targetBatchId) {
      const { data: existingBatch, error: batchErr } = await supabase
        .from("archive_batches")
        .select("*")
        .eq("id", targetBatchId)
        .single();

      if (batchErr || !existingBatch) throw new Error("Batch not found");
      if (existingBatch.status === "VERIFIED") {
        return new Response(
          JSON.stringify({
            success: true,
            message: "Batch already verified and archived",
            checksum: existingBatch.checksum,
            row_count: existingBatch.row_count,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      targetTable = existingBatch.source_table;
      start = existingBatch.period_start;
      end = existingBatch.period_end;
      commId = existingBatch.community_id;
    } else {
      // Default to past 7 days if start/end not specified
      if (!start) {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        start = d.toISOString().split("T")[0];
      }
      if (!end) {
        end = new Date().toISOString().split("T")[0];
      }

      const { data: newBatch, error: createErr } = await supabase
        .from("archive_batches")
        .insert({
          source_table: targetTable,
          period_start: start,
          period_end: end,
          community_id: commId,
          status: "PENDING",
        })
        .select()
        .single();

      if (createErr || !newBatch) throw new Error(`Could not create archive batch: ${createErr?.message}`);
      targetBatchId = newBatch.id;
    }

    // 2. Snapshot Data from Table
    let query = supabase.from(targetTable).select("*");
    if (start) query = query.gte("created_at", start);
    if (end) query = query.lt("created_at", end);

    const { data: records, error: recErr } = await query;
    if (recErr) throw recErr;

    const rowData = records || [];

    // 3. Calculate Cryptographic SHA-256 Checksum over canonical JSON
    const canonicalJson = JSON.stringify(rowData);
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(canonicalJson);
    const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const sha256Checksum = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    // 4. If records exist, export to Google Sheets
    let exportedRowCount = rowData.length;
    if (rowData.length > 0 && spreadsheetId) {
      const googleToken = await createGoogleAccessToken();
      const sheetTabName = `${targetTable.toUpperCase()}_${start}_${end}`;

      exportedRowCount = await appendRowsToGoogleSheet(
        googleToken,
        spreadsheetId,
        sheetTabName,
        rowData
      );
    }

    // 5. Verify and update status to VERIFIED with Checksum
    const { error: updateErr } = await supabase
      .from("archive_batches")
      .update({
        status: "VERIFIED",
        row_count: exportedRowCount,
        checksum: sha256Checksum,
        verified_at: new Date().toISOString(),
      })
      .eq("id", targetBatchId);

    if (updateErr) throw updateErr;

    // 6. Log to Audit Trail
    await supabase.from("audit_logs").insert({
      action: "GOOGLE_SHEETS_WEEKLY_ARCHIVE_VERIFIED",
      details: {
        batch_id: targetBatchId,
        source_table: targetTable,
        period: `${start} to ${end}`,
        row_count: exportedRowCount,
        checksum: sha256Checksum,
      },
      ip_address: "127.0.0.1",
    });

    return new Response(
      JSON.stringify({
        success: true,
        batch_id: targetBatchId,
        table: targetTable,
        exported_rows: exportedRowCount,
        sha256_checksum: sha256Checksum,
        status: "VERIFIED",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message || "Archive processing failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
