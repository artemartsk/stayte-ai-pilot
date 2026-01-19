import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { Users, CheckCircle2, ListTodo, TrendingUp, UserPlus, Settings } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { toast } from "sonner";
import { AgentProfileDialog } from "@/components/agents/AgentProfileDialog";

interface AgentStats {
  id: string;
  full_name: string;
  role: string;
  active_contacts: number;
  active_tasks: number;
  tasks_due_today: number;
  tasks_completed_today: number;
  recent_activities: number;
  active_deals: number;
}

const AgentsDashboard = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [profileDialogAgent, setProfileDialogAgent] = useState<{ id: string; name: string } | null>(null);
  const [formData, setFormData] = useState({
    email: "",
    fullName: "",
    role: "agent"
  });

  const { data: agents, isLoading } = useQuery({
    queryKey: ["agents-dashboard", user?.agency_id],
    queryFn: async () => {
      if (!user?.agency_id) return [];

      // Get all agency members
      const { data: members } = await supabase
        .from("memberships")
        .select("user_id, role")
        .eq("agency_id", user.agency_id)
        .eq("active", true);

      if (!members || members.length === 0) return [];

      // Get profiles for all members
      const userIds = members.map(m => m.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);

      if (!profiles) return [];

      // Get statistics for each agent
      const agentStats: AgentStats[] = await Promise.all(
        members.map(async (member: any) => {
          const agentId = member.user_id;
          const profile = profiles.find(p => p.id === agentId);

          // Активные контакты
          const { count: contactsCount } = await supabase
            .from("contacts")
            .select("*", { count: "exact", head: true })
            .eq("agency_id", user.agency_id)
            .eq("assignee_id", agentId);

          // Активные задачи
          const { count: tasksCount } = await supabase
            .from("tasks")
            .select("*", { count: "exact", head: true })
            .eq("agency_id", user.agency_id)
            .eq("assignee_id", agentId)
            .eq("status", "open");

          // Задачи на сегодня
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);

          const { count: tasksDueTodayCount } = await supabase
            .from("tasks")
            .select("*", { count: "exact", head: true })
            .eq("agency_id", user.agency_id)
            .eq("assignee_id", agentId)
            .eq("status", "open")
            .gte("due_at", today.toISOString())
            .lt("due_at", tomorrow.toISOString());

          // Завершенные задачи сегодня
          const { count: tasksCompletedTodayCount } = await supabase
            .from("tasks")
            .select("*", { count: "exact", head: true })
            .eq("agency_id", user.agency_id)
            .eq("assignee_id", agentId)
            .eq("status", "done")
            .gte("updated_at", today.toISOString())
            .lt("updated_at", tomorrow.toISOString());

          // Активности за последние 7 дней
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          const { count: activitiesCount } = await supabase
            .from("activities")
            .select("*", { count: "exact", head: true })
            .eq("agency_id", user.agency_id)
            .eq("actor_id", agentId)
            .gte("created_at", sevenDaysAgo.toISOString());

          // Активные сделки
          const { count: dealsCount } = await supabase
            .from("deals")
            .select("*", { count: "exact", head: true })
            .eq("agency_id", user.agency_id)
            .eq("primary_agent_id", agentId)
            .not("status", "in", "(won,lost,canceled)");

          return {
            id: agentId,
            full_name: profile?.full_name || "Unknown",
            role: member.role,
            active_contacts: contactsCount || 0,
            active_tasks: tasksCount || 0,
            tasks_due_today: tasksDueTodayCount || 0,
            tasks_completed_today: tasksCompletedTodayCount || 0,
            recent_activities: activitiesCount || 0,
            active_deals: dealsCount || 0,
          };
        })
      );

      return agentStats;
    },
    enabled: !!user?.agency_id,
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const totalStats = agents?.reduce(
    (acc, agent) => ({
      contacts: acc.contacts + agent.active_contacts,
      tasks: acc.tasks + agent.active_tasks,
      activities: acc.activities + agent.recent_activities,
      deals: acc.deals + agent.active_deals,
    }),
    { contacts: 0, tasks: 0, activities: 0, deals: 0 }
  );

  const handleAddAgent = async () => {
    // TODO: Implement agent invitation logic
    toast.success("Agent invitation feature coming soon!");
    setOpen(false);
    setFormData({ email: "", fullName: "", role: "agent" });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header - Notion style */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold text-slate-800">Agents</h1>
          <p className="text-[13px] text-slate-400">Team activity and metrics</p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] text-slate-600 bg-slate-100 hover:bg-slate-200 rounded transition-colors">
              <UserPlus className="h-3.5 w-3.5" />
              Add
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-sm p-0 gap-0 border-0 shadow-lg">
            <div className="px-5 pt-5 pb-3">
              <DialogTitle className="text-[15px] font-medium text-slate-800">Add Agent</DialogTitle>
              <DialogDescription className="text-[13px] text-slate-400">
                Invite a new team member
              </DialogDescription>
            </div>
            <div className="px-5 pb-5 space-y-3">
              <div className="space-y-1">
                <Label className="text-[12px] text-slate-400 uppercase tracking-wide">Email</Label>
                <Input
                  type="email"
                  placeholder="agent@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="h-8 text-[13px] border-slate-200"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[12px] text-slate-400 uppercase tracking-wide">Name</Label>
                <Input
                  placeholder="John Doe"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className="h-8 text-[13px] border-slate-200"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[12px] text-slate-400 uppercase tracking-wide">Role</Label>
                <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
                  <SelectTrigger className="h-8 text-[13px] border-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="agent">Agent</SelectItem>
                    <SelectItem value="team_lead">Team Lead</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-100">
              <button
                onClick={() => setOpen(false)}
                className="px-3 py-1.5 text-[13px] text-slate-500 hover:text-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleAddAgent}
                className="px-3 py-1.5 text-[13px] bg-slate-900 text-white rounded hover:bg-slate-800"
              >
                Send Invite
              </button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats row - Notion minimal */}
      <div className="flex gap-8 text-[13px]">
        <div>
          <span className="text-slate-400">Agents</span>
          <span className="ml-2 text-slate-700 font-medium">{agents?.length || 0}</span>
        </div>
        <div>
          <span className="text-slate-400">Clients</span>
          <span className="ml-2 text-slate-700 font-medium">{totalStats?.contacts || 0}</span>
        </div>
        <div>
          <span className="text-slate-400">Open Tasks</span>
          <span className="ml-2 text-slate-700 font-medium">{totalStats?.tasks || 0}</span>
        </div>
        <div>
          <span className="text-slate-400">Activities (7d)</span>
          <span className="ml-2 text-slate-700 font-medium">{totalStats?.activities || 0}</span>
        </div>
      </div>

      {/* Table - same style as Contacts */}
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent border-b border-border/40">
            <TableHead className="w-[200px] font-normal text-xs text-muted-foreground pl-4 h-9 border-r border-border/40">Name</TableHead>
            <TableHead className="font-normal text-xs text-muted-foreground h-9 px-4 border-r border-border/40">Role</TableHead>
            <TableHead className="font-normal text-xs text-muted-foreground h-9 px-4 border-r border-border/40 text-right">Clients</TableHead>
            <TableHead className="font-normal text-xs text-muted-foreground h-9 px-4 border-r border-border/40 text-right">Deals</TableHead>
            <TableHead className="font-normal text-xs text-muted-foreground h-9 px-4 border-r border-border/40 text-right">Tasks</TableHead>
            <TableHead className="font-normal text-xs text-muted-foreground h-9 px-4 border-r border-border/40 text-right">Due</TableHead>
            <TableHead className="font-normal text-xs text-muted-foreground h-9 px-4 border-r border-border/40 text-right">Done</TableHead>
            <TableHead className="w-[50px] h-9 px-2"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {agents?.map((agent) => (
            <TableRow
              key={agent.id}
              className="hover:bg-muted/30 border-b border-border/30 transition-colors"
            >
              <TableCell className="pl-4 py-2 font-medium border-r border-border/40">{agent.full_name}</TableCell>
              <TableCell className="px-4 py-2 text-sm text-muted-foreground capitalize border-r border-border/40">{agent.role}</TableCell>
              <TableCell className="px-4 py-2 text-sm text-right border-r border-border/40">{agent.active_contacts}</TableCell>
              <TableCell className="px-4 py-2 text-sm text-right border-r border-border/40">{agent.active_deals}</TableCell>
              <TableCell className="px-4 py-2 text-sm text-right border-r border-border/40">{agent.active_tasks}</TableCell>
              <TableCell className="px-4 py-2 text-sm text-right border-r border-border/40">
                <span className={agent.tasks_due_today > 0 ? 'text-orange-600 font-medium' : 'text-muted-foreground'}>
                  {agent.tasks_due_today}
                </span>
              </TableCell>
              <TableCell className="px-4 py-2 text-sm text-right text-muted-foreground border-r border-border/40">
                {agent.tasks_completed_today}
              </TableCell>
              <TableCell className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setProfileDialogAgent({ id: agent.id, name: agent.full_name })}
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {agents?.length === 0 && (
        <div className="text-center py-12 text-slate-400">
          <Users className="h-8 w-8 mx-auto mb-3 opacity-50" />
          <p className="text-[13px]">No agents yet</p>
        </div>
      )}

      {/* Agent Profile Dialog */}
      {profileDialogAgent && (
        <AgentProfileDialog
          agentId={profileDialogAgent.id}
          agentName={profileDialogAgent.name}
          open={!!profileDialogAgent}
          onOpenChange={(open) => !open && setProfileDialogAgent(null)}
        />
      )}
    </div>
  );
};

export default AgentsDashboard;
