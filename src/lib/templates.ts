// src/lib/templates.ts
import { BANNER_PRESETS } from "./constants";

export interface Template {
    id: string;
    name: string;
    bannerImage: string;
    logoImage: string;
    text: string;
    preset: keyof typeof BANNER_PRESETS | 'custom';
    customDimensions?: { width: number, height: number };
    logoPosition: { x: number, y: number };
    logoSize: number;
    textPosition: { x: number, y: number };
    textStyle: {
        font: string;
        size: number;
        color: string;
    };
    textEffects: {
        shadow: { enabled: boolean, color: string, offsetX: number, offsetY: number, blur: number };
        stroke: { enabled: boolean, color: string, width: number };
    };
}


export const templates: Template[] = [
    {
        id: 'tech-event',
        name: 'Evento Tecnológico',
        bannerImage: 'https://picsum.photos/seed/tech/1584/396',
        logoImage: 'https://picsum.photos/seed/logo1/200/200',
        text: 'INNOVATION SUMMIT 2024',
        preset: 'linkedinBanner',
        logoPosition: { x: 10, y: 50 },
        logoSize: 10,
        textPosition: { x: 55, y: 50 },
        textStyle: { font: 'Oswald', size: 64, color: '#FFFFFF' },
        textEffects: {
            shadow: { enabled: true, color: '#000000', offsetX: 3, offsetY: 3, blur: 5 },
            stroke: { enabled: false, color: '#000000', width: 1 },
        }
    },
    {
        id: 'fashion-sale',
        name: 'Venta de Moda',
        bannerImage: 'https://picsum.photos/seed/fashion/1080/1080',
        logoImage: 'https://picsum.photos/seed/logo2/200/200',
        text: '50% OFF',
        preset: 'instagramPost',
        logoPosition: { x: 50, y: 15 },
        logoSize: 15,
        textPosition: { x: 50, y: 55 },
        textStyle: { font: 'Playfair Display', size: 150, color: '#FFFFFF' },
        textEffects: {
            shadow: { enabled: true, color: '#00000080', offsetX: 0, offsetY: 5, blur: 10 },
            stroke: { enabled: false, color: '#000000', width: 1 },
        }
    },
    {
        id: 'restaurant-promo',
        name: 'Promo Restaurante',
        bannerImage: 'https://picsum.photos/seed/food/851/315',
        logoImage: 'https://picsum.photos/seed/logo3/200/200',
        text: 'Sabor que Enamora',
        preset: 'facebookCover',
        logoPosition: { x: 85, y: 20 },
        logoSize: 18,
        textPosition: { x: 40, y: 50 },
        textStyle: { font: 'Dancing Script', size: 72, color: '#FFFFFF' },
        textEffects: {
            shadow: { enabled: true, color: '#4D2C1A', offsetX: 4, offsetY: 4, blur: 6 },
            stroke: { enabled: false, color: '#000000', width: 1 },
        }
    },
    {
        id: 'travel-story',
        name: 'Blog de Viajes',
        bannerImage: 'https://picsum.photos/seed/travel/1080/1920',
        logoImage: 'https://picsum.photos/seed/logo4/200/200',
        text: 'AVENTURA',
        preset: 'instagramStory',
        logoPosition: { x: 50, y: 90 },
        logoSize: 12,
        textPosition: { x: 50, y: 50 },
        textStyle: { font: 'Bebas Neue', size: 180, color: '#FFFFFF' },
        textEffects: {
            shadow: { enabled: false, color: '#000000', offsetX: 2, offsetY: 2, blur: 4 },
            stroke: { enabled: true, color: '#000000', width: 2 },
        }
    },
     {
        id: 'corporate-header',
        name: 'Corporativo',
        bannerImage: 'https://picsum.photos/seed/corp/1500/500',
        logoImage: 'https://picsum.photos/seed/logo5/200/200',
        text: 'Liderando el Futuro de la Industria',
        preset: 'twitterHeader',
        logoPosition: { x: 10, y: 50 },
        logoSize: 8,
        textPosition: { x: 50, y: 50 },
        textStyle: { font: 'Raleway', size: 52, color: '#FFFFFF' },
        textEffects: {
            shadow: { enabled: true, color: '#00000066', offsetX: 2, offsetY: 2, blur: 4 },
            stroke: { enabled: false, color: '#000000', width: 1 },
        }
    }
];
