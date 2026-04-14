import { useQuery, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCidade } from '@/contexts/CidadeContext';
import { useMemo, useCallback, useEffect, useRef } from 'react';

const PAGE_SIZE = 200;
const STALE_TIME = 60_000;
const GC_TIME = 15 * 60 * 1000;

/* ── Query keys ── */
const keys = {
  liderancas: (munId: string | null, scope: string) =>
    ['liderancas', munId, scope] as const,
  eleitores: (munId: string | null, scope: string) =>
    ['eleitores', munId, scope] as const,
  usuarios: () => ['hierarquia_usuarios'] as const,
  contagens: (munId: string | null) => ['contagens', munId] as const,
  fiscais: (munId: string | null, scope: string) =>
    ['fiscais', munId, scope] as const,
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

      const [l, e] = await Promise.all([
        buildQuery('liderancas'),
        buildQuery('possiveis_eleitores'),
      ]);

      return {
        liderancas: l.count ?? 0,
        eleitores: e.count ?? 0,
        total: (l.count ?? 0) + (e.count ?? 0),
      };
    },
    staleTime: 60_000,
    gcTime: GC_TIME,
  });
}

function applyScopeFilter(
  q: any,
  scope: 'own' | 'all',
  isAdmin: boolean,
  usuario: { id: string; suplente_id: string | null } | null,
  _table: 'liderancas' | 'possiveis_eleitores'
) {
  if (!usuario) return q;
  if (scope === 'own') {
    if (usuario.suplente_id) {
      q = q.or(`cadastrado_por.eq.${usuario.id},suplente_id.eq.${usuario.suplente_id}`);
    } else {
      q = q.eq('cadastrado_por', usuario.id);
    }
  } else {
    if (!isAdmin) {
      if (usuario.suplente_id) {
        q = q.or(`cadastrado_por.eq.${usuario.id},suplente_id.eq.${usuario.suplente_id}`);
      } else {
        q = q.eq('cadastrado_por', usuario.id);
      }
    }
  }
  return q;
}

/**
 * Paginated fetch: loads PAGE_SIZE rows at a time.
 * Returns { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage, totalCount }
 * `data` is already flattened into a single array for backward compatibility.
 */
function usePaginatedData(config: {
  queryKey: readonly unknown[];
  table: string;
  select: string;
  enabled: boolean;
  applyFilters: (q: any) => any;
}) {
  const query = useInfiniteQuery({
    queryKey: config.queryKey,
    queryFn: async ({ pageParam = 0 }) => {
      let q = (supabase as any)
        .from(config.table)
        .select(config.select, { count: 'exact' })
        .order('criado_em', { ascending: false })
        .range(pageParam, pageParam + PAGE_SIZE - 1);

      q = config.applyFilters(q);

      const { data, error, count } = await q;
      if (error) throw error;
      return {
        rows: data || [],
        nextOffset: (data?.length || 0) < PAGE_SIZE ? undefined : pageParam + PAGE_SIZE,
        totalCount: count ?? 0,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextOffset,
    initialPageParam: 0,
    enabled: config.enabled,
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    refetchOnMount: false,
    refetchOnReconnect: 'always',
  });

  // Flatten pages for backward-compatible `data` as array
  const flatData = useMemo(() => {
    if (!query.data) return [];
    return query.data.pages.flatMap(p => p.rows);
  }, [query.data]);

  const totalCount = query.data?.pages[0]?.totalCount ?? 0;

  return {
    data: flatData,
    isLoading: query.isLoading,
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    totalCount,
    refetch: query.refetch,
  };
}

/* ── Lideranças ── */
const QUERY_LID = 'id, status, tipo_lideranca, zona_atuacao, apoiadores_estimados, cadastrado_por, criado_em, municipio_id, origem_captacao, regiao_atuacao, bairros_influencia, comunidades_influencia, meta_votos, nivel_comprometimento, observacoes, nivel, suplente_id, pessoas(nome, cpf, telefone, whatsapp, email, instagram, facebook, titulo_eleitor, zona_eleitoral, secao_eleitoral, municipio_eleitoral, uf_eleitoral, colegio_eleitoral, endereco_colegio, situacao_titulo), hierarquia_usuarios!liderancas_cadastrado_por_fkey(nome), suplentes:suplente_id(nome, cargo_disputado)';

export function useLiderancas(scope: 'own' | 'all' = 'own') {
  const { usuario, tipoUsuario } = useAuth();
  const filtroMunicipioId = useFiltroMunicipio();
  const isAdmin = tipoUsuario === 'super_admin' || tipoUsuario === 'coordenador';
  const scopeKey = scope === 'all' ? 'all' : (isAdmin && usuario?.suplente_id ? `sup-${usuario.suplente_id}` : usuario?.id || 'none');

  return usePaginatedData({
    queryKey: keys.liderancas(filtroMunicipioId, scopeKey),
    table: 'liderancas',
    select: QUERY_LID,
    enabled: !!usuario,
    applyFilters: (q: any) => {
      if (scope === 'all' && filtroMunicipioId) q = q.or(`municipio_id.eq.${filtroMunicipioId},municipio_id.is.null`);
      return applyScopeFilter(q, scope, isAdmin, usuario, 'liderancas');
    },
  });
}


/* ── Eleitores ── */
const QUERY_ELE = 'id, compromisso_voto, lideranca_id, cadastrado_por, criado_em, municipio_id, origem_captacao, suplente_id, observacoes, pessoas(nome, cpf, telefone, whatsapp, email, instagram, facebook, titulo_eleitor, zona_eleitoral, secao_eleitoral, municipio_eleitoral, uf_eleitoral, colegio_eleitoral, endereco_colegio, situacao_titulo), liderancas:lideranca_id(id, pessoas(nome)), hierarquia_usuarios!possiveis_eleitores_cadastrado_por_fkey(nome), suplentes:suplente_id(nome, cargo_disputado)';

export function useEleitores(scope: 'own' | 'all' = 'own') {
  const { usuario, tipoUsuario } = useAuth();
  const filtroMunicipioId = useFiltroMunicipio();
  const isAdmin = tipoUsuario === 'super_admin' || tipoUsuario === 'coordenador';
  const scopeKey = scope === 'all' ? 'all' : (isAdmin && usuario?.suplente_id ? `sup-${usuario.suplente_id}` : usuario?.id || 'none');

  return usePaginatedData({
    queryKey: keys.eleitores(filtroMunicipioId, scopeKey),
    table: 'possiveis_eleitores',
    select: QUERY_ELE,
    enabled: !!usuario,
    applyFilters: (q: any) => {
      if (scope === 'all' && filtroMunicipioId) q = q.or(`municipio_id.eq.${filtroMunicipioId},municipio_id.is.null`);
      return applyScopeFilter(q, scope, isAdmin, usuario, 'possiveis_eleitores');
    },
  });
}


/* ── Fiscais ── */
const QUERY_FIS = 'id, status, zona_fiscal, secao_fiscal, colegio_eleitoral, cadastrado_por, suplente_id, criado_em, observacoes, origem_captacao, municipio_id, lideranca_id, pessoas(nome, cpf, telefone, whatsapp, email, instagram, facebook, titulo_eleitor, zona_eleitoral, secao_eleitoral, municipio_eleitoral, uf_eleitoral, colegio_eleitoral, endereco_colegio, situacao_titulo), hierarquia_usuarios!fiscais_cadastrado_por_fkey(nome), liderancas:lideranca_id(id, pessoas(nome)), suplentes:suplente_id(nome, cargo_disputado)';

export function useFiscaisAdmin() {
  const { usuario, tipoUsuario } = useAuth();
  const filtroMunicipioId = useFiltroMunicipio();
  const isAdmin = tipoUsuario === 'super_admin' || tipoUsuario === 'coordenador';

  return usePaginatedData({
    queryKey: keys.fiscais(filtroMunicipioId, 'all'),
    table: 'fiscais',
    select: QUERY_FIS,
    enabled: !!usuario,
    applyFilters: (q: any) => {
      if (filtroMunicipioId) q = q.or(`municipio_id.eq.${filtroMunicipioId},municipio_id.is.null`);
      if (!isAdmin) {
        if (usuario?.suplente_id) {
          q = q.or(`cadastrado_por.eq.${usuario.id},suplente_id.eq.${usuario.suplente_id}`);
        } else {
          q = q.eq('cadastrado_por', usuario?.id);
        }
      }
      return q;
    },
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
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  });
}

/* ── Invalidação centralizada ── */
export function useInvalidarCadastros() {
  const qc = useQueryClient();
  return useCallback(() => {
    qc.invalidateQueries({ queryKey: ['liderancas'] });
    qc.invalidateQueries({ queryKey: ['eleitores'] });
    qc.invalidateQueries({ queryKey: ['fiscais'] });
    qc.invalidateQueries({ queryKey: ['contagens'] });
  }, [qc]);
}

/* ── Realtime: only for admins, with debounce ── */
export function useRealtimeSync() {
  const invalidar = useInvalidarCadastros();
  const { tipoUsuario, municipioId } = useAuth();
  const isAdmin = tipoUsuario === 'super_admin' || tipoUsuario === 'coordenador';
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedInvalidar = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => invalidar(), 500);
  }, [invalidar]);

  useEffect(() => {
    // Non-admins: skip Realtime, rely on staleTime + manual refetch
    if (!isAdmin) {
      console.log('[Realtime] Skipped — non-admin user');
      return;
    }

    const channelName = municipioId
      ? `cadastros-rt-${municipioId}`
      : 'cadastros-rt-global';

    console.log(`[Realtime] Subscribing: ${channelName}`);

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'liderancas' }, () => debouncedInvalidar())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'possiveis_eleitores' }, () => debouncedInvalidar())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fiscais' }, () => debouncedInvalidar())
      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [isAdmin, municipioId, debouncedInvalidar]);
}
