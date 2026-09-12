import {
  Layers,
  IdCard,
  Trophy,
  Flag,
  Briefcase,
  MapPin,
  Store,
  ShoppingBag,
  Megaphone,
  ShieldCheck,
  Users,
  Newspaper,
  ClipboardList,
  Settings,
  Menu,
  X,
  LogOut,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  Layers,
  IdCard,
  Trophy,
  Flag,
  Briefcase,
  MapPin,
  Store,
  ShoppingBag,
  Megaphone,
  ShieldCheck,
  Users,
  Newspaper,
  ClipboardList,
  Settings,
  Menu,
  X,
  LogOut,
};

/** Icono generico por nombre (nav y categorias de noticia comparten este mapa unico). */
export function Icon({ name, className = "h-4 w-4" }: { name: string; className?: string }) {
  const IconComponent = ICONS[name] ?? Megaphone;
  return <IconComponent className={className} aria-hidden="true" />;
}
