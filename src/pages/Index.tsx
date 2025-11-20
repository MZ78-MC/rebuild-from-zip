import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, CheckSquare, DollarSign, Users, Code } from "lucide-react";
import { Link } from "react-router-dom";

const Index = () => {
  const modules = [
    {
      title: "Notes",
      description: "Rich text note-taking with organization",
      icon: FileText,
      url: "/notes",
      color: "text-blue-500",
    },
    {
      title: "Tasks",
      description: "Manage your daily tasks and todos",
      icon: CheckSquare,
      url: "/tasks",
      color: "text-green-500",
    },
    {
      title: "Budget",
      description: "Track income and expenses",
      icon: DollarSign,
      url: "/budget",
      color: "text-yellow-500",
    },
    {
      title: "Debtors",
      description: "Manage debts and credits",
      icon: Users,
      url: "/debtors",
      color: "text-purple-500",
    },
    {
      title: "Dev Assistant",
      description: "Code snippets and development tools",
      icon: Code,
      url: "/dev-assistant",
      color: "text-orange-500",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Welcome to My Voice</h1>
        <p className="text-muted-foreground">
          Your personal productivity suite - select a module to get started
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {modules.map((module) => (
          <Link key={module.title} to={module.url}>
            <Card className="hover:bg-accent transition-colors cursor-pointer h-full">
              <CardHeader>
                <module.icon className={`h-8 w-8 mb-2 ${module.color}`} />
                <CardTitle>{module.title}</CardTitle>
                <CardDescription>{module.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default Index;
