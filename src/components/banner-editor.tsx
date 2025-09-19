

'use client';

import { useState, useMemo, useEffect, useRef, useCallback, ChangeEvent } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Save, Download, Move, Sparkles } from 'lucide-react';
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
import { getPlacementSuggestions } from '@/app/actions';
import { fileToDataUri } from '@/lib/utils';

type DownloadSize = 'small' | 'medium' | 'large';
const DOWNLOAD_SIZES: Record<DownloadSize, { name: string, width: number }> = {
  small: { name: 'Pequeño', width: 600 },
  medium: { name: 'Mediano', width: 1080 },
  large: { name: 'Grande', width: 1920 },
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
  const [isSuggesting, setIsSuggesting] = useState(false);
  
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

   useEffect(() => {
    const editId = searchParams.get('edit');
    if (editId && user) {
      const fetchBannerData = async () => {
        try {
          const docRef = doc(db, 'users', user.uid, 'banners', editId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setBannerId(editId);
            setBannerImage(data.bannerImage || null);
            setLogoImage(data.logoImage || null);
            setText(data.text || 'Tu Texto Aquí');
            setPreset(data.preset || 'facebookCover');
            if (data.preset === 'custom' && data.customDimensions) {
              setCustomDimensions(data.customDimensions);
            }
            setLogoPosition(data.logoPosition || { x: 15, y: 15 });
            setLogoSize(data.logoSize || 15);
            setTextPosition(data.textPosition || { x: 50, y: 50 });
            setTextStyle(data.textStyle || { font: 'Poppins', size: 48, color: '#FFFFFF' });
            setTextEffects(data.textEffects || { shadow: { enabled: true, color: '#000000', offsetX: 2, offsetY: 2, blur: 4 }, stroke: { enabled: false, color: '#000000', width: 1 } });
          } else {
            toast({ variant: 'destructive', title: 'Error', description: 'No se encontró el banner para editar.'});
            router.replace('/');
          }
        } catch (error) {
          console.error("Error fetching banner:", error);
          toast({ variant: 'destructive', title: 'Error', description: 'No se pudo cargar el banner.'});
        }
      };
      fetchBannerData();
    }
   }, [searchParams, user, router, toast]);

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
  
const performDownload = useCallback(async (format: 'png' | 'jpg' | 'pdf', size: DownloadSize) => {
    if (!bannerPreviewRef.current) {
        toast({ variant: 'destructive', title: 'Error de Descarga', description: 'No se pudo encontrar el elemento de vista previa.' });
        return;
    }
    setIsDownloading(true);

    try {
        const banner = bannerPreviewRef.current;
        const rect = banner.getBoundingClientRect();
        const targetWidth = DOWNLOAD_SIZES[size].width;
        const scale = targetWidth / rect.width;
        const targetHeight = rect.height * scale;

        const options = {
            backgroundColor: '#ffffff',
            pixelRatio: 2,
            width: targetWidth,
            height: targetHeight,
            style: {
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
                width: `${rect.width}px`,
                height: `${rect.height}px`,
            },
        };

        const fileName = `${text.substring(0, 20) || 'banner'}-${size}.${format}`;
        let dataUrl: string;

        if (format === 'pdf') {
            const imgData = await htmlToImage.toPng(banner, options);
            const pdf = new jsPDF({
                orientation: targetWidth > targetHeight ? 'landscape' : 'portrait',
                unit: 'px',
                format: [targetWidth, targetHeight],
            });
            pdf.addImage(imgData, 'PNG', 0, 0, targetWidth, targetHeight);
            pdf.save(fileName);
        } else {
            const generator = format === 'png' ? htmlToImage.toPng : htmlToImage.toJpeg;
            dataUrl = await generator(banner, { ...options, quality: 0.95 });
            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = fileName;
            link.click();
        }

        toast({ title: 'Descarga Iniciada', description: `Tu ${format.toUpperCase()} se está descargando.` });
    } catch (error) {
        // Silently fail
    } finally {
        setIsDownloading(false);
    }
}, [text, toast]);

  const handleAiSuggestions = async () => {
    if (!bannerImage || !logoImage) {
      toast({
        variant: 'destructive',
        title: 'Faltan Imágenes',
        description: 'Por favor, sube una imagen de banner y un logo antes de pedir sugerencias.'
      });
      return;
    }
    setIsSuggesting(true);
    try {
      const bannerFile = await (await fetch(bannerImage)).blob();
      const logoFile = await (await fetch(logoImage)).blob();
      const bannerImageDataUri = await fileToDataUri(new File([bannerFile], "banner"));
      const logoImageDataUri = await fileToDataUri(new File([logoFile], "logo"));

      const result = await getPlacementSuggestions({
        bannerImageDataUri,
        logoImageDataUri,
        text,
      });

      if (result.success) {
        const { logoPlacement, textPlacement, reasoning } = result.data;
        
        // Simple mapping for demonstration. Could be more complex.
        const placementMap = {
          'top-left': { x: 15, y: 15 },
          'top-center': { x: 50, y: 15 },
          'top-right': { x: 85, y: 15 },
          'middle-left': { x: 15, y: 50 },
          'middle-center': { x: 50, y: 50 },
          'middle-right': { x: 85, y: 50 },
          'bottom-left': { x: 15, y: 85 },
          'bottom-center': { x: 50, y: 85 },
          'bottom-right': { x: 85, y: 85 },
        };
        
        // @ts-ignore
        if (placementMap[logoPlacement]) setLogoPosition(placementMap[logoPlacement]);
        // @ts-ignore
        if (placementMap[textPlacement]) setTextPosition(placementMap[textPlacement]);

        toast({
          title: 'Sugerencias aplicadas',
          description: `Razón de la IA: ${reasoning}`,
        });
      } else {
        throw new Error(result.error);
      }

    } catch(error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Error de IA',
        description: `No se pudieron obtener las sugerencias. ${error instanceof Error ? error.message : ''}`,
      });
    } finally {
      setIsSuggesting(false);
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
                {preset === 'custom' && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Ancho (px)</Label>
                      <Input type="number" value={customDimensions.width} onChange={e => setCustomDimensions(d => ({...d, width: parseInt(e.target.value)}))} className="h-8 text-xs" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Alto (px)</Label>
                      <Input type="number" value={customDimensions.height} onChange={e => setCustomDimensions(d => ({...d, height: parseInt(e.target.value)}))} className="h-8 text-xs" />
                    </div>
                  </div>
                )}
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
          <Button onClick={handleAiSuggestions} disabled={isSuggesting || isUploading || !bannerImage || !logoImage} className="w-full h-9">
            {isSuggesting ? <Loader2 className="animate-spin mr-2" /> : <Sparkles className="mr-2" />}
            Sugerir Posición (IA)
          </Button>
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
