import { test, expect } from '../playwright-fixture';

test.describe('Perfil e Gestão de Usuários', () => {
  test.beforeEach(async ({ loginAs, page }) => {
    await loginAs('super_admin');
    await page.getByTestId('nav-perfil').click();
  });

  test('exibe botão de sair', async ({ page }) => {
    await expect(page.getByRole('button', { name: /sair|logout|desconectar/i })).toBeVisible();
  });

  test('exibe seção de alterar senha', async ({ page }) => {
    await expect(page.getByText(/senha/i)).toBeVisible();
  });
});
