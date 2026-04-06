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

    // Verify caller is super_admin or coordenador
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
    const senha = body.senha || '123456';
    const resultados: any[] = [];
    let criados = 0;
    let erros = 0;
    let jaExistem = 0;

    // Cache of processed names/emails to prevent duplicates within this run
    const processedNames = new Set<string>();
    const processedEmails = new Set<string>();

    // Pre-load all existing hierarquia users with auth to avoid repeated queries
    const { data: allHierarquia } = await supabaseAdmin
      .from('hierarquia_usuarios')
      .select('id, nome, auth_user_id, tipo')
      .eq('ativo', true);

    const hierarquiaByName = new Map<string, typeof allHierarquia extends (infer T)[] | null ? T : never>();
    for (const h of (allHierarquia || [])) {
      hierarquiaByName.set(h.nome.trim().toLowerCase(), h);
    }

    // Helper to create a user - with dedup
    async function criarUsuario(nome: string, tipo: string, suplenteId: string | null, superiorId: string | null) {
      const nomeLower = nome.trim().toLowerCase();

      // Skip if already processed in this batch
      if (processedNames.has(nomeLower)) {
        return;
      }
      processedNames.add(nomeLower);

      const slug = nomeLower.replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '');
      if (!slug) {
        resultados.push({ nome, status: 'erro', motivo: 'Nome inválido para gerar login' });
        erros++;
        return;
      }

      const email = `${slug}@rede.sarelli.com`;

      // Check if already has auth via cached data
      const existingHierarquia = hierarquiaByName.get(nomeLower);

      if (existingHierarquia?.auth_user_id) {
        resultados.push({ nome, status: 'ja_existe', motivo: 'Já tem conta de acesso' });
        jaExistem++;
        return;
      }

      // Check if email already used in this batch
      if (processedEmails.has(email)) {
        resultados.push({ nome, status: 'ja_existe', motivo: 'Email duplicado no lote' });
        jaExistem++;
        return;
      }
      processedEmails.add(email);

      // Create auth user
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: senha,
        email_confirm: true,
        user_metadata: { name: nome.trim(), role: tipo },
      });

      if (authError) {
        // If email already exists in auth, link instead of creating duplicate
        if (authError.message?.includes('already been registered') || authError.message?.includes('already exists')) {
          // Try to find existing auth user by email
          const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
          const existingAuth = listData?.users?.find(u => u.email === email);

          if (existingAuth && existingHierarquia) {
            // Link existing auth to existing hierarquia
            await supabaseAdmin.from('hierarquia_usuarios')
              .update({ auth_user_id: existingAuth.id })
              .eq('id', existingHierarquia.id);
            resultados.push({ nome, status: 'vinculado', email, motivo: 'Auth existente vinculado à hierarquia' });
            criados++;
            return;
          } else if (existingAuth && !existingHierarquia) {
            // Auth exists but no hierarquia - check if hierarquia already has this auth_user_id
            const jaVinculado = (allHierarquia || []).some(h => h.auth_user_id === existingAuth.id);
            if (jaVinculado) {
              resultados.push({ nome, status: 'ja_existe', motivo: 'Já vinculado na hierarquia' });
              jaExistem++;
              return;
            }
            // Create hierarquia entry
            await supabaseAdmin.from('hierarquia_usuarios').insert({
              auth_user_id: existingAuth.id,
              nome: nome.trim(),
              tipo,
              superior_id: superiorId,
              suplente_id: suplenteId,
            });
            resultados.push({ nome, status: 'vinculado', email });
            criados++;
            return;
          }

          // Fallback: create with alternative email
          const emailAlt = `${slug}.${Date.now().toString(36)}@rede.sarelli.com`;
          const { data: authData2, error: authError2 } = await supabaseAdmin.auth.admin.createUser({
            email: emailAlt,
            password: senha,
            email_confirm: true,
            user_metadata: { name: nome.trim(), role: tipo },
          });
          if (authError2) {
            resultados.push({ nome, status: 'erro', motivo: authError2.message });
            erros++;
            return;
          }
          const authUserId = authData2.user?.id;
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
    const semAuth = (allHierarquia || []).filter(h => !h.auth_user_id);
    for (const u of semAuth) {
      await criarUsuario(u.nome, u.tipo, null, null);
    }

    // 2. Lideranças (da tabela liderancas + pessoas)
    const { data: liderancasDB } = await supabaseAdmin
      .from('liderancas')
      .select('id, pessoa_id, suplente_id, municipio_id, pessoas(nome)')
      .eq('status', 'Ativa');

    for (const l of (liderancasDB || [])) {
      const nomePessoa = (l.pessoas as any)?.nome;
      if (!nomePessoa) continue;
      await criarUsuario(nomePessoa, 'lideranca', l.suplente_id, null);
    }

    // 3. Suplentes do banco externo
    const { data: suplentesExternos } = await externalSupabase
      .from('suplentes')
      .select('id, nome')
      .order('nome');

    for (const s of (suplentesExternos || [])) {
      if (!s.nome) continue;
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
