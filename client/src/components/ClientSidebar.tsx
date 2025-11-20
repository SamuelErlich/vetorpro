import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { 
  Grid3x3, 
  Shield, 
  ImageOff, 
  Store, 
  User, 
  LogOut,
  Home,
  Package,
  CreditCard,
  Settings
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface ClientSidebarProps {
  userEmail?: string;
  activeServices: Array<{
    id: string;
    name: string;
    icon: React.ElementType;
    path: string;
    badge?: string;
  }>;
  onLogout: () => void;
}

export function ClientSidebar({ userEmail, activeServices, onLogout }: ClientSidebarProps) {
  const [location] = useLocation();

  // Main navigation items
  const mainNavItems = [
    {
      title: "Início",
      icon: Home,
      path: "/dashboard",
    },
    {
      title: "Serviços",
      icon: Store,
      path: "/services",
      badge: "Explorar",
    },
  ];

  // Footer navigation items
  const footerNavItems = [
    {
      title: "Pagamentos",
      icon: CreditCard,
      path: "/payments",
    },
    {
      title: "Conta",
      icon: Settings,
      path: "/account",
    },
  ];

  return (
    <Sidebar>
      <SidebarHeader className="border-b">
        <div className="flex items-center gap-2 px-4 py-3">
          <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center">
            <Shield className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">VectorPro</span>
            <span className="text-xs text-muted-foreground">Portal do Cliente</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton asChild isActive={location === item.path}>
                    <Link href={item.path}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                      {item.badge && (
                        <Badge variant="default" className="ml-auto h-5 px-1.5 text-[10px]">
                          {item.badge}
                        </Badge>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <Separator />

        {/* Active Services */}
        {activeServices.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Meus Serviços</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {activeServices.map((service) => (
                  <SidebarMenuItem key={service.id}>
                    <SidebarMenuButton asChild isActive={location === service.path}>
                      <Link href={service.path}>
                        <service.icon className="h-4 w-4" />
                        <span>{service.name}</span>
                        {service.badge && (
                          <Badge variant="secondary" className="ml-auto h-5 px-1.5 text-[10px]">
                            {service.badge}
                          </Badge>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Empty State */}
        {activeServices.length === 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Meus Serviços</SidebarGroupLabel>
            <SidebarGroupContent>
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                <Package className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p>Nenhum serviço ativo</p>
                <p className="text-xs mt-1">Explore os serviços para começar</p>
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {footerNavItems.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton asChild isActive={location === item.path}>
                    <Link href={item.path}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              <Separator className="my-2" />
              <SidebarMenuItem>
                <div className="px-3 py-2 text-xs text-muted-foreground truncate">
                  {userEmail}
                </div>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={onLogout}>
                  <LogOut className="h-4 w-4" />
                  <span>Sair</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarFooter>
    </Sidebar>
  );
}