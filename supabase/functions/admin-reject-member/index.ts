import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Predefined rejection reasons (Bangla + English)
const REASONS: Record<string, { bn: string; en: string }> = {
  NAME_MISMATCH: {
    bn: 'আপনার ফেসবুক আইডির নাম এবং রেজিস্ট্রেশনের সময় দেওয়া নাম মিলছে না।',
    en: 'Your Facebook ID name does not match the name provided during registration.',
  },
  PHOTO_MISMATCH: {
    bn: 'আপনার ফেসবুক প্রোফাইলের ছবি এবং রেজিস্ট্রেশনের সময় দেওয়া ছবি মিলছে না।',
    en: 'Your Facebook profile photo does not match the photo provided during registration.',
  },
  INVALID_FB_LINK: {
    bn: 'আপনার দেওয়া ফেসবুক প্রোফাইল লিংকটি সঠিক নয়।',
    en: 'The Facebook profile link you provided is not valid.',
  },
};

function buildEmail(name: string, reasonBn: string, reasonEn: string, customBn: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0d0d17;font-family:'Segoe UI',Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;background:#16162a;border-radius:12px;overflow:hidden;">
<div style="background:linear-gradient(135deg,#1a237e,#3949ab);padding:32px 24px;text-align:center;">
<div style="color:#fff;font-size:26px;font-weight:800;letter-spacing:1px;">SUPPORT LINK BOX</div>
<div style="color:#c5cae9;font-size:13px;margin-top:6px;">Daily Link Support Community</div>
</div>
<div style="padding:32px 28px;color:#e8e8f0;">
<h2 style="margin:0 0 16px;font-size:20px;color:#ffffff;">রেজিস্ট্রেশন রিভিউ | Registration Review 📋</h2>
<p style="font-size:15px;line-height:1.8;margin:0 0 14px;color:#e8e8f0;">প্রিয় ${name},<br>আপনার রেজিস্ট্রেশন রিকোয়েস্টটি রিভিউ করা হয়েছে। দুঃখিত, নিম্নলিখিত কারণে এটি অনুমোদন করা যায়নি:</p>
<div style="background:#1e1e35;border-left:4px solid #f44336;border-radius:8px;padding:16px;margin:16px 0;">
<p style="font-size:14px;color:#e8e8f0;margin:0 0 8px;line-height:1.7;">${reasonBn}</p>
<p style="font-size:13px;color:#a9a9bd;margin:0;line-height:1.7;">${reasonEn}</p>
${customBn ? `<p style="font-size:14px;color:#e8e8f0;margin:12px 0 0;line-height:1.7;border-top:1px solid #2a2a45;padding-top:12px;">অতিরিক্ত নোট:<br>${customBn}</p>` : ''}
</div>
<p style="font-size:15px;line-height:1.8;margin:0 0 14px;color:#e8e8f0;">সঠিক তথ্য দিয়ে আবার রেজিস্ট্রেশন করতে পারেন।</p>
<p style="font-size:13px;line-height:1.8;margin:0;color:#a9a9bd;">You may register again with correct information.</p>
</div>
<div style="background:#101020;padding:18px;text-align:center;font-size:12px;color:#6a6a7e;">
Support Link Box — প্রতিদিন সাপোর্ট, প্রতিদিন গ্রোথ 🌱<br>
<a href="mailto:slb@supportlinkbox.com" style="color:#8fa2ff;">slb@supportlinkbox.com</a>
</div>
</div>
</body></html>`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const brevoApiKey = Deno.env.get('BREVO_API_KEY') ?? '';

    if (!supabaseUrl || !supabaseServiceKey || !brevoApiKey) {
      throw new Error('Server configuration error');
    }

    // Verify admin
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !userData?.user) throw new Error('UNAUTHORIZED');

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { data: caller } = await supabaseAdmin
      .from('members')
      .select('id, role, name')
      .eq('auth_user_id', userData.user.id)
      .single();

    if (!caller || (caller.role !== 'ADMIN' && caller.role !== 'DEVELOPER')) {
      throw new Error('FORBIDDEN: Admin only');
    }

    const { member_id, reason_code, custom_reason } = await req.json();
    if (!member_id) throw new Error('member_id required');

    const reason = REASONS[reason_code];
    if (!reason && !custom_reason) throw new Error('Reason required');

    // Get member
    const { data: member, error: memberError } = await supabaseAdmin
      .from('members')
      .select('id, email, name')
      .eq('id', member_id)
      .single();
    if (memberError || !member) throw new Error('MEMBER_NOT_FOUND');

    // Update status to REJECTED
    const { error: updateError } = await supabaseAdmin
      .from('members')
      .update({ status: 'REJECTED' })
      .eq('id', member_id);
    if (updateError) throw updateError;

    // Send email via Brevo
    const reasonBn = reason ? reason.bn : '';
    const reasonEn = reason ? reason.en : '';
    const emailHtml = buildEmail(member.name || 'সদস্য', reasonBn, reasonEn, custom_reason || '');

    const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': brevoApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: 'Support Link Box', email: 'slb@supportlinkbox.com' },
        to: [{ email: member.email, name: member.name }],
        subject: 'রেজিস্ট্রেশন রিভিউ | Registration Review — Support Link Box',
        htmlContent: emailHtml,
      }),
    });

    if (!brevoRes.ok) {
      const errText = await brevoRes.text();
      throw new Error('Email send failed: ' + errText.slice(0, 200));
    }

    // Audit log
    await supabaseAdmin.from('audit_logs').insert({
      actor_id: caller.id,
      actor_name: caller.name,
      actor_role: caller.role,
      action: 'MEMBER_REJECTED',
      target_type: 'member',
      target_member_id: member.id,
      details: `Rejected: ${reason_code || 'CUSTOM'}${custom_reason ? ' + custom note' : ''}`,
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
