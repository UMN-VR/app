import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'
import { cpSync, existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import type { Connect, Plugin } from 'vite'

/** The tour pages this site builds; each is a FOSS Earth app with its own scene. */
const TOUR_PAGES = { twinCities: 'tour/twin-cities/index.html' }
/** Where `/` leads while developing: the landing page is Jekyll's, not this app's. */
const DEV_HOME = '/tour/twin-cities/'
/** The Jekyll landing page, deployed beside the tour for GitHub Pages to render. */
const LANDING_PAGE = ['index.md', '_config.yml', 'Media ']

function getGitOutput(command: string): string | null {
  try {
    return execSync(command, { encoding: 'utf8' }).trim()
  } catch {
    return null
  }
}

const sourceCommit = getGitOutput('git rev-parse --short=12 HEAD') ?? 'unknown'
const sourceDirty = Boolean(getGitOutput('git status --short'))

/** Sends `/` to the tour, in `npm run dev` and `npm run preview` alike. */
function tourHome(): Plugin {
  const redirect: Connect.NextHandleFunction = (request, response, next) => {
    if (request.url !== '/') return next()
    response.statusCode = 302
    response.setHeader('Location', DEV_HOME)
    response.end()
  }
  return {
    name: 'umn-vr-tour-home',
    configureServer: server => { server.middlewares.use(redirect) },
    configurePreviewServer: server => { server.middlewares.use(redirect) },
  }
}

/**
 * Makes `dist/` the whole site: the tour this build produced, and the Jekyll landing page
 * copied as it is. GitHub Pages runs Jekyll over the deployed branch, and Jekyll leaves out
 * any file whose name starts with `_` or `.`, so the build refuses to produce one.
 */
function wholeSite(): Plugin {
  let outDir = 'dist'
  let root = '.'
  return {
    name: 'umn-vr-whole-site',
    apply: 'build',
    configResolved(config) {
      root = config.root
      outDir = path.resolve(config.root, config.build.outDir)
    },
    closeBundle() {
      const hidden = (readdirSync(outDir, { recursive: true }) as string[])
        .filter(file => file.split(path.sep).some(part => part.startsWith('_') || part.startsWith('.')))
      if (hidden.length) throw new Error(`Jekyll would drop these built files: ${hidden.join(', ')}`)
      for (const entry of LANDING_PAGE) {
        if (existsSync(path.join(root, entry))) cpSync(path.join(root, entry), path.join(outDir, entry), { recursive: true })
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  // The organization site is served from the domain root.
  base: '/',
  server: {
    // FOSS Earth and gamepad-tools are linked from their checkouts beside this one.
    fs: { allow: ['.', '../../foss-earth', '../../Felipegalind0/gamepad-tools'] },
  },
  resolve: {
    // One copy of each, shared with FOSS Earth's source.
    dedupe: ['@babylonjs/core', '@babylonjs/loaders', '3d-tiles-renderer', 'react', 'react-dom'],
  },
  // FOSS Earth's Settings → About shows these.
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __SOURCE_VERSION__: JSON.stringify(`${sourceCommit}${sourceDirty ? '-dirty' : ''}`),
    __REPOSITORY_SLUG__: JSON.stringify('UMN-VR/UMN-VR.github.io'),
  },
  build: {
    rolldownOptions: { input: TOUR_PAGES },
  },
  plugins: [react(), tourHome(), wholeSite()],
  test: {
    // .local/ holds the YouVisit backup and scratch; public/ the generated scene.
    exclude: [...configDefaults.exclude, '.local/**', 'public/**'],
  },
})
