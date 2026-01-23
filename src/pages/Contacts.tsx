import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Mail, Phone, Users, Loader2, Tags, MoreHorizontal, Filter, LayoutGrid } from 'lucide-react';
import { toast } from 'sonner';
import { GroupsManager } from '@/components/contacts/GroupsManager';
import { GroupFilter } from '@/components/contacts/GroupFilter';
import { GroupBadge } from '@/components/contacts/GroupBadge';
import { ContactGroupAssignment } from '@/components/contacts/ContactGroupAssignment';
import { ContactsKanban } from '@/components/contacts/ContactsKanban';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

const Contacts = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<'list' | 'board'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [groupsManagerOpen, setGroupsManagerOpen] = useState(false);
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [assignmentContactId, setAssignmentContactId] = useState<string | null>(null);
  const [assignmentContactName, setAssignmentContactName] = useState('');
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    marketing_source: ''
  });

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['contacts', user?.agency_id, selectedGroupIds],
    queryFn: async () => {
      if (!user?.agency_id) return [];

      let query = supabase
        .from('contacts')
        .select(`
          *,
          contact_group:contact_groups(id, name, color),
          deals:deals!deals_contact_id_fkey(id, status, created_at, budget_max, ai_hot_score, areas, type),
          owner:profiles!contacts_owner_fkey(id, full_name)
        `)
        .eq('agency_id', user.agency_id);

      // Filter by groups if any are selected
      if (selectedGroupIds.length > 0) {
        query = query.in('group_id', selectedGroupIds);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      // Transform the data to include group
      return (data || []).map((contact: any) => ({
        ...contact,
        groups: contact.contact_group ? [contact.contact_group] : [],
      }));
    },
    enabled: !!user?.agency_id,
  });

  // Fetch lead sources from database
  const { data: leadSources = [] } = useQuery({
    queryKey: ['lead-sources', user?.agency_id],
    queryFn: async () => {
      if (!user?.agency_id) return [];
      const { data, error } = await supabase
        .from('lead_sources')
        .select('*')
        .eq('agency_id', user.agency_id)
        .eq('is_active', true)
        .order('label');
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.agency_id
  });

  const createContactMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!user?.agency_id) throw new Error('No agency ID');

      const { data: newContact, error } = await supabase
        .from('contacts')
        .insert({
          agency_id: user.agency_id,
          first_name: data.first_name,
          last_name: data.last_name,
          primary_email: data.email,
          emails: [data.email],
          primary_phone: data.phone,
          phones: [data.phone],
          marketing_source: data.marketing_source || null,
          current_status: 'new'
        })
        .select()
        .single();

      if (error) throw error;
      return newContact;
    },
    onSuccess: (newContact) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success('Lead created successfully');
      setDialogOpen(false);
      setFormData({ first_name: '', last_name: '', email: '', phone: '', marketing_source: '' });
      navigate(`/contacts/${newContact.id}`);
    },
    onError: (error: any) => {
      if (error.message?.includes('uq_contact_email_per_agency')) {
        toast.error('Contact with this email already exists');
      } else if (error.message?.includes('uq_contact_phone_per_agency')) {
        toast.error('Contact with this phone number already exists');
      } else {
        toast.error('Failed to create lead: ' + error.message);
      }
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createContactMutation.mutate(formData);
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      new: { label: "New", variant: "secondary" as const },
      ai_contacting: { label: "AI Contacting", variant: "default" as const }, // Changed from purple to default for simpler look
      qualified: { label: "Qualified", variant: "secondary" as const },
      negotiation: { label: "Negotiation", variant: "secondary" as const },
      won: { label: "Won", variant: "outline" as const },
      lost: { label: "Lost", variant: "destructive" as const },
      canceled: { label: "Canceled", variant: "secondary" as const },
      lead: { label: "Lead", variant: "secondary" as const },
      client: { label: "Client", variant: "outline" as const },
    };
    const config = variants[status as keyof typeof variants] || { label: status?.replace('_', ' '), variant: "secondary" as const };

    // Minimalist badge style override
    return (
      <Badge variant={config.variant} className="font-normal text-xs px-2 py-0.5 h-5 bg-muted text-muted-foreground border-transparent hover:bg-muted/80">
        {config.label}
      </Badge>
    );
  };

  const filteredContacts = contacts.filter((contact) =>
    `${contact.first_name} ${contact.last_name} ${contact.primary_email} ${contact.primary_phone}`
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Notion-style Compact Header */}
      <div className="px-8 md:px-12 pt-8 pb-4 flex items-center justify-between border-b border-border/40">
        <h1 className="text-xl font-semibold text-foreground/90">Leads</h1>

        <div className="flex items-center gap-2">
          {isSearchVisible ? (
            <div className="flex items-center relative transition-all animate-in fade-in zoom-in-95 duration-200">
              <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
              <Input
                autoFocus
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onBlur={() => !searchQuery && setIsSearchVisible(false)}
                className="pl-9 h-8 rounded-sm bg-muted/50 border-transparent focus:bg-background focus:ring-1 focus:ring-ring text-sm w-[200px] transition-all"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 absolute right-1 hover:bg-transparent text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setSearchQuery('');
                  setIsSearchVisible(false);
                }}
              >
                <span className="sr-only">Close</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
              </Button>
            </div>
          ) : (
            <Button variant="ghost" size="icon" onClick={() => setIsSearchVisible(true)} className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/50">
              <Search className="h-4 w-4" />
            </Button>
          )}

          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/50">
            <Filter className="h-4 w-4" />
          </Button>

          <Button variant="ghost" size="icon" onClick={() => setGroupsManagerOpen(true)} className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/50">
            <Tags className="h-4 w-4" />
          </Button>

          <div className="flex items-center bg-muted/50 p-0.5 rounded-lg border border-border/40 ml-2">
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
              className={`h-7 px-2.5 text-xs ${viewMode === 'list' ? 'bg-background shadow-sm' : 'hover:bg-transparent'}`}
            >
              <LayoutGrid className="h-3.5 w-3.5 mr-1.5" />
              List
            </Button>
            <Button
              variant={viewMode === "board" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("board")}
              className={`h-7 px-2.5 text-xs ${viewMode === 'board' ? 'bg-background shadow-sm' : 'hover:bg-transparent'}`}
            >
              <LayoutGrid className="h-3.5 w-3.5 mr-1.5 rotate-90" />
              Board
            </Button>
          </div>

          <div className="w-[1px] h-4 bg-border/60 mx-1" />

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-8 bg-blue-600 hover:bg-blue-700 text-white shadow-sm font-medium px-3 rounded-[4px]">
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                New
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Add New Lead</DialogTitle>
                <DialogDescription>
                  Enter the details for the new contact.
                </DialogDescription>
              </DialogHeader>
              <form className="space-y-6 pt-4" onSubmit={handleSubmit}>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="first_name">First Name</Label>
                    <Input
                      id="first_name"
                      placeholder="Jane"
                      required
                      value={formData.first_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last_name">Last Name</Label>
                    <Input
                      id="last_name"
                      placeholder="Doe"
                      required
                      value={formData.last_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="jane@example.com"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+1 (555) 000-0000"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="marketing_source">Source</Label>
                  <Select
                    value={formData.marketing_source}
                    onValueChange={(val) => setFormData(prev => ({ ...prev, marketing_source: val }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select source..." />
                    </SelectTrigger>
                    <SelectContent>
                      {leadSources.map((source: any) => (
                        <SelectItem key={source.id} value={source.name}>
                          {source.label}
                        </SelectItem>
                      ))}
                      {leadSources.length === 0 && (
                        <SelectItem value="other" disabled>No sources configured</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={createContactMutation.isPending}
                >
                  {createContactMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Lead'
                  )}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Notion Table Content */}
      <div className="px-8 md:px-12 pb-12">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/30" />
          </div>
        ) : viewMode === 'board' ? (
          <ContactsKanban contacts={filteredContacts} />
        ) : filteredContacts.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm border-t border-border/40">
            No leads found.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-b border-border/40">
                <TableHead className="w-[300px] font-normal text-xs text-muted-foreground pl-4 h-9 border-r border-border/40">Aa Name</TableHead>
                <TableHead className="font-normal text-xs text-muted-foreground h-9 px-4 border-r border-border/40"># Contact</TableHead>
                <TableHead className="font-normal text-xs text-muted-foreground h-9 px-4 border-r border-border/40">Status</TableHead>
                <TableHead className="font-normal text-xs text-muted-foreground h-9 px-4 border-r border-border/40">Source</TableHead>
                <TableHead className="font-normal text-xs text-muted-foreground h-9 px-4 border-r border-border/40">Created</TableHead>
                <TableHead className="w-[50px] h-9 px-2"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContacts.map((contact) => (
                <TableRow
                  key={contact.id}
                  className="cursor-pointer hover:bg-muted/30 border-b border-border/30 transition-colors group"
                  onClick={() => navigate(`/contacts/${contact.id}`)}
                >
                  <TableCell className="pl-4 py-2 align-top border-r border-border/40">
                    <div className="flex items-center gap-2 h-full">
                      <div className="h-5 w-5 rounded bg-muted text-muted-foreground flex items-center justify-center text-[10px] font-medium shrink-0">
                        {contact.first_name?.charAt(0)}{contact.last_name?.charAt(0)}
                      </div>
                      <div className="flex flex-col justify-center">
                        <span className="text-sm font-medium text-foreground/90 border-b border-transparent group-hover:border-foreground/20 leading-tight truncate">
                          {contact.first_name} {contact.last_name}
                        </span>
                        {contact.groups && contact.groups.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {contact.groups.map((group: any) => (
                              <Badge key={group.id} variant="secondary" className="px-1 py-0 h-3.5 text-[9px] font-normal rounded-sm bg-secondary/50 text-secondary-foreground border-0">
                                {group.name}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-2 align-top text-sm border-r border-border/40">
                    <div className="flex flex-col gap-0.5 justify-center h-full">
                      {contact.primary_email && (
                        <div className="flex items-center gap-1.5 overflow-hidden">
                          <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="text-foreground/80 truncate text-xs">{contact.primary_email}</span>
                        </div>
                      )}
                      {contact.primary_phone && (
                        <div className="flex items-center gap-1.5 overflow-hidden">
                          <Phone className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="text-muted-foreground text-[10px]">{contact.primary_phone}</span>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-2 align-top border-r border-border/40">
                    <div className="flex items-center h-full">
                      {contact.current_status && getStatusBadge(contact.current_status)}
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-2 align-top border-r border-border/40">
                    <div className="flex items-center h-full">
                      <Badge variant="outline" className="font-normal text-[10px] h-5 px-1.5 bg-transparent border-border/60 text-muted-foreground">
                        {contact.marketing_source?.replace('_', ' ') || '—'}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-2 align-top text-xs text-muted-foreground border-r border-border/40">
                    <div className="flex items-center h-full">
                      {new Date(contact.created_at).toLocaleDateString("en-US", { month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric' })}
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
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem
                            onClick={() => {
                              setAssignmentContactId(contact.id);
                              setAssignmentContactName(`${contact.first_name} ${contact.last_name}`);
                            }}
                          >
                            <Tags className="h-4 w-4 mr-2" />
                            Manage Groups
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
      </div>

      <GroupsManager open={groupsManagerOpen} onOpenChange={setGroupsManagerOpen} />

      {
        assignmentContactId && (
          <ContactGroupAssignment
            contactId={assignmentContactId}
            contactName={assignmentContactName}
            open={!!assignmentContactId}
            onOpenChange={(open) => !open && setAssignmentContactId(null)}
          />
        )
      }
    </div >
  );
};

export default Contacts;
