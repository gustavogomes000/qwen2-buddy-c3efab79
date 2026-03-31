const statusColors: Record<string, string> = {
  'Ativa': 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  'Potencial': 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  'Em negociação': 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  'Fraca': 'bg-gray-500/15 text-gray-500',
  'Descartada': 'bg-red-500/10 text-red-400',
};

export default function StatusBadge({ status }: { status: string }) {
  const colors = statusColors[status] || statusColors['Fraca'];
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide ${colors}`}>
      {status}
    </span>
  );
}
