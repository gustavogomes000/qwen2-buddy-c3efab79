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

      if (novo_nome) {
        updates.nome = novo_nome.trim();
        // Only update auth email if auth_user_id is a valid UUID
        if (auth_user_id && auth_user_id.length === 36) {
          const newEmail = novo_nome.toLowerCase().trim().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '') + '@rede.sarelli.com';
          await supabaseAdmin.auth.admin.updateUserById(auth_user_id, { email: newEmail });
        }
      }

      if (novo_municipio_id) {
        updates.municipio_id = novo_municipio_id;
      }

      if (Object.keys(updates).length > 0) {
        await supabaseAdmin.from('hierarquia_usuarios').update(updates).eq('id', hierarquia_id);
      }

      if (nova_senha) {
        if (!auth_user_id || auth_user_id.length !== 36) {
          return new Response(
            JSON.stringify({ error: 'Usuário sem conta de autenticação vinculada. Não é possível alterar a senha.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        const { error } = await supabaseAdmin.auth.admin.updateUserById(auth_user_id, { password: nova_senha });
        if (error) throw error;
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Usuário atualizado' }),
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
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
