import { useQuery } from '@tanstack/react-query';
import { getBins, getAlerts, getLiveReadings, type Bin, type Alert } from '../api';
import { friendlyAlert } from '../utils/alertsDisplay';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Link } from 'react-router-dom';
import { useLiveData } from '../context/LiveDataContext';
import { useState, useEffect } from 'react';

function FillGauge({ fill, threshold }: { fill: number; threshold: number }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const clampedFill = Math.min(fill, 100);
  const offset = circumference - (clampedFill / 100) * circumference;
  const getColor = () => {
    if (clampedFill >= threshold) return '#ef4444';
    if (clampedFill >= 50) return '#f59e0b';
    return '#22c55e';
  };
  return (
    <div className="relative w-32 h-32 mx-auto">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="currentColor" strokeWidth="8" className="text-gray-700" />
        <circle cx="60" cy="60" r={radius} fill="none" stroke={getColor()} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          style={{ transition: 'none' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold" style={{ color: getColor() }}>{clampedFill.toFixed(0)}%</span>
        <span className="text-[10px] text-gray-500">fill level</span>
      </div>
    </div>
  );
}

function StatusBadge({ fill, threshold }: { fill: number; threshold: number }) {
  if (fill >= threshold) return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/20 text-red-400 animate-pulse">Critical</span>;
  if (fill >= 50) return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-400">Warning</span>;
  return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-500/20 text-green-400">Normal</span>;
}

function alertLabel(type: string) {
  if (type === 'threshold_exceeded') return 'Capacity';
  if (type === 'gas_detected') return 'Gas/Odor';
  return type;
}

export function DashboardPage() {
  const { data: bins, isLoading } = useQuery<Bin[]>({ queryKey: ['bins'], queryFn: getBins, refetchInterval: 30000 });
  const { data: alerts } = useQuery<Alert[]>({ queryKey: ['alerts'], queryFn: getAlerts, refetchInterval: false });
  const { live, isConnected, lastMessage, hydrateBin } = useLiveData();
  const [toastAlert, setToastAlert] = useState<string | null>(null);

  useEffect(() => {
    getLiveReadings()
      .then((rows) => {
        rows.forEach((d) =>
          hydrateBin(d.bin_id, {
            fill: d.fill_pct,
            temp: d.temperature ?? undefined,
            hum: d.humidity ?? undefined,
            gas: d.gas_ppm ?? undefined,
            moisture: d.moisture_pct ?? undefined,
            time: d.recorded_at,
          }),
        );
      })
      .catch(() => {});
  }, [hydrateBin]);

  useEffect(() => {
    const msg = lastMessage as {
      type?: string;
      data?: { message?: string; bin_name?: string; type?: string; resolved?: boolean };
    } | null;
    if (msg?.type !== 'new_alert' || !msg.data) return;
    const fake = {
      id: '',
      bin_id: '',
      type: msg.data.type || '',
      message: msg.data.message || '',
      resolved: false,
      created_at: new Date().toISOString(),
      bin_name: msg.data.bin_name,
    };
    const { title, detail } = friendlyAlert(fake);
    setToastAlert(`${title} — ${detail}`);
    const t = setTimeout(() => setToastAlert(null), 8000);
    return () => clearTimeout(t);
  }, [lastMessage]);

  const activeAlerts = alerts?.filter(a => !a.resolved) || [];

  if (isLoading) return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div></div>;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl lg:text-4xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">Smart Bins Dashboard</h1>
          <p className="text-gray-400 mt-1">Real-time waste monitoring and alert status</p>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${isConnected ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
          {isConnected ? 'Realtime' : 'Polling fallback'}
        </div>
      </div>

      {toastAlert && (
        <div className="bg-red-500/15 border border-red-500/40 text-red-200 px-4 py-3 rounded-lg flex items-center justify-between animate-pulse">
          <span><strong>New alert:</strong> {toastAlert}</span>
          <Link to="/alerts" className="text-sm underline text-red-300">View all</Link>
        </div>
      )}

      {activeAlerts.length > 0 && (
        <Card className="border-red-500/40 bg-red-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-red-400 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              Active Alerts ({activeAlerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {activeAlerts.slice(0, 5).map(alert => (
              <div key={alert.id} className="flex flex-wrap items-center gap-2 text-sm border-b border-red-500/10 pb-2 last:border-0">
                <span className="font-medium text-gray-200">{alert.bin_name || 'Bin'}</span>
                <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-300 text-xs font-medium">
                  {alertLabel(alert.type)}
                </span>
                <span className="text-gray-300">{friendlyAlert(alert).detail}</span>
              </div>
            ))}
            <Link to="/alerts" className="text-sm text-blue-400 hover:underline inline-block mt-2">View alert history</Link>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center text-2xl">🗑️</div>
            <div><p className="text-sm text-gray-400">Total Bins</p><p className="text-2xl font-bold">{bins?.length || 0}</p></div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center text-2xl">🚨</div>
            <div><p className="text-sm text-gray-400">Active Alerts</p><p className="text-2xl font-bold text-red-400">{activeAlerts.length}</p></div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center text-2xl">⚠️</div>
            <div><p className="text-sm text-gray-400">Critical Bins</p><p className="text-2xl font-bold text-amber-400">{bins?.filter(b => (live[b.id]?.fill || 0) >= b.threshold_pct).length || 0}</p></div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {bins?.map(bin => {
          const d = live[bin.id];
          const fill = d?.fill || 0;
          const lastUpdate = d ? new Date(d.time).toLocaleTimeString() : 'No data yet';
          const binAlerts = activeAlerts.filter(a => a.bin_id === bin.id);
          return (
            <Link key={bin.id} to={`/bins/${bin.id}`}>
              <Card className={`hover:shadow-xl hover:shadow-blue-500/5 transition-all duration-300 cursor-pointer group ${binAlerts.length ? 'border-red-500/40' : 'hover:border-blue-500/30'}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg group-hover:text-blue-400 transition-colors">{bin.name}</CardTitle>
                    <StatusBadge fill={fill} threshold={bin.threshold_pct} />
                  </div>
                  <p className="text-sm text-gray-400">{bin.location || 'Unknown location'}</p>
                  {binAlerts.length > 0 && (
                    <p className="text-xs text-red-400 mt-1">{binAlerts.length} active alert(s)</p>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  <FillGauge fill={fill} threshold={bin.threshold_pct} />
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="bg-gray-800/50 rounded-lg py-1.5 px-2">
                      <span className="text-[10px] text-gray-400 block">Temp</span>
                      <span className="font-semibold text-sm">{d?.temp != null ? `${d.temp.toFixed(1)}°C` : '--'}</span>
                    </div>
                    <div className="bg-gray-800/50 rounded-lg py-1.5 px-2">
                      <span className="text-[10px] text-gray-400 block">Humidity</span>
                      <span className="font-semibold text-sm">{d?.hum != null ? `${d.hum.toFixed(1)}%` : '--'}</span>
                    </div>
                    <div className="bg-gray-800/50 rounded-lg py-1.5 px-2">
                      <span className="text-[10px] text-gray-400 block">Gas (IR)</span>
                      <span className={`font-semibold text-sm ${(d?.gas || 0) >= 300 ? 'text-red-400' : ''}`}>{d?.gas != null ? `${d.gas.toFixed(0)} ppm` : '--'}</span>
                    </div>
                    <div className="bg-gray-800/50 rounded-lg py-1.5 px-2">
                      <span className="text-[10px] text-gray-400 block">Moisture (IR)</span>
                      <span className="font-semibold text-sm">{d?.moisture != null ? `${d.moisture.toFixed(0)}%` : '--'}</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 text-center">Last: {lastUpdate}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
