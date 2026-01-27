import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface PipelineData {
    status: string;
    count: number;
}

interface PipelineBreakdownProps {
    data: PipelineData[];
    loading?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
    new: '#6366f1',
    ai_contacting: '#8b5cf6',
    qualified: '#22c55e',
    negotiation: '#f59e0b',
    won: '#10b981',
    lost: '#ef4444',
    canceled: '#9ca3af'
};

const STATUS_LABELS: Record<string, string> = {
    new: 'New',
    ai_contacting: 'AI Contacting',
    qualified: 'Qualified',
    negotiation: 'Negotiation',
    won: 'Won',
    lost: 'Lost',
    canceled: 'Canceled'
};

export function PipelineBreakdown({ data, loading }: PipelineBreakdownProps) {
    const chartData = useMemo(() => {
        return data.map(d => ({
            name: STATUS_LABELS[d.status] || d.status,
            value: d.count,
            color: STATUS_COLORS[d.status] || '#6b7280'
        }));
    }, [data]);

    if (loading) {
        return (
            <div className="space-y-3">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-8 bg-muted/30 animate-pulse rounded" />
                ))}
            </div>
        );
    }

    if (!chartData.length) {
        return (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground text-[13px]">
                No pipeline data
            </div>
        );
    }

    return (
        <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis
                        type="category"
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: 'hsl(var(--foreground))' }}
                        width={90}
                    />
                    <Tooltip
                        contentStyle={{
                            background: 'hsl(var(--background))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                            fontSize: '12px'
                        }}
                        formatter={(value: number) => [`${value} leads`, 'Count']}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
                        {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
