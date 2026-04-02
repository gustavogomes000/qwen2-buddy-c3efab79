import { test as base } from '@playwright/test';
import type { Page } from '@playwright/test';

type AuthRole = 'super_admin' | 'coordenador' | 'suplente' | 'lideranca';

type Fixtures = {
  loginAs: (role: AuthRole) => Promise<void>;
  authPage: Page;
};

const credenciais: Record<AuthRole, { nome: string; senha: string }> = {
  super_admin: { nome: process.env.TEST_SUPER_ADMIN_NOME || 'Admin Teste', senha: process.env.TEST_SUPER_ADMIN_SENHA || '123456' },
  coordenador: { nome: process.env.TEST_COORD_NOME || 'Coord Teste', senha: process.env.TEST_COORD_SENHA || '123456' },
  suplente: { nome: process.env.TEST_SUP_NOME || 'Suplente Teste', senha: process.env.TEST_SUP_SENHA || '123456' },
  lideranca: { nome: process.env.TEST_LID_NOME || 'Lideranca Teste', senha: process.env.TEST_LID_SENHA || '123456' },
};

export const test = base.extend<Fixtures>({
  authPage: async ({ page }, use) => {
    await use(page);
  },
  loginAs: async ({ page }, use) => {
    const loginAs = async (role: AuthRole) => {
      await page.goto('/login');
      await page.getByTestId('input-nome').fill(credenciais[role].nome);
      await page.getByTestId('input-senha').fill(credenciais[role].senha);
      await page.getByTestId('btn-entrar').click();
      await page.waitForURL('/', { timeout: 10000 });
    };
    await use(loginAs);
  },
});

export { expect } from '@playwright/test';
