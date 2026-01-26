
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
    // Fetch active workflows
    const { data: workflows, isLoading: workflowsLoading } = useQuery({
        queryKey: ['active-workflows-tab', contactId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('workflow_runs')
                .select('*, ai_workflow_templates(name)')
                .eq('contact_id', contactId)
                .neq('status', 'completed')
                .neq('status', 'failed')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data || [];
        },
        enabled: !!contactId,
    });

    // Fetch step logs (execution history)
    const { data: stepLogs, isLoading: stepLogsLoading } = useQuery({
        queryKey: ['workflow-step-logs', contactId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('workflow_step_logs')
                .select('*')
                .eq('contact_id', contactId)
                .order('executed_at', { ascending: false })
                .limit(50);

            if (error) throw error;
            return data || [];
        },
        enabled: !!contactId,
    });

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

    if (isLoading || workflowsLoading || stepLogsLoading) {
        return (
            <div className="flex justify-center p-12">
                <Loader2 className="h-5 w-5 animate-spin text-slate-300" />
            </div>
        );
    }

    if ((!tasks || tasks.length === 0) && (!workflows || workflows.length === 0) && (!stepLogs || stepLogs.length === 0)) {
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
    const planned = (tasks || []).filter(t =>
        (t.status === 'pending' || t.status === 'queued') &&
        new Date(t.scheduled_at) > now
    ).sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());

    const completed = (tasks || []).filter(t =>
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

            {/* SECTION: ACTIVE WORKFLOWS */}
            {workflows && workflows.length > 0 && (
                <section>
                    <div className="flex items-center gap-2 mb-4">
                        <div className="h-1.5 w-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"></div>
                        <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Running Workflows</h3>
                    </div>

                    <div className="space-y-3">
                        {workflows.map((run) => (
                            <div key={run.id} className="p-4 rounded-lg bg-white border border-slate-200 shadow-sm flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="h-9 w-9 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                                        <Zap className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-slate-900">
                                            {run.ai_workflow_templates?.name || 'Workflow'}
                                        </p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-xs text-slate-500 flex items-center gap-1">
                                                <div className="w-1 h-1 rounded-full bg-slate-400"></div>
                                                Status: <span className="font-medium text-slate-700 uppercase">{run.status}</span>
                                            </span>
                                            {run.next_run_at && (
                                                <span className="text-xs text-slate-400">
                                                    • Next: {format(new Date(run.next_run_at), "h:mm a")}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10 animate-pulse">
                                        Running
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* SECTION: PLANNED */}
            <section>
                <div className="flex items-center gap-2 mb-4">
                    <div className="h-1.5 w-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
                    <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Planned Tasks</h3>
                </div>

                {planned.length === 0 ? (
                    <div className="text-xs text-slate-400 pl-4 py-2 italic font-light">
                        No upcoming tasks scheduled.
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

            {/* SECTION: STEP LOGS HISTORY - TABLE FORMAT */}
            <section>
                <div className="flex items-center gap-2 mb-4">
                    <div className="h-1.5 w-1.5 rounded-full bg-slate-300"></div>
                    <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Execution History</h3>
                </div>

                {(!stepLogs || stepLogs.length === 0) ? (
                    <div className="text-xs text-slate-400 pl-4 py-2 italic font-light">
                        No execution history yet.
                    </div>
                ) : (
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Action</th>
                                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Time</th>
                                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Details</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {stepLogs.map((log: any) => {
                                    const Icon = getIcon(log.action);
                                    const isFailed = log.status === 'failed';
                                    const isSuccess = log.status === 'success';
                                    const isWaiting = log.status === 'waiting_for_callback';

                                    return (
                                        <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2.5">
                                                    <div className={cn(
                                                        "h-8 w-8 rounded-md flex items-center justify-center",
                                                        isFailed ? "bg-red-50 text-red-500" :
                                                            isSuccess ? "bg-green-50 text-green-600" :
                                                                isWaiting ? "bg-amber-50 text-amber-600" :
                                                                    "bg-slate-100 text-slate-500"
                                                    )}>
                                                        <Icon className="h-4 w-4" />
                                                    </div>
                                                    <span className="font-medium text-slate-700">{getLabel(log.action)}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={cn(
                                                    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                                                    isFailed ? "bg-red-100 text-red-700" :
                                                        isSuccess ? "bg-green-100 text-green-700" :
                                                            isWaiting ? "bg-amber-100 text-amber-700" :
                                                                "bg-slate-100 text-slate-600"
                                                )}>
                                                    {isWaiting ? 'Waiting' : log.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-slate-500 text-xs font-mono">
                                                {log.executed_at ? format(new Date(log.executed_at), "MMM d, HH:mm") : '—'}
                                            </td>
                                            <td className="px-4 py-3 text-xs text-slate-400 max-w-[200px] truncate">
                                                {log.error_message ? (
                                                    <span className="text-red-500">{log.error_message}</span>
                                                ) : log.result?.call_id ? (
                                                    <span>Call ID: {log.result.call_id.slice(0, 8)}...</span>
                                                ) : (
                                                    '—'
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

        </div>
    );
}
