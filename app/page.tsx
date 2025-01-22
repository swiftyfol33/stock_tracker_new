'use client';

import { useAuth } from '../contexts/AuthContext';
import StockChecker from './components/StockChecker';
import SignInForm from '@/components/auth/SignInForm';
import SignUpForm from '@/components/auth/SignUpForm';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

export default function Home() {
  const { user, loading } = useAuth();
  const [showSignUp, setShowSignUp] = useState(false);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        {showSignUp ? (
          <>
            <SignUpForm />
            <p className="text-center mt-4">
              Already have an account?{' '}
              <Button variant="link" onClick={() => setShowSignUp(false)}>
                Sign In
              </Button>
            </p>
          </>
        ) : (
          <>
            <SignInForm />
            <p className="text-center mt-4">
              Don&apos;t have an account?{' '}
              <Button variant="link" onClick={() => setShowSignUp(true)}>
                Sign Up
              </Button>
            </p>
          </>
        )}
      </div>
    );
  }

  return <StockChecker />;
}