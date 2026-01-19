import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Briefcase, Bot, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
const Dashboard = () => {
  const [recentContacts, setRecentContacts] = useState<Tables<'contacts'>[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const fetchRecentContacts = async () => {
      try {
        const {
          data,
          error
        } = await supabase.from('contacts').select('*').order('created_at', {
          ascending: false
        }).limit(5);
        if (error) throw error;
        setRecentContacts(data || []);
      } catch (error) {
        console.error('Error fetching contacts:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchRecentContacts();
  }, []);
  const stats = [{
    title: "Total Leads",
    value: "248",
    change: "+12%",
    icon: Users,
    href: "/contacts",
    color: "text-primary"
  }, {
    title: "Active Deals",
    value: "37",
    change: "+8%",
    icon: Briefcase,
    href: "/deals",
    color: "text-success"
  }, {
    title: "AI Tasks in Queue",
    value: "15",
    change: "-3%",
    icon: Bot,
    href: "/ai/tasks",
    color: "text-info"
  }, {
    title: "Conversion Rate",
    value: "24.5%",
    change: "+5.2%",
    icon: TrendingUp,
    href: "/deals",
    color: "text-warning"
  }];
  return <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Overview of your agency activity
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map(stat => <Link key={stat.title} to={stat.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  <span className={stat.change.startsWith("+") ? "text-success" : "text-destructive"}>
                    {stat.change}
                  </span>
                  {" "}from last month
                </p>
              </CardContent>
            </Card>
          </Link>)}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>New Leads </CardTitle>
            <CardDescription>
              {loading ? 'Loading...' : `${recentContacts.length} recently added`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {loading ? <div className="text-sm text-muted-foreground">Loading contacts...</div> : recentContacts.length === 0 ? <div className="text-sm text-muted-foreground">No contacts yet</div> : recentContacts.map(contact => {
              const initials = `${contact.first_name?.[0] || ''}${contact.last_name?.[0] || ''}`.toUpperCase() || 'C';
              const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(' ') || 'Unknown';
              const isHot = contact.current_status === 'qualified' || contact.current_status === 'negotiation';
              const getStatusLabel = (status: string | null) => {
                const variants: Record<string, string> = {
                  new: "New",
                  ai_contacting: "AI Contacting",
                  qualified: "Qualified",
                  negotiation: "Negotiation",
                  won: "Won",
                  lost: "Lost",
                  canceled: "Canceled",
                  lead: "Lead",
                  client: "Client"
                };
                return status ? variants[status] || status : 'No status';
              };
              return <Link key={contact.id} to={`/contacts/${contact.id}`}>
                      <div className="flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-800 -mx-2 px-2 py-1 rounded transition-colors">
                        <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-medium">
                          {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{fullName}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {getStatusLabel(contact.current_status)}
                            {isHot && ' 🔥'}
                          </p>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {contact.created_at && new Date(contact.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </Link>;
            })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Active Deals</CardTitle>
            <CardDescription>Require attention</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map(i => <div key={i} className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-success/10 text-success flex items-center justify-center text-sm font-medium">
                    D{i}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Deal #{i}000{i}</p>
                    <p className="text-xs text-muted-foreground">
                      {i % 2 === 0 ? "Sale" : "Rent"} • In Progress
                    </p>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {i}d ago
                  </div>
                </div>)}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>;
};
export default Dashboard;