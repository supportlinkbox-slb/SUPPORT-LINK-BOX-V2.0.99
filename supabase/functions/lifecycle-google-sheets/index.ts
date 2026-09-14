import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createGoogleAccessToken } from "./google_auth.ts";
import { appendRowsToGoogleSheet } from "./google_sheets.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    // 1. Get auth/community context (simplified for cron/admin)
    const { batch_id } = await req.json();
    
    // 2. Fetch Pending Batch
    const { data: batch, error: batchErr } = await supabase
      .from("archive_batches")
      .select("*")
      .eq("id", batch_id)
      .single();
    
    if (batchErr || !batch) throw new Error("Batch not found");
    if (batch.status !== "PENDING") throw new Error("Batch already processed");

    // 3. Snapshot Data (Example for support_records)
    const { data: records, error: recErr } = await supabase
      .from(batch.source_table)
      .select("*")
      .gte("created_at", batch.period_start)
      .lt("created_at", batch.period_end)
      .eq("community_id", batch.community_id);
      
    if (recErr) throw recErr;

    // 4. Authenticate Google
    const token = await createGoogleAccessToken();

    // 5. Append to Sheet
    const rowCount = await appendRowsToGoogleSheet(
      token,
      Deno.env.get("GOOGLE_SHEETS_SPREADSHEET_ID")!,
      batch.source_table + " Archive",
      records
    );

    // 6. Verify and update status
    if (rowCount !== records.length) throw new Error("Row count mismatch");

    await supabase.from("archive_batches").update({ status: "VERIFIED", row_count: rowCount }).eq("id", batch_id);

    return new Response(JSON.stringify({ success: true, exported: rowCount }), { status: 200 });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
