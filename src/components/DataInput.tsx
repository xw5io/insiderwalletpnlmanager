import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Plus, Trash2, Search, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { TokenService } from "@/services/TokenService";

export interface WalletData {
  id: string;
  walletAddress: string;
  tokenName: string;
  investedAmount: number;
  entryMarketCap: number;
  exitMarketCap: number;
}

interface TokenData {
  name: string;
  symbol: string;
  currentMarketCap: number;
  priceHistory: { timestamp: number; marketCap: number }[];
}

interface DataInputProps {
  onDataUpdate: (data: WalletData[]) => void;
  calculatedData?: any[];
}

export const DataInput = ({ onDataUpdate, calculatedData }: DataInputProps) => {
  const [wallets, setWallets] = useState<WalletData[]>([]);
  const [contractAddress, setContractAddress] = useState('');
  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [isLoadingToken, setIsLoadingToken] = useState(false);
  const [newWallet, setNewWallet] = useState<Omit<WalletData, 'id'>>({
    walletAddress: '',
    tokenName: '',
    investedAmount: 0,
    entryMarketCap: 0,
    exitMarketCap: 0,
  });
  const { toast } = useToast();

  const fetchTokenData = async () => {
    if (!contractAddress.trim()) {
      toast({
        title: "Invalid Input",
        description: "Please enter a valid contract address.",
        variant: "destructive",
      });
      return;
    }

    setIsLoadingToken(true);
    try {
      const result = await TokenService.fetchTokenData(contractAddress);
      
      if (result.success && result.data) {
        setTokenData(result.data);
        setNewWallet(prev => ({
          ...prev,
          tokenName: result.data!.name
        }));
        
        toast({
          title: "Token Data Loaded",
          description: `Successfully loaded data for ${result.data.name} (${result.data.symbol})`,
        });
      } else {
        toast({
          title: "Failed to Load Token",
          description: result.error || "Could not fetch token data",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch token data",
        variant: "destructive",
      });
    } finally {
      setIsLoadingToken(false);
    }
  };

  const addWallet = () => {
    if (!newWallet.walletAddress || !newWallet.tokenName || newWallet.investedAmount <= 0) {
      toast({
        title: "Invalid Input",
        description: "Please fill in all fields with valid values.",
        variant: "destructive",
      });
      return;
    }

    const wallet: WalletData = {
      ...newWallet,
      id: Date.now().toString(),
    };

    const updatedWallets = [...wallets, wallet];
    setWallets(updatedWallets);
    onDataUpdate(updatedWallets);
    
    setNewWallet({
      walletAddress: '',
      tokenName: tokenData?.name || '',
      investedAmount: 0,
      entryMarketCap: 0,
      exitMarketCap: 0,
    });

    toast({
      title: "Wallet Added",
      description: "Wallet data has been added successfully.",
    });
  };

  const removeWallet = (id: string) => {
    const updatedWallets = wallets.filter(w => w.id !== id);
    setWallets(updatedWallets);
    onDataUpdate(updatedWallets);
  };

  const handleCSVUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        toast({
          title: "Invalid CSV",
          description: "CSV must contain header and at least one data row.",
          variant: "destructive",
        });
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const expectedHeaders = ['walletaddress', 'tokenname', 'investedamount', 'entrymarketcap', 'exitmarketcap'];
      
      if (!expectedHeaders.every(h => headers.includes(h))) {
        toast({
          title: "Invalid CSV Format",
          description: "CSV must contain columns: walletAddress, tokenName, investedAmount, entryMarketCap, exitMarketCap",
          variant: "destructive",
        });
        return;
      }

      const csvWallets: WalletData[] = [];
      
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        if (values.length >= 5) {
          csvWallets.push({
            id: `csv-${i}-${Date.now()}`,
            walletAddress: values[headers.indexOf('walletaddress')],
            tokenName: values[headers.indexOf('tokenname')],
            investedAmount: parseFloat(values[headers.indexOf('investedamount')]) || 0,
            entryMarketCap: parseFloat(values[headers.indexOf('entrymarketcap')]) || 0,
            exitMarketCap: parseFloat(values[headers.indexOf('exitmarketcap')]) || 0,
          });
        }
      }

      if (csvWallets.length > 0) {
        const updatedWallets = [...wallets, ...csvWallets];
        setWallets(updatedWallets);
        onDataUpdate(updatedWallets);
        
        toast({
          title: "CSV Imported",
          description: `Successfully imported ${csvWallets.length} wallet records.`,
        });
      }
    };

    reader.readAsText(file);
    event.target.value = '';
  };

  // Download PnL Card as a text file (wallet, invested, redistribution only)
  function downloadPnlCard(wallets: WalletData[], calculatedData?: any[]) {
    if (!wallets.length) return;
    let content = 'PnL Card\n\n';
    content += 'Wallet Address, Invested Amount, Redistribution\n';
    wallets.forEach(w => {
      // Try to get redistribution from calculatedData if available
      let redistribution = 0;
      if (Array.isArray(calculatedData)) {
        const found = calculatedData.find((c: any) => c.walletAddress === w.walletAddress);
        if (found) redistribution = found.redistributionAmount;
      }
      content += `${w.walletAddress}, $${w.investedAmount}, $${redistribution}\n`;
    });
    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pnl-card-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Wallet Data Input
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Token Contract Section */}
        <div className="mb-6 p-4 bg-muted rounded-lg">
          <Label htmlFor="contractAddress" className="text-lg font-semibold">Token Contract Address</Label>
          <div className="flex gap-2 mt-2">
            <Input
              id="contractAddress"
              value={contractAddress}
              onChange={(e) => setContractAddress(e.target.value)}
              placeholder="Enter token contract address (e.g., 0x...)"
              className="flex-1"
            />
            <Button 
              onClick={fetchTokenData} 
              disabled={isLoadingToken}
              variant="outline"
            >
              {isLoadingToken ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
            </Button>
          </div>
          {tokenData && (
            <div className="mt-3 text-sm text-muted-foreground">
              <p><strong>{tokenData.name} ({tokenData.symbol})</strong></p>
              <p>Current Market Cap: ${tokenData.currentMarketCap.toLocaleString()}</p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <Label htmlFor="walletAddress">Wallet Address</Label>
                <Input
                  id="walletAddress"
                  value={newWallet.walletAddress}
                  onChange={(e) => setNewWallet({ ...newWallet, walletAddress: e.target.value })}
                  placeholder="0x..."
                />
              </div>
              <div>
                <Label htmlFor="tokenName">Token Name</Label>
                <Input
                  id="tokenName"
                  value={newWallet.tokenName}
                  onChange={(e) => setNewWallet({ ...newWallet, tokenName: e.target.value })}
                  placeholder="PEPE"
                  disabled={!!tokenData}
                />
              </div>
              <div>
                <Label htmlFor="investedAmount">Invested Amount (USD)</Label>
                <Input
                  id="investedAmount"
                  type="number"
                  value={newWallet.investedAmount || ''}
                  onChange={(e) => setNewWallet({ ...newWallet, investedAmount: parseFloat(e.target.value) || 0 })}
                  placeholder="1000"
                />
              </div>
              <div>
                <Label htmlFor="entryMarketCap">Entry Market Cap ($)</Label>
                <Input
                  id="entryMarketCap"
                  type="number"
                  value={newWallet.entryMarketCap || ''}
                  onChange={(e) => setNewWallet({ ...newWallet, entryMarketCap: parseFloat(e.target.value) || 0 })}
                  placeholder="1000000"
                />
              </div>
              <div>
                <Label htmlFor="exitMarketCap">Exit Market Cap ($)</Label>
                <Input
                  id="exitMarketCap"
                  type="number"
                  value={newWallet.exitMarketCap || ''}
                  onChange={(e) => setNewWallet({ ...newWallet, exitMarketCap: parseFloat(e.target.value) || 0 })}
                  placeholder="2000000"
                />
              </div>
            </div>
          <Button onClick={addWallet} className="w-full">
            <Plus className="w-4 h-4 mr-2" />
            Add Wallet
          </Button>
          <Button onClick={() => downloadPnlCard(wallets, calculatedData)} className="w-full mt-2" variant="outline">
            Download PnL Card
          </Button>
        </div>

        {wallets.length > 0 && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-3">Added Wallets ({wallets.length})</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {wallets.map((wallet) => (
                <div key={wallet.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex-1 grid grid-cols-5 gap-2 text-sm">
                    <span className="truncate">{wallet.walletAddress}</span>
                    <span>{wallet.tokenName}</span>
                    <span>${wallet.investedAmount.toLocaleString()}</span>
                    <span>${wallet.entryMarketCap.toLocaleString()}</span>
                    <span>${wallet.exitMarketCap.toLocaleString()}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeWallet(wallet.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};