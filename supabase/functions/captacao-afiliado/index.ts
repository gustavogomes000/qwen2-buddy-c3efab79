import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'npm:zod@3.25.76';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// GET ?token=...   → retorna info do afiliado dono do link (para renderizar a página)
// POST { token, nome, telefone, data_nascimento, cep, rede_social } → grava cadastro

const postSchema = z.object({
  token: z.string().min(8).max(128),
  nome: z.string().trim().min(2).max(120),
  telefone: z.string().trim().min(6).max(40),
  data_nascimento: z.string().optional().nullable(),
  cep: z.string().trim().max(20).optional().nullable(),
  rede_social: z.string().trim().max(200).optional().nullable(),
});

const recent = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX = 12;
function rateLimited(ip: string) {
  const now = Date.now();
  const arr = (recent.get(ip) || []).filter(t => now - t < WINDOW_MS);
  arr.push(now);
  recent.set(ip, arr);
  return arr.length > MAX;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const token = url.searchParams.get('token') || '';
      if (!token || token.length < 8) {
        return new Response(JSON.stringify({ error: 'Token inválido' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const { data, error } = await supabaseAdmin
        .from('hierarquia_usuarios')
        .select('id, nome, tipo, auth_user_id, ativo')
        .eq('link_token', token)
        .maybeSingle();
      if (error || !data) {
        return new Response(JSON.stringify({ error: 'Link inválido' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({
        ok: true,
        afiliado_nome: (data as any).nome,
        is_ativo: !!(data as any).auth_user_id,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (req.method === 'POST') {
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'anon';
      if (rateLimited(ip)) {
        return new Response(JSON.stringify({ error: 'Muitas tentativas. Aguarde alguns segundos.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const parsed = postSchema.safeParse(await req.json());
      if (!parsed.success) {
        return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const p = parsed.data;

      // Localizar afiliado dono do link
      const { data: afiliado, error: afErr } = await supabaseAdmin
        .from('hierarquia_usuarios')
        .select('id, tipo, auth_user_id')
        .eq('link_token', p.token)
        .maybeSingle();
      if (afErr || !afiliado || !(afiliado as any).auth_user_id) {
        return new Response(JSON.stringify({ error: 'Link inválido ou ainda não ativado' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { error: insErr } = await supabaseAdmin
        .from('cadastros_afiliados')
        .insert({
          afiliado_id: (afiliado as any).id,
          nome: p.nome.trim(),
          telefone: p.telefone.trim(),
          data_nascimento: p.data_nascimento || null,
          cep: p.cep?.trim() || null,
          rede_social: p.rede_social?.trim() || null,
          origem: 'link_publico',
        });
      if (insErr) {
        console.error('Insert error:', insErr);
        return new Response(JSON.stringify({ error: 'Erro ao salvar cadastro' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({
        ok: true,
        redirect_url: 'https://www.instagram.com/drafernandasarelli/',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Método não suportado' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Erro:', err);
    return new Response(JSON.stringify({ error: 'Erro interno' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});