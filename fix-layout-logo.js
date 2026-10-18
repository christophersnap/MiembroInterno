import fs from 'fs';
let content = fs.readFileSync('src/components/Layout.tsx', 'utf8');
content = content.replace(/src="\/logo\.png"/g, 'src={logos?.dashboard || "/logo.png"}');
fs.writeFileSync('src/components/Layout.tsx', content, 'utf8');
