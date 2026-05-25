import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getAlerts, getBins, type Alert, type Bin } from '../api';
import { useLiveData } from '../context/LiveDataContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import {
  alertTypeShort,
  friendlyAlert,
  liveIssuesForBin,
  type BinStatusIssue,
} from '../utils/alertsDisplay';

function SeverityDot({ severity }: { severity: BinStatusIssue['severity'] }) {
  const colors = {
    ok: 'bg-green-500',
    warning: 'bg-amber-500',
    critical: 'bg-red-500 animate-pulse',
  };
  return <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${colors[severity]}`} />;
}

function LiveBinCard({ bin, issues }: { bin: Bin; issues: BinStatusIssue[] }) {
  const worst = issues.some((i) => i.severity === 'critical')
    ? 'critical'
    : issues.some((i) => i.severity === 'warning')
      ? 'warning'
      : 'ok';
  const border =
    worst === 'critical'
      ? 'border-red-500/40'
      : worst === 'warning'
        ? 'border-amber-500/30'
        : 'border-gray-700';

  return (
    <Card className={border}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-lg">{bin.name}</CardTitle>
            <p className="text-sm text-gray-400">{bin.location || 'No location set'}</p>
          </div>
          <Link to={`/bins/${bin.id}`} className="text-xs text-blue-400 hover:underline shrink-0">
            Details →
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {issues.map((issue, i) => (
          <div key={i} className="flex gap-3 items-start text-sm">
            <SeverityDot severity={issue.severity} />
            <div>
              <p className="font-medium text-gray-100">{issue.title}</p>
              <p className="text-gray-400">{issue.detail}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function EventRow({ alert, bin }: { alert: Alert; bin?: Bin }) {
  const { icon, title, detail } = friendlyAlert(alert, bin);
  return (
    <div
      className={`flex gap-3 p-3 rounded-lg border ${
        alert.resolved ? 'border-gray-800 bg-gray-900/40' : 'border-red-500/25 bg-red-500/5'
      }`}
    >
      <span className="text-xl leading-none">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-gray-100">{title}</p>
          <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-gray-800 text-gray-400">
            {alertTypeShort(alert.type)}
          </span>
          {!alert.resolved && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 font-medium">
              Active now
            </span>
          )}
          {alert.resolved && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/15 text-green-400 font-medium">
              Cleared
            </span>
          )}
        </div>
        <p className="text-sm text-gray-400 mt-0.5">{detail}</p>
        <p className="text-xs text-gray-600 mt-1">
          {alert.resolved ? 'Cleared' : 'Started'} {new Date(alert.created_at).toLocaleString()}
        </p>
      </div>
    </div>
  );
}

export function AlertsPage() {
  const { live, isConnected } = useLiveData();
  const { data: alerts, isLoading } = useQuery<Alert[]>({
    queryKey: ['alerts'],
    queryFn: getAlerts,
    refetchInterval: false,
  });
  const { data: bins } = useQuery<Bin[]>({ queryKey: ['bins'], queryFn: getBins });

  const binMap = Object.fromEntries((bins ?? []).map((b) => [b.id, b]));

  const activeFromDb = alerts?.filter((a) => !a.resolved) ?? [];
  const history = alerts?.filter((a) => a.resolved).slice(0, 20) ?? [];

  const liveCriticalCount =
    bins?.filter((b) => liveIssuesForBin(b, live[b.id]).some((i) => i.severity === 'critical')).length ?? 0;

  if (isLoading && !bins?.length) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-5xl">
      <div>
        <h1 className="text-3xl lg:text-4xl font-bold bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">
          Alerts & bin status
        </h1>
        <p className="text-gray-400 mt-2 max-w-2xl">
          See what each smart bin is doing right now. Warnings appear when a bin is too full or odor
          is high; they clear automatically when sensors return to normal.
        </p>
        <p className={`text-xs mt-2 ${isConnected ? 'text-green-400' : 'text-amber-400'}`}>
          {isConnected ? '● Live sensor stream connected' : '○ Reconnecting — showing last known values'}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="border-gray-700">
          <CardContent className="p-4">
            <p className="text-sm text-gray-400">Bins monitored</p>
            <p className="text-2xl font-bold">{bins?.length ?? 0}</p>
          </CardContent>
        </Card>
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="p-4">
            <p className="text-sm text-gray-400">Need attention now</p>
            <p className="text-2xl font-bold text-red-400">{liveCriticalCount}</p>
          </CardContent>
        </Card>
        <Card className="border-gray-700">
          <CardContent className="p-4">
            <p className="text-sm text-gray-400">Logged warnings (active)</p>
            <p className="text-2xl font-bold text-amber-400">{activeFromDb.length}</p>
          </CardContent>
        </Card>
      </div>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-100">Live status — each bin</h2>
        <p className="text-sm text-gray-500 -mt-2">
          Based on the latest simulation readings (fill level, gas sensor, etc.)
        </p>
        {!bins?.length ? (
          <p className="text-gray-500">No bins configured. Add a bin in Admin, then run the Wokwi simulation.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {bins.map((bin) => (
              <LiveBinCard key={bin.id} bin={bin} issues={liveIssuesForBin(bin, live[bin.id])} />
            ))}
          </div>
        )}
      </section>

      {activeFromDb.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-red-400">Recorded warnings (still active)</h2>
          <p className="text-sm text-gray-500 -mt-1">
            These were saved when sensors crossed a limit. They disappear from this list when levels go back to safe.
          </p>
          <div className="space-y-2">
            {activeFromDb.map((alert) => (
              <EventRow key={alert.id} alert={alert} bin={binMap[alert.bin_id]} />
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-gray-100">Recent history</h2>
        {history.length === 0 && activeFromDb.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-gray-500">
              No warnings yet. Run the Wokwi simulation and move sliders — alerts appear when fill or gas
              goes over the limit.
            </CardContent>
          </Card>
        ) : history.length === 0 ? (
          <p className="text-gray-500 text-sm">No cleared warnings in history yet.</p>
        ) : (
          <div className="space-y-2">
            {history.map((alert) => (
              <EventRow key={alert.id} alert={alert} bin={binMap[alert.bin_id]} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
