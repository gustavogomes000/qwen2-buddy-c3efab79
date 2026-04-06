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
    const body = await req.json();
    const { acao, hierarquia_id, auth_user_id, novo_nome, nova_senha, novo_municipio_id } = body;

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Verify caller is authenticated
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user: caller } } = await supabaseAdmin.auth.getUser(token);
    if (!caller) {
      return new Response(
        JSON.stringify({ error: 'Token inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Allow self-password-change
    if (acao === 'alterar_propria_senha') {
      if (!nova_senha || nova_senha.length < 4) {
        return new Response(
          JSON.stringify({ error: 'Senha deve ter ao menos 4 caracteres' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const { error } = await supabaseAdmin.auth.admin.updateUserById(caller.id, { password: nova_senha });
      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true, message: 'Senha alterada com sucesso' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For admin actions, verify caller is admin
    const { data: callerHier } = await supabaseAdmin
      .from('hierarquia_usuarios')
      .select('tipo')
      .eq('auth_user_id', caller.id)
      .eq('ativo', true)
      .maybeSingle();
    
    if (!callerHier || !['super_admin', 'coordenador'].includes(callerHier.tipo)) {
      return new Response(
        JSON.stringify({ error: 'Acesso negado: apenas administradores podem gerenciar usuários' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (acao === 'atualizar') {
      const updates: Record<string, any> = {};
      const trimmedNome = typeof novo_nome === 'string' ? novo_nome.trim() : '';
      const hasValidAuth = typeof auth_user_id === 'string' && auth_user_id.length === 36;

      if (trimmedNome) {
        updates.nome = trimmedNome;
      }

      if (novo_municipio_id) {
        updates.municipio_id = novo_municipio_id;
      }

      let resolvedAuthUserId = hasValidAuth ? auth_user_id : null;

      if (nova_senha) {
        const nomeBase = trimmedNome || updates.nome || null;
        const { data: targetUser, error: targetUserError } = await supabaseAdmin
          .from('hierarquia_usuarios')
          .select('id, nome, auth_user_id')
          .eq('id', hierarquia_id)
          .maybeSingle();

        if (targetUserError) throw targetUserError;
        if (!targetUser) {
          return new Response(
            JSON.stringify({ error: 'Usuário não encontrado' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (!resolvedAuthUserId && targetUser.auth_user_id && targetUser.auth_user_id.length === 36) {
          resolvedAuthUserId = targetUser.auth_user_id;
        }

        if (!resolvedAuthUserId) {
          const baseName = (nomeBase || targetUser.nome || '').trim();
          const slug = baseName.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '');

          if (!slug) {
            return new Response(
              JSON.stringify({ error: 'Nome inválido para criar login do usuário' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          const email = `${slug}@rede.sarelli.com`;
          const { data: authList, error: authListError } = await supabaseAdmin.auth.admin.listUsers({
            page: 1,
            perPage: 1000,
          });
          if (authListError) throw authListError;

          const existingAuthUser = authList.users.find((user) => user.email?.toLowerCase() === email.toLowerCase()) ?? null;

          if (existingAuthUser) {
            resolvedAuthUserId = existingAuthUser.id;
            const { error: relinkError } = await supabaseAdmin.auth.admin.updateUserById(resolvedAuthUserId, {
              password: nova_senha,
              email,
              user_metadata: { name: baseName },
            });
            if (relinkError) throw relinkError;
          } else {
            const { data: createdAuth, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
              email,
              password: nova_senha,
              email_confirm: true,
              user_metadata: {
                name: baseName,
              },
            });

            if (createAuthError) throw createAuthError;

            resolvedAuthUserId = createdAuth.user?.id ?? null;
            if (!resolvedAuthUserId) {
              throw new Error('Conta de autenticação não foi criada corretamente');
            }
          }

          updates.auth_user_id = resolvedAuthUserId;
        } else {
          const { error } = await supabaseAdmin.auth.admin.updateUserById(resolvedAuthUserId, { password: nova_senha });
          if (error) throw error;
        }
      }

      if (trimmedNome && resolvedAuthUserId) {
        const newEmail = trimmedNome.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '') + '@rede.sarelli.com';
        const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(resolvedAuthUserId, {
          email: newEmail,
          user_metadata: { name: trimmedNome },
        });
        if (authUpdateError) throw authUpdateError;
      }

      if (Object.keys(updates).length > 0) {
        const { error: updateErr } = await supabaseAdmin.from('hierarquia_usuarios').update(updates).eq('id', hierarquia_id);
        if (updateErr) throw updateErr;
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Usuário atualizado', auth_user_id: resolvedAuthUserId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (acao === 'mover_cidade') {
      if (!hierarquia_id || !novo_municipio_id) {
        return new Response(
          JSON.stringify({ error: 'hierarquia_id e novo_municipio_id são obrigatórios' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error } = await supabaseAdmin
        .from('hierarquia_usuarios')
        .update({ municipio_id: novo_municipio_id })
        .eq('id', hierarquia_id);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, message: 'Cidade do usuário atualizada' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (acao === 'deletar') {
      await supabaseAdmin.from('hierarquia_usuarios').update({ ativo: false }).eq('id', hierarquia_id);
      await supabaseAdmin.auth.admin.deleteUser(auth_user_id);

      return new Response(
        JSON.stringify({ success: true, message: 'Usuário removido' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Ação inválida' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    const message = error instanceof Error ? error.message : 'Erro interno ao gerenciar usuário';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
