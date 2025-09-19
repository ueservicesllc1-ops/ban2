'use client';

import { BannerEditor } from '@/components/banner-editor';
import { Header } from '@/components/header';
import { withAuth } from '@/components/with-auth';

function HomePage() {
  return (
    <div className="p-4 lg:p-8 h-dvh">
      <div className="flex flex-col h-full rounded-lg shadow-lg overflow-hidden bg-background ring-1 ring-border">
        <Header />
        <main className="flex-1 min-h-0">
          <BannerEditor />
        </main>
      </div>
    </div>
  );
}

export default withAuth(HomePage);
