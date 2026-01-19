
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Phone, PhoneCall, PhoneMissed, Clock } from 'lucide-react';

export const CallStats = () => {
    const { data: stats, isLoading } = useQuery({
        queryKey: ['call-stats-today'],
        queryFn: async () => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // Fetch logs for today
            const { data, error } = await supabase
                .from('contact_communications')
                .select('status, created_at')
                .eq('channel', 'ai_call')
                .gte('created_at', today.toISOString());

            if (error) throw error;

            const total = data.length;
            const sent = data.filter(c => c.status === 'sent' || c.status === 'initiated').length;
            const answered = data.filter(c => c.status === 'answer').length;
            const noAnswer = data.filter(c => c.status === 'no-answer' || c.status === 'customer-did-not-answer' || c.status === 'busy').length;
            const failed = data.filter(c => c.status === 'failed' || c.status === 'error').length;

            return { total, sent, answered, noAnswer, failed };
        }
    });

    if (isLoading) {
        return <div className="animate-pulse h-24 bg-muted rounded-lg w-full mb-6" />;
    }

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="p-4 rounded-md border border-border/40 hover:bg-muted/20 transition-colors">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Calls Today</span>
                    <Phone className="h-3.5 w-3.5 text-muted-foreground/70" />
                </div>
                <div className="text-3xl font-normal text-foreground">{stats?.total || 0}</div>
            </div>

            <div className="p-4 rounded-md border border-border/40 hover:bg-muted/20 transition-colors">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Answered</span>
                    <PhoneCall className="h-3.5 w-3.5 text-green-600/70" />
                </div>
                <div className="text-3xl font-normal text-foreground">{stats?.answered || 0}</div>
            </div>

            <div className="p-4 rounded-md border border-border/40 hover:bg-muted/20 transition-colors">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">No Answer</span>
                    <PhoneMissed className="h-3.5 w-3.5 text-orange-500/70" />
                </div>
                <div className="text-3xl font-normal text-foreground">{stats?.noAnswer || 0}</div>
            </div>

            <div className="p-4 rounded-md border border-border/40 hover:bg-muted/20 transition-colors">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Failed</span>
                    <Clock className="h-3.5 w-3.5 text-red-500/70" />
                </div>
                <div className="text-3xl font-normal text-foreground">{stats?.failed || 0}</div>
            </div>
        </div>
    );
};
