
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Calendar, CheckCircle2, XCircle, Clock, ArrowRight, MessageSquare, Phone, Mail, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface AIActionsTabProps {
    contactId: string;
    dealIds: string[];
}

export function AIActionsTab({ contactId, dealIds }: AIActionsTabProps) {
    const { data: tasks, isLoading } = useQuery({
        queryKey: ['ai-tasks-tab', contactId],
        queryFn: async () => {
            if (dealIds.length === 0) return [];

            const { data, error } = await supabase
                .from('ai_tasks')
                .select('*')
                .in('deal_id', dealIds)
                .order('scheduled_at', { ascending: true }); // Ascending to separate past/future easily

            if (error) throw error;
            return data || [];
        },
        enabled: dealIds.length > 0,
    });

    if (isLoading) {
        return (
            <div className="flex justify-center p-12">
                <Loader2 className="h-5 w-5 animate-spin text-slate-300" />
            </div>
        );
    }

    if (!tasks || tasks.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 border border-dashed border-slate-200 rounded-lg bg-slate-50/50">
                <div className="h-10 w-10 bg-slate-100 rounded-full flex items-center justify-center mb-3">
                    <Zap className="h-4 w-4 text-slate-400" />
                </div>
                <p className="text-sm text-slate-500 font-medium">No AI actions found</p>
                <p className="text-xs text-slate-400 mt-1">Start a workflow to see actions here.</p>
            </div>
        );
    }

    const now = new Date();

    // Group tasks
    const planned = tasks.filter(t =>
        (t.status === 'pending' || t.status === 'queued') &&
        new Date(t.scheduled_at) > now
    ).sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());

    const completed = tasks.filter(t =>
        t.status === 'done' ||
        t.status === 'failed' ||
        t.status === 'canceled' ||
        (new Date(t.scheduled_at) <= now && t.status !== 'done' && t.status !== 'failed' && t.status !== 'canceled') // Overdue/Processing
    ).sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime()); // Newest first

    const getIcon = (action: string) => {
        switch (action) {
            case 'call': return Phone;
            case 'send_email': return Mail;
            case 'send_whatsapp': return MessageSquare;
            case 'wait': return Clock;
            default: return Zap;
        }
    };

    const getLabel = (action: string) => {
        switch (action) {
            case 'call': return 'AI Call';
            case 'send_email': return 'Email';
            case 'send_whatsapp': return 'WhatsApp';
            case 'wait': return 'Wait Delay';
            case 'markup_table': return 'Update Table';
            case 'check_qualification': return 'Check Qualification';
            case 'assign_agent': return 'Assign Agent';
            default: return action.replace(/_/g, ' ');
        }
    };

    return (
        <div className="max-w-3xl space-y-12 animate-in fade-in-50 duration-500">

            {/* SECTION: PLANNED */}
            <section>
                <div className="flex items-center gap-2 mb-4">
                    <div className="h-1.5 w-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
                    <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Planned</h3>
                </div>

                {planned.length === 0 ? (
                    <div className="text-xs text-slate-400 pl-4 py-2 italic font-light">
                        No upcoming actions scheduled.
                    </div>
                ) : (
                    <div className="space-y-1">
                        {planned.map((task, i) => {
                            const Icon = getIcon(task.action);
                            return (
                                <div key={task.id} className="group relative flex items-center gap-4 p-3 rounded-lg hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100">
                                    {/* Timeline Line */}
                                    {i !== planned.length - 1 && (
                                        <div className="absolute left-[27px] top-10 bottom-[-14px] w-px bg-slate-100 group-hover:bg-slate-200 transition-colors"></div>
                                    )}

                                    <div className="relative z-10 h-9 w-9 rounded-md bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-500 group-hover:text-blue-600 group-hover:border-blue-100 transition-colors">
                                        <Icon className="h-4 w-4" />
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-slate-700">{getLabel(task.action)}</span>
                                            <span className="inline-flex items-center rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                                                Scheduled
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <Calendar className="h-3 w-3 text-slate-400" />
                                            <span className="text-xs text-slate-500">
                                                {format(new Date(task.scheduled_at), "MMM d, h:mm a")}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                        <div className="p-1.5 rounded-md hover:bg-slate-200 cursor-pointer text-slate-400">
                                            <ArrowRight className="h-3.5 w-3.5" />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>

            {/* SECTION: COMPLETED */}
            <section>
                <div className="flex items-center gap-2 mb-4">
                    <div className="h-1.5 w-1.5 rounded-full bg-slate-300"></div>
                    <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">History</h3>
                </div>

                {completed.length === 0 ? (
                    <div className="text-xs text-slate-400 pl-4 py-2 italic font-light">
                        No history yet.
                    </div>
                ) : (
                    <div className="space-y-1">
                        {completed.map((task, i) => {
                            const Icon = getIcon(task.action);
                            const isFailed = task.status === 'failed';

                            return (
                                <div key={task.id} className="group relative flex items-center gap-4 p-3 rounded-lg hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100 opacity-80 hover:opacity-100">
                                    {/* Timeline Line */}
                                    {i !== completed.length - 1 && (
                                        <div className="absolute left-[27px] top-10 bottom-[-14px] w-px bg-slate-100 group-hover:bg-slate-200 transition-colors"></div>
                                    )}

                                    <div className={cn(
                                        "relative z-10 h-9 w-9 rounded-md border shadow-sm flex items-center justify-center transition-colors",
                                        isFailed
                                            ? "bg-red-50 border-red-100 text-red-500"
                                            : "bg-slate-50 border-slate-200 text-slate-500"
                                    )}>
                                        {isFailed ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className={cn("text-sm font-medium", isFailed ? "text-red-700" : "text-slate-600")}>
                                                {getLabel(task.action)}
                                            </span>
                                            {isFailed && (
                                                <span className="inline-flex items-center rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-700 ring-1 ring-inset ring-red-600/10">
                                                    Failed
                                                </span>
                                            )}
                                            {task.status === 'canceled' && (
                                                <span className="inline-flex items-center rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 ring-1 ring-inset ring-slate-500/10">
                                                    Canceled
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-xs text-slate-400 font-mono">
                                                {format(new Date(task.scheduled_at), "MMM d, h:mm a")}
                                            </span>
                                            {task.last_error && (
                                                <span className="text-[10px] text-red-500 truncate max-w-[200px]">
                                                    • {task.last_error}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>

        </div>
    );
}
