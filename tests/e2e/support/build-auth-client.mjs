import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import webpackPackage from '../../../frontend/portfolio/node_modules/next/dist/compiled/webpack/webpack.js'

export async function buildAuthClient(outputPath) {
  const compiler = webpackPackage.webpack({
    mode: 'development', devtool: false,
    entry: fileURLToPath(new URL('./auth-client-probe.mjs', import.meta.url)),
    output: { path: outputPath, filename: 'auth-client.js' },
  })
  try {
    await new Promise((resolve, reject) => compiler.run((error, stats) => {
      if (error || stats.hasErrors()) reject(error ?? new Error(stats.toString({ all: false, errors: true })))
      else resolve()
    }))
  } finally {
    await new Promise((resolve, reject) => compiler.close((error) => error ? reject(error) : resolve()))
  }
  return readFile(`${outputPath}/auth-client.js`, 'utf8')
}
