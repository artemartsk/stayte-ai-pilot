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
        <div className="group p-4 bg-background border border-border rounded-lg hover:border-muted-foreground/30 transition-all cursor-pointer">
            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-[12px] text-muted-foreground font-medium truncate">{title}</p>
                    {loading ? (
                        <div className="h-6 w-12 bg-muted animate-pulse rounded mt-1" />
                    ) : (
                        <p className="text-[22px] font-semibold tracking-tight text-foreground mt-0.5">{value}</p>
                    )}
                </div>
                <div className="p-1.5 rounded-md bg-muted/50 flex-shrink-0">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
            </div>
        </div>
    );

    if (href) {
        return <Link to={href}>{content}</Link>;
    }
    return content;
}
