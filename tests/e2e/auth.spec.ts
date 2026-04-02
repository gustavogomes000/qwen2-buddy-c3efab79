import { test, expect } from '../playwright-fixture';

test.describe('Autenticação', () => {
  test('redireciona para login quando não autenticado', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/login/);
  });

  test('exibe formulário de login com campos corretos', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByTestId('input-nome')).toBeVisible();
    await expect(page.getByTestId('input-senha')).toBeVisible();
    await expect(page.getByTestId('btn-entrar')).toBeVisible();
  });

  test('exibe erro com credenciais inválidas', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('input-nome').fill('usuário_inexistente');
    await page.getByTestId('input-senha').fill('senha_errada');
    await page.getByTestId('btn-entrar').click();
    await expect(page.getByText(/inválid|erro|incorret|não encontrad/i)).toBeVisible({ timeout: 5000 });
  });

  test('login bem-sucedido redireciona para home', async ({ page, loginAs }) => {
    await loginAs('suplente');
    await expect(page).toHaveURL('/');
  });

  test('logout retorna para tela de login', async ({ page, loginAs }) => {
    await loginAs('suplente');
    await page.getByTestId('nav-perfil').click();
    await page.getByRole('button', { name: /sair|logout|desconectar/i }).click();
    await expect(page).toHaveURL(/login/);
  });
});
