import { memo, useState, useCallback } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { MessageSquare, Phone, Mail, Clock, Trash2, Plus, UserCheck, Home, GitBranch, Flame } from 'lucide-react';
import { type WhatsAppConfig, type CallConfig, type TimeWindow, type SwitchConfig, type AssignAgentConfig, type NurtureConfig, DEFAULT_STATUS_GROUPS } from './StepConfiguration';

// Status colors for switch outputs
const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
    hot_buyer: { bg: 'bg-red-500', text: 'text-red-600' },
    qualified: { bg: 'bg-green-500', text: 'text-green-600' },
    warm: { bg: 'bg-orange-500', text: 'text-orange-600' },
    cold: { bg: 'bg-blue-500', text: 'text-blue-600' },
    new: { bg: 'bg-purple-500', text: 'text-purple-600' },
    nurturing: { bg: 'bg-pink-500', text: 'text-pink-600' },
    default: { bg: 'bg-slate-400', text: 'text-slate-600' },
};

export type NodeData = {
    label: string;
    action: 'send_whatsapp' | 'call' | 'send_email' | 'wait' | 'create_task' | 'check_qualification' | 'assign_agent' | 'mark_as_lost' | 'start_nurture';
    delay_minutes: number;
    timeWindows?: TimeWindow[];
    config?: WhatsAppConfig | CallConfig | SwitchConfig | AssignAgentConfig | NurtureConfig;
    onDelete?: () => void;
    onChange?: (data: Partial<NodeData>) => void;
    onAddNext?: (handle: string, type: NodeData['action']) => void;
};

const NODE_OPTIONS = [
    { type: 'send_whatsapp', label: 'WhatsApp', desc: 'Send message', icon: MessageSquare, color: 'text-green-600 bg-green-50' },
    { type: 'call', label: 'Call', desc: 'AI phone call', icon: Phone, color: 'text-purple-600 bg-purple-50' },
    { type: 'send_email', label: 'Email', desc: 'Send email', icon: Mail, color: 'text-blue-600 bg-blue-50' },
    { type: 'wait', label: 'Wait', desc: 'Delay before next', icon: Clock, color: 'text-orange-600 bg-orange-50' },
    { type: 'check_qualification', label: 'Route by Group', desc: 'Switch by lead group', icon: GitBranch, color: 'text-amber-600 bg-amber-50' },
    { type: 'assign_agent', label: 'Assign Agent', desc: 'Auto-distribute', icon: UserCheck, color: 'text-teal-600 bg-teal-50' },
    { type: 'mark_as_lost', label: 'Lost Lead', desc: 'Mark as lost', icon: Trash2, color: 'text-gray-600 bg-gray-50' },
    { type: 'start_nurture', label: 'Nurture', desc: 'Start sequence', icon: Flame, color: 'text-red-600 bg-red-50' },
] as const;

const CustomNode = ({ data, isConnectable }: NodeProps<NodeData>) => {
    const [menuOpen, setMenuOpen] = useState<string | null>(null);

    // Helper to normalize outputs to objects { id, name, color }
    const getSwitchOutputs = () => {
        if (data.action === 'check_qualification') {
            const switchConfig = data.config as SwitchConfig | undefined;

            // If we have outputs configured, show only those (active groups)
            if (switchConfig?.outputs && switchConfig.outputs.length > 0) {
                const first = switchConfig.outputs[0];
                if (typeof first === 'string') {
                    // Convert old string outputs to objects
                    return (switchConfig.outputs as unknown as string[]).map(s => ({
                        id: s,
                        name: s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
                        color: STATUS_COLORS[s]?.bg || STATUS_COLORS.default.bg,
                        textColor: STATUS_COLORS[s]?.text || STATUS_COLORS.default.text
                    }));
                }
                // New object outputs - show only what's active
                return (switchConfig.outputs as any[]).map(o => ({
                    id: o.id,
                    name: o.name,
                    color: o.color,
                    textColor: 'text-white'
                }));
            }

            // No outputs or no config - show default groups
            // This ensures handles are always available for connections
            return DEFAULT_STATUS_GROUPS.map(g => ({
                id: g.id,
                name: g.name,
                color: g.color,
                textColor: 'text-white'
            }));
        }
        return [];
    };

    const getIcon = (action: string) => {
        switch (action) {
            case 'send_whatsapp': return <MessageSquare className="h-5 w-5" />;
            case 'call': return <Phone className="h-5 w-5" />;
            case 'send_email': return <Mail className="h-5 w-5" />;
            case 'wait': return <Clock className="h-5 w-5" />;
            case 'check_qualification': return <GitBranch className="h-5 w-5" />;
            case 'assign_agent': return <UserCheck className="h-5 w-5" />;
            case 'mark_as_lost': return <Trash2 className="h-5 w-5" />;
            case 'start_nurture': return <Flame className="h-5 w-5" />;
            default: return <MessageSquare className="h-5 w-5" />;
        }
    };

    const getActionColor = (action: string) => {
        switch (action) {
            case 'send_whatsapp': return 'bg-[#E3F2FD] text-[#0D47A1]';
            case 'call': return 'bg-[#F3E5F5] text-[#7B1FA2]';
            case 'send_email': return 'bg-[#E8F5E9] text-[#2E7D32]';
            case 'wait': return 'bg-[#FFF3E0] text-[#E65100]';
            case 'check_qualification': return 'bg-[#FFF8E1] text-[#F57F17]';
            case 'assign_agent': return 'bg-[#E0F2F1] text-[#00695C]';
            case 'mark_as_lost': return 'bg-gray-100 text-gray-700';
            case 'start_nurture': return 'bg-[#FFEBEE] text-[#B71C1C]';
            default: return 'bg-[#F5F5F5] text-[#616161]';
        }
    };

    const handleAddNode = useCallback((handleId: string, type: NodeData['action']) => {
        data.onAddNext?.(handleId, type);
        setMenuOpen(null);
    }, [data]);

    const isSwitch = data.action === 'check_qualification';
    const isBranching = ['send_whatsapp', 'call', 'send_email', 'wait'].includes(data.action);
    const switchOutputs = getSwitchOutputs();

    // Calculate dynamic height for switch node based on number of outputs
    // Base height 80px + ~32px per output if more than 2
    const nodeHeight = isSwitch
        ? Math.max(100, switchOutputs.length * 36 + 20)
        : undefined;

    const getHandleLabel = (handleId: string) => {
        if (handleId === 'replied') {
            if (data.action === 'call') return 'Answered';
            return 'Replied';
        }
        if (handleId === 'no_reply') {
            if (data.action === 'call') return 'No Answer';
            return 'No Reply';
        }
        return 'Next';
    };

    const getHandleColor = (handleId: string) => {
        if (isSwitch) {
            // This function is no longer used for switch outputs, as color is dynamic
            // from the output object itself.
            return '';
        }
        if (handleId === 'replied') return 'bg-green-500';
        if (handleId === 'no_reply') return 'bg-red-500';
        return 'bg-slate-400';
    };

    return (
        <div
            className={`min-w-[220px] max-w-[220px] group relative select-none`}
            style={nodeHeight ? { height: nodeHeight } : undefined}
        >
            {/* Input handle */}
            <Handle
                type="target"
                position={Position.Left}
                isConnectable={isConnectable}
                className="!w-2.5 !h-2.5 !bg-slate-400 !border-2 !border-white"
            />

            {/* Node card */}
            <div
                className={`rounded-xl p-3.5 shadow-sm hover:shadow-md transition-shadow ${getActionColor(data.action)} h-full flex flex-col`}
            >
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/50 rounded-lg shrink-0">
                        {getIcon(data.action)}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{data.label}</p>
                        <p className="text-xs opacity-60 truncate">
                            {isSwitch ? `${switchOutputs.length} groups` :
                                data.action === 'assign_agent' ?
                                    ((data.config as AssignAgentConfig)?.strategy === 'always_admin' ? 'Always Admin' : 'Least Leads') :
                                    (data.delay_minutes > 0 ? `Wait ${data.delay_minutes}m` : 'Immediate')}
                        </p>
                    </div>
                </div>

                {/* Delete button */}
                <button
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-white rounded-full shadow border border-slate-200 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:border-red-200 transition-all z-10"
                    onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
                    onClick={(e) => { e.stopPropagation(); data.onDelete?.(); }}
                >
                    <Trash2 className="h-2.5 w-2.5 text-slate-400 hover:text-red-500" />
                </button>
            </div>

            {/* Output handles */}
            <div className={`absolute top-0 bottom-0 -right-6 flex flex-col justify-center ${isSwitch ? 'gap-1.5' : 'gap-3'}`}>
                {isSwitch ? (
                    // Switch node: multiple outputs for each group
                    switchOutputs.map((output) => (
                        <div key={output.id} className="relative flex items-center">
                            <span
                                className="absolute right-7 text-[9px] font-medium whitespace-nowrap px-1.5 py-0.5 rounded"
                                style={output.color.startsWith('#') ? { color: output.color, backgroundColor: `${output.color}15` } : undefined}
                            >
                                {output.name}
                            </span>
                            <button
                                className={`w-4 h-4 rounded-full border-2 border-white shadow flex items-center justify-center hover:scale-125 transition-transform ${!output.color.startsWith('#') ? output.color : ''}`}
                                style={output.color.startsWith('#') ? { backgroundColor: output.color } : undefined}
                                onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
                                onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === output.id ? null : output.id); }}
                            >
                                <Plus className="h-2 w-2 text-white" />
                            </button>
                            <Handle type="source" position={Position.Right} id={output.id} isConnectable={isConnectable} className="!opacity-0 !absolute !right-0 !top-1/2 !-translate-y-1/2" />
                            {menuOpen === output.id && (
                                <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl border p-1.5 w-48 z-[9999]" onMouseDown={(e) => e.stopPropagation()}>
                                    <div className="px-2 py-1 text-[10px] uppercase tracking-wide font-semibold text-slate-500">{output.name}</div>
                                    {NODE_OPTIONS.map((opt) => (
                                        <div
                                            key={opt.type}
                                            className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50 cursor-pointer"
                                            onMouseDown={(e) => e.stopPropagation()}
                                            onClick={() => handleAddNode(output.id, opt.type)}
                                        >
                                            <div className={`p-1 rounded ${opt.color}`}><opt.icon className="h-3 w-3" /></div>
                                            <div><div className="text-xs font-medium text-slate-700">{opt.label}</div></div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))
                ) : isBranching ? (
                    // Branching nodes (WhatsApp, Call, Email, Wait): replied/no_reply
                    <>
                        <div className="relative">
                            <button
                                className="w-5 h-5 rounded-full bg-green-500 border-2 border-white shadow flex items-center justify-center hover:scale-125 transition-transform"
                                onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
                                onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === 'replied' ? null : 'replied'); }}
                            >
                                <Plus className="h-3 w-3 text-white" />
                            </button>
                            <Handle type="source" position={Position.Right} id="replied" isConnectable={isConnectable} className="!opacity-0 !absolute !right-0 !top-1/2 !-translate-y-1/2" />
                            {menuOpen === 'replied' && (
                                <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl border p-1.5 w-48 z-[9999]" onMouseDown={(e) => e.stopPropagation()}>
                                    <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-green-600 font-semibold">{getHandleLabel('replied')}</div>
                                    {NODE_OPTIONS.map((opt) => (
                                        <div key={opt.type} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50 cursor-pointer" onMouseDown={(e) => e.stopPropagation()} onClick={() => handleAddNode('replied', opt.type)}>
                                            <div className={`p-1 rounded ${opt.color}`}><opt.icon className="h-3 w-3" /></div>
                                            <div><div className="text-xs font-medium text-slate-700">{opt.label}</div></div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="relative">
                            <button
                                className="w-5 h-5 rounded-full bg-red-500 border-2 border-white shadow flex items-center justify-center hover:scale-125 transition-transform"
                                onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
                                onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === 'no_reply' ? null : 'no_reply'); }}
                            >
                                <Plus className="h-3 w-3 text-white" />
                            </button>
                            <Handle type="source" position={Position.Right} id="no_reply" isConnectable={isConnectable} className="!opacity-0 !absolute !right-0 !top-1/2 !-translate-y-1/2" />
                            {menuOpen === 'no_reply' && (
                                <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl border p-1.5 w-48 z-[9999]" onMouseDown={(e) => e.stopPropagation()}>
                                    <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-red-600 font-semibold">{getHandleLabel('no_reply')}</div>
                                    {NODE_OPTIONS.map((opt) => (
                                        <div key={opt.type} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50 cursor-pointer" onMouseDown={(e) => e.stopPropagation()} onClick={() => handleAddNode('no_reply', opt.type)}>
                                            <div className={`p-1 rounded ${opt.color}`}><opt.icon className="h-3 w-3" /></div>
                                            <div><div className="text-xs font-medium text-slate-700">{opt.label}</div></div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    // Simple nodes: single next output
                    <div className="relative">
                        <button
                            className="w-5 h-5 rounded-full bg-slate-400 border-2 border-white shadow flex items-center justify-center hover:scale-125 transition-transform"
                            onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
                            onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === 'next' ? null : 'next'); }}
                        >
                            <Plus className="h-3 w-3 text-white" />
                        </button>
                        <Handle type="source" position={Position.Right} id="next" isConnectable={isConnectable} className="!opacity-0 !absolute !right-0 !top-1/2 !-translate-y-1/2" />
                        {menuOpen === 'next' && (
                            <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl border p-1.5 w-48 z-[9999]" onMouseDown={(e) => e.stopPropagation()}>
                                <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-slate-500 font-semibold">Next</div>
                                {NODE_OPTIONS.map((opt) => (
                                    <div key={opt.type} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50 cursor-pointer" onMouseDown={(e) => e.stopPropagation()} onClick={() => handleAddNode('next', opt.type)}>
                                        <div className={`p-1 rounded ${opt.color}`}><opt.icon className="h-3 w-3" /></div>
                                        <div><div className="text-xs font-medium text-slate-700">{opt.label}</div></div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Backdrop to close menu */}
            {menuOpen && <div className="fixed inset-0 z-[9998]" onClick={() => setMenuOpen(null)} onMouseDown={(e) => e.stopPropagation()} />}
        </div>
    );
};

export default memo(CustomNode);
