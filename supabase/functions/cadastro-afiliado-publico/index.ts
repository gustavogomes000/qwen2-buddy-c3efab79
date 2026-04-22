import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'npm:zod@3.25.76';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const bodySchema = z.object({
  token: z.string().min(8).max(128),
  // Dados pessoais
  nome: z.string().trim().min(2).max(120),
  cpf: z.string().trim().max(20).optional().nullable(),
  telefone: z.string().trim().min(6).max(40),
  whatsapp: z.string().trim().max(40).optional().nullable(),
  email: z.string().trim().max(200).optional().nullable(),
  data_nascimento: z.string().optional().nullable(),
  cep: z.string().trim().max(20).optional().nullable(),
  instagram: z.string().trim().max(120).optional().nullable(),
  facebook: z.string().trim().max(120).optional().nullable(),
  // Dados eleitorais
  titulo_eleitor: z.string().trim().max(40).optional().nullable(),
  zona_eleitoral: z.string().trim().max(20).optional().nullable(),
  secao_eleitoral: z.string().trim().max(20).optional().nullable(),
  municipio_eleitoral: z.string().trim().max(120).optional().nullable(),
  uf_eleitoral: z.string().trim().max(4).optional().nullable(),
  colegio_eleitoral: z.string().trim().max(200).optional().nullable(),
  // Login
  usuario_login: z.string().trim().min(3).max(60),
  senha: z.string().min(6).max(72),
});

// Rate-limit em memória (best-effort por instância)
const recent = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 8;
function rateLimited(ip: string) {
  const now = Date.now();
  const arr = (recent.get(ip) || []).filter(t => now - t < WINDOW_MS);
  arr.push(now);
  recent.set(ip, arr);
  return arr.length > MAX_PER_WINDOW;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'anon';
    if (rateLimited(ip)) {
      return new Response(JSON.stringify({ error: 'Muitas tentativas. Aguarde alguns segundos.' }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const p = parsed.data;
    const { token } = p;

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 1) Validar token → registro pendente do afiliado
    const { data: pendente, error: pendErr } = await supabaseAdmin
      .from('hierarquia_usuarios')
      .select('id, nome, tipo, ativo, auth_user_id, superior_id, municipio_id')
      .eq('link_token', token)
      .maybeSingle();

    if (pendErr || !pendente || (pendente as any).tipo !== 'afiliado') {
      return new Response(JSON.stringify({ error: 'Link inválido ou expirado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Se já tem auth_user_id, link já foi usado
    if ((pendente as any).auth_user_id) {
      return new Response(JSON.stringify({ error: 'Este link já foi utilizado. Faça login no sistema.' }), {
        status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2) Criar auth user
    const loginSlug = p.usuario_login.toLowerCase().trim().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '');
    if (!loginSlug || loginSlug.length < 3) {
      return new Response(JSON.stringify({ error: 'Usuário inválido (use letras/números, sem espaços)' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const email = `${loginSlug}@rede.sarelli.com`;

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: p.senha,
      email_confirm: true,
      user_metadata: { name: p.nome, role: 'afiliado' },
    });

    if (authError || !authData?.user?.id) {
      const msg = authError?.message?.includes('already')
        ? 'Esse usuário já existe. Escolha outro nome de login.'
        : (authError?.message || 'Não foi possível criar o login');
      return new Response(JSON.stringify({ error: msg }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const authUserId = authData.user.id;

    // 3) Criar registro em pessoas com TODOS os dados
    const { data: pessoaIns, error: pessoaErr } = await supabaseAdmin
      .from('pessoas')
      .insert({
        nome: p.nome.trim(),
        cpf: p.cpf?.trim() || null,
        telefone: p.telefone.trim(),
        whatsapp: p.whatsapp?.trim() || p.telefone.trim(),
        email: p.email?.trim() || null,
        data_nascimento: p.data_nascimento || null,
        instagram: p.instagram?.trim() || null,
        facebook: p.facebook?.trim() || null,
        titulo_eleitor: p.titulo_eleitor?.trim() || null,
        zona_eleitoral: p.zona_eleitoral?.trim() || null,
        secao_eleitoral: p.secao_eleitoral?.trim() || null,
        municipio_eleitoral: p.municipio_eleitoral?.trim() || null,
        uf_eleitoral: p.uf_eleitoral?.trim() || null,
        colegio_eleitoral: p.colegio_eleitoral?.trim() || null,
        origem: 'afiliado_link',
      })
      .select('id')
      .maybeSingle();

    if (pessoaErr) {
      console.error('Pessoa insert error:', pessoaErr);
      // rollback auth
      await supabaseAdmin.auth.admin.deleteUser(authUserId);
      return new Response(JSON.stringify({ error: 'Erro ao salvar dados pessoais' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4) Atualizar hierarquia: vincula auth_user_id, atualiza nome e zera token
    const { error: updErr } = await supabaseAdmin
      .from('hierarquia_usuarios')
      .update({
        auth_user_id: authUserId,
        nome: p.nome.trim(),
        ativo: true,
        link_token: null,
      })
      .eq('id', (pendente as any).id);

    if (updErr) {
      console.error('Hierarquia update error:', updErr);
      await supabaseAdmin.auth.admin.deleteUser(authUserId);
      return new Response(JSON.stringify({ error: 'Erro ao ativar acesso' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({ ok: true, login: loginSlug, hierarquia_id: (pendente as any).id, pessoa_id: pessoaIns?.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Error:', err);
    return new Response(JSON.stringify({ error: 'Erro interno' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});