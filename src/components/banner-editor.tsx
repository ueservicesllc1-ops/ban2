// src/components/banner-editor.tsx
'use client';

import { useState, useMemo, ChangeEvent, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { BANNER_PRESETS, FONT_OPTIONS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { SuggestOptimalPlacementsOutput } from '@/ai/flows/suggest-optimal-placements';
import { getPlacementSuggestions } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Info, Loader2, Sparkles, Upload, Save, Download } from 'lucide-react';
import { storage, db } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '@/hooks/use-auth';
import { Switch } from '@/components/ui/switch';
import * as htmlToImage from 'html-to-image';
import jsPDF from 'jspdf';
import { useSearchParams, useRouter } from 'next/navigation';
import { BannerData } from '@/app/portfolio/page';

const placementToPercentage = (placement: string): { x: number; y: number } => {
    const placements: { [key: string]: { x: number; y: number } } = {
        'top-left': { x: 15, y: 15 },
        'top-center': { x: 50, y: 15 },
        'top-right': { x: 85, y: 15 },
        'center-left': { x: 15, y: 50 },
        'center': { x: 50, y: 50 },
        'center-right': { x: 85, y: 50 },
        'bottom-left': { x: 15, y: 85 },
        'bottom-center': { x: 50, y: 85 },
        'bottom-right': { x: 85, y: 85 },
    };
    return placements[placement] || { x: 50, y: 50 };
};

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
  const [textStyle, setTextStyle] = useState({
    font: 'Poppins',
    size: 48,
    color: '#FFFFFF',
  });
  const [textEffects, setTextEffects] = useState({
    shadow: {
      enabled: true,
      color: '#000000',
      blur: 5,
      offsetX: 2,
      offsetY: 2,
    },
    stroke: {
      enabled: false,
      color: '#000000',
      width: 1,
    }
  });

  const [preset, setPreset] = useState('facebookCover');
  const [customDimensions, setCustomDimensions] = useState({ width: 851, height: 315 });

  const [aiSuggestions, setAiSuggestions] = useState<SuggestOptimalPlacementsOutput | null>(null);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  
  const [logoPosition, setLogoPosition] = useState({ x: 15, y: 15 });
  const [logoSize, setLogoSize] = useState(15);
  const [textPosition, setTextPosition] = useState({ x: 50, y: 50 });

  const [downloadOptions, setDownloadOptions] = useState({
    format: 'png',
    size: 'medium',
  });

  const bannerPreviewRef = useRef<HTMLDivElement>(null);
  const draggingElement = useRef<'logo' | 'text' | null>(null);

  const populateEditor = useCallback((data: BannerData) => {
    setBannerImage(data.bannerImage);
    setLogoImage(data.logoImage || null);
    setText(data.text || '');
    setTextStyle(data.textStyle || { font: 'Poppins', size: 48, color: '#FFFFFF' });
    setTextEffects(data.textEffects || { shadow: { enabled: true, color: '#000000', blur: 5, offsetX: 2, offsetY: 2 }, stroke: { enabled: false, color: '#000000', width: 1 } });
    setPreset(data.preset || 'facebookCover');
    setCustomDimensions(data.customDimensions || { width: 851, height: 315 });
    setLogoPosition(data.logoPosition || { x: 15, y: 15 });
    setLogoSize(data.logoSize || 15);
    setTextPosition(data.textPosition || { x: 50, y: 50 });
  }, []);

  useEffect(() => {
    const editBannerId = searchParams.get('edit');
    if (editBannerId && user) {
      if (editBannerId !== bannerId) {
        setBannerId(editBannerId);
        const fetchBannerData = async () => {
          try {
            const bannerDocRef = doc(db, 'users', user.uid, 'banners', editBannerId);
            const bannerDoc = await getDoc(bannerDocRef);
            if (bannerDoc.exists()) {
              populateEditor(bannerDoc.data() as BannerData);
              toast({ title: 'Banner Cargado', description: 'Tu diseño está listo para ser editado.' });
            } else {
              toast({ variant: 'destructive', title: 'Error', description: 'No se pudo encontrar el banner para editar.' });
              router.push('/');
            }
          } catch (error) {
            console.error("Error fetching banner for editing:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Hubo un problema al cargar tu diseño.' });
          }
        };
        fetchBannerData();
      }
    }
  }, [searchParams, user, router, toast, populateEditor, bannerId]);

  const bannerDimensions = useMemo(() => {
    if (preset === 'custom') {
      return customDimensions;
    }
    return BANNER_PRESETS[preset as keyof typeof BANNER_PRESETS];
  }, [preset, customDimensions]);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>, setImage: (url: string | null) => void) => {
    const file = e.target.files?.[0];
    if (file && user) {
      setIsUploading(true);
      try {
        const fileRef = ref(storage, `images/${user.uid}/${uuidv4()}-${file.name}`);
        const uploadTask = await uploadBytes(fileRef, file);
        const downloadURL = await getDownloadURL(uploadTask.ref);
        setImage(downloadURL);
        toast({
          title: 'Subida exitosa',
          description: 'Tu imagen ha sido subida a Firebase Storage.',
        });
      } catch (error) {
        console.error('Error uploading file:', error);
        toast({
          variant: 'destructive',
          title: 'Falló la subida',
          description: 'Hubo un problema al subir tu imagen. Por favor, inténtalo de nuevo.',
        });
      } finally {
        setIsUploading(false);
        e.target.value = ''; // Reset file input
      }
    }
  };

  const handleGetSuggestions = async () => {
    if (!bannerImage || !logoImage || !text) {
      toast({
        variant: 'destructive',
        title: 'Faltan elementos',
        description: 'Por favor, sube un banner, un logo y proporciona texto antes de obtener sugerencias.',
      });
      return;
    }

    setIsLoadingAi(true);
    setAiSuggestions(null);

    const bannerDataUri = await urlToDataUri(bannerImage);
    const logoDataUri = await urlToDataUri(logoImage);

    if (!bannerDataUri || !logoDataUri) {
       toast({
        variant: 'destructive',
        title: 'Falló la conversión de imagen',
        description: 'No se pudieron convertir las URLs de las imágenes para el procesamiento de la IA.',
      });
      setIsLoadingAi(false);
      return;
    }

    const result = await getPlacementSuggestions({
      bannerImageDataUri: bannerDataUri,
      logoImageDataUri: logoDataUri,
      text: text,
    });

    if (result.success) {
      setAiSuggestions(result.data);
      const suggestedLogoPlacement = result.data.logoPlacement.toLowerCase().replace(/ /g, '-').replace(/_/g, '-');
      const suggestedTextPlacement = result.data.textPlacement.toLowerCase().replace(/ /g, '-').replace(/_/g, '-');
      
      setLogoPosition(placementToPercentage(suggestedLogoPlacement));
      setTextPosition(placementToPercentage(suggestedTextPlacement));

      toast({
        title: '¡Sugerencias Recibidas!',
        description: 'Las posiciones de la IA han sido aplicadas a tu banner.',
      });
    } else {
      toast({
        variant: 'destructive',
        title: 'Falló la Sugerencia de IA',
        description: result.error,
      });
    }

    setIsLoadingAi(false);
  };
  
  const urlToDataUri = async (url: string): Promise<string | null> => {
    if (url.startsWith('data:')) return url;
    try {
      // Use a proxy to fetch the image and avoid CORS issues.
      // NOTE: This uses a public CORS proxy. In a production environment, you should host your own.
      const proxyUrl = 'https://images.weserv.nl/?url=';
      const response = await fetch(`${proxyUrl}${encodeURIComponent(url.replace('https://', ''))}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch image from URL: ${url}. Status: ${response.status}`);
      }
      const blob = await response.blob();
      return await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.error("Error converting URL to data URI:", e);
       toast({
        variant: 'destructive',
        title: 'Falló la carga de la imagen',
        description: 'No se pudo cargar una imagen para procesarla. Esto puede suceder con URLs temporales o si la imagen no es de acceso público.',
      });
      return null;
    }
  };

  const handleSaveBanner = async () => {
    if (!bannerImage) {
      toast({ variant: 'destructive', title: 'No se puede guardar', description: 'Por favor, sube una imagen de banner antes de guardar.'});
      return;
    }
     if (!user) {
      toast({ variant: 'destructive', title: 'No autenticado', description: 'Debes iniciar sesión para guardar.'});
      return;
    }
    setIsSaving(true);
    try {
      const bannerData = {
        bannerImage,
        logoImage,
        logoPosition,
        logoSize,
        text,
        textStyle,
        textPosition,
        textEffects,
        preset,
        customDimensions,
        userId: user.uid,
      };

      if (bannerId) {
        // Update existing document
        const bannerDocRef = doc(db, 'users', user.uid, 'banners', bannerId);
        await updateDoc(bannerDocRef, {
          ...bannerData,
          updatedAt: serverTimestamp(),
        });
        toast({ title: '¡Banner Actualizado!', description: 'Tus cambios se han guardado en tu portafolio.' });

      } else {
        // Create new document
        const newDocRef = await addDoc(collection(db, 'users', user.uid, 'banners'), {
          ...bannerData,
          createdAt: serverTimestamp(),
        });
        setBannerId(newDocRef.id);
        router.replace(`/?edit=${newDocRef.id}`, { scroll: false });
        toast({ title: '¡Banner Guardado!', description: 'Tu banner ha sido guardado en tu portafolio.' });
      }

    } catch (error) {
      console.error('Error saving banner: ', error);
      toast({ variant: 'destructive', title: 'Falló al guardar', description: 'No se pudo guardar el banner en Firestore.'});
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownload = async () => {
    const element = bannerPreviewRef.current;
    if (!element) {
      toast({
        variant: 'destructive',
        title: 'Falló la descarga',
        description: 'No se pudo encontrar la previsualización del banner para descargar.',
      });
      return;
    }
    setIsDownloading(true);

    const { scale } = DOWNLOAD_SIZES[downloadOptions.size as keyof typeof DOWNLOAD_SIZES];
    const { width, height } = bannerDimensions;
    const format = downloadOptions.format;

    try {
      const fontFamilies = FONT_OPTIONS.map(f => f.value);
      const fontCSS = await htmlToImage.getWebFontCSS(document.body, {
          fontFamilies,
          fetchRequestInit: {
              mode: 'cors',
              credentials: 'omit',
          }
      });

      const options = {
          width: width,
          height: height,
          canvasWidth: width * scale,
          canvasHeight: height * scale,
          style: {
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          },
          pixelRatio: 1,
          fetchRequestInit: {
            mode: 'cors' as RequestMode,
            credentials: 'omit' as RequestCredentials,
          },
          fontEmbedCSS: fontCSS,
          // The library fails to capture images from Firebase storage unless we provide this.
          // It's a known issue with CORS and external images.
          filter: (node: HTMLElement) => {
            return (node.tagName !== 'IMG' || (node as HTMLImageElement).crossOrigin !== 'anonymous');
          }
      };
      let dataUrl;
      
      const fileName = `${text.substring(0,20) || 'banner'}.${format}`;

      if (format === 'png') {
        dataUrl = await htmlToImage.toPng(element, options);
      } else if (format === 'jpg') {
        dataUrl = await htmlToImage.toJpeg(element, { ...options, quality: 0.95 });
      } else if (format === 'pdf') {
        const pngDataUrl = await htmlToImage.toPng(element, options);
        const doc = new jsPDF({
          orientation: width > height ? 'landscape' : 'portrait',
          unit: 'px',
          format: [width, height],
        });
        doc.addImage(pngDataUrl, 'PNG', 0, 0, width, height);
        doc.save(fileName);
        setIsDownloading(false);
        toast({ title: 'Descarga Iniciada', description: `Tu ${format.toUpperCase()} se está descargando.`});
        return;
      }

      if (dataUrl) {
        const link = document.createElement('a');
        link.download = fileName;
        link.href = dataUrl;
        link.click();
        toast({ title: 'Descarga Iniciada', description: `Tu ${format.toUpperCase()} se está descargando.`});
      } else {
        throw new Error('No se pudo generar la URL de datos.');
      }
    } catch (error) {
      console.error('Error de descarga:', error);
      toast({
        variant: 'destructive',
        title: 'Falló la descarga',
        description: 'Ocurrió un error al generar tu archivo. Revisa la consola para más detalles.',
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>, elementType: 'logo' | 'text') => {
    e.preventDefault();
    draggingElement.current = elementType;
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!draggingElement.current || !bannerPreviewRef.current) return;

    const bannerRect = bannerPreviewRef.current.getBoundingClientRect();
    
    let newX = ((e.clientX - bannerRect.left) / bannerRect.width) * 100;
    let newY = ((e.clientY - bannerRect.top) / bannerRect.height) * 100;

    newX = Math.max(0, Math.min(100, newX));
    newY = Math.max(0, Math.min(100, newY));

    if (draggingElement.current === 'logo') {
      setLogoPosition({ x: newX, y: newY });
    } else if (draggingElement.current === 'text') {
      setTextPosition({ x: newX, y: newY });
    }
  };

  const handleMouseUp = () => {
    draggingElement.current = null;
  };

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const headlineFont = FONT_OPTIONS.find(f => f.value === textStyle.font)?.isHeadline ? 'font-headline' : 'font-body';
  const textPreviewStyles = {
      fontFamily: `'${textStyle.font}', sans-serif`,
      fontSize: `${textStyle.size}px`,
      color: textStyle.color,
      textShadow: textEffects.shadow.enabled
        ? `${textEffects.shadow.offsetX}px ${textEffects.shadow.offsetY}px ${textEffects.shadow.blur}px ${textEffects.shadow.color}`
        : 'none',
  }

  return (
    <div className="container mx-auto py-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-1 h-fit sticky top-24">
          <CardHeader>
            <CardTitle className="font-headline text-2xl">Personaliza tu Banner</CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible defaultValue="item-1" className="w-full">
              <AccordionItem value="item-1">
                <AccordionTrigger className="font-headline">1. Banner y Tamaño</AccordionTrigger>
                <AccordionContent className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="banner-upload">Imagen de Banner</Label>
                    <Input id="banner-upload" type="file" accept="image/*" onChange={(e) => handleFileChange(e, setBannerImage)} disabled={isUploading} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="format-select">Formato Predefinido</Label>
                    <Select value={preset} onValueChange={setPreset}>
                      <SelectTrigger id="format-select">
                        <SelectValue placeholder="Selecciona un formato" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(BANNER_PRESETS).map(([key, value]) => (
                          <SelectItem key={key} value={key}>{value.name}</SelectItem>
                        ))}
                        <SelectItem value="custom">Dimensiones Personalizadas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {preset === 'custom' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="width">Ancho (px)</Label>
                        <Input id="width" type="number" value={customDimensions.width} onChange={e => setCustomDimensions(d => ({...d, width: parseInt(e.target.value)}))} />
                      </div>
                       <div className="space-y-2">
                        <Label htmlFor="height">Alto (px)</Label>
                        <Input id="height" type="number" value={customDimensions.height} onChange={e => setCustomDimensions(d => ({...d, height: parseInt(e.target.value)}))} />
                      </div>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-2">
                <AccordionTrigger className="font-headline">2. Logo y Texto</AccordionTrigger>
                <AccordionContent className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="logo-upload">Logo (PNG)</Label>
                    <Input id="logo-upload" type="file" accept="image/png" onChange={(e) => handleFileChange(e, setLogoImage)} disabled={isUploading}/>
                  </div>
                  <div className="space-y-2">
                    <Label>Tamaño del Logo: {logoSize.toFixed(0)}%</Label>
                    <Slider
                      value={[logoSize]}
                      onValueChange={([val]) => setLogoSize(val)}
                      min={5}
                      max={50}
                      step={1}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="text-input">Texto Superpuesto</Label>
                    <Textarea id="text-input" value={text} onChange={e => setText(e.target.value)} />
                  </div>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-3">
                <AccordionTrigger className="font-headline">3. Estilo del Texto</AccordionTrigger>
                <AccordionContent className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="font-select">Fuente</Label>
                     <Select value={textStyle.font} onValueChange={font => setTextStyle(s => ({...s, font}))}>
                      <SelectTrigger id="font-select">
                        <SelectValue placeholder="Selecciona una fuente" />
                      </SelectTrigger>
                      <SelectContent>
                        {FONT_OPTIONS.map(font => (
                           <SelectItem key={font.value} value={font.value} style={{fontFamily: `'${font.value}', ${font.isHeadline ? 'sans-serif' : 'serif'}`}}>{font.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="font-size">Tamaño de Fuente: {textStyle.size}px</Label>
                    <Slider id="font-size" min={12} max={128} step={1} value={[textStyle.size]} onValueChange={([val]) => setTextStyle(s => ({...s, size: val}))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="font-color">Color de Fuente</Label>
                    <div className="flex items-center gap-2">
                       <Input id="font-color" type="color" value={textStyle.color} onChange={e => setTextStyle(s => ({...s, color: e.target.value}))} className="p-1 h-10 w-14" />
                       <Input type="text" value={textStyle.color} onChange={e => setTextStyle(s => ({...s, color: e.target.value}))} className="w-full" />
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-4">
                <AccordionTrigger className="font-headline">4. Efectos del Texto</AccordionTrigger>
                <AccordionContent className="space-y-6 pt-4">
                  {/* Shadow Controls */}
                  <div className="space-y-4 p-4 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="shadow-enable" className="font-medium">Sombra de Texto</Label>
                      <Switch id="shadow-enable" checked={textEffects.shadow.enabled} onCheckedChange={checked => setTextEffects(e => ({...e, shadow: {...e.shadow, enabled: checked}}))} />
                    </div>
                    {textEffects.shadow.enabled && (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="shadow-color">Color de Sombra</Label>
                          <div className="flex items-center gap-2">
                            <Input id="shadow-color" type="color" value={textEffects.shadow.color} onChange={e => setTextEffects(s => ({...s, shadow: {...s.shadow, color: e.target.value}}))} className="p-1 h-10 w-14" />
                            <Input type="text" value={textEffects.shadow.color} onChange={e => setTextEffects(s => ({...s, shadow: {...s.shadow, color: e.target.value}}))} />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Offset X: {textEffects.shadow.offsetX}px</Label>
                            <Slider value={[textEffects.shadow.offsetX]} onValueChange={([val]) => setTextEffects(e => ({...e, shadow: {...e.shadow, offsetX: val}}))} min={-10} max={10} step={1} />
                          </div>
                          <div className="space-y-2">
                            <Label>Offset Y: {textEffects.shadow.offsetY}px</Label>
                            <Slider value={[textEffects.shadow.offsetY]} onValueChange={([val]) => setTextEffects(e => ({...e, shadow: {...e.shadow, offsetY: val}}))} min={-10} max={10} step={1} />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Desenfoque: {textEffects.shadow.blur}px</Label>
                          <Slider value={[textEffects.shadow.blur]} onValueChange={([val]) => setTextEffects(e => ({...e, shadow: {...e.shadow, blur: val}}))} min={0} max={20} step={1} />
                        </div>
                      </div>
                    )}
                  </div>
                  {/* Stroke Controls */}
                  <div className="space-y-4 p-4 border rounded-lg">
                     <div className="flex items-center justify-between">
                      <Label htmlFor="stroke-enable" className="font-medium">Borde de Texto</Label>
                      <Switch id="stroke-enable" checked={textEffects.stroke.enabled} onCheckedChange={checked => setTextEffects(e => ({...e, stroke: {...e.stroke, enabled: checked}}))} />
                    </div>
                    {textEffects.stroke.enabled && (
                       <div className="space-y-4">
                         <div className="space-y-2">
                            <Label htmlFor="stroke-color">Color de Borde</Label>
                            <div className="flex items-center gap-2">
                              <Input id="stroke-color" type="color" value={textEffects.stroke.color} onChange={e => setTextEffects(s => ({...s, stroke: {...s.stroke, color: e.target.value}}))} className="p-1 h-10 w-14" />
                              <Input type="text" value={textEffects.stroke.color} onChange={e => setTextEffects(s => ({...s, stroke: {...s.stroke, color: e.target.value}}))} />
                            </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Ancho de Borde: {textEffects.stroke.width}px</Label>
                          <Slider value={[textEffects.stroke.width]} onValueChange={([val]) => setTextEffects(e => ({...e, stroke: {...e.stroke, width: val}}))} min={0.5} max={5} step={0.5} />
                        </div>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
               <AccordionItem value="item-5">
                <AccordionTrigger className="font-headline">5. Sugerencias IA</AccordionTrigger>
                <AccordionContent className="space-y-4 pt-4">
                  <p className="text-sm text-muted-foreground">Deja que nuestra IA sugiera la posición óptima para tu logo y texto para un impacto máximo.</p>
                  <Button onClick={handleGetSuggestions} disabled={isLoadingAi || isUploading} className="w-full bg-accent hover:bg-accent/90">
                    {isLoadingAi ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                    Sugerir Posiciones
                  </Button>
                   {aiSuggestions && (
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertTitle className="font-headline">Razonamiento de la IA</AlertTitle>
                      <AlertDescription>
                        {aiSuggestions.reasoning}
                      </AlertDescription>
                    </Alert>
                  )}
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-6">
                <AccordionTrigger className="font-headline">6. Guardar y Descargar</AccordionTrigger>
                <AccordionContent className="space-y-6 pt-4">
                   <div>
                     <p className="text-sm text-muted-foreground mb-2">Guarda el diseño final de tu banner en tu portafolio.</p>
                     <Button onClick={handleSaveBanner} disabled={isSaving || isUploading} className="w-full">
                      {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      {bannerId ? 'Actualizar en Portafolio' : 'Guardar en Portafolio'}
                    </Button>
                   </div>
                   <div className="space-y-4 border-t pt-6">
                      <p className="text-sm font-medium">Opciones de Descarga</p>
                      <div className="grid grid-cols-2 gap-4">
                         <div className="space-y-2">
                           <Label htmlFor="download-format">Formato</Label>
                           <Select value={downloadOptions.format} onValueChange={val => setDownloadOptions(o => ({ ...o, format: val }))}>
                              <SelectTrigger id="download-format">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="png">PNG</SelectItem>
                                <SelectItem value="jpg">JPG</SelectItem>
                                <SelectItem value="pdf">PDF</SelectItem>
                              </SelectContent>
                           </Select>
                         </div>
                         <div className="space-y-2">
                           <Label htmlFor="download-size">Tamaño</Label>
                           <Select value={downloadOptions.size} onValueChange={val => setDownloadOptions(o => ({ ...o, size: val }))}>
                              <SelectTrigger id="download-size">
                                <SelectValue />
                              </Trigger>
                              <SelectContent>
                                {Object.entries(DOWNLOAD_SIZES).map(([key, value]) => (
                                  <SelectItem key={key} value={key}>{value.name}</SelectItem>
                                ))}
                              </SelectContent>
                           </Select>
                         </div>
                      </div>
                      <Button onClick={handleDownload} disabled={isDownloading || !bannerImage} className="w-full">
                        {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                        Descargar Banner
                      </Button>
                   </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          <Card className="w-full h-full min-h-[400px] lg:min-h-0 flex flex-col items-center justify-center p-4">
            <CardHeader className="w-full">
              <CardTitle className="font-headline text-2xl">Previsualización</CardTitle>
            </CardHeader>
            <CardContent className="p-2 sm:p-6 flex-1 flex items-center justify-center w-full">
               <div className="relative w-full h-full flex items-center justify-center">
                <div
                  ref={bannerPreviewRef}
                  id="banner-preview-node"
                  className="relative overflow-hidden bg-muted/50 rounded-lg shadow-inner"
                  style={{
                    aspectRatio: `${bannerDimensions.width} / ${bannerDimensions.height}`,
                    width: '100%',
                    maxWidth: `min(100%, ${bannerDimensions.width}px)`,
                    maxHeight: 'calc(100vh - 240px)', 
                  }}
                >
                  {isUploading && (
                    <div className="absolute inset-0 z-20 bg-background/80 flex items-center justify-center">
                      <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    </div>
                  )}
                  {bannerImage ? (
                    <Image src={bannerImage} alt="Banner background" layout="fill" objectFit="cover" unoptimized crossOrigin="anonymous"/>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground text-center p-4">
                      <Upload className="h-10 w-10 mb-2" />
                      <span>Sube una imagen de banner para empezar</span>
                    </div>
                  )}

                  {logoImage && (
                    <div
                      className="absolute cursor-move z-10 p-2"
                      style={{
                        left: `${logoPosition.x}%`,
                        top: `${logoPosition.y}%`,
                        width: `${logoSize}%`,
                        transform: 'translate(-50%, -50%)',
                      }}
                      onMouseDown={(e) => handleMouseDown(e, 'logo')}
                    >
                      <div className="relative w-full h-full" style={{ aspectRatio: '1 / 1'}}>
                        <Image src={logoImage} alt="Logo" layout="fill" objectFit="contain" unoptimized crossOrigin="anonymous"/>
                      </div>
                    </div>
                  )}

                  {bannerImage && text && (
                     <div
                      className="absolute cursor-move p-2 z-10"
                      style={{
                        left: `${textPosition.x}%`,
                        top: `${textPosition.y}%`,
                        transform: 'translate(-50%, -50%)',
                      }}
                      onMouseDown={(e) => handleMouseDown(e, 'text')}
                    >
                      <p
                        className={cn(headlineFont, 'font-bold whitespace-nowrap', {'text-stroke': textEffects.stroke.enabled})}
                        style={{
                          ...textPreviewStyles,
                          '--tw-stroke-color': textEffects.stroke.color, 
                          '--tw-stroke-width': `${textEffects.stroke.width}px`,
                          lineHeight: 1.2,
                        } as React.CSSProperties}
                      >
                        {text}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
