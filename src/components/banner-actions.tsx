// src/components/banner-actions.tsx
'use client'

import React, { useState, useRef, useCallback } from "react";
import { BannerData } from "@/app/portfolio/page";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent
} from "@/components/ui/dropdown-menu";
import { Download, Edit, Loader2, MoreVertical, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import * as htmlToImage from 'html-to-image';
import jsPDF from 'jspdf';
import Image from "next/image";
import { cn } from "@/lib/utils";
import { FONT_OPTIONS } from "@/lib/constants";
import { Button } from "@/components/ui/button";

interface BannerActionsProps {
  banner: BannerData;
  children: React.ReactNode;
  onDelete: (bannerId: string) => void;
}

const DOWNLOAD_SIZES = {
  small: { name: 'Pequeño', scale: 0.5 },
  medium: { name: 'Mediano', scale: 1 },
  large: { name: 'Grande', scale: 2 },
};

export function BannerActions({ banner, children, onDelete }: BannerActionsProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isDownloading, setIsDownloading] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const handleEdit = () => {
    router.push(`/?edit=${banner.id}`);
  };

  const performDownload = useCallback(async (format: 'png' | 'jpg' | 'pdf', size: 'small' | 'medium' | 'large') => {
    if (!previewRef.current) {
      toast({ variant: 'destructive', title: 'Error de Descarga', description: 'No se pudo encontrar el elemento de vista previa.' });
      return;
    }
    setIsDownloading(true);

    const { scale } = DOWNLOAD_SIZES[size];
    const { width = 1280, height = 720 } = banner.customDimensions || banner.preset && BANNER_PRESETS[banner.preset] || {};

    const fileName = `${banner.text || 'banner'}.${format}`;

    try {
      const options = {
        canvasWidth: width * scale,
        canvasHeight: height * scale,
        style: {
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          width: `${width}px`,
          height: `${height}px`,
        },
        pixelRatio: 1,
        fetchRequestInit: { 
          headers: new Headers(), 
          mode: 'cors' as RequestMode, 
          cache: 'no-cache' as RequestCache,
        }
      };

      let dataUrl;
      const element = previewRef.current;
      
      if (format === 'png') {
        dataUrl = await htmlToImage.toPng(element, { ...options, quality: 1 });
      } else if (format === 'jpg') {
        dataUrl = await htmlToImage.toJpeg(element, { ...options, quality: 0.95 });
      } else if (format === 'pdf') {
        const pngDataUrl = await htmlToImage.toPng(element, { ...options, quality: 1 });
        const doc = new jsPDF({
          orientation: width > height ? 'landscape' : 'portrait',
          unit: 'px',
          format: [width, height],
        });
        doc.addImage(pngDataUrl, 'PNG', 0, 0, width, height);
        doc.save(fileName);
        setIsDownloading(false);
        return;
      }

      if (dataUrl) {
        const link = document.createElement('a');
        link.download = fileName;
        link.href = dataUrl;
        link.click();
      } else {
        throw new Error('No se pudo generar la URL de datos.');
      }
    } catch (error) {
      console.error('Error en la descarga:', error);
      toast({
        variant: 'destructive',
        title: 'Error de Descarga',
        description: 'Ocurrió un error al generar tu archivo.',
      });
    } finally {
      setIsDownloading(false);
    }
  }, [banner, toast]);

  const { textStyle, textEffects, preset, customDimensions } = banner;
  const bannerDimensions = preset === 'custom' ? customDimensions : BANNER_PRESETS[preset as keyof typeof BANNER_PRESETS] || { width: 851, height: 315 };
  
  const headlineFont = FONT_OPTIONS.find(f => f.value === textStyle?.font)?.isHeadline ? 'font-headline' : 'font-body';
  const textPreviewStyles = {
      fontFamily: `'${textStyle?.font}', sans-serif`,
      fontSize: `${textStyle?.size}px`,
      color: textStyle?.color,
      textShadow: textEffects?.shadow.enabled
        ? `${textEffects.shadow.offsetX}px ${textEffects.shadow.offsetY}px ${textEffects.shadow.blur}px ${textEffects.shadow.color}`
        : 'none',
      WebkitTextStroke: textEffects?.stroke.enabled
        ? `${textEffects.stroke.width}px ${textEffects.stroke.color}`
        : 'unset',
  };

  return (
    <>
      {/* Hidden div for generating downloads */}
      <div className="fixed -left-[9999px] top-0">
          <div
              ref={previewRef}
              className="relative overflow-hidden bg-muted/50"
              style={{
                width: `${bannerDimensions.width}px`,
                height: `${bannerDimensions.height}px`,
              }}
            >
              {banner.bannerImage && (
                <Image src={banner.bannerImage} alt="Banner background" layout="fill" objectFit="cover" unoptimized crossOrigin="anonymous"/>
              )}

              {banner.logoImage && banner.logoPosition && (
                <div
                  className="absolute"
                  style={{
                    left: `${banner.logoPosition.x}%`,
                    top: `${banner.logoPosition.y}%`,
                    width: `${banner.logoSize}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  <div className="relative w-full h-full" style={{ aspectRatio: '1 / 1'}}>
                    <Image src={banner.logoImage} alt="Logo" layout="fill" objectFit="contain" unoptimized crossOrigin="anonymous"/>
                  </div>
                </div>
              )}

              {banner.bannerImage && banner.text && banner.textPosition && (
                  <div
                  className="absolute p-2"
                  style={{
                    left: `${banner.textPosition.x}%`,
                    top: `${banner.textPosition.y}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  <p
                    className={cn(headlineFont, 'font-bold whitespace-nowrap')}
                    style={{ ...textPreviewStyles, lineHeight: 1.2 } as React.CSSProperties}
                  >
                    {banner.text}
                  </p>
                </div>
              )}
            </div>
      </div>
    
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <div className="relative">
            {children}
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button variant="secondary" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem onClick={handleEdit}>
            <Edit className="mr-2" />
            Editar
          </DropdownMenuItem>
          
          <DropdownMenuSub>
            <DropdownMenuSubTrigger disabled={isDownloading}>
                {isDownloading ? <Loader2 className="mr-2 animate-spin" /> : <Download className="mr-2" />}
                Descargar
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
                <DropdownMenuItem onClick={() => performDownload('png', 'medium')}>PNG</DropdownMenuItem>
                <DropdownMenuItem onClick={() => performDownload('jpg', 'medium')}>JPG</DropdownMenuItem>
                <DropdownMenuItem onClick={() => performDownload('pdf', 'medium')}>PDF</DropdownMenuItem>
                <DropdownMenuSeparator/>
                 <DropdownMenuSub>
                    <DropdownMenuSubTrigger>Por tamaño</DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                         <DropdownMenuItem onClick={() => performDownload('png', 'small')}>PNG Pequeño</DropdownMenuItem>
                         <DropdownMenuItem onClick={() => performDownload('png', 'large')}>PNG Grande</DropdownMenuItem>
                    </DropdownMenuSubContent>
                </DropdownMenuSub>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10" onClick={() => onDelete(banner.id)}>
            <Trash2 className="mr-2" />
            Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

const BANNER_PRESETS: { [key: string]: { name: string; width: number; height: number; } } = {
  facebookCover: { name: 'Facebook Cover', width: 851, height: 315 },
  instagramPost: { name: 'Instagram Post', width: 1080, height: 1080 },
  instagramStory: { name: 'Instagram Story', width: 1080, height: 1920 },
  twitterHeader: { name: 'Twitter Header', width: 1500, height: 500 },
  linkedinBanner: { name: 'LinkedIn Banner', width: 1584, height: 396 },
  youtubeChannel: { name: 'YouTube Channel Art', width: 2560, height: 1440 },
};
