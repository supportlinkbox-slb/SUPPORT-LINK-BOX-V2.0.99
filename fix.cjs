const fs = require('fs');
let code = fs.readFileSync('src/components/auth/LoginPage.tsx', 'utf8');

// Fix the Confirm Password block
code = code.replace(/\{\/\* Confirm Password \*\/\}\s*<\/div>\s*<div>/s, `{/* Confirm Password */}
              {mode === 'REGISTER' && (
                <div>`);

fs.writeFileSync('src/components/auth/LoginPage.tsx', code);
