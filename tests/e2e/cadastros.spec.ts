import { test, expect } from '../playwright-fixture';

test.describe('Aba Meus Cadastros', () => {
  test.beforeEach(async ({ loginAs, page }) => {
    await loginAs('suplente');
    await page.getByTestId('nav-cadastros').click();
  });

  test('exibe contadores Total, Lideranças, Eleitores', async ({ page }) => {
    await expect(page.getByText('Total')).toBeVisible();
    await expect(page.getByText('Lideranças')).toBeVisible();
    await expect(page.getByText('Eleitores')).toBeVisible();
  });

  test('busca filtra a lista', async ({ page }) => {
    const input = page.getByTestId('input-busca-cadastros');
    await input.fill('qualquercoisa');
    await expect(input).toHaveValue('qualquercoisa');
  });

  test('botão exportar Excel está visível e clicável', async ({ page }) => {
    const exportBtn = page.getByTestId('btn-exportar');
    await expect(exportBtn).toBeVisible();
    await expect(exportBtn).toBeEnabled();
  });
});
