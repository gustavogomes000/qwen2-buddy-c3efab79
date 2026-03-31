import { supabase } from '@/integrations/supabase/client';

interface ExportRow {
  tipo: string;
  nome: string;
  cpf: string;
  telefone: string;
  whatsapp: string;
  email: string;
  instagram: string;
  facebook: string;
  titulo_eleitor: string;
  zona_eleitoral: string;
  secao_eleitoral: string;
  municipio_eleitoral: string;
  uf_eleitoral: string;
  colegio_eleitoral: string;
  endereco_colegio: string;
  situacao_titulo: string;
  status: string;
  cadastrado_por_nome: string;
  criado_em: string;
  extras: string;
}

const headers = [
  'Tipo', 'Nome', 'CPF', 'Telefone', 'WhatsApp', 'E-mail',
  'Instagram', 'Facebook', 'Título Eleitor', 'Zona', 'Seção',
  'Município', 'UF', 'Colégio', 'End. Colégio', 'Situação Título',
  'Status', 'Cadastrado por', 'Data Cadastro', 'Detalhes',
];

function escapeCSV(val: string): string {
  if (!val) return '';
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

function formatDate(d: string | null): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString('pt-BR');
}

export async function exportAllCadastros(tipo?: 'lideranca' | 'fiscal' | 'eleitor') {
  const agentesMap: Record<string, string> = {};
  const { data: agentes } = await supabase.from('hierarquia_usuarios').select('id, nome');
  agentes?.forEach(a => { agentesMap[a.id] = a.nome; });

  const rows: ExportRow[] = [];

  if (!tipo || tipo === 'lideranca') {
    const { data } = await supabase.from('liderancas')
      .select('*, pessoas(*)');
    data?.forEach((l: any) => {
      const p = l.pessoas || {};
      rows.push({
        tipo: 'Liderança',
        nome: p.nome || '', cpf: p.cpf || '', telefone: p.telefone || '',
        whatsapp: p.whatsapp || '', email: p.email || '',
        instagram: p.instagram || '', facebook: p.facebook || '',
        titulo_eleitor: p.titulo_eleitor || '', zona_eleitoral: p.zona_eleitoral || '',
        secao_eleitoral: p.secao_eleitoral || '', municipio_eleitoral: p.municipio_eleitoral || '',
        uf_eleitoral: p.uf_eleitoral || '', colegio_eleitoral: p.colegio_eleitoral || '',
        endereco_colegio: p.endereco_colegio || '', situacao_titulo: p.situacao_titulo || '',
        status: l.status || '', cadastrado_por_nome: agentesMap[l.cadastrado_por] || '',
        criado_em: formatDate(l.criado_em),
        extras: [l.tipo_lideranca, l.nivel, l.regiao_atuacao, l.observacoes].filter(Boolean).join(' | '),
      });
    });
  }

  if (!tipo || tipo === 'fiscal') {
    const { data } = await supabase.from('fiscais')
      .select('*, pessoas(*)');
    data?.forEach((f: any) => {
      const p = f.pessoas || {};
      rows.push({
        tipo: 'Fiscal',
        nome: p.nome || '', cpf: p.cpf || '', telefone: p.telefone || '',
        whatsapp: p.whatsapp || '', email: p.email || '',
        instagram: p.instagram || '', facebook: p.facebook || '',
        titulo_eleitor: p.titulo_eleitor || '', zona_eleitoral: p.zona_eleitoral || '',
        secao_eleitoral: p.secao_eleitoral || '', municipio_eleitoral: p.municipio_eleitoral || '',
        uf_eleitoral: p.uf_eleitoral || '', colegio_eleitoral: f.colegio_eleitoral || p.colegio_eleitoral || '',
        endereco_colegio: p.endereco_colegio || '', situacao_titulo: p.situacao_titulo || '',
        status: f.status || '', cadastrado_por_nome: agentesMap[f.cadastrado_por] || '',
        criado_em: formatDate(f.criado_em),
        extras: [f.zona_fiscal ? `Z${f.zona_fiscal}` : '', f.secao_fiscal ? `S${f.secao_fiscal}` : '', f.observacoes].filter(Boolean).join(' | '),
      });
    });
  }

  if (!tipo || tipo === 'eleitor') {
    const { data } = await supabase.from('possiveis_eleitores')
      .select('*, pessoas(*)');
    data?.forEach((e: any) => {
      const p = e.pessoas || {};
      rows.push({
        tipo: 'Eleitor',
        nome: p.nome || '', cpf: p.cpf || '', telefone: p.telefone || '',
        whatsapp: p.whatsapp || '', email: p.email || '',
        instagram: p.instagram || '', facebook: p.facebook || '',
        titulo_eleitor: p.titulo_eleitor || '', zona_eleitoral: p.zona_eleitoral || '',
        secao_eleitoral: p.secao_eleitoral || '', municipio_eleitoral: p.municipio_eleitoral || '',
        uf_eleitoral: p.uf_eleitoral || '', colegio_eleitoral: p.colegio_eleitoral || '',
        endereco_colegio: p.endereco_colegio || '', situacao_titulo: p.situacao_titulo || '',
        status: e.compromisso_voto || 'Indefinido', cadastrado_por_nome: agentesMap[e.cadastrado_por] || '',
        criado_em: formatDate(e.criado_em),
        extras: e.observacoes || '',
      });
    });
  }

  // Build CSV
  const csvLines = [headers.map(escapeCSV).join(',')];
  rows.forEach(r => {
    csvLines.push([
      r.tipo, r.nome, r.cpf, r.telefone, r.whatsapp, r.email,
      r.instagram, r.facebook, r.titulo_eleitor, r.zona_eleitoral,
      r.secao_eleitoral, r.municipio_eleitoral, r.uf_eleitoral,
      r.colegio_eleitoral, r.endereco_colegio, r.situacao_titulo,
      r.status, r.cadastrado_por_nome, r.criado_em, r.extras,
    ].map(escapeCSV).join(','));
  });

  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const tipoLabel = tipo ? `_${tipo}s` : '_todos';
  a.download = `cadastros${tipoLabel}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);

  return rows.length;
}
