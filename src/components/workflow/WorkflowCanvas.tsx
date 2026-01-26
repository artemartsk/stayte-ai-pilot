import { useState, useCallback, useMemo, useEffect } from 'react';
import ReactFlow, {
    addEdge,
    Background,
    Controls,
    Connection,
    Edge,
    Node,
    useNodesState,
    useEdgesState,
    ReactFlowProvider,
    Panel,
    MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import CustomNode, { type NodeData } from './CustomNode';
import { Button } from '@/components/ui/button';
import { Plus, Settings2, MessageSquare, Phone, Mail, Clock, UserCheck, GitBranch, Archive, Flame, Trash2 } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { TimeWindowInput, WhatsAppInput, CallInput, SwitchInput, AssignAgentInput, NurtureInput, type WhatsAppConfig, type CallConfig, type SwitchConfig, type AssignAgentConfig, type NurtureConfig } from './StepConfiguration';
import { WeeklyScheduleGrid } from './WeeklyScheduleGrid';

const nodeTypes = {
    custom: CustomNode,
};

interface WorkflowCanvasProps {
    initialNodes?: Node[];
    initialEdges?: Edge[];
    onChange: (nodes: Node[], edges: Edge[]) => void;
}

const WorkflowCanvasContent = ({ initialNodes = [], initialEdges = [], onChange }: WorkflowCanvasProps) => {
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes.length > 0 ? initialNodes : [
        {
            id: '1',
            type: 'custom',
            position: { x: 100, y: 100 },
            data: {
                label: 'Send WhatsApp',
                action: 'send_whatsapp',
                delay_minutes: 0,
            },
        },
    ]);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

    // Force update all edges to be bezier (default) to fix existing smoothstep edges
    useEffect(() => {
        setEdges((eds) => eds.map((e) => {
            if (e.type !== 'default') {
                return { ...e, type: 'default' };
            }
            return e;
        }));
    }, [setEdges]);

    // Get selected node data
    const selectedNode = useMemo(() =>
        nodes.find(n => n.id === selectedNodeId),
        [nodes, selectedNodeId]
    );

    const onConnect = useCallback(
        (params: Connection) => {
            const newEdges = addEdge({
                ...params,
                type: 'default',
                markerEnd: { type: MarkerType.ArrowClosed }
            }, edges);
            setEdges(newEdges);
            onChange(nodes, newEdges);
        },
        [edges, nodes, onChange, setEdges]
    );

    const addNode = useCallback((type: NodeData['action']) => {
        const id = `${nodes.length + 1}`;

        // Determine position and source for auto-connection
        let position = { x: 100, y: 100 };
        let sourceNodeId: string | null = null;

        if (selectedNodeId) {
            const sourceNode = nodes.find(n => n.id === selectedNodeId);
            if (sourceNode) {
                sourceNodeId = sourceNode.id;
                position = { x: sourceNode.position.x + 350, y: sourceNode.position.y };
            }
        } else {
            // Find right-most node
            const rightMostX = Math.max(...nodes.map(n => n.position.x), 0);
            position = { x: rightMostX + 350, y: 100 };
        }

        // Descriptive labels based on action
        const getLabel = (action: string) => {
            switch (action) {
                case 'send_whatsapp': return 'Send WhatsApp';
                case 'call': return 'Call Client';
                case 'send_email': return 'Send Email';
                case 'wait': return 'Wait';
                case 'check_qualification': return 'Route by Group';
                case 'assign_agent': return 'Assign Agent';
                case 'mark_as_lost': return 'Lost Lead';
                case 'start_nurture': return 'Nurture Sequence';
                case 'create_task': return 'Create Task';
                default: return `Step ${id}`;
            }
        };

        const newNode: Node<NodeData> = {
            id,
            type: 'custom',
            position,
            data: {
                label: getLabel(type),
                action: type,
                delay_minutes: 0,
                onChange: () => { }, // Re-injected
                onDelete: () => { }  // Re-injected
            },
        };

        let newNodes = [...nodes, newNode];
        let newEdges = [...edges];

        // Auto-connect if source exists
        if (sourceNodeId) {
            const sourceNode = nodes.find(n => n.id === sourceNodeId);
            // Determine handle based on action
            let sourceHandle = 'next';
            if (['send_whatsapp', 'call', 'send_email', 'wait', 'check_qualification'].includes(sourceNode?.data.action || '')) {
                // Default to 'replied' (green) for positive flow
                sourceHandle = 'replied';
            }

            const newEdge: Edge = {
                id: `e${sourceNodeId}-${id}`,
                source: sourceNodeId,
                target: id,
                sourceHandle,
                type: 'default',
                markerEnd: { type: MarkerType.ArrowClosed }
            };
            newEdges = [...newEdges, newEdge];
        }

        setNodes(newNodes);
        setEdges(newEdges);
        onChange(newNodes, newEdges);

        // Select the new node only if it's not a 'mark_as_lost' node
        if (type !== 'mark_as_lost') {
            setSelectedNodeId(id);
        } else {
            // Explicitly close the panel if adding a lost lead node
            setSelectedNodeId(null);
        }
    }, [nodes, edges, onChange, setNodes, setEdges, selectedNodeId]);

    const handleNodeDataChange = useCallback((id: string, newData: Partial<NodeData>) => {
        setNodes((nds) => {
            const newNodes = nds.map((node) => {
                if (node.id === id) {
                    return { ...node, data: { ...node.data, ...newData } };
                }
                return node;
            });
            onChange(newNodes, edges);
            return newNodes;
        });
    }, [edges, onChange, setNodes]);

    const handleNodeDelete = useCallback((id: string) => {
        setNodes((nds) => {
            const newNodes = nds.filter((n) => n.id !== id);
            onChange(newNodes, edges);
            return newNodes;
        });
        setEdges((eds) => {
            const newEdges = eds.filter((e) => e.source !== id && e.target !== id);
            return newEdges;
        });
        if (selectedNodeId === id) setSelectedNodeId(null);
    }, [edges, onChange, setNodes, setEdges, selectedNodeId]);

    const handleAddNext = useCallback((sourceNodeId: string, handleId: string, type: NodeData['action']) => {
        const sourceNode = nodes.find(n => n.id === sourceNodeId);
        if (!sourceNode) return;

        const id = `${Date.now()}`; // Unique ID

        // Calculate base position
        const baseX = sourceNode.position.x + 350;
        let yOffset = 0;

        // For standard branching nodes (replied/no_reply)
        if (handleId === 'replied') {
            yOffset = -80;
        } else if (handleId === 'no_reply') {
            yOffset = 80;
        } else if (handleId !== 'next') {
            // For switch nodes (check_qualification) - handleId is the group ID
            // Find the index of this handle among all outputs
            const switchConfig = sourceNode.data.config as any;
            if (switchConfig?.outputs) {
                const outputIndex = switchConfig.outputs.findIndex((o: any) =>
                    (typeof o === 'string' ? o : o.id) === handleId
                );
                if (outputIndex >= 0) {
                    // Distribute outputs vertically: center them around source node
                    const totalOutputs = switchConfig.outputs.length;
                    const spacing = 100; // Space between each output path
                    const centerOffset = (totalOutputs - 1) * spacing / 2;
                    yOffset = (outputIndex * spacing) - centerOffset;
                }
            }
        }

        let position = {
            x: baseX,
            y: sourceNode.position.y + yOffset
        };

        // Check for collisions with existing nodes and adjust position
        const NODE_HEIGHT = 80;
        const NODE_WIDTH = 250;
        const PADDING = 20;

        const isOverlapping = (pos: { x: number; y: number }) => {
            return nodes.some(node => {
                if (node.id === sourceNodeId) return false; // Ignore source node
                const dx = Math.abs(node.position.x - pos.x);
                const dy = Math.abs(node.position.y - pos.y);
                return dx < NODE_WIDTH + PADDING && dy < NODE_HEIGHT + PADDING;
            });
        };

        // If overlapping, try to find a free spot by moving down
        let attempts = 0;
        while (isOverlapping(position) && attempts < 10) {
            position.y += NODE_HEIGHT + PADDING;
            attempts++;
        }

        const getLabel = (action: string) => {
            switch (action) {
                case 'send_whatsapp': return 'Send WhatsApp';
                case 'call': return 'Call Client';
                case 'send_email': return 'Send Email';
                case 'wait': return 'Wait';
                case 'check_qualification': return 'Route by Group';
                case 'assign_agent': return 'Assign Agent';
                case 'mark_as_lost': return 'Lost Lead';
                case 'start_nurture': return 'Nurture Sequence';
                case 'create_task': return 'Create Task';
                default: return `Step ${nodes.length + 1}`;
            }
        };

        const newNode: Node<NodeData> = {
            id,
            type: 'custom',
            position,
            data: {
                label: getLabel(type),
                action: type,
                delay_minutes: 0,
                onChange: () => { },
                onDelete: () => { },
                onAddNext: () => { }
            },
        };

        const newEdge: Edge = {
            id: `e${sourceNodeId}-${handleId}-${id}`,
            source: sourceNodeId,
            target: id,
            sourceHandle: handleId,
            type: 'bezier',
            markerEnd: { type: MarkerType.ArrowClosed }
        };

        const newNodes = [...nodes, newNode];
        const newEdges = [...edges, newEdge];

        setNodes(newNodes);
        setEdges(newEdges);
        onChange(newNodes, newEdges);

        // Open settings for new node only if it's not 'mark_as_lost'
        if (type !== 'mark_as_lost') {
            setSelectedNodeId(id);
        } else {
            // Explicitly close the panel if adding a lost lead node
            setSelectedNodeId(null);
        }
    }, [nodes, edges, onChange, setNodes, setEdges]);

    // Inject handlers into data
    const nodesWithHandlers = useMemo(() => {
        return nodes.map((node) => ({
            ...node,
            data: {
                ...node.data,
                onChange: (newData: Partial<NodeData>) => handleNodeDataChange(node.id, newData),
                onDelete: () => handleNodeDelete(node.id),
                onAddNext: (handle: 'replied' | 'no_reply' | 'next', type: NodeData['action']) => handleAddNext(node.id, handle, type),
            },
        }));
    }, [nodes, handleNodeDataChange, handleNodeDelete, handleAddNext]);

    return (
        <div className="w-full h-full bg-slate-50 relative">
            <ReactFlow
                defaultEdgeOptions={{ type: 'bezier', markerEnd: { type: MarkerType.ArrowClosed } }}
                nodes={nodesWithHandlers}
                edges={edges}
                onNodesChange={(changes) => {
                    onNodesChange(changes);
                }}
                onEdgesChange={(changes) => {
                    onEdgesChange(changes);
                }}
                onConnect={onConnect}
                onNodeClick={(_, node) => {
                    if (node.data.action !== 'mark_as_lost') {
                        setSelectedNodeId(node.id);
                    }
                }}
                onPaneClick={() => setSelectedNodeId(null)}
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{ padding: 0.3, maxZoom: 1 }}
                minZoom={0.3}
                maxZoom={1.5}
                defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
            >
                <Background color="#cbd5e1" gap={20} size={1} />
                <Controls className="bg-white border-none shadow-sm text-slate-500" />

                {/* Floating Toolbar - Notion Style */}
                <Panel position="bottom-center" className="mb-10">
                    <div className="bg-white/80 backdrop-blur-md p-1.5 rounded-full shadow-lg border border-slate-200/60 flex gap-2 transition-all hover:scale-105 hover:shadow-xl">
                        <Button
                            onClick={() => addNode('send_whatsapp')}
                            variant="ghost"
                            size="icon"
                            className="rounded-full h-10 w-10 hover:bg-green-50 hover:text-green-600 transition-colors"
                            title="Add WhatsApp"
                        >
                            <MessageSquare className="h-5 w-5" />
                        </Button>
                        <Button
                            onClick={() => addNode('call')}
                            variant="ghost"
                            size="icon"
                            className="rounded-full h-10 w-10 hover:bg-purple-50 hover:text-purple-600 transition-colors"
                            title="Add Call"
                        >
                            <Phone className="h-5 w-5" />
                        </Button>
                        <Button
                            onClick={() => addNode('send_email')}
                            variant="ghost"
                            size="icon"
                            className="rounded-full h-10 w-10 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                            title="Add Email"
                        >
                            <Mail className="h-5 w-5" />
                        </Button>
                        <Button
                            onClick={() => addNode('start_nurture')}
                            variant="ghost"
                            size="icon"
                            className="rounded-full h-10 w-10 hover:bg-red-50 hover:text-red-600 transition-colors"
                            title="Add Nurture"
                        >
                            <Flame className="h-5 w-5" />
                        </Button>
                        <Button
                            onClick={() => addNode('wait')}
                            variant="ghost"
                            size="icon"
                            className="rounded-full h-10 w-10 hover:bg-orange-50 hover:text-orange-600 transition-colors"
                            title="Add Wait"
                        >
                            <Clock className="h-5 w-5" />
                        </Button>
                        <Button
                            onClick={() => addNode('assign_agent')}
                            variant="ghost"
                            size="icon"
                            className="rounded-full h-10 w-10 hover:bg-teal-50 hover:text-teal-600 transition-colors"
                            title="Assign Agent"
                        >
                            <UserCheck className="h-5 w-5" />
                        </Button>
                        <Button
                            onClick={() => addNode('mark_as_lost')}
                            variant="ghost"
                            size="icon"
                            className="rounded-full h-10 w-10 hover:bg-gray-50 hover:text-gray-600 transition-colors"
                            title="Lost Lead"
                        >
                            <Archive className="h-5 w-5" />
                        </Button>
                    </div>
                </Panel>
            </ReactFlow>

            {/* Settings Sheet */}
            <Sheet open={!!selectedNodeId} onOpenChange={(open) => !open && setSelectedNodeId(null)}>
                <SheetContent
                    side={(selectedNode?.data.action === 'call' || selectedNode?.data.action === 'send_whatsapp' || selectedNode?.data.action === 'start_nurture') ? 'bottom' : 'right'}
                    className={(selectedNode?.data.action === 'call' || selectedNode?.data.action === 'send_whatsapp' || selectedNode?.data.action === 'start_nurture') ? 'h-[85vh] p-0' : 'overflow-y-auto w-[400px] sm:w-[540px]'}
                >
                    {selectedNode && (
                        (selectedNode.data.action === 'call' || selectedNode.data.action === 'send_whatsapp' || selectedNode.data.action === 'start_nurture') ? (
                            // Split View for Call, WhatsApp, or Nurture Node - Notion style
                            <div className="flex h-full">
                                {/* LEFT PANEL: Settings */}
                                <div className="w-1/2 h-full overflow-y-auto border-r border-slate-100 bg-white p-8">
                                    <div className="mb-8">
                                        <div className="flex items-center gap-2.5 mb-1">
                                            <Settings2 className="h-4 w-4 text-slate-400" />
                                            <h2 className="text-[15px] font-semibold text-slate-800">
                                                {selectedNode.data.action === 'call' ? 'Call Configuration' :
                                                    selectedNode.data.action === 'start_nurture' ? 'Nurture Sequence' :
                                                        'WhatsApp Configuration'}
                                            </h2>
                                        </div>
                                        <p className="text-[13px] text-slate-400 ml-6">
                                            {selectedNode.data.action === 'call' ? 'Configure voice, retry logic, and fallback rules.' :
                                                selectedNode.data.action === 'start_nurture' ? 'Configure property recommendations and schedule.' :
                                                    'Configure message templates and sending logic.'}
                                        </p>
                                    </div>

                                    <div className="space-y-6">
                                        {selectedNode.data.action === 'call' ? (
                                            <CallInput
                                                value={selectedNode.data.config as CallConfig}
                                                onChange={(val) => handleNodeDataChange(selectedNode.id, { config: val })}
                                            />
                                        ) : selectedNode.data.action === 'start_nurture' ? (
                                            <NurtureInput
                                                value={selectedNode.data.config as NurtureConfig}
                                                onChange={(val) => handleNodeDataChange(selectedNode.id, { config: val })}
                                            />
                                        ) : (
                                            <WhatsAppInput
                                                value={selectedNode.data.config as WhatsAppConfig}
                                                onChange={(val) => handleNodeDataChange(selectedNode.id, { config: val })}
                                            />
                                        )}

                                        <div className="pt-4">
                                            <button
                                                className="text-[12px] text-slate-400 hover:text-red-500 transition-colors flex items-center gap-1.5"
                                                onClick={() => handleNodeDelete(selectedNode.id)}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* RIGHT PANEL: Schedule */}
                                <div className="w-1/2 h-full bg-slate-50/50 p-6 flex flex-col">
                                    <div className="flex-1 overflow-hidden">
                                        <WeeklyScheduleGrid
                                            value={selectedNode.data.timeWindows}
                                            onChange={(val) => handleNodeDataChange(selectedNode.id, { timeWindows: val })}
                                        />
                                    </div>
                                </div>
                            </div>
                        ) : (
                            // Standard Layout for other nodes
                            <div className="h-full overflow-y-auto">
                                <SheetHeader className="mb-6 pb-0">
                                    {selectedNode.data.action === 'assign_agent' ? (
                                        <div className="space-y-0.5">
                                            <SheetTitle className="text-[15px] font-medium text-slate-800">
                                                Assign Agent
                                            </SheetTitle>
                                            <SheetDescription className="text-[13px] text-slate-400">
                                                Distribution strategy
                                            </SheetDescription>
                                        </div>
                                    ) : selectedNode.data.action === 'check_qualification' ? (
                                        <div>
                                            <SheetTitle className="text-base font-semibold text-slate-900">
                                                Route by Group
                                            </SheetTitle>
                                            <SheetDescription className="text-sm text-slate-500 mt-0.5">
                                                Conditional routing
                                            </SheetDescription>
                                        </div>
                                    ) : (
                                        <div className="flex items-start gap-4">
                                            <div className="p-3 rounded-xl bg-slate-50">
                                                <Settings2 className="h-6 w-6 text-slate-500" />
                                            </div>
                                            <div className="space-y-1 pt-0.5">
                                                <SheetTitle className="text-xl font-semibold tracking-tight">
                                                    Configuration
                                                </SheetTitle>
                                                <SheetDescription className="text-sm">
                                                    Configure step parameters
                                                </SheetDescription>
                                            </div>
                                        </div>
                                    )}
                                </SheetHeader>

                                <div className="space-y-8">
                                    {selectedNode.data.action !== 'check_qualification' && selectedNode.data.action !== 'assign_agent' && (
                                        <>


                                            <div className="space-y-2">
                                                <Label>Action Type</Label>
                                                <Select
                                                    value={selectedNode.data.action}
                                                    onValueChange={(val: any) => handleNodeDataChange(selectedNode.id, { action: val })}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="send_whatsapp">Send WhatsApp</SelectItem>
                                                        <SelectItem value="call">Call</SelectItem>
                                                        <SelectItem value="send_email">Send Email</SelectItem>
                                                        <SelectItem value="wait">Wait</SelectItem>
                                                        <SelectItem value="start_nurture">Nurture Sequence</SelectItem>
                                                        <SelectItem value="create_task">Create Task</SelectItem>
                                                        <SelectItem value="mark_as_lost">Lost Lead</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>



                                            <div className="border-t pt-4">
                                                <TimeWindowInput
                                                    value={selectedNode.data.timeWindows}
                                                    onChange={(val) => handleNodeDataChange(selectedNode.id, { timeWindows: val })}
                                                />
                                            </div>
                                        </>
                                    )}

                                    {selectedNode.data.action === 'send_whatsapp' && (
                                        <div className="border-t pt-4">
                                            <WhatsAppInput
                                                value={selectedNode.data.config as WhatsAppConfig}
                                                onChange={(val) => handleNodeDataChange(selectedNode.id, { config: val })}
                                            />
                                        </div>
                                    )}

                                    {selectedNode.data.action === 'call' && (
                                        <div className="border-t pt-4">
                                            <CallInput
                                                value={selectedNode.data.config as CallConfig}
                                                onChange={(val) => handleNodeDataChange(selectedNode.id, { config: val })}
                                            />
                                        </div>
                                    )}

                                    {selectedNode.data.action === 'check_qualification' && (
                                        <div className="pt-2">
                                            <SwitchInput
                                                value={selectedNode.data.config as SwitchConfig}
                                                onChange={(val) => handleNodeDataChange(selectedNode.id, { config: val })}
                                            />
                                        </div>
                                    )}

                                    {selectedNode.data.action === 'assign_agent' && (
                                        <div className="pt-2">
                                            <AssignAgentInput
                                                value={selectedNode.data.config as AssignAgentConfig}
                                                onChange={(val) => handleNodeDataChange(selectedNode.id, { config: val })}
                                            />
                                        </div>
                                    )}

                                    <div className="mt-auto pt-8">
                                        <button
                                            onClick={() => handleNodeDelete(selectedNode.id)}
                                            className="text-[12px] text-slate-300 hover:text-slate-500 transition-colors"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )
                    )}
                </SheetContent>
            </Sheet>
        </div>
    );
};

export const WorkflowCanvas = (props: WorkflowCanvasProps) => {
    return (
        <ReactFlowProvider>
            <WorkflowCanvasContent {...props} />
        </ReactFlowProvider>
    );
};
