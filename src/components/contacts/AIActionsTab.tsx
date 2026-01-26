
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Phone, Mail, MessageSquare, Clock, Zap, Calendar, CheckCircle2, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface AIActionsTabProps {
    contactId: string;
    dealIds: string[];
}

interface ActionRow {
    id: string;
    action: string;
    status: 'completed' | 'waiting' | 'scheduled' | 'failed' | 'no_answer';
    time: Date;
    isScheduled: boolean;
    details?: string;
    source: 'log' | 'workflow' | 'contact';
}

export function AIActionsTab({ contactId, dealIds }: AIActionsTabProps) {
    // Fetch active workflows (for scheduled next steps)
    const { data: workflows, isLoading: workflowsLoading } = useQuery({
        queryKey: ['active-workflows-tab', contactId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('workflow_runs')
                .select('*, ai_workflow_templates(name, steps)')
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

    // Fetch contact created_at
    const { data: contact, isLoading: contactLoading } = useQuery({
        queryKey: ['contact-created', contactId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('contacts')
                .select('created_at')
                .eq('id', contactId)
                .single();

            if (error) throw error;
            return data;
        },
        enabled: !!contactId,
    });

    if (workflowsLoading || stepLogsLoading || contactLoading) {
        return (
            <div className="flex justify-center p-12">
                <Loader2 className="h-5 w-5 animate-spin text-slate-300" />
            </div>
        );
    }

    // Build unified action rows
    const actionRows: ActionRow[] = [];

    // Add executed steps from logs
    (stepLogs || []).forEach((log: any) => {
        const status = log.status;
        let mappedStatus: ActionRow['status'] = 'completed';

        if (status === 'failed' || status === 'error') {
            mappedStatus = 'failed';
        } else if (status === 'waiting_for_callback') {
            mappedStatus = 'waiting';
        } else if (status === 'no-answer' || status === 'busy' || status === 'voicemail') {
            mappedStatus = 'no_answer';
        } else if (status === 'answer' || status === 'completed' || status === 'success') {
            mappedStatus = 'completed';
        }

        // Build details string
        let details = log.error_message;
        if (!details && log.result?.reason) {
            details = log.result.reason;
        } else if (!details && log.result?.call_id) {
            details = `Call ID: ${log.result.call_id.slice(0, 8)}...`;
        }

        actionRows.push({
            id: log.id,
            action: log.action,
            status: mappedStatus,
            time: new Date(log.executed_at || log.created_at),
            isScheduled: false,
            details: details,
            source: 'log'
        });
    });

    // Add scheduled next steps from active workflows
    (workflows || []).forEach((run: any) => {
        if (run.next_run_at && run.current_node_id) {
            const steps = run.ai_workflow_templates?.steps as any;
            const currentNode = steps?.nodes?.find((n: any) => n.id === run.current_node_id);
            const action = currentNode?.data?.action || 'next_step';

            actionRows.push({
                id: `scheduled-${run.id}`,
                action: action,
                status: 'scheduled',
                time: new Date(run.next_run_at),
                isScheduled: true,
                details: run.ai_workflow_templates?.name,
                source: 'workflow'
            });
        }
    });

    // Add Lead Created as first event
    if (contact?.created_at) {
        actionRows.push({
            id: 'lead-created',
            action: 'lead_created',
            status: 'completed',
            time: new Date(contact.created_at),
            isScheduled: false,
            details: 'Lead added to system',
            source: 'contact'
        });
    }

    // Sort by time (scheduled first by future date, then completed by past date desc)
    actionRows.sort((a, b) => {
        if (a.isScheduled && !b.isScheduled) return -1;
        if (!a.isScheduled && b.isScheduled) return 1;
        if (a.isScheduled && b.isScheduled) return a.time.getTime() - b.time.getTime();
        return b.time.getTime() - a.time.getTime();
    });

    if (actionRows.length === 0) {
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

    const getIcon = (action: string) => {
        switch (action) {
            case 'call': return Phone;
            case 'send_email': return Mail;
            case 'send_whatsapp': return MessageSquare;
            case 'wait': return Clock;
            case 'lead_created': return UserPlus;
            default: return Zap;
        }
    };

    const getLabel = (action: string) => {
        switch (action) {
            case 'call': return 'AI Call';
            case 'send_email': return 'Email';
            case 'send_whatsapp': return 'WhatsApp';
            case 'wait': return 'Wait';
            case 'markup_table': return 'Update Table';
            case 'check_qualification': return 'Check Qualification';
            case 'assign_agent': return 'Assign Agent';
            case 'next_step': return 'Next Step';
            case 'lead_created': return 'Lead Created';
            default: return action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        }
    };

    const getStatusBadge = (status: ActionRow['status']) => {
        switch (status) {
            case 'completed':
                return <span className="text-green-600">Completed</span>;
            case 'waiting':
                return <span className="text-amber-600">In Progress</span>;
            case 'scheduled':
                return <span className="text-blue-600">Scheduled</span>;
            case 'failed':
                return <span className="text-red-600">Failed</span>;
            case 'no_answer':
                return <span className="text-orange-600">No Answer</span>;
        }
    };

    return (
        <div className="animate-in fade-in-50 duration-300">
            {/* Notion-style table */}
            <div className="w-full">
                {/* Header */}
                <div className="grid grid-cols-12 gap-4 px-3 py-2 text-xs text-slate-400 font-medium border-b border-slate-100">
                    <div className="col-span-4">Action</div>
                    <div className="col-span-2">Status</div>
                    <div className="col-span-3">Time</div>
                    <div className="col-span-3">Details</div>
                </div>

                {/* Rows */}
                <div className="divide-y divide-slate-50">
                    {actionRows.map((row) => {
                        const Icon = getIcon(row.action);

                        return (
                            <div
                                key={row.id}
                                className="grid grid-cols-12 gap-4 px-3 py-3 hover:bg-slate-50/50 transition-colors items-center"
                            >
                                {/* Action */}
                                <div className="col-span-4 flex items-center gap-3">
                                    <div className={cn(
                                        "h-7 w-7 rounded flex items-center justify-center shrink-0",
                                        row.status === 'failed' ? "bg-red-50 text-red-500" :
                                            row.status === 'waiting' ? "bg-amber-50 text-amber-500" :
                                                row.status === 'scheduled' ? "bg-blue-50 text-blue-500" :
                                                    row.status === 'no_answer' ? "bg-orange-50 text-orange-500" :
                                                        row.status === 'completed' ? "bg-green-50 text-green-500" :
                                                            "bg-slate-100 text-slate-500"
                                    )}>
                                        <Icon className="h-3.5 w-3.5" />
                                    </div>
                                    <span className="text-sm text-slate-700 font-medium">{getLabel(row.action)}</span>
                                </div>

                                {/* Status */}
                                <div className="col-span-2 text-sm">
                                    {getStatusBadge(row.status)}
                                </div>

                                {/* Time */}
                                <div className="col-span-3 text-sm text-slate-500">
                                    {row.isScheduled ? (
                                        <span className="flex items-center gap-1.5">
                                            <Calendar className="h-3.5 w-3.5 text-slate-400" />
                                            {format(row.time, "MMM d, HH:mm")}
                                        </span>
                                    ) : (
                                        format(row.time, "MMM d, HH:mm")
                                    )}
                                </div>

                                {/* Details */}
                                <div className="col-span-3 text-sm text-slate-400 truncate">
                                    {row.details || '—'}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
