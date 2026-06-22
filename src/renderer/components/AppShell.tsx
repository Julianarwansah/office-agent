import React from 'react';
import TopBar from './TopBar';
import Sidebar from './Sidebar';
import { useAppStore } from '../stores/app';

interface AppShellProps {
  children: React.ReactNode;
}

const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      <Sidebar />
      <div
        className={`flex flex-1 flex-col overflow-hidden transition-all duration-200 ${
          sidebarOpen ? 'ml-64' : 'ml-[68px]'
        }`}
      >
        <TopBar />
        <main className="flex-1 overflow-hidden">
          <div className="aurora-bg h-full w-full overflow-y-auto scrollbar-thin">
            <div className="mx-auto h-full w-full max-w-[1400px] p-6 lg:p-8">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AppShell;
