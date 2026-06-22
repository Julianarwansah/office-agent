/// <reference types="vite/client" />

import type { OfficeAPI } from '../preload/api';

declare global {
  interface Window {
    officeAPI: OfficeAPI;
    office: {
      platform: NodeJS.Platform | 'web';
      versions: {
        node?: string;
        chrome?: string;
        electron?: string;
        app: string;
      };
    };
  }
}

export {};