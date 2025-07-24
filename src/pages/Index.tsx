import { useState } from "react";
import { DataInput, WalletData } from "@/components/DataInput";
import { PnLCalculator, CalculatedWallet } from "@/components/PnLCalculator";
import { TrendingUp } from "lucide-react";

const Index = () => {
  const [walletData, setWalletData] = useState<WalletData[]>([]);
  const [calculatedData, setCalculatedData] = useState<CalculatedWallet[]>([]);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-4">
              <TrendingUp className="w-8 h-8 text-primary" />
              <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-profit bg-clip-text text-transparent">
                Memecoin Insider PnL Manager
              </h1>
            </div>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Track and redistribute profits/losses among insider wallets for memecoin launches. 
              Calculate fair redistribution to balance group outcomes.
            </p>
          </div>

          {/* Data Input Section */}
          <div className="mb-8">
            <DataInput onDataUpdate={setWalletData} calculatedData={calculatedData} />
          </div>

          {/* P&L Calculator Section */}
          <div className="mb-8">
            <PnLCalculator walletData={walletData} onCalculatedData={setCalculatedData} />
          </div>

          {/* Footer */}
          <div className="text-center text-sm text-muted-foreground mt-12 pt-8 border-t">
            <p>
              This tool is for calculation purposes only. No transactions are automated or executed.
              Always verify calculations before making any financial decisions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;