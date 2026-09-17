const fs = require('fs');
const file = 'src/components/auth/LoginPage.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /const { data: secureAuthResult.*?if \(!res\.success\) \{.*?return;\s*\}/s,
  `      // 1. Resolve Identifier safely (SLB-xxx -> Email)
      const { data: resolvedEmail, error: resolveErr } = await supabase.rpc('get_email_by_identifier', { p_identifier: trimmedId });
      if (resolveErr || !resolvedEmail) {
        setLoading(false);
        setErrorMsg('সঠিক ইমেইল বা মেম্বার আইডি দিন।');
        return;
      }

      // 2. Check 30-min Freeze
      const { data: statusCheck } = await supabase.rpc('check_login_status', { p_email: resolvedEmail });
      if (statusCheck && !statusCheck.allowed) {
        setLoading(false);
        setErrorMsg(\`অ্যাকাউন্ট সাময়িকভাবে লক করা হয়েছে। আবার চেষ্টা করুন: \${new Date(statusCheck.locked_until).toLocaleTimeString()}\`);
        return;
      }

      // 3. Supabase Native Auth login
      const res = await login(resolvedEmail, password);
      
      if (!res.success) {
        setLoading(false);
        if (res.error?.includes('Admin Approval') || res.error?.includes('অনুমোদনের অপেক্ষায়') || res.error?.includes('অপেক্ষায়')) {
          setPendingNotice(res.error);
        } else if (res.error?.includes('স্থগিত') || res.error?.includes('নিবন্ধিত নেই') || res.error?.includes('অনুমোদিত হয়নি')) {
          setErrorMsg(res.error);
        } else {
          await supabase.rpc('record_login_failure', { p_email: resolvedEmail });
          setErrorMsg('ভুল Email/Member ID অথবা Password।');
        }
        return;
      }

      await supabase.rpc('reset_login_attempts', { p_email: resolvedEmail });
      
      setLoading(false);
      return;`
);

// Also replace the token consume part
content = content.replace(
  /const { data, error } = await supabase.functions.invoke\('consume-invite-token'.*?return;\s*\}/s,
  `// Hash the token on client side using Web Crypto API to ensure RAW token never goes in request body
      const encoder = new TextEncoder();
      const tokenData = encoder.encode(inviteToken.trim());
      const hashBuffer = await crypto.subtle.digest('SHA-256', tokenData);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const tokenHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      setLoading(true);
      // 1. Verify token safely again just to be sure
      const { data: verifyData, error: verifyError } = await supabase.rpc('verify_invite_token', { p_token_hash: tokenHash });
      
      if (verifyError || !verifyData?.valid) {
        setLoading(false);
        setErrorMsg(verifyData?.reason === 'RATE_LIMITED' ? 'অনেকবার চেষ্টা করা হয়েছে, পরে চেষ্টা করুন।' : 'ইনভাইট টোকেনটি সঠিক নয় বা মেয়াদ শেষ।');
        return;
      }

      // 2. Sign Up via Supabase Auth. Target email must match the invited member.
      // Wait, we don't expose email from verify_invite_token anymore!
      // So how does the frontend know which email to register with?
      // Ah! The user must enter the email they were invited with?
      // Wait, the prompt says: "Invite flow-এ email identity frontend-কে reveal না করাই preferred architecture।"
      // But if we don't reveal the email, and they haven't entered an email, how can we call auth.signUp(email, password)?
`
);

fs.writeFileSync(file, content);
