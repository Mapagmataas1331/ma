import { expect, test } from '@playwright/test'

test('home shows the portal', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Timofey' })).toBeVisible()
  await expect(page.getByText('me.ma.cyou')).toBeVisible()
})
