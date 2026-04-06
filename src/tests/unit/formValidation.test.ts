import { describe, it, expect } from 'vitest';

describe('Validação do formulário de Liderança', () => {
  const validarLideranca = (form: any) => {
    const erros: string[] = [];
    if (!form.nome?.trim()) erros.push('Nome obrigatório');
    if (!form.telefone?.trim() && !form.whatsapp?.trim()) {
      erros.push('Informe telefone ou WhatsApp');
    }
    return erros;
  };

  it('retorna erro quando nome está vazio', () => {
    const erros = validarLideranca({ nome: '', telefone: '999' });
    expect(erros).toContain('Nome obrigatório');
  });

  it('retorna erro quando não há telefone nem whatsapp', () => {
    const erros = validarLideranca({ nome: 'João', telefone: '', whatsapp: '' });
    expect(erros).toContain('Informe telefone ou WhatsApp');
  });

  it('aceita quando só tem whatsapp', () => {
    const erros = validarLideranca({ nome: 'João', telefone: '', whatsapp: '62999999999' });
    expect(erros).not.toContain('Informe telefone ou WhatsApp');
  });

  it('aceita quando só tem telefone', () => {
    const erros = validarLideranca({ nome: 'João', telefone: '6299999999', whatsapp: '' });
    expect(erros.length).toBe(0);
  });
});

describe('Validação do formulário de Eleitor', () => {
  const validarEleitor = (form: any) => {
    const erros: string[] = [];
    if (!form.nome?.trim()) erros.push('Nome obrigatório');
    if (!form.whatsapp?.trim()) erros.push('WhatsApp obrigatório');
    return erros;
  };

  it('retorna erro quando whatsapp está vazio', () => {
    const erros = validarEleitor({ nome: 'Maria', whatsapp: '' });
    expect(erros).toContain('WhatsApp obrigatório');
  });

  it('não retorna erros para dados válidos', () => {
    const erros = validarEleitor({ nome: 'Maria', whatsapp: '62999999999' });
    expect(erros.length).toBe(0);
  });
});

describe('Validação de senha de usuário', () => {
  const validarSenha = (senha: string) => senha.length >= 6;

  it('aceita senha com 6+ caracteres', () => {
    expect(validarSenha('123456')).toBe(true);
    expect(validarSenha('minhaSenhaSegura')).toBe(true);
  });

  it('rejeita senha com menos de 6 caracteres', () => {
    expect(validarSenha('12345')).toBe(false);
    expect(validarSenha('1234')).toBe(false);
    expect(validarSenha('')).toBe(false);
  });
});
