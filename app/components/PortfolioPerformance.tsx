// app/components/PortfolioPerformance.tsx
/* eslint-disable @typescript-eslint */
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  TooltipProps 
} from 'recharts';
import { format } from 'date-fns';

interface Position {
  symbol: string;
  shares: number;
  price: number;
}

interface PositionHistoryEntry {
  type: 'NEW_POSITION' | 'INCREASE_POSITION' | 'PARTIAL_CLOSE' | 'CLOSE_POSITION';
  symbol: string;
  shares: number;
  price: number;
  timestamp: string;
  dateOfAction: string;
}

interface PerformanceData {
  date: string;
  percentageChange: number;
}

interface PortfolioPerformanceProps {
  positions: Position[];
  positionHistory: PositionHistoryEntry[];
}

interface CustomTooltipProps extends Omit<TooltipProps<number, string>, 'payload'> {
  payload?: Array<{
    value: number;
  }>;
}

const PortfolioPerformance: React.FC<PortfolioPerformanceProps> = ({ positions, positionHistory }) => {
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);

  useEffect(() => {
    const calculateDailyPerformance = () => {
      const dailyPerformance: PerformanceData[] = [];
      const sortedHistory = [...positionHistory].sort((a, b) =>
        new Date(a.dateOfAction).getTime() - new Date(b.dateOfAction).getTime()
      );

      if (sortedHistory.length > 0) {
        // Initialize tracking variables
        const activePositions = new Map<string, { shares: number; avgPrice: number; initialPrice: number }>();
        let lastKnownPerformance = 100; // Base value is 100%
        const dailyValues = new Map<string, number>();
        
        // Start with the first entry
        const firstEntry = sortedHistory[0];
        const firstDate = format(new Date(firstEntry.dateOfAction), 'yyyy-MM-dd');
        
        // Initialize with base value (100%)
        dailyValues.set(firstDate, 100);

        // Get the current position data
        const position = positions.find((p: Position) => p.symbol === firstEntry.symbol);
        if (position) {
          // Calculate the current performance
          const percentageChange = ((position.price - firstEntry.price) / firstEntry.price) * 100;
          const today = format(new Date(), 'yyyy-MM-dd');
          dailyValues.set(today, 100 + percentageChange);
        }
        
        let portfolioValue = 0;
        let portfolioCost = 0;

        // Track cost basis for each position
        const costBasis = new Map<string, number>();

        sortedHistory.forEach((entry) => {
          const date = format(new Date(entry.dateOfAction), 'yyyy-MM-dd');

          if (entry.type === 'NEW_POSITION' || entry.type === 'INCREASE_POSITION') {
            portfolioValue += entry.shares * entry.price;
            portfolioCost += entry.shares * entry.price;
            costBasis.set(entry.symbol, (costBasis.get(entry.symbol) || 0) + entry.shares * entry.price);
          } else if (entry.type === 'CLOSE_POSITION' || entry.type === 'PARTIAL_CLOSE') {
            const positionCost = costBasis.get(entry.symbol) || 0;
            const realizedGainLoss = entry.shares * entry.price - positionCost;
            portfolioValue += realizedGainLoss;
            costBasis.set(entry.symbol, positionCost - entry.shares * entry.price); // subtract from cost basis
          }

          let performance = 100;
          if (portfolioCost !== 0) {
            performance = 100 + ((portfolioValue - portfolioCost) / portfolioCost) * 100;
          }
          dailyValues.set(date, performance);
        });

        // Calculate current performance for all open positions
        let totalCurrentValue = 0;
        let totalCost = 0;

        positions.forEach((position) => {
          const openEntry = sortedHistory.find(e => e.symbol === position.symbol && (e.type === 'NEW_POSITION' || e.type === 'INCREASE_POSITION'));
          if (openEntry) {
            totalCurrentValue += position.shares * position.price;
            totalCost += position.shares * openEntry.price;
          }
        });

        const today = format(new Date(), 'yyyy-MM-dd');
        let currentPerformance = 100;
        if (totalCost !== 0) {
          currentPerformance = 100 + ((totalCurrentValue - totalCost) / totalCost) * 100;
        }
        dailyValues.set(today, currentPerformance);

        // Convert Map to array of performance data points
        const entries: [string, number][] = Array.from(dailyValues.entries());
        const consolidatedPerformance: PerformanceData[] = entries.map(
          ([date, value]) => ({
            date,
            percentageChange: value
          })
        );

        setPerformanceData(consolidatedPerformance);
      }
    };

    calculateDailyPerformance();
  }, [positions, positionHistory]);

  const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border rounded p-2 shadow-lg">
          <p className="text-sm">{format(new Date(label), 'MMM d, yyyy')}</p>
          <p className="text-sm font-medium text-emerald-500">
            {payload[0].value.toFixed(2)}%
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="w-full max-w-6xl mx-auto">
      <CardHeader>
        <CardTitle>Portfolio Performance</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-96 w-full">
          {performanceData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={performanceData} margin={{ top: 5, right: 20, bottom: 5, left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={(date) => format(new Date(date), 'MMM d')} />
                <YAxis
                  tickFormatter={(value) => `${value.toFixed(2)}%`}
                  domain={[
                    (dataMin: number) => Math.min(100, Math.floor(dataMin - 5)),
                    (dataMax: number) => Math.max(100, Math.ceil(dataMax + 5))
                  ]}
                  style={{ fontSize: '12px' }}
                  width={60}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="percentageChange" stroke="#10b981" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              No performance data available yet.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default PortfolioPerformance;