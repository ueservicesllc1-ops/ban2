
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Switch } from '@/components/ui/switch';

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
  
  const [downloadOptions, setDownloadOptions] = useState({ format: 'png', size: 'medium' });
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
      const padding = 32;
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

  const handleDownload = async () => {
    const element = bannerPreviewRef.current;
    if (!element) return;
    setIsDownloading(true);
    try {
      const scale = DOWNLOAD_SIZES[downloadOptions.size as keyof typeof DOWNLOAD_SIZES].scale;
      const dataUrl = await htmlToImage.toPng(element, { backgroundColor: '#ffffff', pixelRatio: scale, style: { transform: 'scale(1)', transformOrigin: 'center center' } });
      if (downloadOptions.format === 'pdf') {
        const pdf = new jsPDF({ unit: 'px', format: [bannerDimensions.width * scale, bannerDimensions.height * scale] });
        pdf.addImage(dataUrl, 'PNG', 0, 0, bannerDimensions.width * scale, bannerDimensions.height * scale);
        pdf.save('banner.pdf');
      } else {
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `banner.${downloadOptions.format}`;
        link.click();
      }
      toast({ title: 'Descarga completada', description: 'Tu banner ha sido descargado.' });
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo descargar el banner.' });
    } finally {
      setIsDownloading(false);
    }
  };
  
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
        <CardHeader>
          <CardTitle>Editor de Banner</CardTitle>
        </CardHeader>
        <div className="flex-1 min-h-0">
          <ScrollArea className="h-full">
            <CardContent className="space-y-4 pb-16">
              <Accordion type="multiple" defaultValue={['item-1', 'item-2', 'item-3']} className="w-full">
                <AccordionItem value="item-1">
                  <AccordionTrigger className="font-semibold">Configuración General</AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-4">
                    <div>
                      <Label>Preset</Label>
                      <Select value={preset} onValueChange={(value) => setPreset(value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona un preset" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.keys(BANNER_PRESETS).map((key) => (
                            <SelectItem key={key} value={key}>{BANNER_PRESETS[key as keyof typeof BANNER_PRESETS].name}</SelectItem>
                          ))}
                          <SelectItem value="custom">Personalizado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Imagen de banner</Label>
                      <Input type="file" accept="image/*" onChange={(e) => handleFileChange(e, setBannerImage)} disabled={isUploading}/>
                      {isUploading && <Loader2 className="animate-spin mt-2" />}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-2">
                  <AccordionTrigger className="font-semibold">Logo</AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-4">
                    <div>
                      <Label>Imagen del Logo</Label>
                      <Input type="file" accept="image/*" onChange={(e) => handleFileChange(e, setLogoImage)} disabled={isUploading}/>
                    </div>

                    {logoImage && (
                      <div className="space-y-2">
                        <Label>Tamaño del Logo ({logoSize}%)</Label>
                        <Slider
                          value={[logoSize]}
                          onValueChange={(value) => setLogoSize(value[0])}
                          max={50}
                          min={5}
                          step={1}
                        />
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
                
                <AccordionItem value="item-3">
                  <AccordionTrigger className="font-semibold">Texto</AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-4">
                    <div>
                      <Label>Contenido del Texto</Label>
                      <Textarea value={text} onChange={(e) => setText(e.target.value)} />
                    </div>
                    <div>
                      <Label>Tipografía</Label>
                      <Select value={textStyle.font} onValueChange={(font) => setTextStyle(s => ({ ...s, font }))}>
                          <SelectTrigger><SelectValue placeholder="Selecciona una fuente" /></SelectTrigger>
                          <SelectContent>
                              {FONT_OPTIONS.map(font => (
                                  <SelectItem key={font.value} value={font.value} style={{fontFamily: `'${font.value}', sans-serif`}}>
                                      {font.label}
                                  </SelectItem>
                              ))}
                          </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Tamaño ({textStyle.size}px)</Label>
                      <Slider value={[textStyle.size]} onValueChange={v => setTextStyle(s => ({ ...s, size: v[0] }))} max={200} min={10} step={1} />
                    </div>
                    <div className="space-y-2">
                      <Label>Color</Label>
                      <div className="flex items-center gap-2">
                        <Input type="color" value={textStyle.color} onChange={e => setTextStyle(s => ({ ...s, color: e.target.value }))} className="p-1 h-10 w-16"/>
                        <Input type="text" value={textStyle.color} onChange={e => setTextStyle(s => ({ ...s, color: e.target.value }))} />
                      </div>
                    </div>
                    
                    <Accordion type="multiple" className="w-full">
                       <AccordionItem value="text-effects-shadow">
                          <AccordionTrigger className="text-sm py-2">Sombra</AccordionTrigger>
                          <AccordionContent className="space-y-4 pt-2">
                            <div className="flex items-center justify-between"><Label>Activar Sombra</Label><Switch checked={textEffects.shadow.enabled} onCheckedChange={c => setTextEffects(e => ({ ...e, shadow: {...e.shadow, enabled: c}}))} /></div>
                            {textEffects.shadow.enabled && <>
                              <div className="space-y-2"><Label>Offset X ({textEffects.shadow.offsetX}px)</Label><Slider value={[textEffects.shadow.offsetX]} onValueChange={v => setTextEffects(e => ({ ...e, shadow: {...e.shadow, offsetX: v[0]}}))} min={-20} max={20} step={1} /></div>
                              <div className="space-y-2"><Label>Offset Y ({textEffects.shadow.offsetY}px)</Label><Slider value={[textEffects.shadow.offsetY]} onValueChange={v => setTextEffects(e => ({ ...e, shadow: {...e.shadow, offsetY: v[0]}}))} min={-20} max={20} step={1} /></div>
                              <div className="space-y-2"><Label>Desenfoque ({textEffects.shadow.blur}px)</Label><Slider value={[textEffects.shadow.blur]} onValueChange={v => setTextEffects(e => ({ ...e, shadow: {...e.shadow, blur: v[0]}}))} min={0} max={40} step={1} /></div>
                              <div className="space-y-2"><Label>Color Sombra</Label><div className="flex items-center gap-2"><Input type="color" value={textEffects.shadow.color} onChange={e => setTextEffects(eff => ({ ...eff, shadow: {...eff.shadow, color: e.target.value}}))} className="p-1 h-10 w-16" /><Input type="text" value={textEffects.shadow.color} onChange={e => setTextEffects(eff => ({ ...eff, shadow: {...eff.shadow, color: e.target.value}}))} /></div></div>
                            </>}
                          </AccordionContent>
                       </AccordionItem>
                       <AccordionItem value="text-effects-stroke">
                          <AccordionTrigger className="text-sm py-2">Borde</AccordionTrigger>
                          <AccordionContent className="space-y-4 pt-2">
                             <div className="flex items-center justify-between"><Label>Activar Borde</Label><Switch checked={textEffects.stroke.enabled} onCheckedChange={c => setTextEffects(e => ({ ...e, stroke: {...e.stroke, enabled: c}}))} /></div>
                              {textEffects.stroke.enabled && <>
                                <div className="space-y-2"><Label>Grosor ({textEffects.stroke.width}px)</Label><Slider value={[textEffects.stroke.width]} onValueChange={v => setTextEffects(e => ({ ...e, stroke: {...e.stroke, width: v[0]}}))} min={0.5} max={10} step={0.5} /></div>
                                <div className="space-y-2"><Label>Color Borde</Label><div className="flex items-center gap-2"><Input type="color" value={textEffects.stroke.color} onChange={e => setTextEffects(eff => ({ ...eff, stroke: {...eff.stroke, color: e.target.value}}))} className="p-1 h-10 w-16" /><Input type="text" value={textEffects.stroke.color} onChange={e => setTextEffects(eff => ({ ...eff, stroke: {...eff.stroke, color: e.target.value}}))} /></div></div>
                              </>}
                          </AccordionContent>
                       </AccordionItem>
                    </Accordion>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
              
              <div className="pt-4 space-y-4 px-6">
                <Button onClick={handleSaveBanner} disabled={isSaving || isUploading} className="w-full">
                  {isSaving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />}
                  Guardar
                </Button>

                <Button onClick={handleDownload} disabled={isDownloading || !bannerImage} className="w-full">
                  {isDownloading ? <Loader2 className="animate-spin mr-2" /> : <Download className="mr-2" />}
                  Descargar
                </Button>
              </div>
            </CardContent>
          </ScrollArea>
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
              />
          ) : (
              <div className="w-full h-full flex flex-col justify-center items-center border-2 border-dashed">
                  <h3 className="text-2xl font-bold font-headline">{bannerDimensions.name}</h3>
                  <p className="text-muted-foreground">{bannerDimensions.width}px &times; {bannerDimensions.height}px</p>
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
