'use client';
import { useEffect, useMemo, useState } from 'react';
import { getSocket } from './lib/socket';

// Phase-1 dashboard. Connects to backend socket.io and listens for `order.*` events.
// Falls back to mock data if backend is unreachable so you can demo the UI.

type OrderEvt = {
  orderId: string; orderNumber?: string; partnerName?: string;
  customerName?: string; status: string; etaMins?: number;
  amountPaise?: number; createdAt: string;
};

const MOCK_ORDERS: OrderEvt[] = [
  { orderId: '1', orderNumber: 'QR-A8X2H7K9', partnerName: 'Forra Foods Kitchen', customerName: 'Aisha P.', status: 'PREPARING', etaMins: 18, amountPaise: 38900, createdAt: new Date(Date.now() - 6*60_000).toISOString() },
  { orderId: '2', orderNumber: 'QR-B3Q1L4M2', partnerName: "Padma's Andhra Kitchen", customerName: 'Rahim K.', status: 'PLACED', etaMins: 32, amountPaise: 25900, createdAt: new Date(Date.now() - 2*60_000).toISOString() },
  { orderId: '3', orderNumber: 'QR-C7Z9P2N5', partnerName: 'Hotel Sahib’s', customerName: 'Vinay M.', status: 'OUT_FOR_DELIVERY', etaMins: 7, amountPaise: 64500, createdAt: new Date(Date.now() - 22*60_000).toISOString() },
  { orderId: '4', orderNumber: 'QR-D2K8L4Q1', partnerName: 'Forra Foods Kitchen', customerName: 'Suma R.', status: 'CONFIRMED', etaMins: 25, amountPaise: 19900, createdAt: new Date(Date.now() - 1*60_000).toISOString() },
];

const MOCK_PARTNERS = [
  { id: 'p1', name: 'Forra Foods Kitchen', type: 'FORRA', online: true, openOrders: 7, capacityLeft: 23 },
  { id: 'p2', name: "Padma's Andhra Kitchen", type: 'HOME_MAKER', online: true, openOrders: 2, capacityLeft: 4 },
  { id: 'p3', name: 'Malabar Home Kitchen', type: 'HOME_MAKER', online: true, openOrders: 1, capacityLeft: 6 },
  { id: 'p4', name: 'Hotel Sahib’s', type: 'RESTAURANT', online: true, openOrders: 3, capacityLeft: 18 },
  { id: 'p5', name: 'FitTiffin Catering', type: 'CATERER', online: false, openOrders: 0, capacityLeft: 0 },
];

const MOCK_RIDERS = [
  { id: 'r1', name: 'Ravi Kumar', online: true, status: 'ON_DELIVERY', deliveriesToday: 9, earningsPaise: 78000 },
  { id: 'r2', name: 'Anwar S.', online: true, status: 'ACTIVE', deliveriesToday: 6, earningsPaise: 52000 },
  { id: 'r3', name: 'Sajeev N.', online: true, status: 'ON_DELIVERY', deliveriesToday: 11, earningsPaise: 92000 },
  { id: 'r4', name: 'Praveen V.', online: false, status: 'OFFLINE', deliveriesToday: 4, earningsPaise: 35000 },
];

const STATUS_COLORS: Record<string, string> = {
  PLACED: 'bg-amber-100 text-amber-800',
  CONFIRMED: 'bg-blue-100 text-blue-800',
  PREPARING: 'bg-indigo-100 text-indigo-800',
  READY_FOR_PICKUP: 'bg-purple-100 text-purple-800',
  PICKED_UP: 'bg-cyan-100 text-cyan-800',
  OUT_FOR_DELIVERY: 'bg-teal-100 text-teal-800',
  DELIVERED: 'bg-emerald-100 text-emerald-800',
  CANCELLED: 'bg-rose-100 text-rose-800',
};

function rupees(paise?: number) {
  if (paise == null) return '—';
  return `₹${(paise / 100).toFixed(0)}`;
}

function relTime(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

export default function Dashboard() {
  const [orders, setOrders] = useState<OrderEvt[]>(MOCK_ORDERS);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const s = getSocket();
    s.on('connect', () => setConnected(true));
    s.on('disconnect', () => setConnected(false));
    s.on('order.placed', (p: any) => {
      setOrders(prev => [{
        orderId: p.orderId, orderNumber: p.orderNumber || p.orderId.slice(0, 8),
        partnerName: p.partnerName || '—', customerName: p.customerName || '—',
        status: 'PLACED', amountPaise: p.totalPaise, createdAt: new Date().toISOString(),
      }, ...prev].slice(0, 50));
    });
    s.on('order.transition', (p: any) => {
      setOrders(prev => prev.map(o => o.orderId === p.orderId ? { ...o, status: p.to } : o));
    });
    return () => { s.off('order.placed'); s.off('order.transition'); };
  }, []);

  const metrics = useMemo(() => {
    const open = orders.filter(o => !['DELIVERED', 'CANCELLED', 'COMPLETED', 'REFUNDED'].includes(o.status));
    const totalGmv = orders.reduce((s, o) => s + (o.amountPaise || 0), 0);
    return {
      open: open.length,
      totalToday: orders.length,
      gmvPaise: totalGmv,
      slaBreaches: open.filter(o => (Date.now() - new Date(o.createdAt).getTime()) > 35 * 60_000).length,
    };
  }, [orders]);

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Operations console</h1>
          <p className="text-sm text-slate-500">
            {connected ? <span className="text-ok">● Live</span> : <span className="text-warn">● Offline (showing mock data)</span>}
            {' · '}Perinthalmanna zone
          </p>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 rounded-lg bg-white border text-sm font-bold hover:bg-slate-50">Export</button>
          <button className="px-4 py-2 rounded-lg bg-ink text-white text-sm font-bold">+ New partner</button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-4 gap-4">
        <Metric label="Open orders" value={metrics.open} accent="text-brand" />
        <Metric label="Today's orders" value={metrics.totalToday} />
        <Metric label="Today's GMV" value={rupees(metrics.gmvPaise)} />
        <Metric label="SLA breaches" value={metrics.slaBreaches} accent={metrics.slaBreaches ? 'text-warn' : 'text-ok'} />
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Live order feed */}
        <div className="col-span-2 bg-white rounded-xl border">
          <div className="px-5 py-3 border-b flex items-center justify-between">
            <h2 className="font-bold">Live order feed</h2>
            <span className="text-xs text-slate-500">{orders.length} orders</span>
          </div>
          <div className="divide-y max-h-[560px] overflow-auto">
            {orders.map(o => (
              <div key={o.orderId} className="px-5 py-3 hover:bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div>
                    <div className="font-bold text-sm">{o.orderNumber}</div>
                    <div className="text-xs text-slate-500">{o.partnerName} → {o.customerName}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold">{rupees(o.amountPaise)}</span>
                  {o.etaMins != null && (
                    <span className="text-xs text-slate-500">{o.etaMins}m ETA</span>
                  )}
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${STATUS_COLORS[o.status] || 'bg-slate-100'}`}>
                    {o.status.replace(/_/g, ' ')}
                  </span>
                  <span className="text-xs text-slate-400 w-20 text-right">{relTime(o.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Side panel */}
        <div className="space-y-4">
          {/* Partner status */}
          <div className="bg-white rounded-xl border">
            <div className="px-4 py-3 border-b font-bold text-sm">Partners</div>
            <div className="divide-y">
              {MOCK_PARTNERS.map(p => (
                <div key={p.id} className="px-4 py-2 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-sm">{p.name}</div>
                    <div className="text-xs text-slate-500">{p.type.replace(/_/g, ' ').toLowerCase()}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-xs text-slate-500">
                      {p.openOrders} open · {p.capacityLeft} left
                    </div>
                    <div className={`w-2 h-2 rounded-full ${p.online ? 'bg-ok' : 'bg-slate-300'}`} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Rider availability */}
          <div className="bg-white rounded-xl border">
            <div className="px-4 py-3 border-b font-bold text-sm">Riders</div>
            <div className="divide-y">
              {MOCK_RIDERS.map(r => (
                <div key={r.id} className="px-4 py-2 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-sm">{r.name}</div>
                    <div className="text-xs text-slate-500">
                      {r.deliveriesToday} today · {rupees(r.earningsPaise)}
                    </div>
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                    r.status === 'ON_DELIVERY' ? 'bg-teal-100 text-teal-800'
                    : r.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-100 text-slate-500'
                  }`}>
                    {r.status.replace(/_/g, ' ')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="bg-white rounded-xl border px-5 py-4">
      <div className="text-xs font-bold text-slate-500 uppercase">{label}</div>
      <div className={`text-3xl font-extrabold mt-1 ${accent || 'text-ink'}`}>{value}</div>
    </div>
  );
}
