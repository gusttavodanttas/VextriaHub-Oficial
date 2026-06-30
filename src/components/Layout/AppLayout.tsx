
import React from 'react';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { AppHeader } from './AppHeader';
import { SidebarInset } from '@/components/ui/sidebar';
import { useCoordinatorAlerts } from '@/hooks/useCoordinatorAlerts';
import { useProximityNotifications } from '@/hooks/useProximityNotifications';

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  useCoordinatorAlerts();
  useProximityNotifications();
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background overflow-x-hidden">
        <AppSidebar />
        <SidebarInset className="flex flex-col flex-1 min-w-0 transition-all duration-200 ease-linear">
          <AppHeader />
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};
