import { Suspense } from 'react';
import Link from 'next/link';
import { ChefHat } from 'lucide-react';
import { SignupForm } from './signup-form';

export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-md rounded-lg border bg-card p-8 shadow-sm">
        <Link href="/" className="mb-6 flex items-center gap-2">
          <ChefHat className="h-6 w-6 text-primary" />
          <span className="font-bold">CaterOS</span>
        </Link>
        <h1 className="mb-2 text-2xl font-semibold">Create your catering org</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Get started in 60 seconds — no credit card required.
        </p>
        <Suspense fallback={<div className="h-80" />}>
          <SignupForm />
        </Suspense>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
