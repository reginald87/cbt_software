/*
 * Copies the offline-capable math libraries (MathJax, KaTeX) from
 * node_modules into the Next.js public/ folder so they are served from the
 * local LAN server instead of a CDN. The exam network has no internet access,
 * so every script/style/font the renderers need must live on the server.
 *
 * Runs automatically via postinstall/prebuild/predev. Uses only the Node
 * built-ins (fs.cpSync requires Node >= 16.7).
 */
'use strict'

const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const publicDir = path.join(root, 'public')

const targets = [
  {
    name: 'MathJax',
    from: path.join(root, 'node_modules', 'mathjax', 'es5'),
    to: path.join(publicDir, 'mathjax'),
  },
  {
    name: 'KaTeX',
    from: path.join(root, 'node_modules', 'katex', 'dist'),
    to: path.join(publicDir, 'katex'),
  },
]

function main() {
  for (const t of targets) {
    if (!fs.existsSync(t.from)) {
      console.error(`[copy-math-libs] SKIP ${t.name}: ${t.from} not found (run npm install)`)
      continue
    }
    fs.rmSync(t.to, { recursive: true, force: true })
    fs.cpSync(t.from, t.to, { recursive: true })
    console.log(`[copy-math-libs] ${t.name} copied -> ${path.relative(root, t.to)}`)
  }
}

main()
