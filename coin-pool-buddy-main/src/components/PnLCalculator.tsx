import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, Calculator } from "lucide-react";
import { WalletData } from "./DataInput";
import { useToast } from "@/hooks/use-toast";

export interface CalculatedWallet extends WalletData {
  rawPnL: number;
  pnLPercentage: number;
  redistributionAmount: number;
  finalBalance: number;
  isProfit: boolean;
}

interface PnLCalculatorProps {
  walletData: WalletData[];
}

export const PnLCalculator = ({ walletData }: PnLCalculatorProps) => {
  const [calculatedData, setCalculatedData] = useState<CalculatedWallet[]>([]);
  const [redistributionMode, setRedistributionMode] = useState<string>("equal");
  const [customPercentages, setCustomPercentages] = useState<{ [key: string]: number }>({});
  const { toast } = useToast();

  const calculatePnL = () => {
    if (walletData.length === 0) return;

    // Calculate raw P&L for each wallet based on market cap changes
    const walletsWithPnL = walletData.map(wallet => {
      // Calculate the ratio of exit to entry market cap
      const marketCapRatio = wallet.exitMarketCap / wallet.entryMarketCap;
      // Calculate the new value of the investment
      const newValue = wallet.investedAmount * marketCapRatio;
      // P&L is the difference between new value and original investment
      const rawPnL = newValue - wallet.investedAmount;
      const pnLPercentage = ((marketCapRatio - 1) * 100);
      
      return {
        ...wallet,
        rawPnL,
        pnLPercentage,
        redistributionAmount: 0,
        finalBalance: wallet.investedAmount + rawPnL,
        isProfit: rawPnL > 0,
      };
    });

    // Calculate total profit and loss
    const totalProfit = walletsWithPnL
      .filter(w => w.isProfit)
      .reduce((sum, w) => sum + w.rawPnL, 0);
    
    const totalLoss = Math.abs(walletsWithPnL
      .filter(w => !w.isProfit)
      .reduce((sum, w) => sum + w.rawPnL, 0));

    const losers = walletsWithPnL.filter(w => !w.isProfit);
    const winners = walletsWithPnL.filter(w => w.isProfit);

    if (totalProfit === 0 || totalLoss === 0) {
      setCalculatedData(walletsWithPnL);
      return;
    }

    // Calculate redistribution based on mode
    const redistributionAmount = Math.min(totalProfit, totalLoss);

    // Distribute losses to be covered
    losers.forEach(loser => {
      switch (redistributionMode) {
        case "equal":
          loser.redistributionAmount = redistributionAmount / losers.length;
          break;
        case "proportional":
          const lossRatio = Math.abs(loser.rawPnL) / totalLoss;
          loser.redistributionAmount = redistributionAmount * lossRatio;
          break;
        case "custom":
          const customPercentage = customPercentages[loser.id] || 0;
          loser.redistributionAmount = (redistributionAmount * customPercentage) / 100;
          break;
      }
      loser.finalBalance = loser.investedAmount + loser.rawPnL + loser.redistributionAmount;
    });

    // Distribute redistribution burden among winners
    const totalRedistributionOut = losers.reduce((sum, l) => sum + l.redistributionAmount, 0);
    
    winners.forEach(winner => {
      const profitRatio = winner.rawPnL / totalProfit;
      winner.redistributionAmount = -totalRedistributionOut * profitRatio;
      winner.finalBalance = winner.investedAmount + winner.rawPnL + winner.redistributionAmount;
    });

    setCalculatedData(walletsWithPnL);
    
    toast({
      title: "Calculations Complete",
      description: `Redistributed $${totalRedistributionOut.toFixed(2)} from ${winners.length} profitable wallets to ${losers.length} losing wallets.`,
    });
  };

  const exportCSV = () => {
    if (calculatedData.length === 0) return;

    const headers = [
      "Wallet Address",
      "Token Name", 
      "Invested Amount",
      "Raw P&L",
      "P&L %",
      "Redistribution Amount",
      "Final Balance"
    ];

    const csvContent = [
      headers.join(","),
      ...calculatedData.map(wallet => [
        wallet.walletAddress,
        wallet.tokenName,
        wallet.investedAmount.toFixed(2),
        wallet.rawPnL.toFixed(2),
        wallet.pnLPercentage.toFixed(2) + "%",
        wallet.redistributionAmount.toFixed(2),
        wallet.finalBalance.toFixed(2)
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `memecoin-pnl-redistribution-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Export Complete",
      description: "CSV file has been downloaded successfully.",
    });
  };

  const handleCustomPercentageChange = (walletId: string, percentage: number) => {
    setCustomPercentages(prev => ({
      ...prev,
      [walletId]: percentage
    }));
  };

  useEffect(() => {
    if (walletData.length > 0) {
      calculatePnL();
    }
  }, [walletData, redistributionMode, customPercentages]);

  if (walletData.length === 0) {
    return (
      <Card className="w-full">
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">
            Add wallet data to see P&L calculations
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalInvested = calculatedData.reduce((sum, w) => sum + w.investedAmount, 0);
  const totalRawPnL = calculatedData.reduce((sum, w) => sum + w.rawPnL, 0);
  const totalFinalBalance = calculatedData.reduce((sum, w) => sum + w.finalBalance, 0);
  const losers = calculatedData.filter(w => !w.isProfit);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Calculator className="w-5 h-5" />
            P&L Redistribution Results
          </span>
          {calculatedData.length > 0 && (
            <Button onClick={exportCSV} variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
          <div className="flex-1">
            <Label htmlFor="redistribution-mode">Redistribution Mode</Label>
            <Select value={redistributionMode} onValueChange={setRedistributionMode}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="equal">Equal Share Among Losers</SelectItem>
                <SelectItem value="proportional">Proportional to Loss</SelectItem>
                <SelectItem value="custom">Custom Percentages</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {redistributionMode === "custom" && losers.length > 0 && (
          <div className="space-y-3">
            <Label>Custom Redistribution Percentages (must total 100%)</Label>
            <div className="grid gap-3">
              {losers.map(wallet => (
                <div key={wallet.id} className="flex items-center gap-3">
                  <span className="text-sm truncate flex-1">{wallet.walletAddress}</span>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      className="w-20"
                      value={customPercentages[wallet.id] || 0}
                      onChange={(e) => handleCustomPercentageChange(wallet.id, parseFloat(e.target.value) || 0)}
                    />
                    <span className="text-sm">%</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="text-sm text-muted-foreground">
              Total: {Object.values(customPercentages).reduce((sum, val) => sum + val, 0)}%
            </div>
          </div>
        )}

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
          <div className="text-center">
            <div className="text-2xl font-bold">${totalInvested.toFixed(2)}</div>
            <div className="text-sm text-muted-foreground">Total Invested</div>
          </div>
          <div className="text-center">
            <div className={`text-2xl font-bold ${totalRawPnL >= 0 ? 'text-profit' : 'text-loss'}`}>
              ${totalRawPnL.toFixed(2)}
            </div>
            <div className="text-sm text-muted-foreground">Raw P&L</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">${totalFinalBalance.toFixed(2)}</div>
            <div className="text-sm text-muted-foreground">Final Balance</div>
          </div>
        </div>

        {/* Results Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left p-3">Wallet</th>
                <th className="text-left p-3">Token</th>
                <th className="text-right p-3">Invested</th>
                <th className="text-right p-3">Raw P&L</th>
                <th className="text-right p-3">P&L %</th>
                <th className="text-right p-3">Redistribution</th>
                <th className="text-right p-3">Final Balance</th>
              </tr>
            </thead>
            <tbody>
              {calculatedData.map((wallet) => (
                <tr key={wallet.id} className="border-b hover:bg-muted/50">
                  <td className="p-3 font-mono text-sm truncate max-w-32">{wallet.walletAddress}</td>
                  <td className="p-3">{wallet.tokenName}</td>
                  <td className="p-3 text-right">${wallet.investedAmount.toFixed(2)}</td>
                  <td className={`p-3 text-right font-semibold ${wallet.isProfit ? 'text-profit' : 'text-loss'}`}>
                    ${wallet.rawPnL.toFixed(2)}
                  </td>
                  <td className={`p-3 text-right ${wallet.isProfit ? 'text-profit' : 'text-loss'}`}>
                    {wallet.pnLPercentage.toFixed(2)}%
                  </td>
                  <td className={`p-3 text-right font-semibold ${wallet.redistributionAmount >= 0 ? 'text-profit' : 'text-loss'}`}>
                    {wallet.redistributionAmount >= 0 ? '+' : ''}${wallet.redistributionAmount.toFixed(2)}
                  </td>
                  <td className="p-3 text-right font-bold">${wallet.finalBalance.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};