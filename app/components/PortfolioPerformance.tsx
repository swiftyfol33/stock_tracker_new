// app/components/PortfolioPerfomance.tsx

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
}

interface PerformanceData {
  date: string;
  value: number;
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

const PortfolioPerformance: React.FC<PortfolioPerformanceProps> = ({ positionHistory }) => {
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);

  useEffect(() => {
    const calculateDailyPerformance = () => {
      // Create a map of daily portfolio values
      const dailyValues = new Map<string, number>();
      
      // Sort history by date
      const sortedHistory = [...positionHistory].sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      // Track running position totals
      const runningPositions = new Map<string, number>();
      const lastKnownPrices = new Map<string, number>();

      sortedHistory.forEach(entry => {
        const date = format(new Date(entry.timestamp), 'yyyy-MM-dd');
        
        // Update running positions based on the action
        if (entry.type === 'NEW_POSITION' || entry.type === 'INCREASE_POSITION') {
          const currentAmount = runningPositions.get(entry.symbol) || 0;
          runningPositions.set(entry.symbol, currentAmount + entry.shares);
          lastKnownPrices.set(entry.symbol, entry.price);
        } else if (entry.type === 'PARTIAL_CLOSE' || entry.type === 'CLOSE_POSITION') {
          const currentAmount = runningPositions.get(entry.symbol) || 0;
          const newAmount = currentAmount - entry.shares;
          if (newAmount <= 0) {
            runningPositions.delete(entry.symbol);
          } else {
            runningPositions.set(entry.symbol, newAmount);
          }
          lastKnownPrices.set(entry.symbol, entry.price);
        }

        // Calculate total portfolio value for this day
        let totalValue = 0;
        runningPositions.forEach((shares, symbol) => {
          const price = lastKnownPrices.get(symbol);
          if (price !== undefined) {
            totalValue += shares * price;
          }
        });

        dailyValues.set(date, totalValue);
      });

      // Convert to array format for Recharts
      const chartData = Array.from(dailyValues.entries()).map(([date, value]) => ({
        date,
        value,
        percentageChange: 0 // Initial value, will be updated below
      }));

      // Calculate percentage change from initial value
      if (chartData.length > 0) {
        const initialValue = chartData[0].value;
        chartData.forEach(data => {
          data.percentageChange = initialValue !== 0 
            ? ((data.value - initialValue) / initialValue) * 100
            : 0;
        });
      }

      setPerformanceData(chartData);
    };

    if (positionHistory.length > 0) {
      calculateDailyPerformance();
    }
  }, [positionHistory]); // Removed positions from dependency array since it's not used

  const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border rounded p-2 shadow-lg">
          <p className="text-sm">{format(new Date(label), 'MMM d, yyyy')}</p>
          <p className="text-sm font-medium">
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
              <LineChart data={performanceData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(date) => format(new Date(date), 'MMM d')}
                />
                <YAxis 
                  tickFormatter={(value) => `${value.toFixed(0)}%`}
                  domain={['auto', 'auto']}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line 
                  type="monotone" 
                  dataKey="percentageChange" 
                  stroke="#10b981" 
                  strokeWidth={2}
                  dot={false}
                />
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