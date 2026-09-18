import re

# 1. Revert src/lib/supabase.ts to just use 'name'
with open('src/lib/supabase.ts', 'r') as f:
    content = f.read()

content = content.replace(
    "facebook_name: string;",
    "name: string;"
)
content = content.replace(
    "facebook_name: params.facebook_name.trim(),\n            facebook_name_original: params.facebook_name.trim(),",
    "name: params.name.trim(),\n            facebook_name: params.name.trim(),"
)

with open('src/lib/supabase.ts', 'w') as f:
    f.write(content)

# 2. Update src/context/AppContext.tsx to pass 'name'
with open('src/context/AppContext.tsx', 'r') as f:
    content2 = f.read()

content2 = content2.replace(
    "facebook_name: data.name,",
    "name: data.name,"
)

with open('src/context/AppContext.tsx', 'w') as f:
    f.write(content2)

