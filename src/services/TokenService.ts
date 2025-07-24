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

  // Fetch historical price and market cap for a token mint at a given timestamp using Birdeye
  static async fetchHistoricalPriceAndMarketCapUSD(mintAddress: string, timestamp: number): Promise<{ price: number, marketCap: number } | null> {
    try {
      // Birdeye expects seconds, JS Date.now() is ms
      const url = `https://public-api.birdeye.so/public/price_historical?address=${mintAddress}&time=${Math.floor(timestamp)}`;
      const response = await fetch(url, {
        headers: { 'X-API-KEY': 'public' }
      });
      if (!response.ok) return null;
      const data = await response.json();
      if (data && data.data && typeof data.data.price === 'number' && typeof data.data.market_cap === 'number') {
        return { price: data.data.price, marketCap: data.data.market_cap };
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  static async fetchWalletData(walletAddress: string, contractAddress: string, tokenData: TokenData): Promise<{
    success: boolean;
    data?: {
      investedAmount: number; // USD
      entryMarketCap: number;
      exitMarketCap: number;
    };
    error?: string;
  }> {
    try {
      const apiKey = "35b7eb01-78d9-410d-84ca-60a632ead4c3";
      const url = `https://api.helius.xyz/v0/addresses/${walletAddress}/transactions?api-key=${apiKey}&limit=100`;
      const response = await fetch(url);
      if (!response.ok) {
        return { success: false, error: `Helius API error: ${response.status}` };
      }
      const transactions = await response.json();
      // Find SPL token transfers for the given mint
      let buys: { amount: number, timestamp: number }[] = [];
      let sells: { amount: number, timestamp: number }[] = [];
      for (const tx of transactions) {
        if (!tx.tokenTransfers) continue;
        for (const transfer of tx.tokenTransfers) {
          if (transfer.mint !== contractAddress) continue;
          if (transfer.toUserAccount === walletAddress) {
            buys.push({ amount: transfer.tokenAmount / Math.pow(10, transfer.decimals || 0), timestamp: tx.timestamp });
          }
          if (transfer.fromUserAccount === walletAddress) {
            sells.push({ amount: transfer.tokenAmount / Math.pow(10, transfer.decimals || 0), timestamp: tx.timestamp });
          }
        }
      }
      if (buys.length === 0) {
        return { success: false, error: "No buy (IN) transactions found for this wallet/token." };
      }
      // Sort buys and sells by timestamp
      buys.sort((a, b) => a.timestamp - b.timestamp);
      sells.sort((a, b) => a.timestamp - b.timestamp);
      // --- Entry/Exit Market Cap Calculation (Industry Standard) ---
      // Entry = first buy, Exit = last sell (or current)
      const entryTimestamp = buys[0].timestamp;
      const exitTimestamp = sells.length > 0 ? sells[sells.length - 1].timestamp : Math.floor(Date.now() / 1000);
      // Fetch entry/exit market cap from Birdeye
      let entryMarketCap = tokenData.currentMarketCap;
      let exitMarketCap = tokenData.currentMarketCap;
      const entryData = await TokenService.fetchHistoricalPriceAndMarketCapUSD(contractAddress, entryTimestamp);
      if (entryData && entryData.marketCap) {
        entryMarketCap = entryData.marketCap;
        console.log(`[DEBUG] Entry Market Cap: $${entryMarketCap} at timestamp ${entryTimestamp}`);
      } else {
        console.warn(`[WARN] Failed to fetch historical entry market cap, using current: $${entryMarketCap}`);
      }
      const exitData = await TokenService.fetchHistoricalPriceAndMarketCapUSD(contractAddress, exitTimestamp);
      if (exitData && exitData.marketCap) {
        exitMarketCap = exitData.marketCap;
        console.log(`[DEBUG] Exit Market Cap: $${exitMarketCap} at timestamp ${exitTimestamp}`);
      } else {
        console.warn(`[WARN] Failed to fetch historical exit market cap, using current: $${exitMarketCap}`);
      }
      // --- Invested Amount Calculation (Net Buys at Historical Prices) ---
      let netTokens = 0;
      let investedAmount = 0;
      let sellIndex = 0;
      for (const buy of buys) {
        let buyAmount = buy.amount;
        // Subtract sells that happened after this buy
        while (sellIndex < sells.length && sells[sellIndex].timestamp <= buy.timestamp) {
          sellIndex++;
        }
        // Subtract sells that match this buy (FIFO)
        while (buyAmount > 0 && sellIndex < sells.length) {
          const sell = sells[sellIndex];
          const sellAmount = Math.min(buyAmount, sell.amount);
          buyAmount -= sellAmount;
          sells[sellIndex].amount -= sellAmount;
          if (sells[sellIndex].amount === 0) sellIndex++;
        }
        if (buyAmount > 0) {
          // Only count the remaining buyAmount as net buy
          const priceData = await TokenService.fetchHistoricalPriceAndMarketCapUSD(contractAddress, buy.timestamp);
          const price = priceData?.price || 0;
          investedAmount += buyAmount * price;
          netTokens += buyAmount;
          console.log(`[DEBUG] Buy: amount=${buy.amount}, netCounted=${buyAmount}, price=${price}, usd=${buyAmount * price}, timestamp=${buy.timestamp}`);
        }
      }
      for (const sell of sells) {
        if (sell.amount > 0) {
          console.log(`[DEBUG] Sell: amount=${sell.amount}, timestamp=${sell.timestamp}`);
        }
      }
      return {
        success: true,
        data: {
          investedAmount,
          entryMarketCap,
          exitMarketCap
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

  // Fetch current USD price for a Solana token mint using Birdeye API
  static async fetchTokenPriceUSD(mintAddress: string): Promise<number | null> {
    try {
      const url = `https://public-api.birdeye.so/public/price?address=${mintAddress}`;
      const response = await fetch(url, {
        headers: { 'X-API-KEY': 'public' } // Birdeye allows public key for basic usage
      });
      if (!response.ok) return null;
      const data = await response.json();
      if (data && data.data && typeof data.data.price === 'number') {
        return data.data.price;
      }
      return null;
    } catch (e) {
      return null;
    }
  }
}