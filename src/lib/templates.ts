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
        bannerImage: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1584&h=396&fit=crop',
        logoImage: '/logo-placeholder-light.png',
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
        bannerImage: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=1080&h=1080&fit=crop',
        logoImage: '/logo-placeholder-dark.png',
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
        bannerImage: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=851&h=315&fit=crop',
        logoImage: '/logo-placeholder-light.png',
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
        bannerImage: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1080&h=1920&fit=crop',
        logoImage: '/logo-placeholder-light.png',
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
        bannerImage: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1500&h=500&fit=crop',
        logoImage: '/logo-placeholder-light.png',
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
    },
    {
        id: 'real-estate',
        name: 'Bienes Raíces de Lujo',
        bannerImage: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=1080&h=1080&fit=crop',
        logoImage: '/logo-placeholder-dark.png',
        text: 'TU HOGAR SOÑADO',
        preset: 'instagramPost',
        logoPosition: { x: 50, y: 10 },
        logoSize: 12,
        textPosition: { x: 50, y: 90 },
        textStyle: { font: 'Montserrat', size: 80, color: '#252525' },
        textEffects: {
            shadow: { enabled: false, color: '#000000', offsetX: 2, offsetY: 2, blur: 4 },
            stroke: { enabled: false, color: '#000000', width: 1 },
        }
    }
];
