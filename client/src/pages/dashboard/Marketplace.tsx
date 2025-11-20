import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Grid3x3, 
  ImageOff, 
  Star,
  TrendingUp,
  Sparkles,
  Shield,
  Zap,
  Package
} from "lucide-react";
import { Link } from "wouter";

// Mock data for services - will be replaced with API data
const services = [
  {
    id: "vectorizer",
    name: "Vectorizer",
    description: "Conversão profissional de imagens em vetores",
    icon: Grid3x3,
    price: "17,50",
    category: "Produtividade",
    isPopular: true,
    features: [
      "Vetorização ilimitada",
      "Alta qualidade",
      "Suporte API",
      "Processamento em lote"
    ],
    path: "/payment"
  },
  {
    id: "removebg",
    name: "RemoveBG",
    description: "Remoção automática de fundo com IA",
    icon: ImageOff,
    price: "A partir de 14,90",
    category: "Imagens",
    isHighlight: true,
    features: [
      "Precisão com IA",
      "HD e 4K",
      "PNG transparente",
      "Processamento rápido"
    ],
    path: "/removebg/plans"
  }
];

const categories = [
  { name: "Todos", count: 2, icon: Package },
  { name: "Produtividade", count: 1, icon: Zap },
  { name: "Imagens", count: 1, icon: ImageOff },
];

export default function Marketplace() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Marketplace</h1>
        <p className="text-muted-foreground">
          Explore e contrate novos serviços para turbinar sua produtividade
        </p>
      </div>

      {/* Promotional Banner */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
        <CardContent className="flex items-center justify-between p-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-lg">Novidade: RemoveBG</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Remova fundos de imagens com precisão profissional usando IA
            </p>
          </div>
          <Button asChild>
            <Link href="/removebg/plans">
              Ver Planos
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* Category Filter */}
      <div className="flex gap-2 pb-2 overflow-x-auto">
        {categories.map((category) => (
          <Button
            key={category.name}
            variant={category.name === "Todos" ? "default" : "outline"}
            size="sm"
            className="whitespace-nowrap"
          >
            <category.icon className="h-4 w-4 mr-2" />
            {category.name}
            <Badge variant="secondary" className="ml-2 h-5 px-1">
              {category.count}
            </Badge>
          </Button>
        ))}
      </div>

      {/* Services Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {services.map((service) => (
          <Card key={service.id} className="relative overflow-hidden">
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
                  <service.icon className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-lg">{service.name}</CardTitle>
                  <Badge variant="outline" className="mt-2 text-xs">
                    {service.category}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {service.description}
              </p>
              
              <div>
                <p className="text-xs text-muted-foreground mb-1">A partir de</p>
                <p className="text-2xl font-bold">
                  R$ {service.price}
                  <span className="text-sm font-normal text-muted-foreground">/mês</span>
                </p>
              </div>

              <ul className="space-y-1">
                {service.features.slice(0, 3).map((feature, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-sm">
                    <Shield className="h-3 w-3 text-green-600" />
                    <span className="text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button className="w-full" asChild>
                <Link href={service.path}>
                  Ver Detalhes
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Coming Soon Section */}
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
    </div>
  );
}