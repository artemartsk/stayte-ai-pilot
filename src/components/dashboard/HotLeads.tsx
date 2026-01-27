import { Link } from 'react-router-dom';
import { Flame, ArrowRight } from 'lucide-react';

interface HotLead {
    id: string;
    name: string;
    status: string;
    budget?: number;
    location?: string;
    updated_at: string;
}

interface HotLeadsProps {
    leads: HotLead[];
    loading?: boolean;
}

const STATUS_BADGES: Record<string, { label: string; class: string }> = {
    qualified: { label: 'Qualified', class: 'bg-emerald-100 text-emerald-700' },
    negotiation: { label: 'Negotiation', class: 'bg-amber-100 text-amber-700' },
    viewing_scheduled: { label: 'Viewing', class: 'bg-blue-100 text-blue-700' }
};

export function HotLeads({ leads, loading }: HotLeadsProps) {
    const formatBudget = (budget?: number) => {
        if (!budget) return '—';
        if (budget >= 1000000) return `€${(budget / 1000000).toFixed(1)}M`;
        if (budget >= 1000) return `€${(budget / 1000).toFixed(0)}K`;
        return `€${budget}`;
    };

    if (loading) {
        return (
            <div className="space-y-3">
                {[1, 2, 3].map(i => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg animate-pulse">
                        <div className="w-10 h-10 rounded-full bg-muted" />
                        <div className="flex-1 space-y-1">
                            <div className="h-4 w-32 bg-muted rounded" />
                            <div className="h-3 w-20 bg-muted rounded" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (!leads.length) {
        return (
            <div className="py-8 text-center text-muted-foreground text-[13px]">
                No hot leads at the moment
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {leads.map((lead) => {
                const badge = STATUS_BADGES[lead.status] || { label: lead.status, class: 'bg-muted text-muted-foreground' };
                const initials = lead.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

                return (
                    <Link
                        key={lead.id}
                        to={`/contacts/${lead.id}`}
                        className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-muted-foreground/30 hover:bg-muted/30 transition-all group"
                    >
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-rose-500 text-white flex items-center justify-center text-sm font-medium flex-shrink-0">
                            {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <p className="text-[13px] font-medium text-foreground truncate">{lead.name}</p>
                                <Flame className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className={`text-[11px] px-1.5 py-0.5 rounded font-medium ${badge.class}`}>
                                    {badge.label}
                                </span>
                                <span className="text-[12px] text-muted-foreground">{formatBudget(lead.budget)}</span>
                                {lead.location && (
                                    <span className="text-[12px] text-muted-foreground">• {lead.location}</span>
                                )}
                            </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                );
            })}
        </div>
    );
}
