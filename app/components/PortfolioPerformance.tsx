import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { format, subDays, subMonths, subYears, startOfYear, isAfter, isFuture } from 'date-fns';

// Types
interface Position {
  symbol: string;
  shares: number;
  price: number;
  purchaseDate: Date;
  purchasePrice: number;
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

interface TimePerformanceData {
  week: number;
  month: number;
  ytd: number;
  year: number;
  total: number;
}

interface PortfolioPerformanceProps {
  positions: Position[];
  positionHistory: PositionHistoryEntry[];
}

type TimeRange = '1D' | '1W' | '1M' | 'YTD' | '1Y' | 'ALL';

// Performance Metrics Component
const PerformanceMetrics: React.FC<{ data: TimePerformanceData }> = ({ data }) => {
  const formatPercentage = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  const getTextColor = (value: number) => {
    return value >= 0 ? 'text-emerald-400' : 'text-red-400';
  };

  return (
    <Card>
      <div className="flex justify-between items-center space-x-4 text-sm">
        <div className="text-center">
          <div className="text-muted-foreground">1 Week</div>
          <div className={getTextColor(data.week)}>
            {formatPercentage(data.week)}
          </div>
        </div>
        <div className="text-center">
          <div className="text-muted-foreground">1 Month</div>
          <div className={getTextColor(data.month)}>
            {formatPercentage(data.month)}
          </div>
        </div>
        <div className="text-center">
          <div className="text-muted-foreground">YTD</div>
          <div className={getTextColor(data.ytd)}>
            {formatPercentage(data.ytd)}
          </div>
        </div>
        <div className="text-center">
          <div className="text-muted-foreground">1 Year</div>
          <div className={getTextColor(data.year)}>
            {formatPercentage(data.year)}
          </div>
        </div>
        <div className="text-center">
          <div className="text-muted-foreground">Total</div>
          <div className={getTextColor(data.total)}>
            {formatPercentage(data.total)}
          </div>
        </div>
      </div>
    </Card>
  );
};

// Main Component
const PortfolioPerformance: React.FC<PortfolioPerformanceProps> = ({ positions, positionHistory }) => {
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);
  const [timeMetrics, setTimeMetrics] = useState<TimePerformanceData>({
    week: 0,
    month: 0,
    ytd: 0,
    year: 0,
    total: 0
  });
  const [selectedRange, setSelectedRange] = useState<TimeRange>('1M');
  const [isLoading, setIsLoading] = useState(false);

  const getStartDate = (range: TimeRange): Date => {
    const now = new Date();
    const earliestPurchaseDate = new Date(Math.min(...positions.map(p => 
      new Date(p.purchaseDate).getTime()
    )));

    switch (range) {
      case '1D':
        return new Date(Math.max(subDays(now, 1).getTime(), earliestPurchaseDate.getTime()));
      case '1W':
        return new Date(Math.max(subDays(now, 7).getTime(), earliestPurchaseDate.getTime()));
      case '1M':
        return new Date(Math.max(subMonths(now, 1).getTime(), earliestPurchaseDate.getTime()));
      case 'YTD':
        return new Date(Math.max(startOfYear(now).getTime(), earliestPurchaseDate.getTime()));
      case '1Y':
        return new Date(Math.max(subYears(now, 1).getTime(), earliestPurchaseDate.getTime()));
      case 'ALL':
        return earliestPurchaseDate;
      default:
        return new Date(Math.max(subMonths(now, 1).getTime(), earliestPurchaseDate.getTime()));
    }
  };

  const calculatePortfolioValue = (date: Date, positionsToCalculate: Position[]) => {
    return positionsToCalculate.reduce((total, position) => {
      const purchaseDate = new Date(position.purchaseDate);
      
      // If the date is before purchase date, don't include this position
      if (date < purchaseDate) {
        return total;
      }

      // For historical dates, use purchase price plus a linear interpolation
      // between purchase price and current price
      if (date < new Date()) {
        const totalDays = (new Date().getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24);
        const daysSincePurchase = (date.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24);
        const progressRatio = daysSincePurchase / totalDays;
        const priceDifference = position.price - position.purchasePrice;
        const interpolatedPrice = position.purchasePrice + (priceDifference * progressRatio);
        return total + (position.shares * interpolatedPrice);
      }

      // Use current price for today
      return total + (position.shares * position.price);
    }, 0);
  };

  const calculatePerformanceData = (range: TimeRange) => {
    const startDate = getStartDate(range);
    const now = new Date();
    const result: PerformanceData[] = [];
    
    // Filter out positions with future purchase dates
    const validPositions = positions.filter(p => !isFuture(new Date(p.purchaseDate)));
    
    if (validPositions.length === 0) {
      return result;
    }

    // Calculate the initial investment value using purchase prices
    const initialInvestment = validPositions.reduce((total, position) => {
      if (new Date(position.purchaseDate) <= startDate) {
        return total + (position.shares * position.purchasePrice);
      }
      return total;
    }, 0);

    if (initialInvestment === 0) return result;

    // Generate data points
    let currentDate = startDate;
    const dayIncrement = range === '1D' ? 1/24 : 1; // Hourly for 1D, daily for others

    while (currentDate <= now) {
      const currentValue = calculatePortfolioValue(currentDate, validPositions);
      const percentageChange = ((currentValue - initialInvestment) / initialInvestment) * 100;

      result.push({
        date: format(currentDate, 'yyyy-MM-dd HH:mm:ss'),
        percentageChange: Number(percentageChange.toFixed(2))
      });

      // Increment based on range
      currentDate = new Date(currentDate.getTime() + (dayIncrement * 24 * 60 * 60 * 1000));
    }

    // Add current point if not already added
    if (result[result.length - 1]?.date !== format(now, 'yyyy-MM-dd HH:mm:ss')) {
      const finalValue = calculatePortfolioValue(now, validPositions);
      const finalPercentageChange = ((finalValue - initialInvestment) / initialInvestment) * 100;
      result.push({
        date: format(now, 'yyyy-MM-dd HH:mm:ss'),
        percentageChange: Number(finalPercentageChange.toFixed(2))
      });
    }

    return result;
  };

  useEffect(() => {
    const calculatePerformance = async () => {
      if (positions.length === 0) {
        setPerformanceData([]);
        setTimeMetrics({
          week: 0,
          month: 0,
          ytd: 0,
          year: 0,
          total: 0
        });
        return;
      }

      setIsLoading(true);
      try {
        // Calculate performance for selected range
        const data = calculatePerformanceData(selectedRange);
        setPerformanceData(data);

        // Calculate metrics for all time periods
        const metrics = {
          week: calculatePerformanceData('1W').slice(-1)[0]?.percentageChange || 0,
          month: calculatePerformanceData('1M').slice(-1)[0]?.percentageChange || 0,
          ytd: calculatePerformanceData('YTD').slice(-1)[0]?.percentageChange || 0,
          year: calculatePerformanceData('1Y').slice(-1)[0]?.percentageChange || 0,
          total: calculatePerformanceData('ALL').slice(-1)[0]?.percentageChange || 0
        };
        
        setTimeMetrics(metrics);
      } catch (error) {
        console.error('Error calculating performance:', error);
      } finally {
        setIsLoading(false);
      }
    };

    calculatePerformance();
  }, [positions, selectedRange]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border rounded p-2 shadow-lg">
          <p className="text-sm text-foreground">{format(new Date(label), 'MMM d, yyyy HH:mm')}</p>
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
        <div className="flex justify-between items-center">
          <CardTitle>Portfolio Performance</CardTitle>
          <div className="flex space-x-2">
            {(['1D', '1W', '1M', 'YTD', '1Y', 'ALL'] as TimeRange[]).map((range) => (
              <Button
                key={range}
                variant={selectedRange === range ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedRange(range)}
                className="px-3 py-1 text-sm"
                disabled={isLoading}
              >
                {range}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <PerformanceMetrics data={timeMetrics} />
        <div className="h-96 w-full mt-4">
          {isLoading ? (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              Loading performance data...
            </div>
          ) : performanceData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart 
                data={performanceData}
                margin={{ top: 5, right: 20, bottom: 5, left: 40 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted/20" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(date) => {
                    const dateObj = new Date(date);
                    switch (selectedRange) {
                      case '1D':
                        return format(dateObj, 'HH:mm');
                      case '1W':
                        return format(dateObj, 'EEE');
                      case '1M':
                      case 'YTD':
                      case '1Y':
                      case 'ALL':
                      default:
                        return format(dateObj, 'MMM d');
                    }
                  }}
                  stroke="currentColor"
                  className="text-muted-foreground"
                />
                <YAxis
                  tickFormatter={(value) => `${value.toFixed(2)}%`}
                  domain={[
                    (dataMin: number) => Math.floor(Math.min(dataMin, 0) - 5),
                    (dataMax: number) => Math.ceil(Math.max(dataMax, 0) + 5)
                  ]}
                  width={60}
                  stroke="currentColor"
                  className="text-muted-foreground"
                />
                <Tooltip content={<CustomTooltip />} />
                <Line 
                  type="monotone" 
                  dataKey="percentageChange" 
                  stroke="currentColor" 
                  strokeWidth={2} 
                  dot={false}
                  className="text-primary"
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