const fs = require('fs');
(async () => {
  const out = [];
  try {
    const d = await fetch('http://localhost:5000/api/auth/anonymous-join', { method: 'POST' });
    const dt = await d.text();
    out.push(`DIRECT :5000 -> ${d.status} | ${dt.slice(0, 120)}`);
  } catch (e) { out.push(`DIRECT :5000 -> ERROR ${e.message}`); }
  try {
    const p = await fetch('http://localhost:3000/api/auth/anonymous-join', { method: 'POST' });
    const pt = await p.text();
    out.push(`PROXY :3000 -> ${p.status} | ${pt.slice(0, 120)}`);
  } catch (e) { out.push(`PROXY :3000 -> ERROR ${e.message}`); }
  try {
    const h = await fetch('http://localhost:3000/');
    const ht = await h.text();
    out.push(`PROXY :3000 root -> ${h.status} | hasRoot: ${ht.includes('id="root"')}`);
  } catch (e) { out.push(`PROXY :3000 root -> ERROR ${e.message}`); }
  fs.writeFileSync('diag.txt', out.join('\n'));
  process.exit(0);
})();