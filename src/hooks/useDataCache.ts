import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCidade } from '@/contexts/CidadeContext';
import { useMemo, useCallback } from 'react';

/* ── Query keys ── */
const keys = {
  liderancas: (munId: string | null, userId: string | null, isAdmin: boolean) =>
    ['liderancas', munId, isAdmin ? 'all' : userId] as const,
  fiscais: (munId: string | null, userId: string | null, isAdmin: boolean) =>
    ['fiscais', munId, isAdmin ? 'all' : userId] as const,
  eleitores: (munId: string | null, userId: string | null, isAdmin: boolean) =>
    ['eleitores', munId, isAdmin ? 'all' : userId] as const,
  usuarios: () => ['hierarquia_usuarios'] as const,
  contagens: (munId: string | null) => ['contagens', munId] as const,
};

/* ── Shared filter logic ── */
function useFiltroMunicipio() {
  const { tipoUsuario, municipioId: authMunicipioId } = useAuth();
  const { cidadeAtiva, isTodasCidades } = useCidade();

  return useMemo(() => {
    if (tipoUsuario === 'super_admin' || tipoUsuario === 'coordenador') {
      return isTodasCidades ? null : cidadeAtiva?.id || null;
    }
    return authMunicipioId;
  }, [tipoUsuario, isTodasCidades, cidadeAtiva, authMunicipioId]);
}

/* ── Contagens rápidas (HEAD only) ── */
export function useContagens() {
  const filtroMunicipioId = useFiltroMunicipio();

  return useQuery({
    queryKey: keys.contagens(filtroMunicipioId),
    queryFn: async () => {
      const buildQuery = (table: string) => {
        let q = (supabase as any).from(table).select('id', { count: 'exact', head: true });
        if (filtroMunicipioId) q = q.eq('municipio_id', filtroMunicipioId);
        return q;
      };

      const [l, f, e] = await Promise.all([
        buildQuery('liderancas'),
        buildQuery('fiscais'),
        buildQuery('possiveis_eleitores'),
      ]);

      return {
        liderancas: l.count ?? 0,
        fiscais: f.count ?? 0,
        eleitores: e.count ?? 0,
        total: (l.count ?? 0) + (f.count ?? 0) + (e.count ?? 0),
      };
    },
    staleTime: 2 * 60 * 1000, // 2 min
    gcTime: 10 * 60 * 1000,
  });
}

/* ── Lideranças ── */
const QUERY_LID = 'id, status, tipo_lideranca, zona_atuacao, apoiadores_estimados, cadastrado_por, criado_em, municipio_id, origem_captacao, regiao_atuacao, bairros_influencia, comunidades_influencia, meta_votos, nivel_comprometimento, observacoes, nivel, suplente_id, pessoas(nome, cpf, telefone, whatsapp, email, instagram, facebook, titulo_eleitor, zona_eleitoral, secao_eleitoral, municipio_eleitoral, uf_eleitoral, colegio_eleitoral, endereco_colegio, situacao_titulo), hierarquia_usuarios!liderancas_cadastrado_por_fkey(nome)';

export function useLiderancas() {
  const { usuario, tipoUsuario } = useAuth();
  const filtroMunicipioId = useFiltroMunicipio();
  const isAdmin = tipoUsuario === 'super_admin' || tipoUsuario === 'coordenador';

  return useQuery({
    queryKey: keys.liderancas(filtroMunicipioId, usuario?.id || null, isAdmin),
    queryFn: async () => {
      let q = (supabase as any)
        .from('liderancas')
        .select(QUERY_LID)
        .order('criado_em', { ascending: false })
        .limit(500);

      if (filtroMunicipioId) q = q.eq('municipio_id', filtroMunicipioId);
      if (!isAdmin && usuario) q = q.eq('cadastrado_por', usuario.id);

      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: !!usuario,
    staleTime: 60 * 1000, // 1 min - show cached data instantly
    gcTime: 10 * 60 * 1000,
  });
}

/* ── Fiscais ── */
const QUERY_FISC = 'id, status, colegio_eleitoral, zona_fiscal, secao_fiscal, cadastrado_por, criado_em, municipio_id, origem_captacao, suplente_id, lideranca_id, observacoes, pessoas(nome, cpf, telefone, whatsapp, email, instagram, facebook, titulo_eleitor, zona_eleitoral, secao_eleitoral, municipio_eleitoral, uf_eleitoral, colegio_eleitoral, endereco_colegio, situacao_titulo), hierarquia_usuarios!fiscais_cadastrado_por_fkey(nome)';

export function useFiscais() {
  const { usuario, tipoUsuario } = useAuth();
  const filtroMunicipioId = useFiltroMunicipio();
  const isAdmin = tipoUsuario === 'super_admin' || tipoUsuario === 'coordenador';

  return useQuery({
    queryKey: keys.fiscais(filtroMunicipioId, usuario?.id || null, isAdmin),
    queryFn: async () => {
      let q = (supabase as any)
        .from('fiscais')
        .select(QUERY_FISC)
        .order('criado_em', { ascending: false })
        .limit(500);

      if (filtroMunicipioId) q = q.eq('municipio_id', filtroMunicipioId);
      if (!isAdmin && usuario) q = q.eq('cadastrado_por', usuario.id);

      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: !!usuario,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

/* ── Eleitores ── */
const QUERY_ELE = 'id, compromisso_voto, lideranca_id, fiscal_id, cadastrado_por, criado_em, municipio_id, origem_captacao, suplente_id, observacoes, pessoas(nome, cpf, telefone, whatsapp, email, instagram, facebook, titulo_eleitor, zona_eleitoral, secao_eleitoral, municipio_eleitoral, uf_eleitoral, colegio_eleitoral, endereco_colegio, situacao_titulo), liderancas:lideranca_id(id, pessoas(nome)), fiscais:fiscal_id(id, pessoas(nome)), hierarquia_usuarios!possiveis_eleitores_cadastrado_por_fkey(nome)';

export function useEleitores() {
  const { usuario, tipoUsuario } = useAuth();
  const filtroMunicipioId = useFiltroMunicipio();
  const isAdmin = tipoUsuario === 'super_admin' || tipoUsuario === 'coordenador';

  return useQuery({
    queryKey: keys.eleitores(filtroMunicipioId, usuario?.id || null, isAdmin),
    queryFn: async () => {
      let q = (supabase as any)
        .from('possiveis_eleitores')
        .select(QUERY_ELE)
        .order('criado_em', { ascending: false })
        .limit(500);

      if (filtroMunicipioId) q = q.eq('municipio_id', filtroMunicipioId);
      if (!isAdmin && usuario) q = q.eq('cadastrado_por', usuario.id);

      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: !!usuario,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

/* ── Usuários da hierarquia ── */
export function useUsuarios() {
  return useQuery({
    queryKey: keys.usuarios(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hierarquia_usuarios')
        .select('id, nome, tipo, suplente_id, municipio_id, ativo')
        .eq('ativo', true)
        .order('nome');
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
}

/* ── Invalidação centralizada ── */
export function useInvalidarCadastros() {
  const qc = useQueryClient();
  return useCallback(() => {
    qc.invalidateQueries({ queryKey: ['liderancas'] });
    qc.invalidateQueries({ queryKey: ['fiscais'] });
    qc.invalidateQueries({ queryKey: ['eleitores'] });
    qc.invalidateQueries({ queryKey: ['contagens'] });
  }, [qc]);
}
