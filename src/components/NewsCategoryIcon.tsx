import { Icon } from "@/components/Icon";

export function NewsCategoryIcon({ icon, className = "h-4 w-4" }: { icon: string; className?: string }) {
  return <Icon name={icon} className={className} />;
}
