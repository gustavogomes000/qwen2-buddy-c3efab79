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

function formatDate(d: string | null): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString('pt-BR');
}

export async function exportAllCadastros(tipo?: 'lideranca' | 'eleitor') {
  const XLSX = await import('xlsx');
  const agentesMap: Record<string, string> = {};
  const { data: agentes } = await supabase.from('hierarquia_usuarios').select('id, nome');
  agentes?.forEach(a => { agentesMap[a.id] = a.nome; });

  const rows: ExportRow[] = [];

  if (!tipo || tipo === 'lideranca') {
    const { data } = await supabase.from('liderancas').select('*, pessoas(*)');
    data?.forEach((l: any) => {
      const p = l.pessoas || {};
      rows.push({
        tipo: 'Liderança', nome: p.nome || '', cpf: p.cpf || '', telefone: p.telefone || '',
        whatsapp: p.whatsapp || '', email: p.email || '', instagram: p.instagram || '', facebook: p.facebook || '',
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

  if (!tipo || tipo === 'eleitor') {
    const { data } = await supabase.from('possiveis_eleitores').select('*, pessoas(*)');
    data?.forEach((e: any) => {
      const p = e.pessoas || {};
      rows.push({
        tipo: 'Eleitor', nome: p.nome || '', cpf: p.cpf || '', telefone: p.telefone || '',
        whatsapp: p.whatsapp || '', email: p.email || '', instagram: p.instagram || '', facebook: p.facebook || '',
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

  const wsData = [headers, ...rows.map(r => [
    r.tipo, r.nome, r.cpf, r.telefone, r.whatsapp, r.email,
    r.instagram, r.facebook, r.titulo_eleitor, r.zona_eleitoral,
    r.secao_eleitoral, r.municipio_eleitoral, r.uf_eleitoral,
    r.colegio_eleitoral, r.endereco_colegio, r.situacao_titulo,
    r.status, r.cadastrado_por_nome, r.criado_em, r.extras,
  ])];

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const colWidths = headers.map((h, i) => {
    let max = h.length;
    rows.forEach(r => {
      const vals = [r.tipo, r.nome, r.cpf, r.telefone, r.whatsapp, r.email,
        r.instagram, r.facebook, r.titulo_eleitor, r.zona_eleitoral,
        r.secao_eleitoral, r.municipio_eleitoral, r.uf_eleitoral,
        r.colegio_eleitoral, r.endereco_colegio, r.situacao_titulo,
        r.status, r.cadastrado_por_nome, r.criado_em, r.extras];
      const len = (vals[i] || '').length;
      if (len > max) max = len;
    });
    return { wch: Math.min(max + 2, 40) };
  });
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  const tipoLabel = tipo ? (tipo === 'lideranca' ? 'Lideranças' : 'Eleitores') : 'Cadastros';
  XLSX.utils.book_append_sheet(wb, ws, tipoLabel);

  const fileName = `cadastros_${tipo || 'todos'}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fileName);

  return rows.length;
}
