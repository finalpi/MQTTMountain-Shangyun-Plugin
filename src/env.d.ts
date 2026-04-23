/// <reference types="vite/client" />

declare global {
  interface Window {
    MqttMountainHost?: {
      api?: Record<string, any>;
      bridge?: {
        getSnapshot?: () => any;
        publish?: (payload: any) => Promise<any>;
      };
      view?: {
        id: string;
        name: string;
        pluginId: string;
        pluginName: string;
      };
    };
  }
}

export {};
