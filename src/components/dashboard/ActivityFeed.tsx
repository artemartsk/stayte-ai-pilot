import { Mail, Phone, MessageSquare, UserCheck, UserPlus, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

interface Activity {
    id: string;
    type: 'email' | 'call' | 'sms' | 'status_change' | 'new_lead';
    description: string;
    contact_id?: string;
    contact_name?: string;
    created_at: string;
}

interface ActivityFeedProps {
    activities: Activity[];
    loading?: boolean;
}

const ACTIVITY_ICONS = {
    email: Mail,
    call: Phone,
    sms: MessageSquare,
    status_change: UserCheck,
    new_lead: UserPlus
};

const ACTIVITY_COLORS = {
    email: 'bg-blue-100 text-blue-600',
    call: 'bg-emerald-100 text-emerald-600',
    sms: 'bg-purple-100 text-purple-600',
    status_change: 'bg-amber-100 text-amber-600',
    new_lead: 'bg-indigo-100 text-indigo-600'
};

export function ActivityFeed({ activities, loading }: ActivityFeedProps) {
    if (loading) {
        return (
            <div className="space-y-4">
                {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />
                        <div className="flex-1 space-y-1">
                            <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
                            <div className="h-3 w-20 bg-muted animate-pulse rounded" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (!activities.length) {
        return (
            <div className="py-8 text-center text-muted-foreground text-[13px]">
                No recent activity
            </div>
        );
    }

    return (
        <div className="space-y-1">
            {activities.map((activity) => {
                const Icon = ACTIVITY_ICONS[activity.type] || Mail;
                const colorClass = ACTIVITY_COLORS[activity.type] || 'bg-muted text-muted-foreground';

                return (
                    <div
                        key={activity.id}
                        className="flex items-center gap-3 py-2.5 px-2 -mx-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                    >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                            <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[13px] text-foreground truncate">
                                {activity.contact_name && (
                                    <span className="font-medium">{activity.contact_name}</span>
                                )}
                                {activity.contact_name && ' — '}
                                {activity.description}
                            </p>
                        </div>
                        <div className="text-[12px] text-muted-foreground flex-shrink-0">
                            {formatDistanceToNow(new Date(activity.created_at), { addSuffix: false })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
