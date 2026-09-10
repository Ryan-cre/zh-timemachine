import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'

const require = createRequire(import.meta.url)
let failed = false
function check(name, action) {
  try {
    console.log(`[OK] ${name}: ${action()}`)
  } catch (error) {
    failed = true
    console.error(`[FAIL] ${name}: ${error.message}`)
  }
}

check('Node.js', () => {
  if (Number(process.versions.node.split('.')[0]) !== 24) {
    throw new Error(`Expected Node.js 24 LTS, found ${process.version}`)
  }
  return `${process.version} (${process.platform}/${process.arch})`
})

for (const name of [
  'react',
  'react-dom',
  'typescript',
  'vite',
  'electron-vite',
  'electron-builder',
  'electron',
]) {
  check(name, () => require(`${name}/package.json`).version)
}

check('Electron runtime', () => {
  const result = spawnSync(
    require('electron'),
    ['-e', 'console.log(JSON.stringify(process.versions))'],
    {
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      encoding: 'utf8',
      timeout: 30000,
      windowsHide: true,
    },
  )
  if (result.error) throw result.error
  if (result.status !== 0)
    throw new Error(result.stderr || `Exit code ${result.status}`)
  const versions = JSON.parse(result.stdout.trim())
  if (!versions.electron) throw new Error('Electron version missing')
  return `Electron ${versions.electron}, Chromium ${versions.chrome}, Node.js ${versions.node}`
})

process.exitCode = failed ? 1 : 0
