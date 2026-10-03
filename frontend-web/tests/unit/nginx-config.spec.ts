import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('frontend container nginx contract', () => {
  const nginx = readFileSync(resolve(process.cwd(), 'nginx.conf'), 'utf8')

  it('only serves the SPA and does not duplicate gateway API routing', () => {
    expect(nginx).toContain('try_files $uri $uri/ /index.html;')
    expect(nginx).not.toContain('proxy_pass')
    expect(nginx).not.toContain('location /api')
  })

  it('does not cache the HTML shell but caches hashed assets', () => {
    expect(nginx).toContain('location = /index.html')
    expect(nginx).toContain('no-cache, no-store, must-revalidate')
    expect(nginx).toContain('location /assets/')
    expect(nginx).toContain('immutable')
  })
})
