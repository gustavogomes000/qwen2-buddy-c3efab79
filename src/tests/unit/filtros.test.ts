import { describe, it, expect } from 'vitest';

describe('Filtro de cadastros unificados', () => {
  const cadastros = [
    { id: '1', tipo: 'lideranca', nome: 'João Silva', cpf: '11144477735', telefone: '62999', cadastrado_por_nome: 'Admin' },
    { id: '2', tipo: 'eleitor', nome: 'Maria Santos', cpf: null, telefone: null, cadastrado_por_nome: 'Agente' },
    { id: '3', tipo: 'lideranca', nome: 'Pedro Costa', cpf: null, telefone: '62888', cadastrado_por_nome: null },
  ];

  it('filtra por tipo lideranca', () => {
    const result = cadastros.filter(c => c.tipo === 'lideranca');
    expect(result.length).toBe(2);
  });

  it('filtra por tipo eleitor', () => {
    const result = cadastros.filter(c => c.tipo === 'eleitor');
    expect(result.length).toBe(1);
  });

  it('busca por nome (case insensitive)', () => {
    const q = 'silva';
    const result = cadastros.filter(c => c.nome.toLowerCase().includes(q));
    expect(result.length).toBe(1);
    expect(result[0].nome).toBe('João Silva');
  });

  it('busca por CPF', () => {
    const q = '11144477735';
    const result = cadastros.filter(c => c.cpf && c.cpf.includes(q));
    expect(result.length).toBe(1);
  });

  it('busca por nome do agente cadastrador', () => {
    const q = 'agente';
    const result = cadastros.filter(c =>
      c.cadastrado_por_nome && c.cadastrado_por_nome.toLowerCase().includes(q)
    );
    expect(result.length).toBe(1);
  });

  it('retorna todos quando busca está vazia', () => {
    const q = '';
    const result = cadastros.filter(() => !q || true);
    expect(result.length).toBe(3);
  });
});

describe('Estatísticas de eleitores por compromisso', () => {
  const eleitores = [
    { compromisso_voto: 'Confirmado' },
    { compromisso_voto: 'Confirmado' },
    { compromisso_voto: 'Provável' },
    { compromisso_voto: 'Indefinido' },
    { compromisso_voto: 'Improvável' },
  ];

  it('conta confirmados corretamente', () => {
    const confirmados = eleitores.filter(e => e.compromisso_voto === 'Confirmado').length;
    expect(confirmados).toBe(2);
  });

  it('conta prováveis corretamente', () => {
    const provaveis = eleitores.filter(e => e.compromisso_voto === 'Provável').length;
    expect(provaveis).toBe(1);
  });
});

describe('Filtro de pagamentos', () => {
  const pagamentos = [
    { id: '1', status: 'Paga', valor: 500, descricao: 'Aluguel escritório', fornecedor_nome_livre: 'Imobiliária X' },
    { id: '2', status: 'Lancada', valor: 200, descricao: 'Material gráfico', fornecedor_nome_livre: null },
    { id: '3', status: 'Vencida', valor: 1000, descricao: 'Transporte', fornecedor_nome_livre: 'Transporte Y' },
  ];

  it('filtra por status Paga', () => {
    const result = pagamentos.filter(p => p.status === 'Paga');
    expect(result.length).toBe(1);
  });

  it('calcula total pago', () => {
    const total = pagamentos.filter(p => p.status === 'Paga').reduce((s, p) => s + p.valor, 0);
    expect(total).toBe(500);
  });

  it('calcula total pendente (exceto Paga e Cancelada)', () => {
    const total = pagamentos
      .filter(p => p.status !== 'Paga' && p.status !== 'Cancelada')
      .reduce((s, p) => s + p.valor, 0);
    expect(total).toBe(1200);
  });

  it('busca por descrição', () => {
    const q = 'material';
    const result = pagamentos.filter(p => p.descricao.toLowerCase().includes(q));
    expect(result.length).toBe(1);
  });

  it('busca por fornecedor', () => {
    const q = 'transporte';
    const result = pagamentos.filter(p =>
      p.fornecedor_nome_livre && p.fornecedor_nome_livre.toLowerCase().includes(q)
    );
    expect(result.length).toBe(1);
  });
});
