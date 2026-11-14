/// <reference types="vite/client" />

import type { InvestAiApi } from "../shared/contracts";

declare global {
  interface Window {
    investAi: InvestAiApi;
  }
}

export {};
