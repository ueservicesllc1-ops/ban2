import { BannerEditor } from '@/components/banner-editor';
import { Header } from '@/components/header';

export default function Home() {
  return (
    <div className="flex flex-col min-h-dvh bg-background">
      <Header />
      <main className="flex-1">
        <BannerEditor />
      </main>
    </div>
  );
}
