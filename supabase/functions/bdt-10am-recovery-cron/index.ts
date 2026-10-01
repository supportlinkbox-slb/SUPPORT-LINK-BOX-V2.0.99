import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * 10:00 AM BDT RECOVERY CUTOFF CRON JOB (Blueprint Chapter 13 & Section 48)
 * Triggered daily at 04:00 UTC (10:00 AM BDT, Asia/Dhaka)
 * 
 * Rules:
 * 1. Checks yesterday's links and required support counts.
 * 2. Identifies all members with uncompleted support duties who failed to submit all-done or valid exemption before 10:00 AM BDT.
 * 3. Suspends unrecovered accounts automatically.
 * 4. Logs audit trail and dispatches warning notifications.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify BDT time window or authorization header (prevent premature cutoff pings)
    const bdtNow = new Date(Date.now() + 6 * 3600 * 1000);
    const bdtHour = bdtNow.getUTCHours();
    const authHeader = req.headers.get("Authorization");
    const isCronAuthorized = Boolean(authHeader && (authHeader.includes("Bearer") || authHeader.includes("cron")));

    if (bdtHour < 10 && !isCronAuthorized) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "CUTOFF_WINDOW_NOT_REACHED: 10:00 AM BDT cutoff window has not arrived yet.",
          current_bdt_hour: bdtHour,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // 1. Call authoritative database RPC
    const { data: rpcResult, error: rpcErr } = await supabase.rpc("cron_bdt_10am_recovery_cutoff");

    if (rpcErr) {
      // If RPC is not yet created in PostgreSQL instance, execute direct fallback query
      console.warn("RPC cron_bdt_10am_recovery_cutoff error, attempting fallback:", rpcErr.message);

      // Target yesterday in BDT (UTC+6)
      const bdtNow = new Date(Date.now() + 6 * 3600 * 1000);
      const yesterdayDate = new Date(bdtNow.getTime() - 24 * 3600 * 1000).toISOString().split("T")[0];

      // Fetch active links from yesterday
      const { data: yesterdayLinks } = await supabase
        .from("daily_links")
        .select("id, owner_id, serial_display")
        .eq("date", yesterdayDate)
        .eq("status", "active");

      const totalLinksYesterday = yesterdayLinks?.length || 0;

      if (totalLinksYesterday > 0) {
        // Fetch completed all-done records
        const { data: yesterdayAllDone } = await supabase
          .from("all_done")
          .select("member_id")
          .eq("date", yesterdayDate);

        const allDoneMemberIds = new Set((yesterdayAllDone || []).map((ad) => ad.member_id));

        // Check active members who missed support
        const { data: activeMembers } = await supabase
          .from("members")
          .select("id, name, member_number, status, role")
          .eq("status", "ACTIVE")
          .neq("role", "DEVELOPER");

        const suspendedMembers: string[] = [];

        for (const member of activeMembers || []) {
          // If member submitted link yesterday but didn't complete all-done
          const hasLinkYesterday = yesterdayLinks?.some((l) => l.owner_id === member.id);
          const hasAllDone = allDoneMemberIds.has(member.id);

          if (hasLinkYesterday && !hasAllDone) {
            // Check support records count
            const { count } = await supabase
              .from("support_records")
              .select("id", { count: "exact", head: true })
              .eq("date", yesterdayDate)
              .eq("supporter_id", member.id);

            const completedCount = count || 0;
            const requiredCount = totalLinksYesterday - 1; // excluding own link

            if (completedCount < requiredCount) {
              // Suspend member
              await supabase
                .from("members")
                .update({
                  status: "SUSPENDED",
                  days_inactive: (member as any).days_inactive ? (member as any).days_inactive + 1 : 1,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", member.id);

              // Record punishment
              await supabase.from("member_punishments").insert({
                member_id: member.id,
                penalty_type: "SUSPENSION",
                reason: "AUTOMATIC_SUSPENSION_MISSED_10AM_BDT_RECOVERY",
                issued_by: "SYSTEM_10AM_BDT_CRON",
                effective_date: yesterdayDate,
              });

              // Send notification
              await supabase.from("notifications").insert({
                member_id: member.id,
                title: "অ্যাকাউন্ট সাময়িক স্থগিত (Suspended)",
                message: `পূর্ববর্তী দিনের (${yesterdayDate}) বাকি সাপোর্ট সকাল ১০:০০ AM BDT কাট-অফ সময়ের মধ্যে সম্পন্ন না করায় আপনার অ্যাকাউন্ট সাসপেন্ড করা হয়েছে।`,
                type: "PENALTY_WARNING",
              });

              suspendedMembers.push(`${member.member_number} (${member.name})`);
            }
          }
        }

        // Log audit trail
        await supabase.from("audit_logs").insert({
          action: "10AM_BDT_RECOVERY_CUTOFF_EXECUTED",
          details: {
            target_date: yesterdayDate,
            total_suspended: suspendedMembers.length,
            members: suspendedMembers,
          },
          ip_address: "127.0.0.1",
        });

        return new Response(
          JSON.stringify({
            success: true,
            target_date: yesterdayDate,
            suspended_count: suspendedMembers.length,
            suspended_members: suspendedMembers,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: rpcResult || { message: "10:00 AM BDT cutoff executed successfully" },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message || "10 AM cutoff cron failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
