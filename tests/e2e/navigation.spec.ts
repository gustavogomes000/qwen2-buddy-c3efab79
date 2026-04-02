import { test, expect } from '../playwright-fixture';

test.describe('Navegação — Super Admin', () => {
  test.beforeEach(async ({ loginAs }) => {
    await loginAs('super_admin');
  });

  test('vê aba de Rastreamento', async ({ page }) => {
    await expect(page.getByTestId('nav-rastreamento')).toBeVisible();
  });

  test('vê link para Painel Admin', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Painel/i })).toBeVisible();
  });
});

test.describe('Navegação — Suplente', () => {
  test.beforeEach(async ({ loginAs }) => {
    await loginAs('suplente');
  });

  test('não vê aba de Rastreamento', async ({ page }) => {
    await expect(page.getByTestId('nav-rastreamento')).not.toBeVisible();
  });

  test('não vê link para Painel Admin', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Painel/i })).not.toBeVisible();
  });

  test('vê abas de Lideranças, Eleitores, Cadastros, Perfil', async ({ page }) => {
    await expect(page.getByTestId('nav-liderancas')).toBeVisible();
    await expect(page.getByTestId('nav-eleitores')).toBeVisible();
    await expect(page.getByTestId('nav-cadastros')).toBeVisible();
    await expect(page.getByTestId('nav-perfil')).toBeVisible();
  });
});
