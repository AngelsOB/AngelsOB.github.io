'use client';

import ModalOverlay from '../../beta-builder/presentation/components/ModalOverlay';
import Button from '../../../components/Button';
import { useAuthStore } from '../authStore';

interface SignInPromptProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SignInPrompt({ isOpen, onClose }: SignInPromptProps) {
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle);

  return (
    <ModalOverlay isOpen={isOpen} onClose={onClose} size="sm">
      <div className="p-6 text-center">
        <div className="text-4xl mb-3">🔐</div>
        <h2 className="text-xl font-bold mb-2">Sign in to save your recipe</h2>
        <p className="text-[var(--brew-text-secondary)] mb-6">
          It&apos;s free and takes one click. Your recipe will be saved automatically.
        </p>
        <div className="flex gap-3">
          <Button variant="ghost" onClick={onClose} fullWidth>
            Not Now
          </Button>
          <Button
            variant="neon"
            onClick={() => {
              signInWithGoogle();
              onClose();
            }}
            fullWidth
            leftIcon={
              <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
            }
          >
            Sign in with Google
          </Button>
        </div>
      </div>
    </ModalOverlay>
  );
}
