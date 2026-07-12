import { Nav } from '@/components/sections/Nav';
import { Hero } from '@/components/sections/Hero';
import { PhoneStory } from '@/components/sections/PhoneStory';
import { Memory } from '@/components/sections/Memory';
import { Capabilities } from '@/components/sections/Capabilities';
import { BetaCta } from '@/components/sections/BetaCta';
import { ResearchProof } from '@/components/sections/ResearchProof';
import { Footer } from '@/components/sections/Footer';

export default function Home() {
  return (
    <>
      <Nav />
      <main id="main">
        <Hero />
        <PhoneStory />
        <Memory />
        <Capabilities />
        <ResearchProof />
        <BetaCta />
      </main>
      <Footer />
    </>
  );
}
