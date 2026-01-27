import { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

interface StatsCardProps {
    title: string;
    value: string | number;
    change?: string;
    icon: LucideIcon;
    href?: string;
    loading?: boolean;
}

export function StatsCard({ title, value, change, icon: Icon, href, loading }: StatsCardProps) {
    const content = (
        <div className="group p-5 bg-background border border-border rounded-xl hover:border-muted-foreground/30 transition-all cursor-pointer">
            <div className="flex items-start justify-between">
                <div className="space-y-2">
                    <p className="text-[13px] text-muted-foreground font-medium">{title}</p>
                    {loading ? (
                        <div className="h-8 w-16 bg-muted animate-pulse rounded" />
                    ) : (
                        <p className="text-[28px] font-semibold tracking-tight text-foreground">{value}</p>
                    )}
                    {change && (
                        <p className="text-[12px] font-medium">
                            <span className={change.startsWith('+') ? 'text-emerald-600' : change.startsWith('-') ? 'text-rose-600' : 'text-muted-foreground'}>
                                {change}
                            </span>
                            <span className="text-muted-foreground ml-1">vs last month</span>
                        </p>
                    )}
                </div>
                <div className="p-2 rounded-lg bg-muted/50 group-hover:bg-muted transition-colors">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                </div>
            </div>
        </div>
    );

    if (href) {
        return <Link to={href}>{content}</Link>;
    }
    return content;
}
