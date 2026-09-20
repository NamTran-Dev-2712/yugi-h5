import { createStore } from 'zustand/vanilla';

export type ConnectionStatus = 'checking' | 'connected' | 'disconnected';

interface ViewState {
  connectionStatus: ConnectionStatus;
  setConnectionStatus: (status: ConnectionStatus) => void;
}

/**
 * Client-side VIEW state only — a mirror of what the server last told us.
 * Never mutate game state here directly; it always flows in from server events.
 * Plain `zustand/vanilla` (no React) since Phaser scenes drive rendering, not React components.
 */
export const viewStore = createStore<ViewState>((set) => ({
  connectionStatus: 'checking',
  setConnectionStatus: (status) => set({ connectionStatus: status }),
}));
