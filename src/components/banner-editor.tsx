'use client';

import { useState, useMemo, useEffect, useRef, useCallback, ChangeEvent } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Sparkles, Save, Download } from 'lucide-react';
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

  const bannerDimensions = useMemo(() => {
    return preset === 'custom' ? customDimensions : BANNER_PRESETS[preset as keyof typeof BANNER_PRESETS];
  }, [preset, customDimensions]);

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
    if (!bannerImage || !user) return;
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
      const dataUrl = await htmlToImage.toPng(element, { backgroundColor: null, pixelRatio: scale });
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
    <div className="container mx-auto py-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-1 h-fit sticky top-24">
          <CardHeader>
            <CardTitle>Editor de Banner</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label>Preset</Label>
              <Select value={preset} onValueChange={setPreset}>
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
              <Input type="file" accept="image/*" onChange={(e) => handleFileChange(e, setBannerImage)} />
            </div>

            <div>
              <Label>Logo</Label>
              <Input type="file" accept="image/*" onChange={(e) => handleFileChange(e, setLogoImage)} />
            </div>

            <div>
              <Label>Texto</Label>
              <Textarea value={text} onChange={(e) => setText(e.target.value)} />
            </div>

            <Button onClick={handleSaveBanner} disabled={isSaving} className="w-full">
              {isSaving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />}
              Guardar
            </Button>

            <Button onClick={handleDownload} disabled={isDownloading} className="w-full">
              {isDownloading ? <Loader2 className="animate-spin mr-2" /> : <Download className="mr-2" />}
              Descargar
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardContent>
            <div
              ref={bannerPreviewRef}
              className="relative"
              style={{
                width: `${bannerDimensions.width}px`,
                height: `${bannerDimensions.height}px`,
                border: '1px solid #ccc',
                backgroundImage: `url(${bannerImage})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            >
              {logoImage && (
                <Image
                  src={logoImage}
                  alt="Logo"
                  width={logoSize * 10}
                  height={logoSize * 10}
                  style={{
                    position: 'absolute',
                    left: `${logoPosition.x}%`,
                    top: `${logoPosition.y}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                />
              )}
              <span
                style={{
                  position: 'absolute',
                  left: `${textPosition.x}%`,
                  top: `${textPosition.y}%`,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                {text}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
