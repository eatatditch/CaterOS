import { Suspense } from 'react';
import Link from 'next/link';
import { ChefHat } from 'lucide-react';
import { LoginForm } from './login-form';

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-md rounded-lg border bg-card p-8 shadow-sm">
        <Link href="/" className="mb-6 flex items-center gap-2">
          <ChefHat className="h-6 w-6 text-primary" />
          <span className="font-bold">CaterOS</span>
        </Link>
        <h1 className="mb-2 text-2xl font-semibold">Welcome back</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Log in to manage events, quotes, and your team.
        </p>
        <Suspense fallback={<div className="h-64" />}>
          <LoginForm />
        </Suspense>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="font-medium text-primary hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
