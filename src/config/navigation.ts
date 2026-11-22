import {
  FileText,
  Home,
  LineChart,
  Mic,
  User,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Home", href: "/dashboard", icon: Home },
  { label: "Log", href: "/log", icon: Mic },
  { label: "Insights", href: "/insights", icon: LineChart },
  { label: "Reports", href: "/reports", icon: FileText },
  { label: "Profile", href: "/profile", icon: User },
];
