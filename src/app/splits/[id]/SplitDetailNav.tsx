export interface SplitDetailNavItem {
  href: string;
  label: string;
}

/**
 * Indice de secciones del detalle del split. En escritorio (`lg` o
 * superior) queda como una barra lateral estrecha y `sticky`; en
 * movil/tablet se convierte en una lista compacta al principio de la
 * pagina, sin restar ancho al contenido. Son anclas HTML normales: no hay
 * deteccion de seccion activa ni JavaScript adicional.
 */
export function SplitDetailNav({ items }: { items: SplitDetailNavItem[] }) {
  return (
    <nav aria-label="Secciones del split" className="mb-6 lg:sticky lg:top-6 lg:mb-0 lg:self-start">
      <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm lg:flex-col lg:gap-y-1 lg:border-r lg:border-slate-200 lg:pr-4">
        {items.map((item) => (
          <li key={item.href}>
            <a href={item.href} className="text-slate-600 underline hover:text-slate-900">
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
