#!/usr/bin/env python3
# Fix: move misplaced blacklistMember function outside provider object
# Run from repo root: python3 fix-blacklist-placement.py
import re

path = 'src/context/AppContext.tsx'
with open(path) as f:
    c = f.read()

bad_fn = """
  const blacklistMember = async (targetId: string, email: string, fbLink: string, reason: string) => {
    if (!currentUser || (currentUser.role !== 'ADMIN' && currentUser.role !== 'DEVELOPER')) {
      return { success: false, error: 'Admin permission required' };
    }
    if (isSupabaseConfigured) {
      const res = await membersApi.blacklistMember(targetId, email, fbLink, reason);
      if (!res.success) return { success: false, error: res.error };
      await refreshData();
      return { success: true };
    }
    return { success: false, error: 'Supabase not configured' };
  };
"""

if bad_fn in c:
    c = c.replace(bad_fn, "\n", 1)
    print("Removed misplaced function")
else:
    print("Already fixed or pattern not found — exiting")
    exit(0)

m = re.search(
    r'(const rejectMember = async \(targetId: string, reasonCode\?: string \| null, customReason\?: string\) => \{.*?^  \};)',
    c, re.DOTALL | re.MULTILINE
)
if not m:
    print("ERROR: rejectMember not found")
    exit(1)

good_fn = """
  const blacklistMember = async (targetId: string, email: string, fbLink: string, reason: string) => {
    if (!currentUser || (currentUser.role !== 'ADMIN' && currentUser.role !== 'DEVELOPER')) {
      return { success: false, error: 'Admin permission required' };
    }
    if (isSupabaseConfigured) {
      const res = await membersApi.blacklistMember(targetId, email, fbLink, reason);
      if (!res.success) return { success: false, error: res.error };
      await refreshData();
      return { success: true };
    }
    return { success: false, error: 'Supabase not configured' };
  };"""
c = c[:m.end()] + good_fn + c[m.end():]

with open(path, 'w') as f:
    f.write(c)
print("Fixed! blacklistMember moved to correct location.")
