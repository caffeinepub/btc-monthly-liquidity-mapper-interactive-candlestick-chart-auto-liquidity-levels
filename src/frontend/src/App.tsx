import { LiquidityMapperPage } from './pages/LiquidityMapperPage';
import { Toaster } from '@/components/ui/sonner';
import { ThemeProvider } from 'next-themes';

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <div className="min-h-screen bg-background">
        <LiquidityMapperPage />
        <Toaster />
      </div>
    </ThemeProvider>
  );
}
