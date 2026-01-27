import { useEffect, useState } from 'react';
import { Users, Briefcase, Bot, TrendingUp, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { StatsCard, LeadsChart, PipelineBreakdown, ActivityFeed, HotLeads } from '@/components/dashboard';

interface DashboardStats {
  totalLeads: number;
  activeDeals: number;
  aiTasks: number;
  conversionRate: number;
}

interface LeadsByDay {
  date: string;
  count: number;
}

interface PipelineStatus {
  status: string;
  count: number;
}

interface Activity {
  id: string;
  type: 'email' | 'call' | 'sms' | 'status_change' | 'new_lead';
  description: string;
  contact_id?: string;
  contact_name?: string;
  created_at: string;
}

interface HotLead {
  id: string;
  name: string;
  status: string;
  budget?: number;
  location?: string;
  updated_at: string;
}

const Dashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({ totalLeads: 0, activeDeals: 0, aiTasks: 0, conversionRate: 0 });
  const [leadsByDay, setLeadsByDay] = useState<LeadsByDay[]>([]);
  const [pipelineData, setPipelineData] = useState<PipelineStatus[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [hotLeads, setHotLeads] = useState<HotLead[]>([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!user?.agency_id) return;
      setLoading(true);

      try {
        // 1. Total leads
        const { count: totalLeads } = await supabase
          .from('contacts')
          .select('*', { count: 'exact', head: true })
          .eq('agency_id', user.agency_id);

        // 2. Active deals
        const { count: activeDeals } = await supabase
          .from('deals')
          .select('*', { count: 'exact', head: true })
          .eq('agency_id', user.agency_id)
          .in('status', ['active', 'negotiation', 'viewing_scheduled']);

        // 3. AI tasks pending
        const { count: aiTasks } = await supabase
          .from('ai_tasks')
          .select('*', { count: 'exact', head: true })
          .eq('agency_id', user.agency_id)
          .eq('status', 'pending');

        // 4. Won deals for conversion
        const { count: wonDeals } = await supabase
          .from('deals')
          .select('*', { count: 'exact', head: true })
          .eq('agency_id', user.agency_id)
          .eq('status', 'won');

        const conversionRate = totalLeads && totalLeads > 0
          ? Math.round((wonDeals || 0) / totalLeads * 100 * 10) / 10
          : 0;

        setStats({
          totalLeads: totalLeads || 0,
          activeDeals: activeDeals || 0,
          aiTasks: aiTasks || 0,
          conversionRate
        });

        // 5. Leads by day (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { data: leadsData } = await supabase
          .from('contacts')
          .select('created_at')
          .eq('agency_id', user.agency_id)
          .gte('created_at', thirtyDaysAgo.toISOString());

        const leadCounts: Record<string, number> = {};
        leadsData?.forEach(lead => {
          const date = new Date(lead.created_at).toISOString().split('T')[0];
          leadCounts[date] = (leadCounts[date] || 0) + 1;
        });

        const leadsByDayData = Object.entries(leadCounts)
          .map(([date, count]) => ({ date, count }))
          .sort((a, b) => a.date.localeCompare(b.date));
        setLeadsByDay(leadsByDayData);

        // 6. Pipeline breakdown
        const { data: statusData } = await supabase
          .from('contacts')
          .select('current_status')
          .eq('agency_id', user.agency_id);

        const statusCounts: Record<string, number> = {};
        statusData?.forEach(c => {
          const status = c.current_status || 'new';
          statusCounts[status] = (statusCounts[status] || 0) + 1;
        });

        setPipelineData(
          Object.entries(statusCounts)
            .map(([status, count]) => ({ status, count }))
            .sort((a, b) => b.count - a.count)
        );

        // 7. Recent activity (from contact_communications)
        const { data: commsData } = await supabase
          .from('contact_communications')
          .select('id, channel, subject, contact_id, created_at, contacts(first_name, last_name)')
          .eq('agency_id', user.agency_id)
          .order('created_at', { ascending: false })
          .limit(8);

        const activitiesData: Activity[] = (commsData || []).map((c: any) => ({
          id: c.id,
          type: c.channel === 'email' ? 'email' : c.channel === 'call' ? 'call' : 'sms',
          description: c.subject || `${c.channel} sent`,
          contact_id: c.contact_id,
          contact_name: [c.contacts?.first_name, c.contacts?.last_name].filter(Boolean).join(' '),
          created_at: c.created_at
        }));
        setActivities(activitiesData);

        // 8. Hot leads
        const { data: hotData } = await supabase
          .from('contacts')
          .select('id, first_name, last_name, current_status, updated_at, deals(budget_max, locations)')
          .eq('agency_id', user.agency_id)
          .in('current_status', ['qualified', 'negotiation'])
          .order('updated_at', { ascending: false })
          .limit(5);

        const hotLeadsData: HotLead[] = (hotData || []).map((c: any) => ({
          id: c.id,
          name: [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Unknown',
          status: c.current_status,
          budget: c.deals?.[0]?.budget_max,
          location: c.deals?.[0]?.locations?.[0],
          updated_at: c.updated_at
        }));
        setHotLeads(hotLeadsData);

      } catch (error) {
        console.error('Dashboard fetch error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [user?.agency_id]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border px-8 py-6">
        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-[13px] text-muted-foreground mt-1">
          Overview of your agency performance
        </p>
      </div>

      {/* Content */}
      <div className="px-8 py-6 space-y-8">
        {/* Stats Row */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Total Leads"
            value={stats.totalLeads}
            icon={Users}
            href="/contacts"
            loading={loading}
          />
          <StatsCard
            title="Active Deals"
            value={stats.activeDeals}
            icon={Briefcase}
            href="/deals"
            loading={loading}
          />
          <StatsCard
            title="AI Tasks Pending"
            value={stats.aiTasks}
            icon={Bot}
            href="/ai/tasks"
            loading={loading}
          />
          <StatsCard
            title="Conversion Rate"
            value={`${stats.conversionRate}%`}
            icon={TrendingUp}
            loading={loading}
          />
        </div>

        {/* Charts Row */}
        <div className="grid gap-6 lg:grid-cols-5">
          {/* Leads Chart - takes 3 cols */}
          <div className="lg:col-span-3 p-5 border border-border rounded-xl bg-background">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-[14px] font-medium text-foreground">Leads Over Time</h3>
                <p className="text-[12px] text-muted-foreground">Last 30 days</p>
              </div>
            </div>
            <LeadsChart data={leadsByDay} loading={loading} />
          </div>

          {/* Pipeline - takes 2 cols */}
          <div className="lg:col-span-2 p-5 border border-border rounded-xl bg-background">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-[14px] font-medium text-foreground">Pipeline Breakdown</h3>
                <p className="text-[12px] text-muted-foreground">Leads by status</p>
              </div>
            </div>
            <PipelineBreakdown data={pipelineData} loading={loading} />
          </div>
        </div>

        {/* Activity + Hot Leads Row */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Activity Feed */}
          <div className="p-5 border border-border rounded-xl bg-background">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[14px] font-medium text-foreground">Recent Activity</h3>
              <Link to="/contacts" className="text-[12px] text-muted-foreground hover:text-foreground flex items-center gap-1">
                See all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <ActivityFeed activities={activities} loading={loading} />
          </div>

          {/* Hot Leads */}
          <div className="p-5 border border-border rounded-xl bg-background">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[14px] font-medium text-foreground">Hot Leads 🔥</h3>
              <Link to="/contacts?status=qualified" className="text-[12px] text-muted-foreground hover:text-foreground flex items-center gap-1">
                See all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <HotLeads leads={hotLeads} loading={loading} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;