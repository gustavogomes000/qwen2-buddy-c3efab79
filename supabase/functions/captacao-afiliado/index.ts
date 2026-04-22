import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'npm:zod@3.25.76';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// GET ?token=...&tipo=lideranca|fiscal|eleitor|fernanda|afiliado
//   → retorna { ok, afiliado_nome, afiliado_tipo, is_ativo, link_tipo }
// POST { token, tipo, ...campos } → grava no destino correto

const tipoLink = z.enum(['lideranca', 'fiscal', 'eleitor', 'fernanda', 'afiliado']).optional().nullable();

const postSchema = z.object({
  token: z.string().min(6).max(128),
  tipo: tipoLink,
  // Pessoais
  nome: z.string().trim().min(2).max(120),
  cpf: z.string().trim().max(20).optional().nullable(),
  telefone: z.string().trim().min(6).max(40),
  whatsapp: z.string().trim().max(40).optional().nullable(),
  email: z.string().trim().max(200).optional().nullable(),
  data_nascimento: z.string().optional().nullable(),
  cep: z.string().trim().max(20).optional().nullable(),
  cidade: z.string().trim().max(120).optional().nullable(),
  uf: z.string().trim().max(4).optional().nullable(),
  endereco: z.string().trim().max(300).optional().nullable(),
  instagram: z.string().trim().max(120).optional().nullable(),
  facebook: z.string().trim().max(120).optional().nullable(),
  rede_social: z.string().trim().max(200).optional().nullable(),
  // Eleitorais
  titulo_eleitor: z.string().trim().max(40).optional().nullable(),
  zona_eleitoral: z.string().trim().max(20).optional().nullable(),
  secao_eleitoral: z.string().trim().max(20).optional().nullable(),
  municipio_eleitoral: z.string().trim().max(120).optional().nullable(),
  uf_eleitoral: z.string().trim().max(4).optional().nullable(),
  colegio_eleitoral: z.string().trim().max(200).optional().nullable(),
  // Específicos
  nivel_comprometimento: z.string().trim().max(60).optional().nullable(), // liderança
  apoiadores_estimados: z.coerce.number().int().nonnegative().optional().nullable(), // liderança
  bairros_influencia: z.string().trim().max(300).optional().nullable(), // liderança
  compromisso_voto: z.string().trim().max(60).optional().nullable(), // eleitor
  observacoes: z.string().trim().max(500).optional().nullable(),
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

async function buscarAfiliado(supabaseAdmin: any, token: string) {
  let query = supabaseAdmin
    .from('hierarquia_usuarios')
    .select('id, nome, tipo, auth_user_id, ativo, municipio_id, suplente_id');
  if (token.length >= 32) query = query.eq('link_token', token);
  else query = query.like('link_token', `${token}%`).limit(1);
  const { data: rows, error } = await query;
  const data = Array.isArray(rows) ? rows[0] : rows;
  return { data, error };
}

function jres(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
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
      if (!token || token.length < 6) return jres({ error: 'Token inválido' }, 400);
      const { data, error } = await buscarAfiliado(supabaseAdmin, token);
      if (error || !data) return jres({ error: 'Link inválido' }, 404);
      return jres({
        ok: true,
        afiliado_nome: (data as any).nome,
        afiliado_tipo: (data as any).tipo,
        is_ativo: !!(data as any).auth_user_id,
      });
    }

    if (req.method !== 'POST') return jres({ error: 'Método não suportado' }, 405);

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'anon';
    if (rateLimited(ip)) return jres({ error: 'Muitas tentativas. Aguarde alguns segundos.' }, 429);

    const parsed = postSchema.safeParse(await req.json());
    if (!parsed.success) return jres({ error: parsed.error.flatten().fieldErrors }, 400);
    const p = parsed.data;

    // Localizar afiliado dono do link
    const { data: afRow, error: afErr } = await buscarAfiliado(supabaseAdmin, p.token);
    const afiliado: any = afRow;
    if (afErr || !afiliado || !afiliado.auth_user_id) {
      return jres({ error: 'Link inválido ou ainda não ativado' }, 404);
    }

    const tipoDestino = p.tipo || 'lideranca';
    const whatsappFinal = (p.whatsapp?.trim() || p.telefone?.trim() || '').trim();

    // ─── FERNANDA ──────────────────────────────────────────────────────────
    if (tipoDestino === 'fernanda') {
      const { error: insErr } = await supabaseAdmin.from('cadastros_fernanda').insert({
        nome: p.nome.trim(),
        telefone: whatsappFinal,
        cidade: p.cidade?.trim() || null,
        instagram: p.instagram?.trim() || null,
        cadastrado_por: afiliado.id,
      });
      if (insErr) {
        console.error('cadastros_fernanda insert error:', insErr);
        return jres({ error: 'Erro ao salvar cadastro' }, 500);
      }
      return jres({ ok: true, redirect_url: 'https://www.instagram.com/drafernandasarelli/' });
    }

    // ─── AFILIADO (cadastro genérico simples) ──────────────────────────────
    if (tipoDestino === 'afiliado') {
      const { error: insErr } = await supabaseAdmin.from('cadastros_afiliados').insert({
        afiliado_id: afiliado.id,
        nome: p.nome.trim(),
        telefone: whatsappFinal,
        data_nascimento: p.data_nascimento || null,
        cep: p.cep?.trim() || null,
        rede_social: p.rede_social?.trim() || p.instagram?.trim() || null,
        origem: 'link_publico',
      });
      if (insErr) {
        console.error('cadastros_afiliados insert error:', insErr);
        return jres({ error: 'Erro ao salvar cadastro' }, 500);
      }
      return jres({ ok: true, redirect_url: 'https://www.instagram.com/drafernandasarelli/' });
    }

    // ─── LIDERANÇA / FISCAL / ELEITOR ──────────────────────────────────────
    // Cria pessoa + registro no módulo correspondente
    const observacoes = [
      p.observacoes?.trim(),
      p.cep?.trim() ? `CEP: ${p.cep.trim()}` : null,
      p.endereco?.trim() ? `End.: ${p.endereco.trim()}` : null,
    ].filter(Boolean).join(' | ') || null;

    const { data: pessoa, error: pessoaErr } = await supabaseAdmin
      .from('pessoas')
      .insert({
        nome: p.nome.trim(),
        cpf: p.cpf?.trim() || null,
        telefone: whatsappFinal,
        whatsapp: whatsappFinal,
        email: p.email?.trim() || null,
        data_nascimento: p.data_nascimento || null,
        instagram: p.instagram?.trim() || null,
        facebook: p.facebook?.trim() || null,
        titulo_eleitor: p.titulo_eleitor?.trim() || null,
        zona_eleitoral: p.zona_eleitoral?.trim() || null,
        secao_eleitoral: p.secao_eleitoral?.trim() || null,
        municipio_eleitoral: p.municipio_eleitoral?.trim() || p.cidade?.trim() || null,
        uf_eleitoral: p.uf_eleitoral?.trim() || p.uf?.trim() || null,
        colegio_eleitoral: p.colegio_eleitoral?.trim() || null,
        observacoes_gerais: observacoes,
        origem: `link_publico_${tipoDestino}`,
      })
      .select('id')
      .maybeSingle();

    if (pessoaErr || !pessoa?.id) {
      console.error('pessoas insert error:', pessoaErr);
      return jres({ error: 'Erro ao salvar dados pessoais' }, 500);
    }

    if (tipoDestino === 'lideranca') {
      const { error } = await supabaseAdmin.from('liderancas').insert({
        pessoa_id: pessoa.id,
        cadastrado_por: afiliado.id,
        municipio_id: afiliado.municipio_id || null,
        suplente_id: afiliado.suplente_id || null,
        nivel_comprometimento: p.nivel_comprometimento?.trim() || null,
        apoiadores_estimados: p.apoiadores_estimados ?? null,
        bairros_influencia: p.bairros_influencia?.trim() || null,
        origem_captacao: 'link_publico',
        status: 'Ativa',
      });
      if (error) {
        console.error('liderancas insert error:', error);
        return jres({ error: 'Erro ao salvar liderança' }, 500);
      }
    } else if (tipoDestino === 'fiscal') {
      const { error } = await supabaseAdmin.from('fiscais').insert({
        pessoa_id: pessoa.id,
        cadastrado_por: afiliado.id,
        municipio_id: afiliado.municipio_id || null,
        suplente_id: afiliado.suplente_id || null,
        zona_fiscal: p.zona_eleitoral?.trim() || null,
        secao_fiscal: p.secao_eleitoral?.trim() || null,
        colegio_eleitoral: p.colegio_eleitoral?.trim() || null,
        origem_captacao: 'link_publico',
        status: 'Ativo',
      });
      if (error) {
        console.error('fiscais insert error:', error);
        return jres({ error: 'Erro ao salvar fiscal' }, 500);
      }
    } else if (tipoDestino === 'eleitor') {
      const { error } = await supabaseAdmin.from('possiveis_eleitores').insert({
        pessoa_id: pessoa.id,
        cadastrado_por: afiliado.id,
        municipio_id: afiliado.municipio_id || null,
        suplente_id: afiliado.suplente_id || null,
        compromisso_voto: p.compromisso_voto?.trim() || null,
        observacoes: p.observacoes?.trim() || null,
        origem_captacao: 'link_publico',
      });
      if (error) {
        console.error('possiveis_eleitores insert error:', error);
        return jres({ error: 'Erro ao salvar eleitor' }, 500);
      }
    }

    return jres({ ok: true, redirect_url: 'https://www.instagram.com/drafernandasarelli/' });
  } catch (err) {
    console.error('Erro:', err);
    return jres({ error: 'Erro interno' }, 500);
  }
});