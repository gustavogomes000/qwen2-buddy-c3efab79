import { describe, it, expect } from 'vitest';
import { formatCPF, cleanCPF, validateCPF, maskCPF } from '@/lib/cpf';

describe('formatCPF', () => {
  it('formata CPF de 11 dígitos corretamente', () => {
    expect(formatCPF('12345678901')).toBe('123.456.789-01');
  });
  it('retorna string vazia para entrada vazia', () => {
    expect(formatCPF('')).toBe('');
  });
  it('formata parcialmente com menos de 11 dígitos', () => {
    expect(formatCPF('123')).toBe('123');
    expect(formatCPF('12345')).toBe('123.45');
    expect(formatCPF('12345678')).toBe('123.456.78');
  });
  it('ignora caracteres não numéricos na entrada', () => {
    expect(formatCPF('123.456.789-01')).toBe('123.456.789-01');
  });
});

describe('cleanCPF', () => {
  it('remove pontos e traços', () => {
    expect(cleanCPF('123.456.789-01')).toBe('12345678901');
  });
  it('retorna apenas números', () => {
    expect(cleanCPF('abc123def456ghi')).toBe('123456');
  });
  it('retorna vazio para entrada vazia', () => {
    expect(cleanCPF('')).toBe('');
  });
});

describe('validateCPF', () => {
  it('valida CPF correto', () => {
    expect(validateCPF('11144477735')).toBe(true);
    expect(validateCPF('529.982.247-25')).toBe(true);
  });
  it('rejeita CPF com todos dígitos iguais', () => {
    expect(validateCPF('11111111111')).toBe(false);
    expect(validateCPF('00000000000')).toBe(false);
  });
  it('rejeita CPF com menos de 11 dígitos', () => {
    expect(validateCPF('1234567890')).toBe(false);
  });
  it('rejeita CPF inválido', () => {
    expect(validateCPF('12345678901')).toBe(false);
  });
});

describe('maskCPF', () => {
  it('mascara os primeiros dígitos', () => {
    const masked = maskCPF('12345678901');
    expect(masked).toContain('***');
    expect(masked).not.toBe('123.456.789-01');
  });
  it('funciona com string vazia', () => {
    expect(maskCPF('')).toBe('');
  });
});
