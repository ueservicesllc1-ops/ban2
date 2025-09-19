// src/components/header.tsx
'use client';
import { Icons } from "@/components/icons";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { LogOut, LayoutGrid } from "lucide-react";
import { useRouter } from 'next/navigation';

export function Header() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 max-w-screen-2xl items-center">
        <div className="mr-4 flex">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <Icons.logo className="h-8 w-8 text-primary" />
            <span className="font-bold font-headline text-xl sm:inline-block">
              BannerForge
            </span>
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-end space-x-2 sm:space-x-4">
          {user && (
            <>
               <Button variant="outline" asChild>
                <Link href="/portfolio">
                  <LayoutGrid className="mr-0 sm:mr-2" />
                  <span className="hidden sm:inline-block">Portafolio</span>
                </Link>
              </Button>
              <Button variant="ghost" size="icon" onClick={handleSignOut} title="Sign Out">
                <LogOut className="h-5 w-5" />
                <span className="sr-only">Sign Out</span>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
