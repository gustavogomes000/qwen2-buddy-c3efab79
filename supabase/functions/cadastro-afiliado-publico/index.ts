import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'npm:zod@3.25.76';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const bodySchema = z.object({
  token: z.string().min(8).max(128),
  nome: z.string().trim().min(1).max(120),
  telefone: z.string().trim().min(6).max(40),
  data_nascimento: z.string().optional().nullable(),
  cep: z.string().trim().max(20).optional().nullable(),
  rede_social: z.string().trim().max(120).optional().nullable(),
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

    const { token, nome, telefone, data_nascimento, cep, rede_social } = parsed.data;

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Validar token → afiliado
    const { data: afiliado, error: afErr } = await supabaseAdmin
      .from('hierarquia_usuarios')
      .select('id, nome, tipo, ativo')
      .eq('link_token', token)
      .eq('ativo', true)
      .maybeSingle();

    if (afErr || !afiliado || (afiliado as any).tipo !== 'afiliado') {
      return new Response(JSON.stringify({ error: 'Link inválido ou expirado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { error: insErr } = await supabaseAdmin
      .from('cadastros_afiliados')
      .insert({
        afiliado_id: (afiliado as any).id,
        nome: nome.trim(),
        telefone: telefone.trim(),
        data_nascimento: data_nascimento || null,
        cep: cep?.trim() || null,
        rede_social: rede_social?.trim() || null,
        origem: 'link_publico',
      });

    if (insErr) {
      console.error('Insert error:', insErr);
      return new Response(JSON.stringify({ error: 'Não foi possível salvar o cadastro' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Buscar URL do Instagram configurada
    const { data: cfg } = await supabaseAdmin
      .from('configuracoes')
      .select('valor')
      .eq('chave', 'instagram_doutora_url')
      .maybeSingle();

    const instagram_url = (cfg as any)?.valor || 'https://instagram.com/deputadasarelli';

    return new Response(
      JSON.stringify({ ok: true, instagram_url, afiliado: (afiliado as any).nome }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Error:', err);
    return new Response(JSON.stringify({ error: 'Erro interno' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});