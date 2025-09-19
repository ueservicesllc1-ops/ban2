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

  const embedGoogleFont = async (cssRule: string): Promise<string> => {
    const urlMatch = cssRule.match(/url\((https?:\/\/[^)]+)\)/);
    if (!urlMatch) return cssRule;
  
    const fontUrl = urlMatch[1];
    try {
      const res = await fetch(fontUrl);
      const fontBuffer = await res.arrayBuffer();
      const fontBase64 = btoa(
        new Uint8Array(fontBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );
  
      return cssRule.replace(urlMatch[1], `data:font/woff2;base64,${fontBase64}`);
    } catch (e) {
      console.warn('No se pudo embeder la fuente', fontUrl, e);
      return cssRule;
    }
  };

  const performDownload = useCallback(async (format: 'png' | 'jpg' | 'pdf', sizeKey: keyof typeof DOWNLOAD_SIZES) => {
    if (!previewRef.current) {
        toast({ variant: 'destructive', title: 'Error de Descarga', description: 'No se pudo encontrar el elemento de vista previa.' });
        return;
    }
    setIsDownloading(true);

    const { scale: sizeScale } = DOWNLOAD_SIZES[sizeKey];
    const bannerDimensions = (banner.preset === 'custom' ? banner.customDimensions : (banner.preset && BANNER_PRESETS[banner.preset as keyof typeof BANNER_PRESETS])) || { width: 851, height: 315 };
    const { width = 851, height = 315 } = bannerDimensions;
    
    const fileName = `${banner.text?.substring(0, 20) || 'banner'}-${sizeKey}.${format}`;

    try {
        const styleSheets = Array.from(document.styleSheets);
        let cssText = '';

        for (const sheet of styleSheets) {
            try {
                const rules = sheet.cssRules;
                if (rules) {
                    for (const rule of Array.from(rules)) {
                        if (rule.cssText.startsWith('@font-face')) {
                            cssText += await embedGoogleFont(rule.cssText);
                        } else {
                            cssText += rule.cssText;
                        }
                    }
                }
            } catch (e) {
                console.warn('No se pudo acceder a la hoja de estilos, omitiendo: ', e);
                continue;
            }
        }
        
        const styleEl = document.createElement('style');
        styleEl.innerHTML = cssText;
        
        const dataUrlOptions: htmlToImage.Options = {
            width,
            height,
            style: {
              transform: `scale(${sizeScale})`,
              transformOrigin: 'top left',
              width: `${width}px`,
              height: `${height}px`
            },
            pixelRatio: 1,
            fetchRequestInit: {
                mode: 'cors',
                credentials: 'omit',
            },
            imagePlaceholder: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
        };

        const generateAndDownload = async (generator: (node: HTMLElement, options?: any) => Promise<string>, options: any, ext: 'png' | 'jpeg') => {
            const tempNode = previewRef.current!.cloneNode(true) as HTMLElement;
            tempNode.prepend(styleEl);

            const images = Array.from(tempNode.getElementsByTagName('img'));
            for(const img of images){
                if(img.src.startsWith('http')) {
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
            
            const dataUrl = await generator(tempNode, options);
            if (ext === 'jpeg' && format === 'pdf') {
                const doc = new jsPDF({
                    orientation: width > height ? 'landscape' : 'portrait',
                    unit: 'px',
                    format: [width * sizeScale, height * sizeScale],
                });
                doc.addImage(dataUrl, 'JPEG', 0, 0, width * sizeScale, height * sizeScale);
                doc.save(fileName);
            } else {
                const link = document.createElement('a');
                link.download = fileName;
                link.href = dataUrl;
                link.click();
            }
        };

        if (format === 'png') {
            await generateAndDownload(htmlToImage.toPng, dataUrlOptions, 'png');
        } else if (format === 'jpg') {
            await generateAndDownload(htmlToImage.toJpeg, { ...dataUrlOptions, quality: 0.95 }, 'jpeg');
        } else if (format === 'pdf') {
            await generateAndDownload(htmlToImage.toJpeg, { ...dataUrlOptions, quality: 0.95 }, 'jpeg');
        }

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
                {(Object.keys(DOWNLOAD_SIZES) as Array<keyof typeof DOWNLOAD_SIZES>).map((sizeKey) => (
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

    

    