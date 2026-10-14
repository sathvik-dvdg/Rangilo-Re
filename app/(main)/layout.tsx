import { Navbar } from '@/components/layout/Navbar';
import { CustomCursor } from '@/components/layout/CustomCursor';
import { SmoothScroll } from '@/components/layout/SmoothScroll';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SmoothScroll />
      <CustomCursor />
      <Navbar />
      {children}
    </>
  );
}
