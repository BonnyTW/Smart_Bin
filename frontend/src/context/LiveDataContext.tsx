import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getLiveReadings, type Alert, type Reading } from '../api';

function wsUrl(): string {
  const env = import.meta.env.VITE_API_URL;
  if (env) {
    return `${String(env).replace(/^http/, 'ws')}/ws/bins`;
  }
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws/bins`;
}

export interface LiveReading {
  fill: number;
  temp?: number;
  hum?: number;
  gas?: number;
  moisture?: number;
  time: string;
}

interface LiveDataContextValue {
  live: Record<string, LiveReading>;
  isConnected: boolean;
  lastMessage: unknown;
  hydrateBin: (binId: string, reading: LiveReading) => void;
}

const LiveDataContext = createContext<LiveDataContextValue | null>(null);

function toLiveReading(data: Record<string, unknown>): LiveReading {
  return {
    fill: Number(data.fill_pct),
    temp: data.temperature != null ? Number(data.temperature) : undefined,
    hum: data.humidity != null ? Number(data.humidity) : undefined,
    gas: data.gas_ppm != null ? Number(data.gas_ppm) : undefined,
    moisture: data.moisture_pct != null ? Number(data.moisture_pct) : undefined,
    time: String(data.recorded_at),
  };
}

function toReadingRow(data: Record<string, unknown>): Reading {
  return {
    id: String(data.id),
    bin_id: String(data.bin_id),
    fill_pct: Number(data.fill_pct),
    temperature: data.temperature != null ? Number(data.temperature) : null,
    humidity: data.humidity != null ? Number(data.humidity) : null,
    gas_ppm: data.gas_ppm != null ? Number(data.gas_ppm) : null,
    moisture_pct: data.moisture_pct != null ? Number(data.moisture_pct) : null,
    recorded_at: String(data.recorded_at),
    fan_on: Boolean(data.fan_on),
  };
}

function toAlertRow(data: Record<string, unknown>): Alert {
  return {
    id: String(data.id),
    bin_id: String(data.bin_id),
    type: String(data.type),
    message: String(data.message),
    resolved: Boolean(data.resolved),
    created_at: String(data.created_at ?? new Date().toISOString()),
    bin_name: data.bin_name != null ? String(data.bin_name) : null,
    status: data.resolved ? 'resolved' : 'active_danger',
  };
}

export function LiveDataProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [live, setLive] = useState<Record<string, LiveReading>>({});
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<unknown>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectedRef = useRef(false);

  const hydrateBin = useCallback((binId: string, reading: LiveReading) => {
    setLive((prev) => {
      const existing = prev[binId];
      if (existing && new Date(existing.time) >= new Date(reading.time)) {
        return prev;
      }
      return { ...prev, [binId]: reading };
    });
  }, []);

  const applyReading = useCallback(
    (data: Record<string, unknown>) => {
      const binId = String(data.bin_id);
      setLive((prev) => ({ ...prev, [binId]: toLiveReading(data) }));

      const row = toReadingRow(data);
      queryClient.setQueryData<Reading[]>(['readings', binId], (prev) => {
        if (!prev?.length) return [row];
        if (prev[0].recorded_at === row.recorded_at && prev[0].fill_pct === row.fill_pct) {
          return [{ ...row }, ...prev.slice(1)];
        }
        return [row, ...prev].slice(0, 100);
      });
    },
    [queryClient],
  );

  const patchAlert = useCallback(
    (data: Record<string, unknown>, event: 'new' | 'resolved' | 'updated') => {
      const row = toAlertRow(data);
      queryClient.setQueryData<Alert[]>(['alerts'], (prev) => {
        const list = prev ?? [];
        const idx = list.findIndex((a) => a.id === row.id);
        if (event === 'new' && idx < 0) {
          return [row, ...list];
        }
        if (idx >= 0) {
          const next = [...list];
          next[idx] = { ...next[idx], ...row };
          if (event === 'resolved') {
            next[idx] = { ...next[idx], resolved: true, message: row.message };
          }
          return next;
        }
        return [row, ...list];
      });
    },
    [queryClient],
  );

  const syncLiveSnapshot = useCallback(async () => {
    try {
      const rows = await getLiveReadings();
      rows.forEach((r) => {
        hydrateBin(r.bin_id, {
          fill: r.fill_pct,
          temp: r.temperature ?? undefined,
          hum: r.humidity ?? undefined,
          gas: r.gas_ppm ?? undefined,
          moisture: r.moisture_pct ?? undefined,
          time: r.recorded_at,
        });
      });
    } catch {
      /* backend may still be starting */
    }
  }, [hydrateBin]);

  useEffect(() => {
    syncLiveSnapshot();
  }, [syncLiveSnapshot]);

  useEffect(() => {
    let closed = false;

    const connect = () => {
      if (closed) return;
      const ws = new WebSocket(wsUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        connectedRef.current = true;
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          setLastMessage(msg);
          if (msg.type === 'new_reading' && msg.data) {
            applyReading(msg.data);
          }
          if (msg.type === 'new_alert' && msg.data) {
            patchAlert(msg.data, 'new');
          }
          if (msg.type === 'alert_resolved' && msg.data) {
            patchAlert(msg.data, 'resolved');
          }
          if (msg.type === 'alert_updated' && msg.data) {
            patchAlert(msg.data, 'updated');
          }
        } catch (e) {
          console.error('Failed to parse WS message', e);
        }
      };

      ws.onclose = () => {
        connectedRef.current = false;
        setIsConnected(false);
        if (!closed) {
          reconnectTimer.current = setTimeout(connect, 400);
        }
      };

      ws.onerror = () => ws.close();
    };

    connect();

    const poll = setInterval(() => {
      if (!connectedRef.current) syncLiveSnapshot();
    }, 800);

    return () => {
      closed = true;
      clearInterval(poll);
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [applyReading, patchAlert, syncLiveSnapshot]);

  return (
    <LiveDataContext.Provider value={{ live, isConnected, lastMessage, hydrateBin }}>
      {children}
    </LiveDataContext.Provider>
  );
}

export function useLiveData() {
  const ctx = useContext(LiveDataContext);
  if (!ctx) throw new Error('useLiveData must be used within LiveDataProvider');
  return ctx;
}
