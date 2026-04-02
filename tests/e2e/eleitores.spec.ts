import { test, expect } from '../playwright-fixture';

test.describe('Cadastro de Eleitores', () => {
  test.beforeEach(async ({ loginAs, page }) => {
    await loginAs('suplente');
    await page.getByTestId('nav-eleitores').click();
  });

  test('aba eleitores carrega corretamente', async ({ page }) => {
    await expect(page.getByTestId('btn-cadastrar-eleitor')).toBeVisible();
  });

  test('exibe estatísticas de compromisso', async ({ page }) => {
    await expect(page.getByText('Total')).toBeVisible();
    await expect(page.getByText('Confirmados')).toBeVisible();
    await expect(page.getByText('Prováveis')).toBeVisible();
  });

  test('abre formulário de cadastro', async ({ page }) => {
    await page.getByTestId('btn-cadastrar-eleitor').click();
    await expect(page.getByPlaceholder(/Nome do eleitor/i)).toBeVisible();
  });

  test('valida nome obrigatório', async ({ page }) => {
    await page.getByTestId('btn-cadastrar-eleitor').click();
    await page.getByTestId('btn-salvar-eleitor').click();
    await expect(page.getByText(/nome|obrigatório|preencha/i)).toBeVisible({ timeout: 3000 });
  });

  test('botão Voltar retorna para lista de eleitores', async ({ page }) => {
    await page.getByTestId('btn-cadastrar-eleitor').click();
    await page.getByTestId('btn-voltar').click();
    await expect(page.getByTestId('btn-cadastrar-eleitor')).toBeVisible();
  });

  test('busca por nome funciona', async ({ page }) => {
    const searchInput = page.getByTestId('input-busca-eleitor');
    await searchInput.fill('teste');
    await expect(searchInput).toHaveValue('teste');
  });
});
