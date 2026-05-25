import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { getBin, getReadings, type Bin, type Reading } from '../api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useLiveData } from '../context/LiveDataContext';

export function BinDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { live, isConnected } = useLiveData();
  const { data: bin, isLoading: bl } = useQuery<Bin>({ queryKey: ['bin', id], queryFn: () => getBin(id!) });
  const { data: readings, isLoading: rl } = useQuery<Reading[]>({
    queryKey: ['readings', id],
    queryFn: () => getReadings(id!),
    refetchInterval: isConnected ? false : 1500,
  });

  if (bl || rl) return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div></div>;
  if (!bin) return <div className="p-8 text-center text-gray-400">Bin not found</div>;

  const stream = id ? live[id] : undefined;
  const latest = readings?.[0];
  const fill = stream?.fill ?? latest?.fill_pct ?? 0;
  const temp = stream?.temp ?? latest?.temperature;
  const hum = stream?.hum ?? latest?.humidity;
  const gas = stream?.gas ?? latest?.gas_ppm;
  const moisture = stream?.moisture ?? latest?.moisture_pct;
  const lastUpdate = stream?.time
    ? new Date(stream.time).toLocaleTimeString()
    : latest
      ? new Date(latest.recorded_at).toLocaleTimeString()
      : 'No data yet';

  const chartData = [...(readings || [])].reverse().map(r => ({
    time: new Date(r.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    fill: Number(r.fill_pct.toFixed(1)),
    temp: r.temperature ? Number(r.temperature.toFixed(1)) : null,
    humidity: r.humidity ? Number(r.humidity.toFixed(1)) : null,
    gas: r.gas_ppm ? Number(r.gas_ppm.toFixed(0)) : null,
    moisture: r.moisture_pct ? Number(r.moisture_pct.toFixed(1)) : null,
  }));

  const fillColor = fill >= bin.threshold_pct ? 'text-red-400' : fill >= 50 ? 'text-amber-400' : 'text-green-400';
  const tooltipStyle = { backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <Link to="/" className="text-sm text-blue-400 hover:text-blue-300 mb-2 inline-block">&larr; Back to Dashboard</Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold">{bin.name}</h1>
          <span className={`text-xs px-2 py-1 rounded-full ${isConnected ? 'bg-green-500/15 text-green-400' : 'bg-amber-500/15 text-amber-400'}`}>
            {isConnected ? 'Realtime stream' : 'Reconnecting…'}
          </span>
        </div>
        <p className="text-gray-400 mt-1">📍 {bin.location || 'No location'} · Last update {lastUpdate}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="p-3 text-center">
            <p className="text-[10px] text-gray-400 mb-0.5">Fill Level</p>
            <p className={`text-2xl font-bold ${fillColor}`}>{fill.toFixed(1)}%</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
          <CardContent className="p-3 text-center">
            <p className="text-[10px] text-gray-400 mb-0.5">🌡️ Temp</p>
            <p className="text-2xl font-bold text-orange-400">{temp != null ? `${temp.toFixed(1)}°` : '--'}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border-cyan-500/20">
          <CardContent className="p-3 text-center">
            <p className="text-[10px] text-gray-400 mb-0.5">💧 Humidity</p>
            <p className="text-2xl font-bold text-cyan-400">{hum != null ? `${hum.toFixed(1)}%` : '--'}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-rose-500/10 to-rose-600/5 border-rose-500/20">
          <CardContent className="p-3 text-center">
            <p className="text-[10px] text-gray-400 mb-0.5">💨 Gas</p>
            <p className={`text-2xl font-bold ${(gas || 0) >= 300 ? 'text-red-400' : 'text-rose-400'}`}>{gas != null ? `${gas.toFixed(0)}` : '--'}<span className="text-sm ml-0.5">ppm</span></p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-teal-500/10 to-teal-600/5 border-teal-500/20">
          <CardContent className="p-3 text-center">
            <p className="text-[10px] text-gray-400 mb-0.5">🌊 Moisture</p>
            <p className="text-2xl font-bold text-teal-400">{moisture != null ? `${moisture.toFixed(0)}%` : '--'}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <CardContent className="p-3 text-center">
            <p className="text-[10px] text-gray-400 mb-0.5">Threshold</p>
            <p className="text-2xl font-bold text-purple-400">{bin.threshold_pct}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Fill Chart */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Fill Level Over Time</CardTitle></CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs><linearGradient id="fg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151"/>
              <XAxis dataKey="time" stroke="#6b7280" fontSize={11}/>
              <YAxis domain={[0, 100]} stroke="#6b7280" fontSize={11}/>
              <Tooltip contentStyle={tooltipStyle} labelStyle={{color:'#9ca3af'}}/>
              <Area type="monotone" dataKey="fill" stroke="#3b82f6" strokeWidth={2} fill="url(#fg)" name="Fill %"/>
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Temp & Humidity */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Temperature & Humidity</CardTitle></CardHeader>
        <CardContent className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151"/>
              <XAxis dataKey="time" stroke="#6b7280" fontSize={11}/>
              <YAxis stroke="#6b7280" fontSize={11}/>
              <Tooltip contentStyle={tooltipStyle} labelStyle={{color:'#9ca3af'}}/>
              <Line type="monotone" dataKey="temp" stroke="#f97316" strokeWidth={2} dot={false} name="Temp °C"/>
              <Line type="monotone" dataKey="humidity" stroke="#06b6d4" strokeWidth={2} dot={false} name="Humidity %"/>
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Gas & Moisture */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Gas Level & Moisture</CardTitle></CardHeader>
        <CardContent className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151"/>
              <XAxis dataKey="time" stroke="#6b7280" fontSize={11}/>
              <YAxis stroke="#6b7280" fontSize={11}/>
              <Tooltip contentStyle={tooltipStyle} labelStyle={{color:'#9ca3af'}}/>
              <Line type="monotone" dataKey="gas" stroke="#f43f5e" strokeWidth={2} dot={false} name="Gas (ppm)"/>
              <Line type="monotone" dataKey="moisture" stroke="#14b8a6" strokeWidth={2} dot={false} name="Moisture %"/>
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Readings Table */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Recent Readings</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Fill</TableHead>
                <TableHead>Temp</TableHead>
                <TableHead>Humidity</TableHead>
                <TableHead>Gas</TableHead>
                <TableHead>Moisture</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {readings?.slice(0, 15).map(r => {
                const sc = r.fill_pct >= bin.threshold_pct ? 'text-red-400' : r.fill_pct >= 50 ? 'text-amber-400' : 'text-green-400';
                const sl = r.fill_pct >= bin.threshold_pct ? 'Critical' : r.fill_pct >= 50 ? 'Warning' : 'Normal';
                return (
                  <TableRow key={r.id}>
                    <TableCell className="text-gray-300">{new Date(r.recorded_at).toLocaleString()}</TableCell>
                    <TableCell className="font-semibold">{r.fill_pct.toFixed(1)}%</TableCell>
                    <TableCell>{r.temperature ? `${r.temperature.toFixed(1)}°C` : '-'}</TableCell>
                    <TableCell>{r.humidity ? `${r.humidity.toFixed(1)}%` : '-'}</TableCell>
                    <TableCell className={(r.gas_ppm || 0) >= 300 ? 'text-red-400 font-semibold' : ''}>{r.gas_ppm ? `${r.gas_ppm.toFixed(0)} ppm` : '-'}</TableCell>
                    <TableCell>{r.moisture_pct ? `${r.moisture_pct.toFixed(0)}%` : '-'}</TableCell>
                    <TableCell className={`font-medium ${sc}`}>{sl}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
