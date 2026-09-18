import re

with open('src/components/auth/LoginPage.tsx', 'r') as f:
    content = f.read()

# Replace profilePhotoUrl.trim() with safe fallback
content = content.replace(
    "let finalPhotoUrl = profilePhotoUrl.trim();",
    "let finalPhotoUrl = (profilePhotoUrl || '').trim();"
)

# And in the UI where it renders
content = content.replace(
    "(profilePhotoUrl.trim() ||",
    "((profilePhotoUrl || '').trim() ||"
)

with open('src/components/auth/LoginPage.tsx', 'w') as f:
    f.write(content)
