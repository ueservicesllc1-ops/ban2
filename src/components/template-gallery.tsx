// src/components/template-gallery.tsx
'use client';

import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { templates, Template } from '@/lib/templates';
import { cn } from '@/lib/utils';
import { FONT_OPTIONS } from '@/lib/constants';

interface TemplateGalleryProps {
    onSelectTemplate: (template: Template) => void;
}

export function TemplateGallery({ onSelectTemplate }: TemplateGalleryProps) {
    return (
        <div className="p-4">
            <h3 className="text-lg font-semibold mb-4 px-2 font-headline">Inspírate con una Plantilla</h3>
            <ScrollArea className="w-full whitespace-nowrap">
                <div className="flex space-x-4 pb-4">
                    {templates.map((template) => {
                        const { textStyle, textEffects } = template;
                        const headlineFont = FONT_OPTIONS.find(f => f.value === textStyle?.font)?.isHeadline ? 'font-headline' : 'font-body';
                        const textPreviewStyles = {
                            fontFamily: `'${textStyle?.font}', sans-serif`,
                            fontSize: `12px`, // Use a smaller, fixed size for preview
                            color: textStyle?.color,
                            textShadow: textEffects?.shadow.enabled
                              ? `${textEffects.shadow.offsetX/4}px ${textEffects.shadow.offsetY/4}px ${textEffects.shadow.blur/4}px ${textEffects.shadow.color}`
                              : 'none',
                        };

                        return (
                            <Card 
                                key={template.id} 
                                className="w-64 h-36 overflow-hidden shrink-0 cursor-pointer group hover:ring-2 hover:ring-primary transition-all"
                                onClick={() => onSelectTemplate(template)}
                            >
                                <CardContent className="p-0 h-full">
                                    <div className="relative w-full h-full bg-muted/50">
                                        <Image 
                                            src={template.bannerImage} 
                                            alt={template.name}
                                            layout="fill"
                                            objectFit="cover"
                                            className="group-hover:scale-105 transition-transform"
                                            unoptimized
                                        />
                                        <div className="absolute inset-0 bg-black/30"></div>
                                        
                                        {/* Simplified preview of elements */}
                                        {template.logoImage && (
                                            <div 
                                                className="absolute" 
                                                style={{
                                                    top: `${template.logoPosition.y}%`,
                                                    left: `${template.logoPosition.x}%`,
                                                    width: `${template.logoSize}%`,
                                                    transform: 'translate(-50%, -50%)',
                                                }}
                                            >
                                                <div className="relative w-full" style={{paddingBottom: '100%'}}>
                                                    <Image
                                                        src={template.logoImage}
                                                        alt="Logo"
                                                        layout="fill"
                                                        objectFit="contain"
                                                        unoptimized
                                                    />
                                                </div>
                                            </div>
                                        )}
                                        <div
                                            className="absolute p-1"
                                            style={{
                                                top: `${template.textPosition.y}%`,
                                                left: `${template.textPosition.x}%`,
                                                transform: 'translate(-50%, -50%)',
                                            }}
                                        >
                                             <p
                                                className={cn(headlineFont, 'font-bold whitespace-nowrap', {'text-stroke': textEffects?.stroke.enabled})}
                                                style={{ 
                                                    ...textPreviewStyles,
                                                    '--tw-stroke-color': textEffects?.stroke.color, 
                                                    '--tw-stroke-width': '0.5px' 
                                                } as React.CSSProperties}
                                            >
                                                {template.text}
                                            </p>
                                        </div>
                                        <div className="absolute bottom-2 left-2 right-2">
                                            <p className="text-white text-xs font-semibold truncate">{template.name}</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
                <ScrollBar orientation="horizontal" />
            </ScrollArea>
        </div>
    );
}
