import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Bot,
  Briefcase,
  CalendarClock,
  FileText,
  LayoutDashboard,
  LogOut,
  Mail,
  Search,
  Send,
  Settings as SettingsIcon,
  Target,
  UserCheck,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const primaryNav = [
  { title: "Dashboard", jp: "司令", url: "/dashboard", icon: LayoutDashboard, exact: true },
  { title: "Profile Preview", jp: "人物", url: "/profile-preview", icon: UserCheck },
  { title: "Job Search", jp: "探索", url: "/search", icon: Search },
  { title: "Jobs", jp: "業務", url: "/jobs", icon: Briefcase },
  { title: "Applications", jp: "応募", url: "/applications", icon: Send },
  { title: "Resume Studio", jp: "履歴", url: "/resume", icon: FileText },
  { title: "Cover Letters", jp: "信書", url: "/cover-letters", icon: Mail },
  { title: "Autopilot", jp: "自動", url: "/autopilot", icon: Bot },
  { title: "Interviews", jp: "面接", url: "/interviews", icon: CalendarClock },
  { title: "Skill Gap", jp: "鍛錬", url: "/skills", icon: Target },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const navigate = useNavigate();
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);

  const isActive = (url: string, exact?: boolean) =>
    exact ? pathname === url : pathname === url || pathname.startsWith(`${url}/`);

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) return toast.error(error.message);
    navigate({ to: "/auth", replace: true });
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2.5 px-1 py-2">
          <span className="imp-mark-sm" aria-hidden />
          <div className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="imp-display text-[13px] text-foreground">IMPERIUM</span>
            <span className="imp-eyebrow">帝国 · AI Job Agent</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="relative">
        {/* faint kanji watermark behind nav */}
        <span
          aria-hidden
          className="pointer-events-none absolute -right-2 top-10 select-none font-[Noto_Serif_JP] text-[7rem] font-extrabold leading-none text-white/[0.025] group-data-[collapsible=icon]:hidden"
        >
          帝
        </span>
        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center gap-2">
            <span>Platform</span>
            <span className="font-[Noto_Serif_JP] text-[10px] text-muted-foreground/70">壇上</span>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {primaryNav.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url, item.exact)} tooltip={`${item.title} · ${item.jp}`}>
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      <span className="flex min-w-0 flex-col leading-tight">
                        <span className="truncate">{item.title}</span>
                        <span className="imp-jp-label truncate group-data-[collapsible=icon]:hidden">{item.jp}</span>
                      </span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="imp-brush-divider mb-1 opacity-60 group-data-[collapsible=icon]:hidden" aria-hidden />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={isActive("/settings")} tooltip="Settings · 設定">
              <Link to="/settings" className="flex items-center gap-2">
                <SettingsIcon className="h-4 w-4" />
                <span className="flex min-w-0 flex-col leading-tight">
                  <span>Settings</span>
                  <span className="imp-jp-label group-data-[collapsible=icon]:hidden">設定</span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={signOut} tooltip={email || "Sign out · 退"}>
              <LogOut className="h-4 w-4" />
              <span className="truncate">{email ? `Sign out · 退 (${email})` : "Sign out · 退"}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
