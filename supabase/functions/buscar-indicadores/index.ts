import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { termo } = await req.json();

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Buscar suplentes da tabela suplentes (banco compartilhado)
    const { data: suplentesDB } = await supabaseAdmin
      .from('suplentes')
      .select('id, nome, partido, regiao_atuacao, numero_urna')
      .ilike('nome', `%${termo}%`)
      .order('nome')
      .limit(15);

    // Buscar usuários da hierarquia (suplentes + lideranças + coordenadores)
    const { data: hierarquiaUsers } = await supabaseAdmin
      .from('hierarquia_usuarios')
      .select('id, nome, tipo')
      .eq('ativo', true)
      .in('tipo', ['lideranca', 'suplente', 'coordenador'])
      .ilike('nome', `%${termo}%`)
      .order('nome')
      .limit(20);

    // Separar hierarquia em suplentes e lideranças
    const nomesSuplenteVistos = new Set((suplentesDB || []).map(s => s.nome.toLowerCase()));
    const suplentesHierarquia = (hierarquiaUsers || [])
      .filter(u => u.tipo === 'suplente' && !nomesSuplenteVistos.has(u.nome.toLowerCase()));

    const liderancasHierarquia = (hierarquiaUsers || [])
      .filter(u => u.tipo === 'lideranca' || u.tipo === 'coordenador');

    // Montar resultado
    const suplentes = [
      ...(suplentesDB || []).map(s => ({
        id: s.id,
        nome: s.nome,
        partido: s.partido,
        numero_urna: (s as any).numero_urna || null,
        regiao_atuacao: s.regiao_atuacao,
      })),
      ...suplentesHierarquia.map(u => ({
        id: u.id,
        nome: u.nome,
        partido: null,
        numero_urna: null,
        regiao_atuacao: null,
      })),
    ];

    const liderancas = liderancasHierarquia.map(l => ({
      id: l.id,
      nome: l.nome,
      regiao: '',
      fonte: 'hierarquia',
    }));

    return new Response(
      JSON.stringify({ suplentes, liderancas }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erro buscar-indicadores:', error);
    return new Response(
      JSON.stringify({ suplentes: [], liderancas: [], error: error instanceof Error ? error.message : 'Erro' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
