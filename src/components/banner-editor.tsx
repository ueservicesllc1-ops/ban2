// src/components/banner-editor.tsx
'use client';

import { useState, useMemo, ChangeEvent, useEffect, useRef } from 'react';
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
import { Info, Loader2, Sparkles, Upload, Save, Move } from 'lucide-react';
import { storage, db } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '@/hooks/use-auth';

const placementClasses: { [key: string]: string } = {
  'top-left': 'top-4 left-4',
  'top-center': 'top-4 left-1/2 -translate-x-1/2',
  'top-right': 'top-4 right-4',
  'center-left': 'top-1/2 -translate-y-1/2 left-4',
  center: 'top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2',
  'center-right': 'top-1/2 -translate-y-1/2 right-4',
  'bottom-left': 'bottom-4 left-4',
  'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
  'bottom-right': 'bottom-4 right-4',
};

const placementToPercentage = (placement: string): { x: number; y: number } => {
    switch (placement) {
        case 'top-left': return { x: 5, y: 5 };
        case 'top-center': return { x: 50, y: 5 };
        case 'top-right': return { x: 95, y: 5 };
        case 'center-left': return { x: 5, y: 50 };
        case 'center': return { x: 50, y: 50 };
        case 'center-right': return { x: 95, y: 50 };
        case 'bottom-left': return { x: 5, y: 95 };
        case 'bottom-center': return { x: 50, y: 95 };
        case 'bottom-right': return { x: 95, y: 95 };
        default: return { x: 5, y: 5 };
    }
};

export function BannerEditor() {
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [bannerImage, setBannerImage] = useState<string | null>(null);
  const [logoImage, setLogoImage] = useState<string | null>(null);
  const [text, setText] = useState('Your Text Here');
  const [textStyle, setTextStyle] = useState({
    font: 'Poppins',
    size: 48,
    color: '#FFFFFF',
  });
  const [preset, setPreset] = useState('facebookCover');
  const [customDimensions, setCustomDimensions] = useState({ width: 851, height: 315 });

  const [aiSuggestions, setAiSuggestions] = useState<SuggestOptimalPlacementsOutput | null>(null);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // States for logo drag and resize
  const [logoPosition, setLogoPosition] = useState({ x: 10, y: 10 }); // in percentage
  const [logoSize, setLogoSize] = useState(15); // in percentage of banner width
  const isDragging = useRef(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const bannerPreviewRef = useRef<HTMLDivElement>(null);


  const [textPlacement, setTextPlacement] = useState('center');
  
  useEffect(() => {
    // This will run once when the component mounts
    if (user) {
      console.log('BannerEditor mounted. User is authenticated:', user.uid);
    } else {
      console.log('BannerEditor mounted. User is NOT authenticated.');
    }
  }, [user]);

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
        await uploadBytes(fileRef, file);
        const downloadURL = await getDownloadURL(fileRef);
        setImage(downloadURL);
        toast({
          title: 'Upload successful',
          description: 'Your image has been uploaded to Firebase Storage.',
        });
      } catch (error) {
        console.error('Error uploading file:', error);
        toast({
          variant: 'destructive',
          title: 'Upload failed',
          description: 'There was a problem uploading your image. Please try again.',
        });
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleGetSuggestions = async () => {
    if (!bannerImage || !logoImage || !text) {
      toast({
        variant: 'destructive',
        title: 'Missing elements',
        description: 'Please upload a banner, a logo, and provide text before getting suggestions.',
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
        title: 'Image Conversion Failed',
        description: 'Could not convert image URLs to data for AI processing.',
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
      
      const logoPos = placementToPercentage(suggestedLogoPlacement);
      setLogoPosition(logoPos);
      setTextPlacement(placementClasses[suggestedTextPlacement] ? suggestedTextPlacement : 'center');
      toast({
        title: 'Suggestions Received!',
        description: 'AI placements have been applied to your banner.',
      });
    } else {
      toast({
        variant: 'destructive',
        title: 'AI Suggestion Failed',
        description: result.error,
      });
    }

    setIsLoadingAi(false);
  };
  
  const urlToDataUri = async (url: string): Promise<string | null> => {
    if (url.startsWith('data:')) return url;
    try {
      // Using a proxy to avoid CORS issues when converting images from other origins
      const response = await fetch(`https://cors-anywhere.herokuapp.com/${url}`);
      const blob = await response.blob();
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error("Error converting URL to data URI:", error);
      // Fallback for direct fetch if proxy fails or for same-origin requests
      try {
        const response = await fetch(url);
        const blob = await response.blob();
        return await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
      } catch (e) {
        console.error("Direct fetch also failed:", e);
        return null;
      }
    }
  };

  const handleSaveBanner = async () => {
    if (!bannerImage) {
      toast({ variant: 'destructive', title: 'Cannot Save', description: 'Please upload a banner image before saving.'});
      return;
    }
     if (!user) {
      toast({ variant: 'destructive', title: 'Not Authenticated', description: 'You must be logged in to save.'});
      return;
    }
    setIsSaving(true);
    try {
      await addDoc(collection(db, 'users', user.uid, 'banners'), {
        bannerImage,
        logoImage,
        logoPosition,
        logoSize,
        text,
        textStyle,
        textPlacement,
        preset,
        customDimensions,
        createdAt: new Date(),
        userId: user.uid,
      });
      toast({ title: 'Banner Saved!', description: 'Your banner configuration has been saved to Firestore.' });
    } catch (error) {
      console.error('Error saving banner: ', error);
      toast({ variant: 'destructive', title: 'Save Failed', description: 'Could not save banner to Firestore.'});
    } finally {
      setIsSaving(false);
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!bannerPreviewRef.current) return;
    isDragging.current = true;
    
    const bannerRect = bannerPreviewRef.current.getBoundingClientRect();
    dragStartPos.current = {
      x: e.clientX,
      y: e.clientY,
      offsetX: e.clientX - bannerRect.left - (logoPosition.x / 100) * bannerRect.width,
      offsetY: e.clientY - bannerRect.top - (logoPosition.y / 100) * bannerRect.height,
    };
    e.preventDefault();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging.current || !bannerPreviewRef.current) return;

    const bannerRect = bannerPreviewRef.current.getBoundingClientRect();
    let newX = ((e.clientX - bannerRect.left) / bannerRect.width) * 100;
    let newY = ((e.clientY - bannerRect.top) / bannerRect.height) * 100;

    // Clamp values to stay within the banner
    newX = Math.max(0, Math.min(100, newX));
    newY = Math.max(0, Math.min(100, newY));

    setLogoPosition({ x: newX, y: newY });
  };

  const handleMouseUp = () => {
    isDragging.current = false;
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

  return (
    <div className="container mx-auto py-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-1 h-fit">
          <CardHeader>
            <CardTitle className="font-headline text-2xl">Customize Your Banner</CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible defaultValue="item-1" className="w-full">
              <AccordionItem value="item-1">
                <AccordionTrigger className="font-headline">1. Banner &amp; Size</AccordionTrigger>
                <AccordionContent className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="banner-upload">Banner Image</Label>
                    <Input id="banner-upload" type="file" accept="image/*" onChange={(e) => handleFileChange(e, setBannerImage)} disabled={isUploading} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="format-select">Preset Format</Label>
                    <Select value={preset} onValueChange={setPreset}>
                      <SelectTrigger id="format-select">
                        <SelectValue placeholder="Select a format" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(BANNER_PRESETS).map(([key, value]) => (
                          <SelectItem key={key} value={key}>{value.name}</SelectItem>
                        ))}
                        <SelectItem value="custom">Custom Dimensions</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {preset === 'custom' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="width">Width (px)</Label>
                        <Input id="width" type="number" value={customDimensions.width} onChange={e => setCustomDimensions(d => ({...d, width: parseInt(e.target.value)}))} />
                      </div>
                       <div className="space-y-2">
                        <Label htmlFor="height">Height (px)</Label>
                        <Input id="height" type="number" value={customDimensions.height} onChange={e => setCustomDimensions(d => ({...d, height: parseInt(e.target.value)}))} />
                      </div>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-2">
                <AccordionTrigger className="font-headline">2. Logo &amp; Text</AccordionTrigger>
                <AccordionContent className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="logo-upload">Logo (PNG)</Label>
                    <Input id="logo-upload" type="file" accept="image/png" onChange={(e) => handleFileChange(e, setLogoImage)} disabled={isUploading}/>
                  </div>
                  <div className="space-y-2">
                    <Label>Logo Size: {logoSize.toFixed(0)}%</Label>
                    <Slider
                      value={[logoSize]}
                      onValueChange={([val]) => setLogoSize(val)}
                      min={5}
                      max={50}
                      step={1}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="text-input">Overlay Text</Label>
                    <Textarea id="text-input" value={text} onChange={e => setText(e.target.value)} />
                  </div>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-3">
                <AccordionTrigger className="font-headline">3. Text Styling</AccordionTrigger>
                <AccordionContent className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="font-select">Font</Label>
                     <Select value={textStyle.font} onValueChange={font => setTextStyle(s => ({...s, font}))}>
                      <SelectTrigger id="font-select">
                        <SelectValue placeholder="Select a font" />
                      </SelectTrigger>
                      <SelectContent>
                        {FONT_OPTIONS.map(font => (
                           <SelectItem key={font.value} value={font.value}>{font.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="font-size">Font Size: {textStyle.size}px</Label>
                    <Slider id="font-size" min={12} max={128} step={1} value={[textStyle.size]} onValueChange={([val]) => setTextStyle(s => ({...s, size: val}))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="font-color">Font Color</Label>
                    <div className="flex items-center gap-2">
                       <Input id="font-color" type="color" value={textStyle.color} onChange={e => setTextStyle(s => ({...s, color: e.target.value}))} className="p-1 h-10 w-14" />
                       <Input type="text" value={textStyle.color} onChange={e => setTextStyle(s => ({...s, color: e.target.value}))} className="w-full" />
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
               <AccordionItem value="item-4">
                <AccordionTrigger className="font-headline">4. AI Smart Suggestions</AccordionTrigger>
                <AccordionContent className="space-y-4 pt-4">
                  <p className="text-sm text-muted-foreground">Let our AI suggest the optimal placement for your logo and text for maximum impact.</p>
                  <Button onClick={handleGetSuggestions} disabled={isLoadingAi || isUploading} className="w-full bg-accent hover:bg-accent/90">
                    {isLoadingAi ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                    Suggest Placements
                  </Button>
                   {aiSuggestions && (
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertTitle className="font-headline">AI Reasoning</AlertTitle>
                      <AlertDescription>
                        {aiSuggestions.reasoning}
                      </AlertDescription>
                    </Alert>
                  )}
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-5">
                <AccordionTrigger className="font-headline">5. Save Banner</AccordionTrigger>
                <AccordionContent className="space-y-4 pt-4">
                  <p className="text-sm text-muted-foreground">Save your final banner design to the database.</p>
                   <Button onClick={handleSaveBanner} disabled={isSaving || isUploading} className="w-full">
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save to Firestore
                  </Button>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          <Card className="w-full h-full min-h-[400px] lg:min-h-0 flex flex-col items-center justify-center p-4">
            <CardHeader className="w-full">
              <CardTitle className="font-headline text-2xl">Preview</CardTitle>
            </CardHeader>
            <CardContent className="p-2 sm:p-6 flex-1 flex items-center justify-center w-full">
               <div className="relative w-full h-full flex items-center justify-center">
                <div
                  ref={bannerPreviewRef}
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
                    <Image src={bannerImage} alt="Banner background" layout="fill" objectFit="cover" unoptimized/>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
                      <Upload className="h-10 w-10 mb-2" />
                      <span>Upload a banner image to start</span>
                    </div>
                  )}

                  {logoImage && (
                    <div
                      className="absolute cursor-move z-10"
                      style={{
                        left: `${logoPosition.x}%`,
                        top: `${logoPosition.y}%`,
                        width: `${logoSize}%`,
                        transform: 'translate(-50%, -50%)',
                      }}
                      onMouseDown={handleMouseDown}
                    >
                      <div className="relative w-full h-full" style={{ aspectRatio: '1 / 1'}}>
                        <Image src={logoImage} alt="Logo" layout="fill" objectFit="contain" unoptimized/>
                      </div>
                    </div>
                  )}

                  {bannerImage && text && (
                    <div className={cn('absolute transition-all duration-500 ease-in-out p-2 z-10', placementClasses[textPlacement])}>
                      <p
                        className={cn(headlineFont, 'font-bold drop-shadow-lg')}
                        style={{
                          fontFamily: `'${textStyle.font}', sans-serif`,
                          fontSize: `${textStyle.size}px`,
                          color: textStyle.color,
                          lineHeight: 1.2
                        }}
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
