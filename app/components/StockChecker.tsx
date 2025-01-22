
"use client";
/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import PortfolioPerformance from "@/app/components/PortfolioPerformance"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { db, auth } from '@/firebase/firebase';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  query,
  updateDoc,
  addDoc,
  serverTimestamp,
  orderBy
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { 
  CalendarIcon, 
  PlusCircle, 
  TrendingUp, 
  TrendingDown, 
  XCircle,
  History,
  LogOut
} from "lucide-react";
import { format } from "date-fns";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

// Register Chart.js components
ChartJS.register(ArcElement, Tooltip, Legend);

interface Position {
  symbol: string;
  data: {
    amount: number;
    purchasePrice: number;
    currentPrice: number;
    percentageChange: string;
    totalValue: string;
    profitLoss: string;
    purchaseDate: Date | string;
  };
}
interface PositionHistoryEntry {
  timestamp: string;
  dateOfAction: string;
  type: "NEW_POSITION" | "INCREASE_POSITION" | "PARTIAL_CLOSE" | "CLOSE_POSITION";
  symbol: string;
  shares: number;
  price: number;
  newAveragePrice?: string;
  totalShares?: number;
  realizedGain?: string;
}

const formatDate = (date: Date | null | undefined) => {
  if (!date) return 'N/A';
  try {
    return format(date, "PPP");
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Invalid date';
  }
};

const StockChecker = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const [stockSymbol, setStockSymbol] = useState('');
  const [amount, setAmount] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [date, setDate] = useState(new Date());
  const [positions, setPositions] = useState(new Map());
  const [realizedPnL, setRealizedPnL] = useState(new Map());
  const [errorMessage, setErrorMessage] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isCloseDialogOpen, setIsCloseDialogOpen] = useState(false);
  const [industryAllocation, setIndustryAllocation] = useState<Record<string, number>>({});
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  const [closeAmount, setCloseAmount] = useState('');
  const [closeType, setCloseType] = useState('full');
  const [positionHistory, setPositionHistory] = useState<PositionHistoryEntry[]>([]);

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUserId(user?.uid || null);
      if (user) {
        loadUserData(user.uid);
      } else {
        // Clear local state when user logs out
        setPositions(new Map());
        setRealizedPnL(new Map());
        setPositionHistory([]);
        setIndustryAllocation({});
      }
    });

    return () => unsubscribe();
  }, []);

  // Load user data from Firestore
  const loadUserData = async (uid: string) => {
    try {
      // Load positions
      const positionsRef = collection(db, `users/${uid}/positions`);
      const positionsSnapshot = await getDocs(positionsRef);
      const positionsMap = new Map();
      positionsSnapshot.forEach((doc) => {
        const data = doc.data();
        // Convert Firestore Timestamp to Date
        const position = {
          ...data,
          purchaseDate: data.purchaseDate?.toDate() || new Date()
        };
        positionsMap.set(doc.id, position);
      });
      setPositions(positionsMap);

      // Load realized P&L
      const pnlRef = collection(db, `users/${uid}/realizedPnL`);
      const pnlSnapshot = await getDocs(pnlRef);
      const pnlMap = new Map();
      pnlSnapshot.forEach((doc) => {
        pnlMap.set(doc.id, doc.data().amount);
      });
      setRealizedPnL(pnlMap);

      // Load position history
      const historyRef = collection(db, `users/${uid}/history`);
      const historyQuery = query(historyRef, orderBy('timestamp', 'desc'));
      const historySnapshot = await getDocs(historyQuery);
      const history = historySnapshot.docs.map(doc => {
        const data = doc.data();
        const date = data.timestamp?.toDate() || new Date();
        const actionDate = data.dateOfAction?.toDate() || date;
        return {
          type: data.type as "NEW_POSITION" | "INCREASE_POSITION" | "PARTIAL_CLOSE" | "CLOSE_POSITION",
          symbol: data.symbol,
          shares: data.shares,
          price: data.price,
          timestamp: format(date, "yyyy-MM-dd'T'HH:mm:ss"),
          dateOfAction: format(actionDate, "yyyy-MM-dd'T'HH:mm:ss"),
          newAveragePrice: data.newAveragePrice,
          totalShares: data.totalShares,
          realizedGain: data.realizedGain
        };
      });
      setPositionHistory(history);

      // Load industry data
      const industriesRef = collection(db, `users/${uid}/industries`);
      const industriesSnapshot = await getDocs(industriesRef);
      const allocationData: { [key: string]: number } = {};
      industriesSnapshot.forEach((doc) => {
        allocationData[doc.data().industry] = doc.data().allocation;
      });
      setIndustryAllocation(allocationData);
    } catch (error) {
      console.error('Error loading user data:', error);
      setErrorMessage('Error loading your portfolio data.');
    }
  };

  const fetchIndustry = async (symbol: string) => {
    const API_KEY = "cu5337hr01qo4c10s9agcu5337hr01qo4c10s9b0";
    try {
      const response = await axios.get(
        `https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${API_KEY}`
      );
      return response.data.finnhubIndustry || "Unknown";
    } catch (error) {
      console.error(`Error fetching industry for ${symbol}:`, error);
      return "Unknown";
    }
  };

  const updateIndustryData = useCallback(async () => {
    if (!userId) return;
    
    try {
      const allocation: { [key: string]: number } = {};

      for (const [symbol, data] of positions.entries()) {
        const industry = await fetchIndustry(symbol);
        const totalValue = Number(data.totalValue);
        allocation[industry] = (allocation[industry] || 0) + totalValue;

        // Save industry data to Firestore
        await setDoc(doc(db, `users/${userId}/industries/${symbol}`), {
          industry,
          allocation: totalValue
        });
      }

      setIndustryAllocation(allocation);
    } catch (error) {
      console.error('Error updating industry data:', error);
    }
  }, [userId, positions]);

  useEffect(() => {
    if (positions.size > 0) {
      updateIndustryData();
    }
  }, [positions, updateIndustryData]);

  const handleAddStock = async () => {
    if (!userId) {
      setErrorMessage('Please sign in to add positions.');
      return;
    }
    if (!stockSymbol || !amount || !purchasePrice) {
      setErrorMessage('Please fill in all fields.');
      return;
    }

    try {
      setErrorMessage('');
      const API_KEY = 'cu5337hr01qo4c10s9agcu5337hr01qo4c10s9b0';
      const response = await axios.get(
        `https://finnhub.io/api/v1/quote?symbol=${stockSymbol.toUpperCase()}&token=${API_KEY}`
      );

      const data = response.data;
      if (data && data.c) {
        const currentPrice = data.c;
        const symbol = stockSymbol.toUpperCase();
        const positionRef = doc(db, `users/${userId}/positions/${symbol}`);
        
        if (positions.has(symbol)) {
          // Update existing position
          const existingPosition = positions.get(symbol);
          const totalShares = existingPosition.amount + Number(amount);
          const newAvgPrice = ((existingPosition.amount * existingPosition.purchasePrice) + 
                             (Number(amount) * Number(purchasePrice))) / totalShares;
          
          const updatedPosition = {
            amount: totalShares,
            purchasePrice: Number(newAvgPrice.toFixed(2)),
            currentPrice: Number(currentPrice.toFixed(2)),
            percentageChange: ((currentPrice - newAvgPrice) / newAvgPrice * 100).toFixed(2),
            totalValue: (currentPrice * totalShares).toFixed(2),
            profitLoss: ((currentPrice * totalShares) - (newAvgPrice * totalShares)).toFixed(2),
            purchaseDate: date
          };

          await updateDoc(positionRef, updatedPosition);
          
          // Add to history
          await addDoc(collection(db, `users/${userId}/history`), {
            type: 'INCREASE_POSITION',
            symbol,
            shares: Number(amount),
            price: Number(purchasePrice),
            totalShares,
            newAveragePrice: newAvgPrice.toFixed(2),
            timestamp: serverTimestamp()
          });

        } else {
          // Add new position
          const newPosition = {
            currentPrice: Number(currentPrice.toFixed(2)),
            purchasePrice: Number(purchasePrice),
            amount: Number(amount),
            purchaseDate: date,            percentageChange: ((currentPrice - Number(purchasePrice)) / Number(purchasePrice) * 100).toFixed(2),
            totalValue: (currentPrice * Number(amount)).toFixed(2),
            profitLoss: ((currentPrice * Number(amount)) - (Number(purchasePrice) * Number(amount))).toFixed(2)
          };

          await setDoc(positionRef, newPosition);

          // Add to history
          await addDoc(collection(db, `users/${userId}/history`), {
            type: 'NEW_POSITION',
            symbol,
            shares: Number(amount),
            price: Number(purchasePrice),
            timestamp: serverTimestamp(),
            dateOfAction: date
          });
        }

        // Refresh data
        await loadUserData(userId);
        
        setStockSymbol('');
        setAmount('');
        setPurchasePrice('');
        setIsAddDialogOpen(false);
      } else {
        setErrorMessage('Not a real stock.');
      }
    } catch (error) {
      console.error('Error adding stock:', error);
      setErrorMessage('Error adding stock position. Please try again.');
    }
  };

  const handleClosePosition = async () => {
    if (!userId || !selectedPosition) return;
    
    try {
      const API_KEY = 'cu5337hr01qo4c10s9agcu5337hr01qo4c10s9b0';
      const response = await axios.get(
        `https://finnhub.io/api/v1/quote?symbol=${selectedPosition.symbol}&token=${API_KEY}`
      );

      const currentPrice = response.data.c;
      const sharesToClose = closeType === 'full' ? 
        selectedPosition.data.amount : 
        Number(closeAmount);

      if (sharesToClose > selectedPosition.data.amount) {
        setErrorMessage('Cannot close more shares than owned.');
        return;
      }

      const realizedGain = (
        (currentPrice - Number(selectedPosition.data.purchasePrice)) * 
        sharesToClose
      ).toFixed(2);

      // Update realized P&L in Firestore
      const pnlRef = doc(db, `users/${userId}/realizedPnL/${selectedPosition.symbol}`);
      const existingPnL = realizedPnL.get(selectedPosition.symbol) || 0;
      await setDoc(pnlRef, {
        amount: (Number(existingPnL) + Number(realizedGain)).toFixed(2)
      });

      // Add to history in Firestore
      await addDoc(collection(db, `users/${userId}/history`), {
        type: closeType === 'full' ? 'CLOSE_POSITION' : 'PARTIAL_CLOSE',
        symbol: selectedPosition.symbol,
        shares: sharesToClose,
        price: currentPrice,
        realizedGain,
        timestamp: serverTimestamp(),
        dateOfAction: new Date()
      });

      // Update or remove position in Firestore
      const positionRef = doc(db, `users/${userId}/positions/${selectedPosition.symbol}`);
      if (closeType === 'full' || sharesToClose === selectedPosition.data.amount) {
        await deleteDoc(positionRef);
      } else {
        const remainingShares = selectedPosition.data.amount - sharesToClose;
        await updateDoc(positionRef, {
          amount: remainingShares,
          totalValue: (currentPrice * remainingShares).toFixed(2),
          profitLoss: ((currentPrice - selectedPosition.data.purchasePrice) * remainingShares).toFixed(2)
        });
      }

      // Refresh data
      await loadUserData(userId);
      
      setIsCloseDialogOpen(false);
      setSelectedPosition(null);
      setCloseAmount('');
      setCloseType('full');
      
    } catch (error) {
      console.error('Error closing position:', error);
      setErrorMessage('Error closing position. Please try again.');
    }
  };

  const handleSignOut = async () => {
    try {
      await auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const getPortfolioDiversificationData = () => {
    const symbols = Array.from(positions.keys());
    const values = Array.from(positions.values()).map(pos => Number(pos.totalValue));

    return {
      labels: symbols,
      datasets: [{
        data: values,
        backgroundColor: [
          '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'
        ],
        hoverBackgroundColor: [
          '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'
        ]
      }]
    };
  };

  const diversificationData = {
    labels: Object.keys(industryAllocation),
    datasets: [{
      data: Object.values(industryAllocation),
      backgroundColor: [
        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'
      ],
      hoverBackgroundColor: [
        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'
      ]
    }]
  };

  return (
    <div className="space-y-8">
      {!userId ? (
        <Card className="w-full max-w-6xl mx-auto">
          <CardContent className="p-6 text-center">
            <p className="mb-4">Please sign in to manage your portfolio.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex justify-end max-w-6xl mx-auto">
            <Button variant="outline" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>

          <Card className="w-full max-w-6xl mx-auto">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Stock Positions</CardTitle>
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Stock
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Stock Position</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                      <Input
                        type="text"
                        placeholder="Enter stock symbol (e.g., AAPL)"
                        value={stockSymbol}
                        onChange={(e) => setStockSymbol(e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <Input
                        type="number"
                        placeholder="Number of shares"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                      />
                      <Input
                        type="number"
                        placeholder="Purchase price per share"
                        value={purchasePrice}
                        onChange={(e) => setPurchasePrice(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start text-left font-normal">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {date ? format(date, "PPP") : <span>Pick a date</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={date}
                            onSelect={(day: Date | undefined) => day && setDate(day)}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    {errorMessage && (
                      <Alert variant="destructive">
                        <AlertDescription>{errorMessage}</AlertDescription>
                      </Alert>
                    )}
                    <Button onClick={handleAddStock}>Add Position</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {positions.size > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.from(positions.entries()).map(([symbol, data], index) => (
                    <Card key={index} className="relative">
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-center">
                          <CardTitle className="text-xl font-bold">{symbol}</CardTitle>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedPosition({ symbol, data });
                              setIsCloseDialogOpen(true);
                            }}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Shares</span>
                          <span className="font-medium">{data.amount}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Purchase Price</span>
                          <span className="font-medium">${data.purchasePrice}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Current Price</span>
                          <span className="font-medium">${data.currentPrice}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">% Change</span>
                          <div className="flex items-center">
                            {Number(data.percentageChange) > 0 ? (
                              <TrendingUp className="mr-1 h-4 w-4 text-green-500" />
                            ) : (
                              <TrendingDown className="mr-1 h-4 w-4 text-red-500" />
                            )}
                            <span className={Number(data.percentageChange) > 0 ? "text-green-500" : "text-red-500"}>
                              {data.percentageChange}%
                            </span>
                          </div>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Total Value</span>
                          <span className="font-medium">${data.totalValue}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Unrealized P/L</span>
                          <span className={Number(data.profitLoss) > 0 ? "text-green-500 font-medium" : "text-red-500 font-medium"}>
                            ${Math.abs(data.profitLoss)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Realized P/L</span>
                          <span className={Number(realizedPnL.get(symbol) || 0) > 0 ? "text-green-500 font-medium" : "text-red-500 font-medium"}>
                            ${Math.abs(realizedPnL.get(symbol) || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Purchase Date</span>
                          <span className="font-medium">{formatDate(data.purchaseDate)}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  No stock positions added yet. Click &quot;Add Stock&quot; to get started.
                </div>
              )}

              <Dialog open={isCloseDialogOpen} onOpenChange={setIsCloseDialogOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Close Position</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <RadioGroup value={closeType} onValueChange={setCloseType}>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="full" id="full" />
                        <Label htmlFor="full">Close entire position</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="partial" id="partial" />
                        <Label htmlFor="partial">Close partial position</Label>
                      </div>
                    </RadioGroup>

                    {closeType === 'partial' && (
                      <div className="space-y-2">
                        <Input
                          type="number"
                          placeholder="Number of shares to close"
                          value={closeAmount}
                          onChange={(e) => setCloseAmount(e.target.value)}
                        />
                      </div>
                    )}
                    
                    {errorMessage && (
                      <Alert variant="destructive">
                        <AlertDescription>{errorMessage}</AlertDescription>
                      </Alert>
                    )}
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsCloseDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleClosePosition}>
                      Close Position
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>

          <PortfolioPerformance 
  positions={Array.from(positions, ([symbol, data]) => ({
    symbol,
    shares: data.amount,
    price: data.currentPrice,
    purchasePrice: data.purchasePrice,
    purchaseDate: data.purchaseDate instanceof Date ? 
      data.purchaseDate : 
      new Date(data.purchaseDate)
  }))} 
  positionHistory={positionHistory.map(entry => ({
    ...entry,
    timestamp: entry.timestamp.toString(),
    dateOfAction: entry.dateOfAction.toString()
  }))} 
/>

          <Card className="w-full max-w-6xl mx-auto">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Portfolio Diversification</CardTitle>
            </CardHeader>
            <CardContent>
              {positions.size > 0 || Object.keys(industryAllocation).length > 0 ? (
                <div className="flex justify-center space-x-4">
                  {positions.size > 0 && (
                    <div style={{ width: '400px' }}>
                      <h3 className="text-center mb-4">By Stock</h3>
                      <Pie data={getPortfolioDiversificationData()} />
                    </div>
                  )}
                  {Object.keys(industryAllocation).length > 0 && (
                    <div style={{ width: '400px' }}>
                      <h3 className="text-center mb-4">By Industry</h3>
                      <Pie data={diversificationData} />
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  No data available to show diversification. Add stocks to view details.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="w-full max-w-6xl mx-auto">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Position History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date Tracked</TableHead>
                    <TableHead>Date of Action</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Shares</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {positionHistory.map((entry, index) => (
                    <TableRow key={index}>
                      <TableCell>{format(new Date(entry.timestamp), "MMM d, yyyy HH:mm")}</TableCell>
                      <TableCell>{format(new Date(entry.dateOfAction), "MMM d, yyyy")}</TableCell>
                      <TableCell>
                        {entry.type === 'NEW_POSITION' && 'Opened Position'}
                        {entry.type === 'INCREASE_POSITION' && 'Increased Position'}
                        {entry.type === 'PARTIAL_CLOSE' && 'Partial Close'}
                        {entry.type === 'CLOSE_POSITION' && 'Closed Position'}
                      </TableCell>
                      <TableCell className="font-medium">{entry.symbol}</TableCell>
                      <TableCell>{entry.shares}</TableCell>
                      <TableCell>${typeof entry.price === 'number' ? entry.price.toFixed(2) : entry.price}</TableCell>
                      <TableCell>
                        {entry.type === 'INCREASE_POSITION' && 
                          `New Avg: ${entry.newAveragePrice} (Total: ${entry.totalShares} shares)`}
                        {(entry.type === 'PARTIAL_CLOSE' || entry.type === 'CLOSE_POSITION') && 
                          `P/L: ${Number(entry.realizedGain) >= 0 ? '+' : ''}${entry.realizedGain}`}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {positionHistory.length === 0 && (
                <div className="text-center py-6 text-muted-foreground">
                  No position history yet. Actions will appear here when you start trading.
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default StockChecker;