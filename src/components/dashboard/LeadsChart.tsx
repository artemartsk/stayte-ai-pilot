import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface LeadsChartProps {
    data: { date: string; count: number }[];
    loading?: boolean;
}

export function LeadsChart({ data, loading }: LeadsChartProps) {
    const chartData = useMemo(() => {
        if (!data.length) return [];
        return data.map(d => ({
            date: new Date(d.date).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
            leads: d.count
        }));
    }, [data]);

    if (loading) {
        return (
            <div className="h-[240px] bg-muted/30 animate-pulse rounded-lg" />
        );
    }

    if (!chartData.length) {
        return (
            <div className="h-[240px] flex items-center justify-center text-muted-foreground text-[13px]">
                No data yet
            </div>
        );
    }

    return (
        <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                        <linearGradient id="leadsGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <XAxis
                        dataKey="date"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                        dy={10}
                    />
                    <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                        dx={-5}
                    />
                    <Tooltip
                        contentStyle={{
                            background: 'hsl(var(--background))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                            fontSize: '12px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                        }}
                        labelStyle={{ fontWeight: 600, marginBottom: 4 }}
                    />
                    <Area
                        type="monotone"
                        dataKey="leads"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        fill="url(#leadsGradient)"
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
