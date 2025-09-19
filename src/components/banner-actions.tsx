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
  DropdownMenuSubContent,
  DropdownMenuPortal
} from "@/components/ui/dropdown-menu";
import { Download, Edit, Loader2, MoreVertical, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import * as htmlToImage from 'html-to-image';
import jsPDF from 'jspdf';
import Image from "next/image";
import { cn } from "@/lib/utils";
import { FONT_OPTIONS, BANNER_PRESETS } from "@/lib/constants";
import { Button } from "@/components/ui/button";

interface BannerActionsProps {
  banner: BannerData;
  children: React.ReactNode;
  onDelete: (bannerId: string) => void;
}

type DownloadSize = 'small' | 'medium' | 'large';
const DOWNLOAD_SIZES: Record<DownloadSize, { name: string, width: number }> = {
  small: { name: 'Pequeño', width: 600 },
  medium: { name: 'Mediano', width: 1080 },
  large: { name: 'Grande', width: 1920 },
};

export function BannerActions({ banner, children, onDelete }: BannerActionsProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isDownloading, setIsDownloading] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const handleEdit = () => {
    router.push(`/?edit=${banner.id}`);
  };

  const performDownload = useCallback(async (format: 'png' | 'jpg' | 'pdf', size: DownloadSize = 'medium') => {
    if (!previewRef.current) {
        toast({ variant: 'destructive', title: 'Error de Descarga', description: 'No se pudo encontrar el elemento de vista previa.' });
        return;
    }
    setIsDownloading(true);

    const bannerNode = previewRef.current;
    const bannerDimensions = (banner.preset === 'custom' ? banner.customDimensions : (banner.preset && BANNER_PRESETS[banner.preset as keyof typeof BANNER_PRESETS])) || { width: 851, height: 315 };
    const fileName = `${banner.text?.substring(0, 20) || 'banner'}-${size}.${format}`;

    try {
        const tempNode = bannerNode.cloneNode(true) as HTMLElement;
        // The clone needs to be in the DOM to be processed by html-to-image
        tempNode.style.position = 'fixed';
        tempNode.style.left = '-9999px';
        tempNode.style.top = '0px';
        document.body.appendChild(tempNode);

        // Preload and embed images
        const images = Array.from(tempNode.getElementsByTagName('img'));
        for (const img of images) {
            if (img.src.startsWith('http')) {
                 try {
                    const response = await fetch(img.src, { mode: 'cors', cache: 'no-cache' });
                    const blob = await response.blob();
                    const dataUrl = await new Promise<string>(resolve => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result as string);
                        reader.readAsDataURL(blob);
                    });
                    img.src = dataUrl;
                } catch (e) {
                    console.warn(`No se pudo cargar la imagen a base64: ${img.src}`, e);
                }
            }
        }
        
        // Embed fonts
        const styleSheets = Array.from(document.styleSheets);
        let cssText = '';
        const embedGoogleFont = async (cssRule: string): Promise<string> => {
            const urlMatch = cssRule.match(/url\((https?:\/\/[^)]+)\)/);
            if (!urlMatch) return cssRule;
            const fontUrl = urlMatch[1];
            try {
                const res = await fetch(fontUrl);
                const fontBuffer = await res.arrayBuffer();
                const fontBase64 = btoa(new Uint8Array(fontBuffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));
                return cssRule.replace(fontUrl, `data:font/woff2;base64,${fontBase64}`);
            } catch (e) {
                console.warn('No se pudo embeder la fuente', fontUrl, e);
                return cssRule;
            }
        };

        for (const sheet of styleSheets) {
            try {
                if (sheet.cssRules) {
                    for (const rule of Array.from(sheet.cssRules)) {
                        if (rule.cssText.startsWith('@font-face')) {
                            cssText += await embedGoogleFont(rule.cssText);
                        } else {
                            cssText += rule.cssText;
                        }
                    }
                }
            } catch (e) {
                console.warn('No se pudo acceder a la hoja de estilos, omitiendo: ', e);
            }
        }
        const styleEl = document.createElement('style');
        styleEl.innerHTML = cssText;
        tempNode.prepend(styleEl);

        const targetWidth = DOWNLOAD_SIZES[size].width;
        const scaleFactor = targetWidth / bannerDimensions.width;
        const targetHeight = bannerDimensions.height * scaleFactor;

        const options = {
            width: bannerDimensions.width,
            height: bannerDimensions.height,
            style: {
                transform: `scale(${scaleFactor})`,
                transformOrigin: 'top left',
            },
            pixelRatio: 2, // for high quality
        };

        if (format === 'pdf') {
            const jpegData = await htmlToImage.toJpeg(tempNode, { ...options, quality: 0.95 });
            const doc = new jsPDF({
                orientation: targetWidth > targetHeight ? 'landscape' : 'portrait',
                unit: 'px',
                format: [targetWidth, targetHeight],
            });
            doc.addImage(jpegData, 'JPEG', 0, 0, targetWidth, targetHeight);
            doc.save(fileName);
        } else {
            const generator = format === 'png' ? htmlToImage.toPng : htmlToImage.toJpeg;
            const dataUrl = await generator(tempNode, options);
            const link = document.createElement('a');
            link.download = fileName;
            link.href = dataUrl;
            link.click();
        }
        
        document.body.removeChild(tempNode);
        toast({ title: 'Descarga Iniciada', description: `Tu ${format.toUpperCase()} se está descargando.` });

    } catch (error) {
        console.error('Error en la descarga:', error);
        toast({
            variant: 'destructive',
            title: 'Error de Descarga',
            description: 'Ocurrió un error al generar tu archivo. Revisa la consola para más detalles.',
        });
    } finally {
        setIsDownloading(false);
    }
  }, [banner, toast]);

  const { textStyle, textEffects, preset, customDimensions } = banner;
  const bannerDimensions = preset === 'custom' ? customDimensions : (preset && BANNER_PRESETS[preset as keyof typeof BANNER_PRESETS]) || { width: 851, height: 315 };
  
  const headlineFont = FONT_OPTIONS.find(f => f.value === textStyle?.font)?.isHeadline ? 'font-headline' : 'font-body';
  const textPreviewStyles = {
      fontFamily: `'${textStyle?.font}', sans-serif`,
      fontSize: `${textStyle?.size}px`,
      color: textStyle?.color,
      textShadow: textEffects?.shadow.enabled
        ? `${textEffects.shadow.offsetX}px ${textEffects.shadow.offsetY}px ${textEffects.shadow.blur}px ${textEffects.shadow.color}`
        : 'none',
  };

  return (
    <>
      {/* Hidden div for generating downloads */}
      <div className="fixed -left-[9999px] top-0">
          <div
              ref={previewRef}
              id={`preview-node-${banner.id}`}
              className="relative overflow-hidden bg-muted/50"
              style={{
                width: `${bannerDimensions?.width}px`,
                height: `${bannerDimensions?.height}px`,
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
                    className={cn(headlineFont, 'font-bold whitespace-nowrap', {'text-stroke': textEffects?.stroke.enabled})}
                    style={{ ...textPreviewStyles, '--tw-stroke-color': textEffects?.stroke.color, '--tw-stroke-width': `${textEffects?.stroke.width}px`, lineHeight: 1.2 } as React.CSSProperties}
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
            <Edit className="mr-2 h-4 w-4" />
            <span>Editar</span>
          </DropdownMenuItem>
          
          <DropdownMenuSub>
            <DropdownMenuSubTrigger disabled={isDownloading}>
                {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                <span>Descargar</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent>
                {(Object.keys(DOWNLOAD_SIZES) as DownloadSize[]).map((sizeKey) => (
                    <DropdownMenuSub key={sizeKey}>
                      <DropdownMenuSubTrigger>{DOWNLOAD_SIZES[sizeKey].name}</DropdownMenuSubTrigger>
                      <DropdownMenuPortal>
                        <DropdownMenuSubContent>
                          {(['png', 'jpg', 'pdf'] as const).map((format) => (
                            <DropdownMenuItem key={format} onClick={() => performDownload(format, sizeKey)}>
                              {format.toUpperCase()}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuSubContent>
                      </DropdownMenuPortal>
                    </DropdownMenuSub>
                  ))}
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>
          
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10" onClick={() => onDelete(banner.id)}>
            <Trash2 className="mr-2 h-4 w-4" />
            <span>Eliminar</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
