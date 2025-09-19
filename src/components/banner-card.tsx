// src/components/banner-card.tsx
'use client';

import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { BannerData } from '@/app/portfolio/page';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { BannerActions } from './banner-actions';

interface BannerCardProps {
  banner: BannerData;
  onDelete: (bannerId: string) => void;
}

export function BannerCard({ banner, onDelete }: BannerCardProps) {
    
  const createdAtDate = banner.createdAt?.toDate();
  const timeAgo = createdAtDate 
    ? formatDistanceToNow(createdAtDate, { addSuffix: true, locale: es })
    : 'hace un momento';

  return (
    <Card className="overflow-hidden group transition-all hover:shadow-lg hover:-translate-y-1">
      <BannerActions banner={banner} onDelete={onDelete}>
        <CardContent className="p-0 cursor-pointer">
          <div className="relative aspect-[16/9] bg-muted">
            <Image
              src={banner.bannerImage}
              alt="Banner preview"
              layout="fill"
              objectFit="cover"
              className="transition-transform group-hover:scale-105"
              unoptimized
            />
          </div>
          <div className="p-4">
              <p className="text-sm font-medium truncate">{banner.text || 'Sin Título'}</p>
              <p className="text-xs text-muted-foreground mt-1">{timeAgo}</p>
          </div>
        </CardContent>
      </BannerActions>
    </Card>
  );
}

export function BannerCardSkeleton() {
    return (
        <div className="space-y-2">
            <Skeleton className="h-[125px] w-full rounded-lg" />
            <div className="space-y-2 p-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
            </div>
        </div>
    )
}
