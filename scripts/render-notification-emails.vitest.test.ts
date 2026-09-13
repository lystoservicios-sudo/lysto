import { mkdir, writeFile } from 'node:fs/promises'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import { chromium } from '@playwright/test'
import { expect, test } from 'vitest'

import { renderOutboxNotification } from '../lib/notifications/delivery-template'
import { notificationEmailFixtures } from '../tests/visual/notification-email-fixtures'

function assertSynthetic(content: string) {
  for (const match of content.matchAll(/[A-Z0-9._%+-]+@([A-Z0-9.-]+\.[A-Z]{2,})/gi))
    if (!match[1].endsWith('.test')) throw new Error('Email previews refuse real addresses')
}

test('renders sanitized responsive email evidence', async () => {
  const configuredOutput = process.env.EMAIL_PREVIEW_OUTPUT
  if (!configuredOutput) throw new Error('EMAIL_PREVIEW_OUTPUT is required')
  const output = resolve(configuredOutput)
  const outputRoot = resolve('output', 'email-preview')
  const outputRelative = relative(outputRoot, output)
  if (
    isAbsolute(outputRelative) ||
    outputRelative === '..' ||
    outputRelative.startsWith(`..${sep}`)
  )
    throw new Error('EMAIL_PREVIEW_OUTPUT must stay under output/email-preview')
  await mkdir(output, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  try {
    const evidence: Array<Record<string, unknown>> = []
    for (const fixture of notificationEmailFixtures) {
      const rendered = renderOutboxNotification(fixture.context, 'https://app.lysto.test')
      assertSynthetic(JSON.stringify(rendered))
      await writeFile(resolve(output, `${fixture.slug}.html`), rendered.html)
      await writeFile(resolve(output, `${fixture.slug}.txt`), rendered.text + '\n')
      for (const width of [390, 720]) {
        for (const colorScheme of ['light', 'dark'] as const) {
          const page = await browser.newPage({ viewport: { width, height: 900 }, colorScheme })
          await page.setContent(
            `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0">${rendered.html}</body></html>`
          )
          const inspection = await page.evaluate(() => ({
            overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
            text: document.body.innerText
          }))
          expect(inspection.overflow).toBe(false)
          for (const label of fixture.requiredText) expect(inspection.text).toContain(label)
          const file = `${fixture.slug}-${width}-${colorScheme}.png`
          await page.screenshot({ path: resolve(output, file), fullPage: true })
          evidence.push({ template: fixture.slug, width, colorScheme, file, overflow: false })
          await page.close()
        }
      }
    }
    await writeFile(resolve(output, 'inspection.json'), JSON.stringify(evidence, null, 2) + '\n')
  } finally {
    await browser.close()
  }
}, 60_000)
