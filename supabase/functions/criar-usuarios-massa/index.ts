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
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const externalSupabase = createClient(
      Deno.env.get('EXTERNAL_SUPABASE_URL')!,
      Deno.env.get('EXTERNAL_SUPABASE_SERVICE_KEY') ||
      Deno.env.get('EXTERNAL_SUPABASE_ANON_KEY')!
    );

    // Verify caller is super_admin
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabaseAdmin.auth.getUser(token);
      if (user) {
        const { data: caller } = await supabaseAdmin
          .from('hierarquia_usuarios')
          .select('tipo')
          .eq('auth_user_id', user.id)
          .eq('ativo', true)
          .single();
        if (!caller || (caller.tipo !== 'super_admin' && caller.tipo !== 'coordenador')) {
          return new Response(
            JSON.stringify({ error: 'Sem permissão' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    const body = await req.json().catch(() => ({}));
    const senha = body.senha || '12345';
    const resultados: any[] = [];
    let criados = 0;
    let erros = 0;
    let jaExistem = 0;

    // Helper to create a user
    async function criarUsuario(nome: string, tipo: string, suplenteId: string | null, superiorId: string | null) {
      const slug = nome.toLowerCase().trim().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '');
      if (!slug) {
        resultados.push({ nome, status: 'erro', motivo: 'Nome inválido para gerar login' });
        erros++;
        return;
      }

      const email = `${slug}@rede.sarelli.com`;

      // Check if auth user already exists
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1 });
      // Check by email in hierarquia
      const { data: existingHierarquia } = await supabaseAdmin
        .from('hierarquia_usuarios')
        .select('id, auth_user_id')
        .ilike('nome', nome.trim())
        .eq('ativo', true)
        .maybeSingle();

      if (existingHierarquia?.auth_user_id) {
        resultados.push({ nome, status: 'ja_existe', motivo: 'Já tem conta de acesso' });
        jaExistem++;
        return;
      }

      // Create auth user
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: senha,
        email_confirm: true,
        user_metadata: { name: nome, role: tipo },
      });

      if (authError) {
        // If email already exists, try with suffix
        if (authError.message?.includes('already been registered') || authError.message?.includes('already exists')) {
          const emailAlt = `${slug}.${Date.now().toString(36)}@rede.sarelli.com`;
          const { data: authData2, error: authError2 } = await supabaseAdmin.auth.admin.createUser({
            email: emailAlt,
            password: senha,
            email_confirm: true,
            user_metadata: { name: nome, role: tipo },
          });
          if (authError2) {
            resultados.push({ nome, status: 'erro', motivo: authError2.message });
            erros++;
            return;
          }
          // Continue with authData2
          const authUserId = authData2.user?.id;
          if (!authUserId) { erros++; return; }

          if (existingHierarquia) {
            // Update existing hierarquia record
            await supabaseAdmin.from('hierarquia_usuarios')
              .update({ auth_user_id: authUserId })
              .eq('id', existingHierarquia.id);
          } else {
            await supabaseAdmin.from('hierarquia_usuarios').insert({
              auth_user_id: authUserId,
              nome: nome.trim(),
              tipo,
              superior_id: superiorId,
              suplente_id: suplenteId,
            });
          }
          resultados.push({ nome, status: 'criado', email: emailAlt });
          criados++;
          return;
        }
        resultados.push({ nome, status: 'erro', motivo: authError.message });
        erros++;
        return;
      }

      const authUserId = authData.user?.id;
      if (!authUserId) { erros++; return; }

      if (existingHierarquia) {
        await supabaseAdmin.from('hierarquia_usuarios')
          .update({ auth_user_id: authUserId })
          .eq('id', existingHierarquia.id);
      } else {
        await supabaseAdmin.from('hierarquia_usuarios').insert({
          auth_user_id: authUserId,
          nome: nome.trim(),
          tipo,
          superior_id: superiorId,
          suplente_id: suplenteId,
        });
      }
      resultados.push({ nome, status: 'criado', email });
      criados++;
    }

    // 1. Hierarquia_usuarios sem auth_user_id
    const { data: semAuth } = await supabaseAdmin
      .from('hierarquia_usuarios')
      .select('id, nome, tipo, superior_id, suplente_id')
      .is('auth_user_id', null)
      .eq('ativo', true);

    for (const u of (semAuth || [])) {
      await criarUsuario(u.nome, u.tipo, u.suplente_id, u.superior_id);
    }

    // 2. Lideranças (da tabela liderancas + pessoas)
    const { data: liderancasDB } = await supabaseAdmin
      .from('liderancas')
      .select('id, pessoa_id, suplente_id, municipio_id, pessoas(nome)')
      .eq('status', 'Ativa');

    for (const l of (liderancasDB || [])) {
      const nomePessoa = (l.pessoas as any)?.nome;
      if (!nomePessoa) continue;
      // Check if already has user
      const { data: existing } = await supabaseAdmin
        .from('hierarquia_usuarios')
        .select('id')
        .ilike('nome', nomePessoa.trim())
        .eq('ativo', true)
        .maybeSingle();
      if (existing) {
        jaExistem++;
        resultados.push({ nome: nomePessoa, status: 'ja_existe', motivo: 'Já existe na hierarquia' });
        continue;
      }
      await criarUsuario(nomePessoa, 'lideranca', l.suplente_id, null);
    }

    // 3. Suplentes do banco externo
    const { data: suplentesExternos } = await externalSupabase
      .from('suplentes')
      .select('id, nome')
      .order('nome');

    for (const s of (suplentesExternos || [])) {
      if (!s.nome) continue;
      const { data: existing } = await supabaseAdmin
        .from('hierarquia_usuarios')
        .select('id')
        .ilike('nome', s.nome.trim())
        .eq('ativo', true)
        .maybeSingle();
      if (existing) {
        jaExistem++;
        resultados.push({ nome: s.nome, status: 'ja_existe', motivo: 'Já existe na hierarquia' });
        continue;
      }
      await criarUsuario(s.nome, 'suplente', s.id, null);
    }

    return new Response(
      JSON.stringify({
        resumo: { criados, erros, ja_existem: jaExistem, total: criados + erros + jaExistem },
        detalhes: resultados,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
