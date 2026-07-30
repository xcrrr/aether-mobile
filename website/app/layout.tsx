import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { SmoothScroll } from '@/components/ui/SmoothScroll';

export const metadata: Metadata = {
  title: 'Aether — a private AI assistant for Android',
  description:
    'Aether runs a language model on your phone. Conversations and memory stay on your device, and optional Research goes online only when you ask. Open beta, free on GitHub.',
  openGraph: {
    title: 'Aether — a private AI assistant for Android',
    description:
      'An assistant that runs on your phone, remembers what matters, and goes online only when you ask. Open beta for Android.',
    type: 'website',
    siteName: 'Aether',
  },
  twitter: {
    card: 'summary',
    title: 'Aether — a private AI assistant for Android',
    description:
      'An assistant that runs on your phone, remembers what matters, and goes online only when you ask. Open beta for Android.',
  },
};

const newsreader = localFont({
  src: [
    { path: '../public/fonts/Newsreader-var.woff2', weight: '400 600', style: 'normal' },
    { path: '../public/fonts/Newsreader-italic-var.woff2', weight: '400 500', style: 'italic' },
  ],
  variable: '--font-serif',
  display: 'swap',
});

const instrumentSans = localFont({
  src: '../public/fonts/InstrumentSans-var.woff2',
  weight: '400 700',
  variable: '--font-sans',
  display: 'swap',
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${newsreader.variable} ${instrumentSans.variable}`}>
      <body>
        <SmoothScroll />
        {children}
      </body>
    </html>
  );
}
