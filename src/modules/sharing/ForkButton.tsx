'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '../../components/Button';
import { useAuthStore } from '../auth/authStore';
import { auth } from '@/config/firebase';
import { toast } from '../../stores/toastStore';

interface ForkButtonProps {
  recipeId: string;
  recipeName: string;
}

export default function ForkButton({ recipeId, recipeName }: ForkButtonProps) {
  const user = useAuthStore((s) => s.user);
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle);
  const router = useRouter();
  const [isForking, setIsForking] = useState(false);

  async function handleFork() {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    setIsForking(true);
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch('/api/fork', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ recipeId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to fork recipe');
      }

      const { recipeId: newId } = await res.json();
      toast.success(`Forked "${recipeName}" to your recipes`);
      router.push(`/recipes/${newId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to fork recipe');
    } finally {
      setIsForking(false);
    }
  }

  if (!user) {
    return (
      <Button variant="outline" size="sm" onClick={signInWithGoogle}>
        Sign in to save this recipe
      </Button>
    );
  }

  return (
    <Button variant="neon" size="sm" onClick={handleFork} loading={isForking}>
      Fork to My Recipes
    </Button>
  );
}
