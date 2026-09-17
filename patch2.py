import re

with open('src/components/auth/LoginPage.tsx', 'r') as f:
    content = f.read()

# Replace the login logic
new_login_logic = """      // 1. Resolve Identifier safely (SLB-xxx -> Email)
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
        setErrorMsg(`অ্যাকাউন্ট সাময়িকভাবে লক করা হয়েছে। আবার চেষ্টা করুন: ${new Date(statusCheck.locked_until).toLocaleTimeString()}`);
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
      return;"""

content = re.sub(
    r"const \{ data: secureAuthResult.*?return;\n    \}",
    new_login_logic + "\n    }",
    content,
    flags=re.DOTALL
)

with open('src/components/auth/LoginPage.tsx', 'w') as f:
    f.write(content)
