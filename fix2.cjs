const fs = require('fs');
let code = fs.readFileSync('src/components/auth/LoginPage.tsx', 'utf8');

code = code.replace(/\{mode === 'REGISTER' && \(\s*<div className="bg-slate-900 border border-slate-700/s, 
`{mode === 'REGISTER' && (
                <>
  <div className="bg-slate-900 border border-slate-700`);

code = code.replace(/\{mode === 'REGISTER' && \(\s*<div className="bg-slate-900 border border-slate-700/s, 
`{mode === 'REGISTER' && (
                <>
  <div className="bg-slate-900 border border-slate-700`); // Actually there's only one.

fs.writeFileSync('src/components/auth/LoginPage.tsx', code);
