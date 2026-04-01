import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-token',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const TOKEN_SECRETO = Deno.env.get('CADASTRO_EXTERNO_TOKEN');
    const tokenRecebido = req.headers.get('x-api-token');
    if (!tokenRecebido || tokenRecebido !== TOKEN_SECRETO) {
      return new Response(
        JSON.stringify({ erro: 'Token inválido ou ausente' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const externalSupabase = createClient(
      Deno.env.get('EXTERNAL_SUPABASE_URL')!,
      Deno.env.get('EXTERNAL_SUPABASE_SERVICE_KEY') || Deno.env.get('EXTERNAL_SUPABASE_ANON_KEY')!
    );

    // Fonte A — suplentes do banco externo
    const { data: suplentesExternos } = await externalSupabase
      .from('suplentes')
      .select('id, nome, partido, regiao_atuacao, situacao')
      .order('nome');

    // Fonte B — usuários do sistema (hierarquia)
    const { data: usuariosLocais } = await supabaseAdmin
      .from('hierarquia_usuarios')
      .select('id, nome, tipo, municipio_id, municipios(nome)')
      .eq('ativo', true)
      .order('nome');

    // Fonte C — lideranças cadastradas (tabela liderancas + pessoas)
    const { data: liderancasCadastradas } = await supabaseAdmin
      .from('liderancas')
      .select('id, regiao_atuacao, status, tipo_lideranca, pessoa_id, pessoas(nome, whatsapp, cpf), municipios(nome)')
      .order('criado_em', { ascending: false });

    // Fonte D — fiscais cadastrados
    const { data: fiscaisCadastrados } = await supabaseAdmin
      .from('fiscais')
      .select('id, zona_fiscal, secao_fiscal, status, pessoa_id, pessoas(nome, whatsapp, cpf), municipios(nome)')
      .order('criado_em', { ascending: false });

    // Fonte E — eleitores cadastrados
    const { data: eleitoresCadastrados } = await supabaseAdmin
      .from('possiveis_eleitores')
      .select('id, compromisso_voto, pessoa_id, pessoas(nome, whatsapp, cpf), municipios(nome)')
      .order('criado_em', { ascending: false });

    function tipoLabel(tipo: string): string {
      const labels: Record<string, string> = {
        super_admin: 'Super Admin',
        suplente: 'Suplente',
        lideranca: 'Liderança',
        coordenador: 'Coordenador',
        fiscal: 'Fiscal',
      };
      return labels[tipo] ?? tipo;
    }

    // Nomes já incluídos (por pessoa_id) para evitar duplicatas
    const pessoaIdsUsados = new Set<string>();
    const idsUsados = new Set<string>();

    const listaUnificada: any[] = [];

    // Suplentes externos
    for (const s of suplentesExternos ?? []) {
      idsUsados.add(s.id);
      listaUnificada.push({
        id: s.id,
        nome: s.nome,
        tipo: 'suplente',
        tag: 'Suplente',
        subtitulo: [s.partido, s.regiao_atuacao].filter(Boolean).join(' · '),
        municipio: null,
        fonte: 'externo',
      });
    }

    // Usuários do sistema (hierarquia)
    for (const u of usuariosLocais ?? []) {
      if (idsUsados.has(u.id)) continue;
      idsUsados.add(u.id);
      listaUnificada.push({
        id: u.id,
        nome: u.nome,
        tipo: u.tipo,
        tag: tipoLabel(u.tipo),
        subtitulo: tipoLabel(u.tipo) + ((u.municipios as any)?.nome ? ` · ${(u.municipios as any).nome}` : ''),
        municipio: (u.municipios as any)?.nome ?? null,
        fonte: 'local',
      });
    }

    // Lideranças cadastradas
    for (const l of liderancasCadastradas ?? []) {
      if (l.pessoa_id && pessoaIdsUsados.has(l.pessoa_id)) continue;
      if (l.pessoa_id) pessoaIdsUsados.add(l.pessoa_id);
      const nomePessoa = (l.pessoas as any)?.nome ?? '—';
      listaUnificada.push({
        id: l.id,
        nome: nomePessoa,
        tipo: 'lideranca_cadastrada',
        tag: 'Liderança',
        subtitulo: [l.tipo_lideranca, l.regiao_atuacao].filter(Boolean).join(' · ') || 'Liderança',
        municipio: (l.municipios as any)?.nome ?? null,
        fonte: 'local',
      });
    }

    // Fiscais cadastrados
    for (const f of fiscaisCadastrados ?? []) {
      if (f.pessoa_id && pessoaIdsUsados.has(f.pessoa_id)) continue;
      if (f.pessoa_id) pessoaIdsUsados.add(f.pessoa_id);
      const nomePessoa = (f.pessoas as any)?.nome ?? '—';
      listaUnificada.push({
        id: f.id,
        nome: nomePessoa,
        tipo: 'fiscal_cadastrado',
        tag: 'Fiscal',
        subtitulo: [f.zona_fiscal ? `Zona ${f.zona_fiscal}` : null, f.secao_fiscal ? `Seção ${f.secao_fiscal}` : null].filter(Boolean).join(' · ') || 'Fiscal',
        municipio: (f.municipios as any)?.nome ?? null,
        fonte: 'local',
      });
    }

    // Eleitores cadastrados
    for (const e of eleitoresCadastrados ?? []) {
      if (e.pessoa_id && pessoaIdsUsados.has(e.pessoa_id)) continue;
      if (e.pessoa_id) pessoaIdsUsados.add(e.pessoa_id);
      const nomePessoa = (e.pessoas as any)?.nome ?? '—';
      listaUnificada.push({
        id: e.id,
        nome: nomePessoa,
        tipo: 'eleitor_cadastrado',
        tag: 'Eleitor',
        subtitulo: e.compromisso_voto ? `Voto: ${e.compromisso_voto}` : 'Eleitor',
        municipio: (e.municipios as any)?.nome ?? null,
        fonte: 'local',
      });
    }

    listaUnificada.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

    return new Response(
      JSON.stringify(listaUnificada),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erro em listar-usuarios-externos:', error);
    return new Response(
      JSON.stringify({ erro: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
