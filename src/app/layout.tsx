import type { Metadata } from 'next';
import './globals.css';
import ReduxProvider from '@/frontend/components/ReduxProvider';

export const metadata: Metadata = {
  title: 'AI-First CRM - HCP Module',
  description: 'AI-First CRM HCP Log Interaction Module with LangGraph Agent and Redux State management.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ReduxProvider>{children}</ReduxProvider>
      </body>
    </html>
  );
}
