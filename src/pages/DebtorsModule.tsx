import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Users, UserMinus, UserPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Debtor {
  id: string;
  name: string;
  amount: number;
  type: "owes_me" | "i_owe";
  date: Date;
}

const DebtorsModule = () => {
  const [debtors, setDebtors] = useState<Debtor[]>([]);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"owes_me" | "i_owe">("owes_me");
  const { toast } = useToast();

  const addDebtor = () => {
    if (!name.trim() || !amount) {
      toast({ title: "Please fill all fields", variant: "destructive" });
      return;
    }

    const debtor: Debtor = {
      id: Date.now().toString(),
      name,
      amount: parseFloat(amount),
      type,
      date: new Date(),
    };

    setDebtors([debtor, ...debtors]);
    setName("");
    setAmount("");
    toast({ title: "Debtor added" });
  };

  const deleteDebtor = (id: string) => {
    setDebtors(debtors.filter((d) => d.id !== id));
    toast({ title: "Debtor removed" });
  };

  const totalOwesMe = debtors
    .filter((d) => d.type === "owes_me")
    .reduce((sum, d) => sum + d.amount, 0);

  const totalIOwe = debtors
    .filter((d) => d.type === "i_owe")
    .reduce((sum, d) => sum + d.amount, 0);

  const netBalance = totalOwesMe - totalIOwe;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Debtors</h1>
        <p className="text-muted-foreground">Manage debts and credits</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">People Owe Me</CardTitle>
            <UserPlus className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">${totalOwesMe.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">I Owe</CardTitle>
            <UserMinus className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">${totalIOwe.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Net Balance</CardTitle>
            <Users className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${netBalance >= 0 ? "text-green-500" : "text-red-500"}`}>
              ${netBalance.toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add Debtor</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Input
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="md:col-span-2"
            />
            <Input
              type="number"
              placeholder="Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <div className="flex gap-2">
              <Select value={type} onValueChange={(v) => setType(v as "owes_me" | "i_owe")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owes_me">Owes Me</SelectItem>
                  <SelectItem value="i_owe">I Owe</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={addDebtor}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All Debtors ({debtors.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {debtors.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No debtors yet. Add your first entry!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {debtors.map((debtor) => (
                <div
                  key={debtor.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {debtor.type === "owes_me" ? (
                      <UserPlus className="h-5 w-5 text-green-500" />
                    ) : (
                      <UserMinus className="h-5 w-5 text-red-500" />
                    )}
                    <div>
                      <p className="font-medium">{debtor.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {debtor.date.toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span
                      className={`font-bold ${
                        debtor.type === "owes_me" ? "text-green-500" : "text-red-500"
                      }`}
                    >
                      ${debtor.amount.toFixed(2)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteDebtor(debtor.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DebtorsModule;
