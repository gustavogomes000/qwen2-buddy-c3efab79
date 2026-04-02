import { test, expect } from '../playwright-fixture';

test.describe('Aba de Pagamentos (Admin)', () => {
  test.beforeEach(async ({ loginAs, page }) => {
    await loginAs('super_admin');
    await page.goto('/admin');
  });

  test('painel admin carrega', async ({ page }) => {
    await expect(page).toHaveURL('/admin');
  });
});
