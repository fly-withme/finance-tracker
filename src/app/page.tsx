import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-base p-8 text-center">
      <div className="max-w-2xl">
        <h1 className="text-5xl md:text-7xl font-bold tracking-tighter text-primary-text">
          Finanzielle Klarheit, mühelos erreicht.
        </h1>
        <p className="mt-6 text-lg md:text-xl text-secondary-text max-w-xl mx-auto">
          Verwandle deine Kontoauszüge in wertvolle Einblicke. Verfolge deine Ausgaben, erkenne Muster und übernimm die Kontrolle über deine Finanzen.
        </p>
        <div className="mt-10">
          <Link 
            href="/dashboard" 
            className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-accent text-white font-semibold rounded-full shadow-soft hover:opacity-90 transition-opacity"
          >
            Jetzt loslegen <ArrowRight size={20} />
          </Link>
        </div>
      </div>
    </div>
  );
}