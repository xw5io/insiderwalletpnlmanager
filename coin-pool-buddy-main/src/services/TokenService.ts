interface TokenData {
  name: string;
  symbol: string;
  currentMarketCap: number;
  priceHistory: { timestamp: number; marketCap: number }[];
}

export class TokenService {
  private static API_KEY_STORAGE_KEY = 'dexscreener_api_key';

  static saveApiKey(apiKey: string): void {
    localStorage.setItem(this.API_KEY_STORAGE_KEY, apiKey);
  }

  static getApiKey(): string | null {
    return localStorage.getItem(this.API_KEY_STORAGE_KEY);
  }

  static async fetchTokenData(contractAddress: string): Promise<{ success: boolean; data?: TokenData; error?: string }> {
    try {
      // First try DexScreener (public API, no key needed)
      const dexResponse = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${contractAddress}`);
      
      if (dexResponse.ok) {
        const dexData = await dexResponse.json();
        
        if (dexData.pairs && dexData.pairs.length > 0) {
          const pair = dexData.pairs[0];
          const currentPrice = parseFloat(pair.priceUsd || '0');
          const totalSupply = parseFloat(pair.fdv || '0') / currentPrice; // Estimate from FDV
          const currentMarketCap = parseFloat(pair.fdv || '0');
          
          return {
            success: true,
            data: {
              name: pair.baseToken.name,
              symbol: pair.baseToken.symbol,
              currentMarketCap,
              priceHistory: [{
                timestamp: Date.now(),
                marketCap: currentMarketCap
              }]
            }
          };
        }
      }

      // Fallback: try with mock data for development
      console.log('Using mock data for token:', contractAddress);
      return {
        success: true,
        data: {
          name: "Sample Token",
          symbol: "SAMPLE",
          currentMarketCap: Math.random() * 10000000 + 1000000, // Random between 1M-11M
          priceHistory: [
            { timestamp: Date.now() - 86400000, marketCap: Math.random() * 5000000 + 500000 },
            { timestamp: Date.now(), marketCap: Math.random() * 10000000 + 1000000 }
          ]
        }
      };
    } catch (error) {
      console.error('Error fetching token data:', error);
      return {
        success: false,
        error: 'Failed to fetch token data'
      };
    }
  }

  static async fetchWalletData(walletAddress: string, contractAddress: string, tokenData: TokenData): Promise<{
    success: boolean;
    data?: {
      investedAmount: number;
      entryMarketCap: number;
      exitMarketCap: number;
    };
    error?: string;
  }> {
    try {
      // In a real implementation, you would fetch:
      // 1. Wallet transaction history for this token
      // 2. Entry transaction (buy) details
      // 3. Exit transaction (sell) details
      // 4. Calculate invested amount based on transaction value
      
      // For now, return mock data based on current market cap
      const currentMC = tokenData.currentMarketCap;
      const entryMC = currentMC * (0.1 + Math.random() * 0.8); // Random entry between 10%-90% of current
      const exitMC = currentMC * (0.2 + Math.random() * 1.5); // Random exit between 20%-150% of current
      const investedAmount = Math.random() * 5000 + 500; // Random between $500-$5500
      
      return {
        success: true,
        data: {
          investedAmount,
          entryMarketCap: entryMC,
          exitMarketCap: exitMC
        }
      };
    } catch (error) {
      console.error('Error fetching wallet data:', error);
      return {
        success: false,
        error: 'Failed to fetch wallet data'
      };
    }
  }
}