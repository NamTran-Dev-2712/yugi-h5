import { describe, expect, it } from 'vitest';
import { viewStore } from './view-store';

describe('viewStore', () => {
  it('starts in the checking state', () => {
    expect(viewStore.getState().connectionStatus).toBe('checking');
  });

  it('updates connection status', () => {
    viewStore.getState().setConnectionStatus('connected');
    expect(viewStore.getState().connectionStatus).toBe('connected');
  });
});
