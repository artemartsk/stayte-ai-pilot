
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings, Loader2, Plus, Trash2, Edit3, GitBranch, Zap, MoreHorizontal } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Tables } from '@/integrations/supabase/types';
import { WorkflowCanvas } from '@/components/workflow/WorkflowCanvas';
import { Badge } from '@/components/ui/badge';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Node, Edge } from 'reactflow';
import { CallStats } from '@/components/vapi/CallStats';
import { VapiSettingsDialog } from '@/components/vapi/VapiSettingsDialog';
import { TwilioSettingsDialog } from '@/components/twilio/TwilioSettingsDialog';

type WorkflowTemplate = Tables<'ai_workflow_templates'>;

interface TriggerConfig {
  event: 'manual' | 'contact_created' | 'contact_updated';
  conditions?: {
    marketing_source?: string;
  };
}

const AITasks = () => {
  const [agencyId, setAgencyId] = useState<string>('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<WorkflowTemplate | null>(null);
  const [workflowName, setWorkflowName] = useState('');
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [triggerConfig, setTriggerConfig] = useState<TriggerConfig>({ event: 'manual' });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    fetchUserAgency();
  }, []);

  const fetchUserAgency = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('agency_id')
        .eq('id', user.id)
        .single();

      if (profile?.agency_id) {
        setAgencyId(profile.agency_id);
      }
    } catch (error) {
      console.error('Error fetching agency:', error);
    }
  };

  // Fetch all workflows
  const { data: workflows = [], isLoading: workflowsLoading } = useQuery({
    queryKey: ['workflows', agencyId],
    queryFn: async () => {
      if (!agencyId) return [];
      const { data, error } = await supabase
        .from('ai_workflow_templates')
        .select('*')
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!agencyId
  });

  // Fetch AI tasks
  const { data: aiTasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['ai-tasks', agencyId],
    queryFn: async () => {
      if (!agencyId) return [];
      const { data, error } = await supabase
        .from('ai_tasks')
        .select('*, deals(contact_id, contacts(first_name, last_name))')
        .eq('agency_id', agencyId)
        .order('scheduled_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!agencyId
  });

  // Fetch lead sources for trigger config
  const { data: leadSources = [] } = useQuery({
    queryKey: ['lead-sources', agencyId],
    queryFn: async () => {
      if (!agencyId) return [];
      const { data, error } = await supabase
        .from('lead_sources')
        .select('*')
        .eq('agency_id', agencyId)
        .eq('is_active', true)
        .order('label');
      if (error) throw error;
      return data || [];
    },
    enabled: !!agencyId
  });

  // Save workflow mutation
  const saveWorkflow = useMutation({
    mutationFn: async () => {
      const graphData = { nodes, edges };

      if (editingWorkflow) {
        const { error } = await supabase
          .from('ai_workflow_templates')
          .update({
            name: workflowName,
            steps: graphData as any,
            trigger_config: triggerConfig as any
          })
          .eq('id', editingWorkflow.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('ai_workflow_templates').insert({
          agency_id: agencyId,
          name: workflowName || 'New Workflow',
          steps: graphData as any,
          trigger_config: triggerConfig as any
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Workflow saved' });
      queryClient.invalidateQueries({ queryKey: ['workflows', agencyId] });
      closeEditor();
    },
    onError: (err) => {
      toast({ title: 'Error', description: 'Failed to save workflow', variant: 'destructive' });
      console.error(err);
    }
  });

  // Delete workflow mutation
  const deleteWorkflow = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('ai_workflow_templates')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Deleted', description: 'Workflow removed' });
      queryClient.invalidateQueries({ queryKey: ['workflows', agencyId] });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to delete', variant: 'destructive' });
    }
  });

  const openEditor = (workflow?: WorkflowTemplate) => {
    if (workflow) {
      setEditingWorkflow(workflow);
      setWorkflowName(workflow.name);
      const stepsData = workflow.steps as any;
      setNodes(stepsData?.nodes || []);
      setEdges(stepsData?.edges || []);
      const tc = (workflow as any).trigger_config as TriggerConfig;
      setTriggerConfig(tc || { event: 'manual' });
    } else {
      setEditingWorkflow(null);
      setWorkflowName('');
      setNodes([]);
      setEdges([]);
      setTriggerConfig({ event: 'manual' });
    }
    setEditorOpen(true);
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setEditingWorkflow(null);
    setWorkflowName('');
    setNodes([]);
    setEdges([]);
    setTriggerConfig({ event: 'manual' });
  };

  const getNodeCount = (workflow: WorkflowTemplate) => {
    const steps = workflow.steps as any;
    return steps?.nodes?.length || 0;
  };

  const getTriggerBadge = (workflow: WorkflowTemplate) => {
    const tc = (workflow as any).trigger_config as TriggerConfig | undefined;
    if (!tc || tc.event === 'manual') return null;
    return (
      <span className="inline-flex items-center gap-1 rounded-[4px] bg-amber-100/50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
        <Zap className="h-3 w-3" />
        {tc.event === 'contact_created' ? 'Auto-Trigger' : 'On Update'}
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: "bg-gray-100/50 text-gray-600 ring-gray-500/10",
      queued: "bg-gray-100/50 text-gray-600 ring-gray-500/10",
      running: "bg-blue-100/50 text-blue-700 ring-blue-700/10",
      done: "bg-green-100/50 text-green-700 ring-green-600/20",
      failed: "bg-red-100/50 text-red-700 ring-red-600/10",
      canceled: "bg-orange-100/50 text-orange-700 ring-orange-600/10"
    };
    const style = styles[status] || styles.pending;
    return (
      <span className={`inline-flex items-center rounded-[4px] px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${style}`}>
        {(status || 'pending').charAt(0).toUpperCase() + (status || 'pending').slice(1)}
      </span>
    );
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      send_whatsapp: "WhatsApp",
      call: "Call",
      send_email: "Email",
      wait: "Wait",
      create_task: "Create Task"
    };
    return labels[action] || action;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Notion-style Compact Header */}
      <div className="px-8 md:px-12 pt-8 pb-4 flex items-center justify-between border-b border-border/40">
        <h1 className="text-xl font-semibold text-foreground/90">Workflows</h1>

        <div className="flex items-center gap-2">
          <TwilioSettingsDialog />
          <VapiSettingsDialog />

          <div className="w-[1px] h-4 bg-border/60 mx-1" />

          <Button onClick={() => openEditor()} size="sm" className="h-8 bg-blue-600 hover:bg-blue-700 text-white shadow-sm font-medium px-3 rounded-[4px]">
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            New
          </Button>
        </div>
      </div>

      <div className="px-8 md:px-12 pb-12">
        <Tabs defaultValue="workflows" className="space-y-0">
          <TabsList className="bg-transparent p-0 border-b border-border/40 w-full justify-start h-auto rounded-none gap-6">
            <TabsTrigger
              value="workflows"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-black data-[state=active]:bg-transparent data-[state=active]:text-black bg-transparent px-0 py-2.5 text-slate-500 font-medium transition-all hover:text-slate-800"
            >
              Workflows
            </TabsTrigger>
            <TabsTrigger
              value="activity"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-black data-[state=active]:bg-transparent data-[state=active]:text-black bg-transparent px-0 py-2.5 text-slate-500 font-medium transition-all hover:text-slate-800"
            >
              Activity Log
            </TabsTrigger>
          </TabsList>

          <TabsContent value="workflows" className="space-y-4 animate-in fade-in-50 duration-300">
            <div className="flex items-center justify-between mb-4">
              {/* Optional filter/search could go here */}
            </div>

            {workflowsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/30" />
              </div>
            ) : workflows.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm border-t border-border/40">
                No workflows yet. Create your first workflow!
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-b border-border/40">
                    <TableHead className="w-[300px] font-normal text-xs text-muted-foreground pl-4 h-9 border-r border-border/40">Name</TableHead>
                    <TableHead className="font-normal text-xs text-muted-foreground h-9 px-4 border-r border-border/40">Trigger</TableHead>
                    <TableHead className="font-normal text-xs text-muted-foreground h-9 px-4 border-r border-border/40">Steps</TableHead>
                    <TableHead className="font-normal text-xs text-muted-foreground h-9 px-4 border-r border-border/40">Status</TableHead>
                    <TableHead className="w-[80px] h-9 px-2"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workflows.map((wf) => (
                    <TableRow
                      key={wf.id}
                      className="cursor-pointer hover:bg-muted/30 border-b border-border/30 transition-colors group"
                      onClick={() => openEditor(wf)}
                    >
                      <TableCell className="pl-4 py-2 align-top border-r border-border/40">
                        <div className="flex items-center gap-2 h-full">
                          <div className="h-5 w-5 rounded bg-muted text-muted-foreground flex items-center justify-center shrink-0">
                            <GitBranch className="h-3 w-3" />
                          </div>
                          <span className="text-sm font-medium text-foreground/90 border-b border-transparent group-hover:border-foreground/20 leading-tight truncate">
                            {wf.name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-2 align-top border-r border-border/40">
                        <div className="flex items-center h-full">
                          {getTriggerBadge(wf) || <span className="text-xs text-muted-foreground">Manual</span>}
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-2 align-top text-xs text-muted-foreground border-r border-border/40">
                        <div className="flex items-center h-full">
                          {getNodeCount(wf)} steps
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-2 align-top border-r border-border/40">
                        <div className="flex items-center h-full">
                          <Badge variant="secondary" className="font-normal text-xs px-2 py-0.5 h-5 bg-muted text-muted-foreground border-transparent hover:bg-muted/80">Active</Badge>
                        </div>
                      </TableCell>
                      <TableCell className="px-2 py-2 align-top" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center h-full opacity-0 group-hover:opacity-100 transition-opacity">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground">
                                <MoreHorizontal className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                              <DropdownMenuItem onClick={() => openEditor(wf)}>
                                <Edit3 className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => deleteWorkflow.mutate(wf.id)} className="text-red-600 focus:text-red-600">
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          <TabsContent value="activity" className="space-y-8 animate-in fade-in-50 duration-300">
            <CallStats />

            <div className="space-y-4">
              <h2 className="text-base font-medium text-muted-foreground flex items-center gap-2">
                <Zap className="h-4 w-4" /> Activity Log
              </h2>

              {tasksLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/30" />
                </div>
              ) : aiTasks.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-sm border-t border-border/40">
                  No recent AI tasks found
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-b border-border/40">
                      <TableHead className="w-[200px] font-normal text-xs text-muted-foreground pl-4 h-9 border-r border-border/40">Contact</TableHead>
                      <TableHead className="font-normal text-xs text-muted-foreground h-9 px-4 border-r border-border/40">Action</TableHead>
                      <TableHead className="font-normal text-xs text-muted-foreground h-9 px-4 border-r border-border/40">Status</TableHead>
                      <TableHead className="font-normal text-xs text-muted-foreground h-9 px-4 border-r border-border/40">Scheduled</TableHead>
                      <TableHead className="font-normal text-xs text-muted-foreground h-9 px-4">Attempts</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {aiTasks.map(task => (
                      <TableRow key={task.id} className="cursor-pointer hover:bg-muted/30 border-b border-border/30 transition-colors group">
                        <TableCell className="pl-4 py-2 align-top border-r border-border/40">
                          <div className="flex items-center gap-2 h-full">
                            <div className="h-5 w-5 rounded bg-muted text-muted-foreground flex items-center justify-center text-[10px] font-medium shrink-0">
                              {task.deals?.contacts?.first_name?.charAt(0) || '?'}{task.deals?.contacts?.last_name?.charAt(0) || ''}
                            </div>
                            <span className="text-sm font-medium text-foreground/90 leading-tight truncate">
                              {task.deals?.contacts?.first_name} {task.deals?.contacts?.last_name || 'Unknown'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-2 align-top border-r border-border/40">
                          <div className="flex items-center h-full">
                            <Badge variant="outline" className="font-normal text-[10px] h-5 px-1.5 bg-transparent border-border/60 text-muted-foreground">
                              {getActionLabel(task.action)}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-2 align-top border-r border-border/40">
                          <div className="flex items-center h-full">
                            {getStatusBadge(task.status)}
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-2 align-top text-xs text-muted-foreground border-r border-border/40">
                          <div className="flex items-center h-full">
                            {new Date(task.scheduled_at).toLocaleDateString("en-US", { month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric' })}
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-2 align-top text-xs text-muted-foreground">
                          <div className="flex items-center h-full">
                            {task.attempts}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Workflow Editor Sheet - Full Screen Notion Style */}
        <Sheet open={editorOpen} onOpenChange={setEditorOpen}>
          <SheetContent side="bottom" className="h-[95vh] overflow-hidden p-0 rounded-t-2xl border-t-0 shadow-2xl">
            <div className="h-full flex flex-col bg-white">
              {/* Editor Header */}
              <div className="px-8 py-4 flex items-center justify-between bg-white z-10 border-b border-slate-100">
                <div className="flex items-center gap-4">
                  <Button variant="ghost" onClick={closeEditor} size="sm" className="text-slate-400 hover:text-slate-900 -ml-2">
                    Cancel
                  </Button>
                  <div className="w-[1px] h-4 bg-slate-200" />
                  <Input
                    value={workflowName}
                    onChange={(e) => setWorkflowName(e.target.value)}
                    placeholder="Workflow name..."
                    className="w-80 border-none shadow-none bg-transparent hover:bg-slate-50 focus-visible:ring-0 focus-visible:bg-slate-50 transition-colors h-10 text-lg font-semibold placeholder:text-slate-300 px-2 rounded-md"
                  />
                </div>
                <div>
                  <Button onClick={() => saveWorkflow.mutate()} disabled={saveWorkflow.isPending} size="sm" className="h-9 bg-black hover:bg-slate-800 text-white rounded-md px-6 shadow-sm font-medium">
                    {saveWorkflow.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />}
                    Save Changes
                  </Button>
                </div>
              </div>

              {/* Minimalist Configuration Bar */}
              <div className="px-8 py-2 border-b border-slate-100 bg-white flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Trigger</span>
                  <Select
                    value={triggerConfig.event}
                    onValueChange={(val: TriggerConfig['event']) =>
                      setTriggerConfig({ ...triggerConfig, event: val })
                    }
                  >
                    <SelectTrigger className="w-auto min-w-[140px] h-7 text-xs border-none shadow-none bg-slate-50 hover:bg-slate-100 text-slate-700 px-2 rounded-md focus:ring-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Manual Trigger</SelectItem>
                      <SelectItem value="contact_created">New Contact Created</SelectItem>
                      <SelectItem value="contact_updated">Contact Updated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {triggerConfig.event !== 'manual' && (
                  <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-300">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Source</span>
                    <Select
                      value={triggerConfig.conditions?.marketing_source || 'any'}
                      onValueChange={(val) =>
                        setTriggerConfig({
                          ...triggerConfig,
                          conditions: val === 'any' ? undefined : { marketing_source: val }
                        })
                      }
                    >
                      <SelectTrigger className="w-auto min-w-[140px] h-7 text-xs border-none shadow-none bg-slate-50 hover:bg-slate-100 text-slate-700 px-2 rounded-md focus:ring-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Any Source</SelectItem>
                        {leadSources.map((source: any) => (
                          <SelectItem key={source.id} value={source.name}>
                            {source.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Canvas Area */}
              <div className="flex-1 bg-slate-50/50 relative">
                <WorkflowCanvas
                  initialNodes={nodes}
                  initialEdges={edges}
                  onChange={(nds, eds) => {
                    setNodes(nds);
                    setEdges(eds);
                  }}
                />
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
};

export default AITasks;