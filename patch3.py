import re

with open('src/components/auth/LoginPage.tsx', 'r') as f:
    content = f.read()

handleVerify = """  const handleVerifyInvite = async () => {
    const trimmedToken = inviteToken.trim();
    if (!trimmedToken) {
      setErrorMsg('ইনভাইট টোকেন প্রদান করুন।');
      return;
    }
    setLoading(true);
    try {
      // Hash the token on client side using Web Crypto API to ensure RAW token never goes in request body
      const encoder = new TextEncoder();
      const tokenData = encoder.encode(trimmedToken);
      const hashBuffer = await crypto.subtle.digest('SHA-256', tokenData);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const tokenHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      const { data: verifyData, error: verifyError } = await supabase.rpc('verify_invite_token', { p_token_hash: tokenHash });
      
      if (verifyError || !verifyData?.valid) {
        setErrorMsg(verifyData?.reason === 'RATE_LIMITED' ? 'অনেকবার চেষ্টা করা হয়েছে, পরে চেষ্টা করুন।' : 'ইনভাইট টোকেনটি সঠিক নয় বা মেয়াদ শেষ।');
        setLoading(false);
        return;
      }
      
      setInviteTokenHash(tokenHash);
      setSuccessNotice({
        type: 'REGISTER_SUCCESS',
        message: 'টোকেন সঠিক। দয়া করে যে ইমেইল দিয়ে ইনভাইট করা হয়েছে সেটি ব্যবহার করে রেজিস্ট্রেশন বা লগইন করুন।'
      });
      setMode('REGISTER');
    } catch (err: any) {
      setErrorMsg('ভেরিফিকেশন ব্যর্থ হয়েছে।');
    }
    setLoading(false);
  };"""

content = re.sub(
    r"const handleVerifyInvite = async \(\) => \{.*?(?=const handleSubmit = async)",
    handleVerify + "\n\n  ",
    content,
    flags=re.DOTALL
)

with open('src/components/auth/LoginPage.tsx', 'w') as f:
    f.write(content)
