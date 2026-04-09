const LIDERANCAS_MODULE = 'cadastrar_liderancas';
const ELEITORES_MODULE = 'cadastrar_eleitores';

export function getDefaultModulesForTipo(tipo: string) {
  if (tipo === 'suplente') {
    return new Set<string>([LIDERANCAS_MODULE]);
  }

  return new Set<string>();
}

export function toggleModuleSelection(current: Set<string>, modulo: string) {
  const next = new Set(current);

  if (next.has(modulo)) {
    next.delete(modulo);
    return next;
  }

  if (modulo === LIDERANCAS_MODULE) {
    next.delete(ELEITORES_MODULE);
  }

  if (modulo === ELEITORES_MODULE) {
    next.delete(LIDERANCAS_MODULE);
  }

  next.add(modulo);
  return next;
}