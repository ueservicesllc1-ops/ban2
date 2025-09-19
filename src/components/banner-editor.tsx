
'use client';

import { useState, useMemo, useEffect, useRef, useCallback, ChangeEvent } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Save, Download } from 'lucide-react';
import { storage, db } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { useSearchParams, useRouter } from 'next/navigation';
import * as htmlToImage from 'html-to-image';
import jsPDF from 'jspdf';
import { BANNER_PRESETS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

const DOWNLOAD_SIZES = {
  small: { name: 'Pequeño', scale: 0.5 },
  medium: { name: 'Mediano', scale: 1 },
  large: { name: 'Grande', scale: 2 },
};

const placementToPercentage = (placement: string) => {
  const map: { [key: string]: { x: number; y: number } } = {
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
  return map[placement] || { x: 50, y: 50 };
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
  const [downloadOptions, setDownloadOptions] = useState({ format: 'png', size: 'medium' });
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

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
      const padding = 32; // p-4 on container
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
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
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
      const data = { bannerImage, logoImage, logoPosition, logoSize, text, textPosition, preset, customDimensions, userId: user.uid };
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[384px_1fr] h-[calc(100vh-65px)] overflow-hidden">
      {/* Editor Column */}
      <Card className="rounded-none border-0 border-r flex flex-col">
        <CardHeader>
          <CardTitle>Editor de Banner</CardTitle>
        </CardHeader>
        <ScrollArea className="flex-1">
          <CardContent className="space-y-6 pt-0">
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

            <div>
              <Label>Logo</Label>
              <Input type="file" accept="image/*" onChange={(e) => handleFileChange(e, setLogoImage)} disabled={isUploading}/>
            </div>

            <div>
              <Label>Texto</Label>
              <Textarea value={text} onChange={(e) => setText(e.target.value)} />
            </div>

            <div className="pt-4 space-y-4">
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
      </Card>

      {/* Preview Column */}
      <div 
        ref={bannerWrapperRef}
        className="flex-1 flex justify-center items-center bg-muted/30 p-4 relative min-h-0"
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
              />
          ) : (
              <div className="w-full h-full flex flex-col justify-center items-center border-2 border-dashed">
                  <h3 className="text-2xl font-bold font-headline">{bannerDimensions.name}</h3>
                  <p className="text-muted-foreground">{bannerDimensions.width}px &times; {bannerDimensions.height}px</p>
              </div>
          )}
          
          {logoImage && (
            <div
              className="absolute"
              style={{
                  top: `${textPosition.y}%`,
                  left: `${logoPosition.x}%`,
                  width: `${logoSize}%`,
                  transform: 'translate(-50%, -50%)',
              }}
            >
              <div className="relative w-full" style={{paddingBottom: '100%'}}>
                  <Image
                      src={logoImage}
                      alt="Logo"
                      layout="fill"
                      objectFit="contain"
                  />
              </div>
            </div>

          )}
          <div
            className="absolute"
            style={{
              top: `${textPosition.y}%`,
              left: `${textPosition.x}%`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <span
              className={cn('whitespace-nowrap font-bold text-center', {
                'text-transparent': !bannerImage // Hide text if no image
              })}
              style={{
                fontSize: `48px` // Example static size, adjust as needed
              }}
            >
              {text}
            </span>
          </div>
        </div>
      </div>
      
    </div>
  );
}
