
'use client';

import { useState, useMemo, useEffect, useRef, useCallback, ChangeEvent } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Save, Download, Move } from 'lucide-react';
import { storage, db } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { useSearchParams, useRouter } from 'next/navigation';
import * as htmlToImage from 'html-to-image';
import jsPDF from 'jspdf';
import { BANNER_PRESETS, FONT_OPTIONS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { Slider } from '@/components/ui/slider';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const DOWNLOAD_SIZES = {
  small: { name: 'Pequeño', scale: 0.5 },
  medium: { name: 'Mediano', scale: 1 },
  large: { name: 'Grande', scale: 2 },
};

export function BannerEditor() {
  const { toast } = useToast();
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [bannerId, setBannerId] = useState<string | null>(null);
  const [bannerImage, setBannerImage] = useState<string | null>(null);
  const [logoImage, setLogoImage] = useState<string | null>(null);
  const [text, setText] = useState('Tu Texto Aquí');
  const [preset, setPreset] = useState('facebookCover');
  const [customDimensions, setCustomDimensions] = useState({ width: 851, height: 315 });
  const [logoPosition, setLogoPosition] = useState({ x: 15, y: 15 });
  const [logoSize, setLogoSize] = useState(15);
  const [textPosition, setTextPosition] = useState({ x: 50, y: 50 });
  const [textStyle, setTextStyle] = useState({
    font: 'Poppins',
    size: 48,
    color: '#FFFFFF',
  });
  const [textEffects, setTextEffects] = useState({
    shadow: { enabled: true, color: '#000000', offsetX: 2, offsetY: 2, blur: 4 },
    stroke: { enabled: false, color: '#000000', width: 1 },
  });
  
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  
  const [isDraggingLogo, setIsDraggingLogo] = useState(false);
  const [isDraggingText, setIsDraggingText] = useState(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  const bannerPreviewRef = useRef<HTMLDivElement>(null);
  const bannerWrapperRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  
  const bannerDimensions = useMemo(() => {
    if (preset === 'custom') return customDimensions;
    return BANNER_PRESETS[preset as keyof typeof BANNER_PRESETS] || BANNER_PRESETS.facebookCover;
  }, [preset, customDimensions]);

  const updateScale = useCallback(() => {
    if (bannerWrapperRef.current && bannerDimensions) {
      const container = bannerWrapperRef.current;
      const padding = 32; // p-4 = 1rem * 2 = 32px
      const availableWidth = container.clientWidth - padding;
      const availableHeight = container.clientHeight - padding;
      
      const widthScale = availableWidth / bannerDimensions.width;
      const heightScale = availableHeight / bannerDimensions.height;
      
      const newScale = Math.min(widthScale, heightScale, 1);
      setScale(newScale);
    }
  }, [bannerDimensions]);


  useEffect(() => {
    updateScale();
    const debouncedUpdateScale = setTimeout(updateScale, 100);
    window.addEventListener('resize', updateScale);
    return () => {
      window.removeEventListener('resize', updateScale);
      clearTimeout(debouncedUpdateScale);
    }
  }, [updateScale]);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>, setImage: (url: string | null) => void) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setIsUploading(true);
    try {
      const fileRef = ref(storage, `images/${user.uid}/${uuidv4()}-${file.name}`);
      const uploadTask = await uploadBytes(fileRef, file);
      const downloadURL = await getDownloadURL(uploadTask.ref);
      setImage(downloadURL);
      toast({ title: 'Subida exitosa', description: 'Imagen subida a Firebase Storage.' });
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo subir la imagen.' });
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleSaveBanner = async () => {
    if (!bannerImage && !user) {
        toast({ variant: 'destructive', title: 'Error', description: 'Por favor, sube una imagen de banner antes de guardar.' });
        return;
    };
    if (!user) return;

    setIsSaving(true);
    try {
      const data = { bannerImage, logoImage, logoPosition, logoSize, text, textPosition, textStyle, textEffects, preset, customDimensions, userId: user.uid };
      if (bannerId) {
        const docRef = doc(db, 'users', user.uid, 'banners', bannerId);
        await updateDoc(docRef, { ...data, updatedAt: serverTimestamp() });
        toast({ title: 'Banner actualizado', description: 'Cambios guardados.' });
      } else {
        const newDoc = await addDoc(collection(db, 'users', user.uid, 'banners'), { ...data, createdAt: serverTimestamp() });
        setBannerId(newDoc.id);
        router.replace(`/?edit=${newDoc.id}`, { scroll: false });
        toast({ title: 'Banner guardado', description: 'Banner agregado a tu portafolio.' });
      }
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo guardar el banner.' });
    } finally {
      setIsSaving(false);
    }
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
    if (!bannerPreviewRef.current) {
        toast({ variant: 'destructive', title: 'Error de Descarga', description: 'No se pudo encontrar el elemento de vista previa.' });
        return;
    }
    setIsDownloading(true);

    const { scale: sizeScale } = DOWNLOAD_SIZES[sizeKey];
    const { width, height } = bannerDimensions;
    const fileName = `${text.substring(0, 20) || 'banner'}-${sizeKey}.${format}`;

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
            const tempNode = bannerPreviewRef.current!.cloneNode(true) as HTMLElement;
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
  }, [bannerDimensions, text, toast]);
  
  const handleDragMouseDown = (e: React.MouseEvent<HTMLDivElement>, type: 'logo' | 'text') => {
      if (!bannerPreviewRef.current) return;
      if (type === 'logo') setIsDraggingLogo(true);
      if (type === 'text') setIsDraggingText(true);
      
      const targetEl = e.currentTarget;
      const bannerRect = bannerPreviewRef.current.getBoundingClientRect();
      const targetRect = targetEl.getBoundingClientRect();

      const offsetX = (e.clientX - targetRect.left) / scale;
      const offsetY = (e.clientY - targetRect.top) / scale;
      dragOffsetRef.current = { x: offsetX, y: offsetY };
      
      e.preventDefault();
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDraggingLogo && !isDraggingText) return;
    if (!bannerPreviewRef.current) return;

    const bannerRect = bannerPreviewRef.current.getBoundingClientRect();
    
    let newXPercent, newYPercent;

    if (isDraggingLogo) {
        let newX = (e.clientX - bannerRect.left) / scale - dragOffsetRef.current.x;
        let newY = (e.clientY - bannerRect.top) / scale - dragOffsetRef.current.y;
        
        const logoWidth = (bannerDimensions.width * logoSize) / 100;
        const logoHeight = (bannerDimensions.width * logoSize) / 100;

        newXPercent = ((newX + logoWidth / 2) / bannerDimensions.width) * 100;
        newYPercent = ((newY + logoHeight / 2) / bannerDimensions.height) * 100;
    } else { // isDraggingText
        const textEl = bannerPreviewRef.current.querySelector('#banner-text-preview') as HTMLElement;
        if (!textEl) return;
        
        let newX = (e.clientX - bannerRect.left) / scale - dragOffsetRef.current.x;
        let newY = (e.clientY - bannerRect.top) / scale - dragOffsetRef.current.y;
        
        newXPercent = ((newX + textEl.offsetWidth / 2) / bannerDimensions.width) * 100;
        newYPercent = ((newY + textEl.offsetHeight / 2) / bannerDimensions.height) * 100;
    }
    
    newXPercent = Math.max(0, Math.min(100, newXPercent));
    newYPercent = Math.max(0, Math.min(100, newYPercent));
    
    if (isDraggingLogo) setLogoPosition({ x: newXPercent, y: newYPercent });
    if (isDraggingText) setTextPosition({ x: newXPercent, y: newYPercent });

  }, [isDraggingLogo, isDraggingText, scale, logoSize, bannerDimensions]);

  const handleMouseUp = useCallback(() => {
    setIsDraggingLogo(false);
    setIsDraggingText(false);
  }, []);

  useEffect(() => {
    if (isDraggingLogo || isDraggingText) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp, { once: true });
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingLogo, isDraggingText, handleMouseMove, handleMouseUp]);
  
  const textPreviewStyles = {
    fontFamily: `'${textStyle.font}', sans-serif`,
    fontSize: `${textStyle.size}px`,
    color: textStyle.color,
    textShadow: textEffects.shadow.enabled
      ? `${textEffects.shadow.offsetX}px ${textEffects.shadow.offsetY}px ${textEffects.shadow.blur}px ${textEffects.shadow.color}`
      : 'none',
  };
  const headlineFont = FONT_OPTIONS.find(f => f.value === textStyle.font)?.isHeadline ? 'font-headline' : 'font-body';

  return (
    <div className="flex h-full w-full overflow-hidden">
       <Card className="rounded-none border-0 border-r w-full lg:w-96 shrink-0 h-full flex flex-col">
        <CardHeader className="py-2 border-b">
          <CardTitle className="text-xl">Editor de Banner</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 space-y-1 p-2 overflow-y-auto">
          <Accordion type="multiple" defaultValue={['item-1', 'item-2', 'item-3']} className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger className="font-semibold py-1 text-base">Configuración</AccordionTrigger>
              <AccordionContent className="space-y-1 pt-1">
                <div className="space-y-1">
                  <Label className="text-xs">Preset</Label>
                  <Select value={preset} onValueChange={(value) => setPreset(value)}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.keys(BANNER_PRESETS).map((key) => (
                        <SelectItem key={key} value={key} className="text-xs">{BANNER_PRESETS[key as keyof typeof BANNER_PRESETS].name}</SelectItem>
                      ))}
                      <SelectItem value="custom" className="text-xs">Personalizado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Imagen de banner</Label>
                  <Input type="file" accept="image/*" onChange={(e) => handleFileChange(e, setBannerImage)} disabled={isUploading} className="h-8 text-xs"/>
                  {isUploading && <Loader2 className="animate-spin mt-1" />}
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2">
              <AccordionTrigger className="font-semibold py-1 text-base">Logo</AccordionTrigger>
              <AccordionContent className="space-y-1 pt-1">
                <div className="space-y-1">
                  <Label className="text-xs">Imagen del Logo</Label>
                  <Input type="file" accept="image/*" onChange={(e) => handleFileChange(e, setLogoImage)} disabled={isUploading} className="h-8 text-xs"/>
                </div>

                {logoImage && (
                  <div className="space-y-1">
                    <Label className="text-xs">Tamaño ({logoSize}%)</Label>
                    <Slider value={[logoSize]} onValueChange={(value) => setLogoSize(value[0])} max={50} min={5} step={1} />
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-3">
              <AccordionTrigger className="font-semibold py-1 text-base">Texto</AccordionTrigger>
              <AccordionContent className="space-y-1 pt-1">
                <div className="space-y-1">
                  <Label className="text-xs">Contenido</Label>
                  <Textarea value={text} onChange={(e) => setText(e.target.value)} className="text-xs min-h-[60px]" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Tipografía</Label>
                  <Select value={textStyle.font} onValueChange={(font) => setTextStyle(s => ({ ...s, font }))}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                          {FONT_OPTIONS.map(font => (
                              <SelectItem key={font.value} value={font.value} style={{fontFamily: `'${font.value}', sans-serif`}} className="text-xs">
                                  {font.label}
                              </SelectItem>
                          ))}
                      </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Tamaño ({textStyle.size}px)</Label>
                  <Slider value={[textStyle.size]} onValueChange={v => setTextStyle(s => ({ ...s, size: v[0] }))} max={200} min={10} step={1} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Color</Label>
                  <div className="flex items-center gap-2">
                    <Input type="color" value={textStyle.color} onChange={e => setTextStyle(s => ({ ...s, color: e.target.value }))} className="p-1 h-8 w-10"/>
                    <Input type="text" value={textStyle.color} onChange={e => setTextStyle(s => ({ ...s, color: e.target.value }))} className="h-8 text-xs"/>
                  </div>
                </div>
                
                <Accordion type="multiple" className="w-full">
                   <AccordionItem value="text-effects-shadow">
                      <AccordionTrigger className="text-sm py-1">Sombra</AccordionTrigger>
                      <AccordionContent className="space-y-1 pt-1">
                        <div className="flex items-center justify-between h-8"><Label className="text-xs">Activar Sombra</Label><Switch checked={textEffects.shadow.enabled} onCheckedChange={c => setTextEffects(e => ({ ...e, shadow: {...e.shadow, enabled: c}}))} /></div>
                        {textEffects.shadow.enabled && <>
                          <div className="space-y-1"><Label className="text-xs">Offset X ({textEffects.shadow.offsetX}px)</Label><Slider value={[textEffects.shadow.offsetX]} onValueChange={v => setTextEffects(e => ({ ...e, shadow: {...e.shadow, offsetX: v[0]}}))} min={-20} max={20} step={1} /></div>
                          <div className="space-y-1"><Label className="text-xs">Offset Y ({textEffects.shadow.offsetY}px)</Label><Slider value={[textEffects.shadow.offsetY]} onValueChange={v => setTextEffects(e => ({ ...e, shadow: {...e.shadow, offsetY: v[0]}}))} min={-20} max={20} step={1} /></div>
                          <div className="space-y-1"><Label className="text-xs">Desenfoque ({textEffects.shadow.blur}px)</Label><Slider value={[textEffects.shadow.blur]} onValueChange={v => setTextEffects(e => ({ ...e, shadow: {...e.shadow, blur: v[0]}}))} min={0} max={40} step={1} /></div>
                          <div className="space-y-1"><Label className="text-xs">Color Sombra</Label><div className="flex items-center gap-2"><Input type="color" value={textEffects.shadow.color} onChange={e => setTextEffects(eff => ({ ...eff, shadow: {...eff.shadow, color: e.target.value}}))} className="p-1 h-8 w-10" /><Input type="text" value={textEffects.shadow.color} onChange={e => setTextEffects(eff => ({ ...eff, shadow: {...eff.shadow, color: e.target.value}}))} className="h-8 text-xs"/></div></div>
                        </>}
                      </AccordionContent>
                   </AccordionItem>
                   <AccordionItem value="text-effects-stroke">
                      <AccordionTrigger className="text-sm py-1">Borde</AccordionTrigger>
                      <AccordionContent className="space-y-1 pt-1">
                         <div className="flex items-center justify-between h-8"><Label className="text-xs">Activar Borde</Label><Switch checked={textEffects.stroke.enabled} onCheckedChange={c => setTextEffects(e => ({ ...e, stroke: {...e.stroke, enabled: c}}))} /></div>
                          {textEffects.stroke.enabled && <>
                            <div className="space-y-1"><Label className="text-xs">Grosor ({textEffects.stroke.width}px)</Label><Slider value={[textEffects.stroke.width]} onValueChange={v => setTextEffects(e => ({ ...e, stroke: {...e.stroke, width: v[0]}}))} min={0.5} max={10} step={0.5} /></div>
                            <div className="space-y-1"><Label className="text-xs">Color Borde</Label><div className="flex items-center gap-2"><Input type="color" value={textEffects.stroke.color} onChange={e => setTextEffects(eff => ({ ...eff, stroke: {...eff.stroke, color: e.target.value}}))} className="p-1 h-8 w-10" /><Input type="text" value={textEffects.stroke.color} onChange={e => setTextEffects(eff => ({ ...eff, stroke: {...eff.stroke, color: e.target.value}}))} className="h-8 text-xs"/></div></div>
                          </>}
                      </AccordionContent>
                   </AccordionItem>
                </Accordion>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
        <div className="p-2 space-y-2 border-t">
          <Button onClick={handleSaveBanner} disabled={isSaving || isUploading} className="w-full h-9">
            {isSaving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />}
            Guardar
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button disabled={isDownloading || !bannerImage} className="w-full h-9">
                {isDownloading ? <Loader2 className="animate-spin mr-2" /> : <Download className="mr-2" />}
                Descargar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuPortal>
               <DropdownMenuContent align="center" className="w-56">
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
              </DropdownMenuContent>
            </DropdownMenuPortal>
          </DropdownMenu>
        </div>
      </Card>

      <div 
        ref={bannerWrapperRef}
        className="flex-1 flex justify-center items-center bg-muted/30 p-4 relative min-h-0 overflow-hidden"
      >
        <div
          ref={bannerPreviewRef}
          className="relative overflow-hidden shadow-lg bg-background"
          style={{
            width: `${bannerDimensions.width}px`,
            height: `${bannerDimensions.height}px`,
            transform: `scale(${scale})`,
            transformOrigin: 'center center',
          }}
        >
          {bannerImage ? (
              <Image
                  src={bannerImage}
                  alt="Banner"
                  layout="fill"
                  objectFit="cover"
                  unoptimized
                  crossOrigin="anonymous"
              />
          ) : (
              <div className="w-full h-full flex flex-col justify-center items-center border-2 border-dashed">
                  <h3 className="text-xl font-bold font-headline">{bannerDimensions.name}</h3>
                  <p className="text-muted-foreground text-sm">{bannerDimensions.width}px &times; {bannerDimensions.height}px</p>
              </div>
          )}
          
          {logoImage && (
            <div
              className={cn("absolute cursor-move group", { 'cursor-grabbing': isDraggingLogo })}
              style={{
                  top: `${logoPosition.y}%`,
                  left: `${logoPosition.x}%`,
                  width: `${logoSize}%`,
                  transform: 'translate(-50%, -50%)',
              }}
              onMouseDown={(e) => handleDragMouseDown(e, 'logo')}
            >
              <div className="relative w-full" style={{paddingBottom: '100%'}}>
                  <Image
                      src={logoImage}
                      alt="Logo"
                      layout="fill"
                      objectFit="contain"
                      className="pointer-events-none"
                      unoptimized
                      crossOrigin="anonymous"
                  />
              </div>
              <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground rounded-full p-1 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
                <Move size={12} />
              </div>
            </div>
          )}

          {bannerImage && text && (
            <div
              id="banner-text-preview"
              className={cn("absolute cursor-move group p-2", { 'cursor-grabbing': isDraggingText })}
              style={{
                top: `${textPosition.y}%`,
                left: `${textPosition.x}%`,
                transform: 'translate(-50%, -50%)',
              }}
              onMouseDown={(e) => handleDragMouseDown(e, 'text')}
            >
              <p
                className={cn(headlineFont, 'font-bold whitespace-nowrap', {'text-stroke': textEffects.stroke.enabled})}
                style={{ ...textPreviewStyles, '--tw-stroke-color': textEffects.stroke.color, '--tw-stroke-width': `${textEffects.stroke.width}px` } as React.CSSProperties}
              >
                {text}
              </p>
              <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full p-1 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
                <Move size={10} />
              </div>
            </div>
          )}
        </div>
      </div>
      
    </div>
  );
}

    

    