import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'npm:zod@3.25.76';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const bodySchema = z.object({
  nome: z.string().trim().min(1, 'Nome é obrigatório').max(120, 'Nome muito longo'),
  senha: z.string().min(4, 'Senha deve ter ao menos 4 caracteres').max(72, 'Senha muito longa'),
  tipo: z.enum(['super_admin', 'coordenador', 'suplente', 'lideranca', 'fiscal', 'fernanda']).optional().default('suplente'),
  superior_id: z.string().uuid().nullable().optional(),
  suplente_id: z.string().uuid().nullable().optional(),
  municipio_id: z.string().uuid().nullable().optional(),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const parsed = bodySchema.safeParse(await req.json());

    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { nome, senha, tipo, superior_id, suplente_id, municipio_id } = parsed.data;

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Create email from nome
    const slug = nome.toLowerCase().trim().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '');

    if (!slug) {
      return new Response(
        JSON.stringify({ error: 'Nome inválido para criar login' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const email = `${slug}@rede.sarelli.com`;

    // Check if auth user already exists
    let authUserId: string | null = null;

    // Try to create user first, handle duplicate gracefully
    let existingUser: any = null;
    
    // Attempt creation first (faster path for new users)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: { name: nome, role: tipo },
    });

    if (authError) {
      if (authError.message?.includes('already been registered')) {
        // Find existing user by listing with filter
        const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1 });
        // Search by iterating (Supabase doesn't have email filter on listUsers)
        // Use a workaround: try to sign in or look up
        const { data: usersData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
        existingUser = usersData?.users?.find(u => u.email === email) || null;
        
        if (!existingUser) {
          return new Response(
            JSON.stringify({ error: 'Email já registrado mas não encontrado. Contate o administrador.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        console.error('Auth error:', authError);
        return new Response(
          JSON.stringify({ error: authError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (existingUser) {
      // Check if already linked in hierarquia
      const { data: existingHier } = await supabaseAdmin
        .from('hierarquia_usuarios')
        .select('id')
        .eq('auth_user_id', existingUser.id)
        .eq('ativo', true)
        .maybeSingle();

      if (existingHier) {
        return new Response(
          JSON.stringify({ error: `Usuário "${nome}" já possui acesso ativo no sistema` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Reuse existing auth user and update password
      await supabaseAdmin.auth.admin.updateUser(existingUser.id, {
        password: senha,
        email_confirm: true,
        user_metadata: { name: nome, role: tipo },
      });
      authUserId = existingUser.id;
    } else {
      // New user was already created above
      authUserId = authData?.user?.id || null;
    }

    if (!authUserId) {
      return new Response(
        JSON.stringify({ error: 'Usuário de autenticação não foi criado corretamente' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create hierarquia_usuarios record
    const { data: hierarquiaData, error: hierarquiaError } = await supabaseAdmin
      .from('hierarquia_usuarios')
      .insert({
        auth_user_id: authUserId,
        nome: nome.trim(),
        tipo,
        superior_id: superior_id || null,
        suplente_id: suplente_id || null,
        municipio_id: municipio_id || null,
      })
      .select('id')
      .single();

    if (hierarquiaError) {
      console.error('Hierarquia insert error:', hierarquiaError);
      // Rollback auth user
      await supabaseAdmin.auth.admin.deleteUser(authUserId);
      return new Response(
        JSON.stringify({ error: hierarquiaError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Usuário "${nome}" criado com sucesso`,
        hierarquia_id: hierarquiaData.id,
        auth_user_id: authUserId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno ao criar usuário' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
