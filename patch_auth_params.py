import re

# 1. Update src/lib/supabase.ts
with open('src/lib/supabase.ts', 'r') as f:
    content = f.read()

# Fix the interface mismatch in signUp
content = content.replace(
    "name: string;",
    "facebook_name: string;"
)
content = content.replace(
    "name: params.name.trim(),",
    "facebook_name: params.facebook_name.trim(),\n            facebook_name_original: params.facebook_name.trim(),"
)

with open('src/lib/supabase.ts', 'w') as f:
    f.write(content)


# 2. Update src/components/auth/LoginPage.tsx (Error reporting inside catch block)
with open('src/components/auth/LoginPage.tsx', 'r') as f:
    content2 = f.read()

# Make the catch block log the actual error for debugging if it still fails
content2 = content2.replace(
    "setErrorMsg('ছবি আপলোড করতে সমস্যা হয়েছে। Storage তৈরি আছে কিনা নিশ্চিত করুন অথবা ছবির লিংক ব্যবহার করুন।');",
    "setErrorMsg('ছবি আপলোড করতে সমস্যা হয়েছে: ' + (error.message || error) + '. Storage তৈরি আছে কিনা নিশ্চিত করুন অথবা ছবির লিংক ব্যবহার করুন।');"
)

with open('src/components/auth/LoginPage.tsx', 'w') as f:
    f.write(content2)

