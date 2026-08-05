// Post-build: copy .next/static into standalone output.
// Avoids fs.cpSync (crashes on Windows with some Node versions) and xcopy quirks.
const fs = require('fs')
const path = require('path')

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name)
    const d = path.join(dest, entry.name)
    if (entry.isDirectory()) copyDir(s, d)
    else fs.copyFileSync(s, d)
  }
}

copyDir('.next/static', '.next/standalone/.next/static')
if (fs.existsSync('public')) copyDir('public', '.next/standalone/public')
console.log('[postbuild] standalone assets copied')
