'use client';

import { ThemeToggle } from './theme-toggle';
import { Button } from './ui/button';
import { useAuth } from '@/contexts/AuthContext';

export function Header() {
  const { logout } = useAuth();

  return (
    <header className="border-b">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <h1 className="text-xl font-semibold">Stock Tracker</h1>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => logout()}
          >
            Sign Out
          </Button>
        </div>
      </div>
    </header>
  );
}