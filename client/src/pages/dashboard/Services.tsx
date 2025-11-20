import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { 
  Grid3x3, 
  ImageOff, 
  Star,
  TrendingUp,
  Sparkles,
  Shield,
  Zap,
  Package,
  Search,
  AlertCircle,
  CheckCircle,
  ShoppingCart,
  Layers,
  Palette
} from "lucide-react";
import { useLocation } from "wouter";

// Service icon mapping
const serviceIcons: Record<string, any> = {
  "vectorizer-001": Grid3x3,
  "removebg-001": ImageOff,
  default: Package
};

// Category icon mapping
const categoryIcons: Record<string, any> = {
  "Todos": Package,
  "Produtividade": Zap,
  "Imagens": Palette,
  "Geral": Layers
};

interface Service {
  id: string;
  nome: string;
  descricao: string | null;
  preco: string;
  ativo: boolean;
  category: string;
  features: string[];
  isPopular: boolean;
  isHighlight: boolean;
}

interface Category {
  name: string;
  count: number;
}

export default function Services() {
  const [selectedCategory, setSelectedCategory] = useState("Todos");
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();
  const [, navigate] = useLocation();

  // Fetch services from API
  const { data: services = [], isLoading: servicesLoading } = useQuery<Service[]>({
    queryKey: ["/api/services"],
    staleTime: 1000 * 60 * 5 // Cache for 5 minutes
  });

  // Fetch categories from API
  const { data: categories = [], isLoading: categoriesLoading } = useQuery<Category[]>({
    queryKey: ["/api/services/categories"],
    staleTime: 1000 * 60 * 5 // Cache for 5 minutes
  });

  // Subscribe mutation
  const subscribeMutation = useMutation({
    mutationFn: (serviceId: string) => 
      apiRequest("/api/services/subscribe", {
        method: "POST",
        body: JSON.stringify({ serviceId })
      }),
    onSuccess: (data) => {
      toast({
        title: "Serviço adicionado!",
        description: data.message || "Efetue o pagamento para ativar o serviço.",
      });
      
      // Redirect to payment page
      if (data.redirect) {
        navigate(data.redirect);
      }
    },
    onError: (error: any) => {
      const message = error.message || "Erro ao adicionar serviço";
      
      // Check if user already has the service
      if (error.message?.includes("já possui")) {
        toast({
          title: "Serviço já contratado",
          description: message,
          variant: "default"
        });
        
        if (error.redirect) {
          navigate(error.redirect);
        }
      } else {
        toast({
          title: "Erro ao adicionar serviço",
          description: message,
          variant: "destructive"
        });
      }
    }
  });

  // Filter services based on category and search
  const filteredServices = useMemo(() => {
    return services.filter(service => {
      // Filter by active services only
      if (!service.ativo) return false;
      
      // Filter by category
      if (selectedCategory !== "Todos" && service.category !== selectedCategory) {
        return false;
      }
      
      // Filter by search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          service.nome.toLowerCase().includes(query) ||
          (service.descricao && service.descricao.toLowerCase().includes(query)) ||
          service.features.some(f => f.toLowerCase().includes(query))
        );
      }
      
      return true;
    });
  }, [services, selectedCategory, searchQuery]);

  // Handle service subscription
  const handleSubscribe = (serviceId: string) => {
    // Check if user is logged in
    const checkAuth = async () => {
      try {
        const response = await fetch("/api/auth/me");
        if (!response.ok) {
          toast({
            title: "Login necessário",
            description: "Faça login para contratar este serviço.",
            variant: "default"
          });
          navigate("/");
          return false;
        }
        return true;
      } catch {
        return false;
      }
    };

    checkAuth().then(isAuthenticated => {
      if (isAuthenticated) {
        subscribeMutation.mutate(serviceId);
      }
    });
  };

  // Get service-specific routing
  const getServicePath = (serviceId: string) => {
    if (serviceId === "removebg-001") {
      return "/removebg/plans";
    }
    return "/payment";
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Serviços</h1>
        <p className="text-muted-foreground">
          Explore e contrate novos serviços para turbinar sua produtividade
        </p>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          data-testid="input-search-services"
          placeholder="Buscar serviços..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Promotional Banner */}
      {services.some(s => s.isHighlight) && !searchQuery && (
        <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
          <CardContent className="flex items-center justify-between p-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-lg">Destaque do Mês</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                {services.find(s => s.isHighlight)?.descricao || "Confira nossos serviços em destaque!"}
              </p>
            </div>
            <Button 
              data-testid="button-view-highlights"
              onClick={() => {
                const highlightService = services.find(s => s.isHighlight);
                if (highlightService) {
                  navigate(getServicePath(highlightService.id));
                }
              }}
            >
              Ver Detalhes
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Category Filter */}
      {categoriesLoading ? (
        <div className="flex gap-2">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-9 w-32" />
          ))}
        </div>
      ) : (
        <div className="flex gap-2 pb-2 overflow-x-auto">
          {categories.map((category) => {
            const IconComponent = categoryIcons[category.name] || categoryIcons.default;
            return (
              <Button
                data-testid={`button-category-${category.name.toLowerCase()}`}
                key={category.name}
                variant={category.name === selectedCategory ? "default" : "outline"}
                size="sm"
                className="whitespace-nowrap"
                onClick={() => setSelectedCategory(category.name)}
              >
                <IconComponent className="h-4 w-4 mr-2" />
                {category.name}
                <Badge variant="secondary" className="ml-2 h-5 px-1">
                  {category.count}
                </Badge>
              </Button>
            );
          })}
        </div>
      )}

      {/* Services Grid */}
      {servicesLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-12 w-12 rounded-md mb-4" />
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-20 mt-2" />
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-8 w-24" />
                <div className="space-y-2">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredServices.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">
              {searchQuery ? "Nenhum serviço encontrado" : "Nenhum serviço disponível"}
            </h3>
            <p className="text-sm text-muted-foreground max-w-md">
              {searchQuery 
                ? "Tente ajustar sua busca ou explorar outras categorias."
                : "Novos serviços serão adicionados em breve. Fique atento!"}
            </p>
            {searchQuery && (
              <Button 
                data-testid="button-clear-search"
                variant="outline" 
                size="sm" 
                className="mt-4"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("Todos");
                }}
              >
                Limpar filtros
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredServices.map((service) => {
            const IconComponent = serviceIcons[service.id] || serviceIcons.default;
            
            return (
              <Card 
                data-testid={`card-service-${service.id}`}
                key={service.id} 
                className="relative overflow-hidden hover:shadow-lg transition-shadow"
              >
                {service.isPopular && (
                  <div className="absolute top-4 right-4 z-10">
                    <Badge variant="default" className="gap-1">
                      <Star className="h-3 w-3" />
                      Popular
                    </Badge>
                  </div>
                )}
                {service.isHighlight && (
                  <div className="absolute top-4 right-4 z-10">
                    <Badge className="gap-1 bg-gradient-to-r from-blue-600 to-purple-600 border-0">
                      <TrendingUp className="h-3 w-3" />
                      Destaque
                    </Badge>
                  </div>
                )}
                
                <CardHeader>
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <IconComponent className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg">{service.nome}</CardTitle>
                      <Badge variant="outline" className="mt-2 text-xs">
                        {service.category}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    {service.descricao || "Serviço profissional de alta qualidade"}
                  </p>
                  
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      {service.id === "removebg-001" ? "A partir de" : "Mensalidade"}
                    </p>
                    <p className="text-2xl font-bold">
                      R$ {service.preco}
                      <span className="text-sm font-normal text-muted-foreground">
                        {service.id === "removebg-001" ? "" : "/mês"}
                      </span>
                    </p>
                  </div>

                  {service.features.length > 0 && (
                    <ul className="space-y-1">
                      {service.features.slice(0, 3).map((feature, idx) => (
                        <li key={idx} className="flex items-center gap-2 text-sm">
                          <CheckCircle className="h-3 w-3 text-green-600 flex-shrink-0" />
                          <span className="text-muted-foreground">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  <Button 
                    data-testid={`button-subscribe-${service.id}`}
                    className="w-full" 
                    onClick={() => handleSubscribe(service.id)}
                    disabled={subscribeMutation.isPending}
                  >
                    {subscribeMutation.isPending ? (
                      "Processando..."
                    ) : (
                      <>
                        <ShoppingCart className="h-4 w-4 mr-2" />
                        {service.id === "removebg-001" ? "Ver Planos" : "Contratar"}
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Coming Soon Section */}
      {!searchQuery && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <Sparkles className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="font-semibold mb-2">Mais serviços em breve!</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Estamos trabalhando para trazer novos serviços incríveis para você. 
              Fique atento às novidades!
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}