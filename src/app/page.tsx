'use client';

import { BannerEditor } from '@/components/banner-editor';
import { Header } from '@/components/header';
import { withAuth } from '@/components/with-auth';

function HomePage() {
  return (
    <div className="flex flex-col min-h-dvh bg-background overflow-hidden">
      <Header />
      <main className="flex-1">
        <BannerEditor />
      </main>
    </div>
  );
}

export default withAuth(HomePage);
