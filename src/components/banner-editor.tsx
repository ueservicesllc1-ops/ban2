'use client';

import { useState, useMemo, ChangeEvent } from 'react';
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
import { cn, fileToDataUri } from '@/lib/utils';
import type { SuggestOptimalPlacementsOutput } from '@/ai/flows/suggest-optimal-placements';
import { getPlacementSuggestions } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Info, Loader2, Sparkles, Upload } from 'lucide-react';

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

export function BannerEditor() {
  const { toast } = useToast();

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
  const [logoPlacement, setLogoPlacement] = useState('top-left');
  const [textPlacement, setTextPlacement] = useState('center');

  const bannerDimensions = useMemo(() => {
    if (preset === 'custom') {
      return customDimensions;
    }
    return BANNER_PRESETS[preset as keyof typeof BANNER_PRESETS];
  }, [preset, customDimensions]);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>, setImage: (url: string | null) => void) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const dataUri = await fileToDataUri(file);
        setImage(dataUri);
      } catch (error) {
        toast({
          variant: 'destructive',
          title: 'Error reading file',
          description: 'There was a problem converting your image. Please try another file.',
        });
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

    const result = await getPlacementSuggestions({
      bannerImageDataUri: bannerImage,
      logoImageDataUri: logoImage,
      text: text,
    });

    if (result.success) {
      setAiSuggestions(result.data);
      setLogoPlacement(result.data.logoPlacement.toLowerCase().replace('_', '-'));
      setTextPlacement(result.data.textPlacement.toLowerCase().replace('_', '-'));
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
  
  const headlineFont = FONT_OPTIONS.find(f => f.value === textStyle.font)?.isHeadline ? 'font-headline' : 'font-body';

  return (
    <div className="container py-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-1 h-fit">
          <CardHeader>
            <CardTitle className="font-headline text-2xl">Customize Your Banner</CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible defaultValue="item-1" className="w-full">
              <AccordionItem value="item-1">
                <AccordionTrigger className="font-headline">1. Banner & Size</AccordionTrigger>
                <AccordionContent className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="banner-upload">Banner Image</Label>
                    <Input id="banner-upload" type="file" accept="image/*" onChange={(e) => handleFileChange(e, setBannerImage)} />
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
                <AccordionTrigger className="font-headline">2. Logo & Text</AccordionTrigger>
                <AccordionContent className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="logo-upload">Logo (PNG)</Label>
                    <Input id="logo-upload" type="file" accept="image/png" onChange={(e) => handleFileChange(e, setLogoImage)} />
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
                  <Button onClick={handleGetSuggestions} disabled={isLoadingAi} className="w-full bg-accent hover:bg-accent/90">
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
            </Accordion>
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          <Card className="w-full h-full min-h-[400px] lg:min-h-0 flex flex-col">
            <CardHeader>
              <CardTitle className="font-headline text-2xl">Preview</CardTitle>
            </CardHeader>
            <CardContent className="p-2 sm:p-6 flex-1 flex items-center justify-center">
              <div
                className="relative w-full max-w-full overflow-hidden bg-muted/50 rounded-lg shadow-inner"
                style={{
                  aspectRatio: `${bannerDimensions.width} / ${bannerDimensions.height}`,
                  maxHeight: 'calc(100vh - 250px)'
                }}
              >
                {bannerImage ? (
                  <Image src={bannerImage} alt="Banner background" fill style={{ objectFit: 'cover' }} />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
                    <Upload className="h-10 w-10 mb-2" />
                    <span>Upload a banner image to start</span>
                  </div>
                )}

                {logoImage && (
                  <div className={cn('absolute transition-all duration-500 ease-in-out', placementClasses[logoPlacement])}>
                    <div className="relative w-24 h-24" style={{ width: '96px', height: 'auto', maxWidth: '150px' }}>
                       <Image src={logoImage} alt="Logo" width={96} height={96} style={{objectFit: 'contain', width: '100%', height: 'auto'}} />
                    </div>
                  </div>
                )}

                {bannerImage && text && (
                  <div className={cn('absolute transition-all duration-500 ease-in-out p-2', placementClasses[textPlacement])}>
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
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
