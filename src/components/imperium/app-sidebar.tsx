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
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, exact: true },
  { title: "Job Search", url: "/search", icon: Search },
  { title: "Jobs", url: "/jobs", icon: Briefcase },
  { title: "Applications", url: "/applications", icon: Send },
  { title: "Resume Studio", url: "/resume", icon: FileText },
  { title: "Cover Letters", url: "/cover-letters", icon: Mail },
  { title: "Autopilot", url: "/autopilot", icon: Bot },
  { title: "Interviews", url: "/interviews", icon: CalendarClock },
  { title: "Skill Gap", url: "/skills", icon: Target },
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
            <span className="imp-eyebrow">AI Job Agent</span>
          </div>
        </div>
      </SidebarHeader>


      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Platform</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {primaryNav.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url, item.exact)} tooltip={item.title}>
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={isActive("/settings")} tooltip="Settings">
              <Link to="/settings" className="flex items-center gap-2">
                <SettingsIcon className="h-4 w-4" />
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={signOut} tooltip={email || "Sign out"}>
              <LogOut className="h-4 w-4" />
              <span className="truncate">{email ? `Sign out (${email})` : "Sign out"}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
