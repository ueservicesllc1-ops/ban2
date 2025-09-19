// src/app/portfolio/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, DocumentData } from 'firebase/firestore';
import { useAuth } from '@/hooks/use-auth';
import { withAuth } from '@/components/with-auth';
import { Header } from '@/components/header';
import { BannerCard, BannerCardSkeleton } from '@/components/banner-card';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';

export interface BannerData extends DocumentData {
  id: string;
  bannerImage: string;
  logoImage?: string;
  text?: string;
  createdAt: any;
}

function PortfolioPage() {
  const { user } = useAuth();
  const [banners, setBanners] = useState<BannerData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    setIsLoading(true);
    const q = query(collection(db, 'users', user.uid, 'banners'), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const bannersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as BannerData));
      setBanners(bannersData);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching banners: ", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  return (
    <div className="flex flex-col min-h-dvh bg-background">
      <Header />
      <main className="flex-1">
        <div className="container mx-auto py-8">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold font-headline">Mi Portafolio</h1>
            <Button asChild>
              <Link href="/">
                <PlusCircle className="mr-2" />
                Crear Nuevo Banner
              </Link>
            </Button>
          </div>

          {isLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => <BannerCardSkeleton key={i} />)}
            </div>
          )}

          {!isLoading && banners.length === 0 && (
            <div className="text-center py-16 border-2 border-dashed rounded-lg">
                <h2 className="text-xl font-semibold">Tu portafolio está vacío</h2>
                <p className="text-muted-foreground mt-2 mb-4">¡Empieza a crear tu primer diseño ahora!</p>
                <Button asChild>
                  <Link href="/">Crear Banner</Link>
                </Button>
            </div>
          )}

          {!isLoading && banners.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {banners.map(banner => (
                <BannerCard key={banner.id} banner={banner} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default withAuth(PortfolioPage);
