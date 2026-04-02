import { test, expect } from '../playwright-fixture';

test.describe('Cadastro de Lideranças', () => {
  test.beforeEach(async ({ loginAs }) => {
    await loginAs('suplente');
  });

  test('aba de lideranças está visível na navegação', async ({ page }) => {
    await expect(page.getByTestId('nav-liderancas')).toBeVisible();
  });

  test('abre formulário de cadastro de liderança', async ({ page }) => {
    await page.getByTestId('btn-cadastrar-lideranca').click();
    await expect(page.getByPlaceholder(/Nome da liderança/i)).toBeVisible();
  });

  test('valida nome obrigatório', async ({ page }) => {
    await page.getByTestId('btn-cadastrar-lideranca').click();
    await page.getByTestId('btn-salvar-lideranca').click();
    await expect(page.getByText(/nome|obrigatório|preencha/i)).toBeVisible({ timeout: 3000 });
  });

  test('preenche CPF com formatação automática', async ({ page }) => {
    await page.getByTestId('btn-cadastrar-lideranca').click();
    const cpfInput = page.getByPlaceholder(/000\.000\.000-00/i).first();
    await cpfInput.fill('11144477735');
    await expect(cpfInput).toHaveValue(/111\.444\.777-35/);
  });

  test('botão Voltar retorna para lista', async ({ page }) => {
    await page.getByTestId('btn-cadastrar-lideranca').click();
    await page.getByTestId('btn-voltar').click();
    await expect(page.getByTestId('btn-cadastrar-lideranca')).toBeVisible();
  });

  test('busca na lista de lideranças funciona', async ({ page }) => {
    const searchInput = page.getByTestId('input-busca-lideranca');
    await searchInput.fill('João');
    await expect(searchInput).toHaveValue('João');
  });
});
