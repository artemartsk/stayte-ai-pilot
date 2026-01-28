import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  ArrowLeft, Mail, Phone, Building, User, Loader2, Calendar,
  MessageSquare, Eye, PhoneCall, Send, Clock, Sparkles, Briefcase, History,
  Plus, MoreHorizontal, Bed, Bath, Maximize, MapPin, Play, Pause
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { DealCard } from '../components/DealCard.tsx';
import { DealEditDialog } from '@/components/deals/DealEditDialog';
import { ChatHistory } from '@/components/chat/ChatHistory';
import { AIActionsTab } from '@/components/contacts/AIActionsTab';

const AudioPlayer = ({ src }: { src?: string }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Use provided src or a dummy placeholder for demo purposes if null
  const audioSrc = src || "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <div className="mt-1.5 flex items-center gap-3 w-full max-w-[320px] group">
      <button
        onClick={togglePlay}
        className="h-7 w-7 flex items-center justify-center rounded-full bg-foreground text-background hover:bg-foreground/90 transition-all shrink-0 shadow-sm"
      >
        {isPlaying ? <Pause className="h-3 w-3 fill-current" /> : <Play className="h-3 w-3 ml-0.5 fill-current" />}
      </button>

      <div className="flex-1 flex items-center gap-[2px] h-5 overflow-hidden opacity-80 group-hover:opacity-100 transition-opacity">
        {Array.from({ length: 30 }).map((_, i) => {
          const height = [40, 60, 45, 70, 50, 80, 40, 60, 45, 70, 40, 80, 50, 90, 45, 60, 40, 80, 40, 60, 45, 70, 40, 50][i % 24];
          return (
            <div
              key={i}
              className={`w-[3px] rounded-full shrink-0 transition-all duration-300 ${isPlaying ? 'bg-primary animate-pulse' : 'bg-muted-foreground/30'}`}
              style={{
                height: `${height}%`,
                animationDelay: `${i * 0.05}s`
              }}
            />
          );
        })}
      </div>
      <audio
        ref={audioRef}
        src={audioSrc}
        onEnded={() => setIsPlaying(false)}
        className="hidden"
      />
    </div>
  );
};

const ContactDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const defaultTab = searchParams.get("tab") || "overview";
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [editingDeal, setEditingDeal] = useState<any>(null);

  // Realtime subscription for updates
  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel('contact-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'contact_communications',
          filter: `contact_id=eq.${id}`,
        },
        () => {
          console.log('Realtime update: contact_communications');
          queryClient.invalidateQueries({ queryKey: ['contact-activities', id] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'activities',
          filter: `contact_id=eq.${id}`,
        },
        () => {
          console.log('Realtime update: activities');
          queryClient.invalidateQueries({ queryKey: ['contact-activities', id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, queryClient]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setSearchParams({ tab: value });
  };

  const { data: contact, isLoading: contactLoading } = useQuery({
    queryKey: ['contact', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('contacts').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: profile } = useQuery({
    queryKey: ['contact-profile', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('contact_profiles').select('*').eq('contact_id', id).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: deals = [] } = useQuery({
    queryKey: ['contact-deals', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('deals').select('*').eq('contact_id', id).order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  // deal_preference_profiles has been merged into deals table, no separate query needed

  const { data: availableGroups = [] } = useQuery({
    queryKey: ['contact-groups', user?.agency_id],
    queryFn: async () => {
      if (!user?.agency_id) return [];
      const { data, error } = await supabase
        .from('contact_groups')
        .select('*')
        .eq('agency_id', user.agency_id)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.agency_id,
  });

  const setGroupMutation = useMutation({
    mutationFn: async (groupId: string | null) => {
      const { error } = await supabase
        .from('contacts')
        .update({ group_id: groupId === 'no-group' ? null : groupId } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact', id] });
      toast.success('Group updated');
    },
  });

  const { data: activities = [], isLoading: activitiesLoading } = useQuery({
    queryKey: ['contact-activities', id],
    queryFn: async () => {
      // Fetch both activities and communications to merge them
      const [activitiesRes, commsRes] = await Promise.all([
        supabase.from('activities').select('*').eq('contact_id', id).order('created_at', { ascending: false }),
        supabase.from('contact_communications').select('*').eq('contact_id', id).order('created_at', { ascending: false })
      ]);

      if (activitiesRes.error) throw activitiesRes.error;
      if (commsRes.error) throw commsRes.error;

      // Transform communications to activity-like format
      const commsAsActivities = (commsRes.data || []).map((comm: any) => {
        const messageBody = comm.body || comm.payload?.transcript || comm.payload?.body || '';
        const channel = comm.channel || 'message';
        const direction = comm.direction || '';
        const status = comm.status || '';

        // Build human-readable channel name
        const channelName =
          channel === 'whatsapp' || channel === 'wa' ? 'WhatsApp' :
            channel === 'ai_call' ? 'AI Call' :
              channel === 'call' ? 'Call' :
                channel === 'email' ? 'Email' :
                  channel === 'sms' ? 'SMS' :
                    channel;

        // Build human-readable description
        let description = '';

        if (channel === 'ai_call' || channel === 'call') {
          // Check payload for additional info
          const payload = comm.payload || comm.metadata || {};
          const endedReason = payload.endedReason || payload.reason || '';
          const hasTranscript = !!payload.transcript;
          const hasRecording = !!(payload.recordingUrl || payload.recording_url || payload.stereoRecordingUrl);

          // Infer final status from payload
          let finalStatus = status;

          // Check explicit ended reason - overrides everything else
          if (['customer-did-not-answer', 'no-answer', 'silence-timed-out', 'Silence Timed Out', 'failed'].includes(endedReason)) {
            finalStatus = 'no-answer';
          } else if (['busy', 'customer-busy'].includes(endedReason)) {
            finalStatus = 'busy';
          } else if (endedReason === 'voicemail') {
            finalStatus = 'voicemail';
          } else if (status === 'sent' && (hasTranscript || hasRecording)) {
            // Only if status is still 'sent' (unknown) do we assume answer based on data
            finalStatus = 'answer';
          }

          // Call specific statuses - make outcome clear
          if (finalStatus === 'answer' || finalStatus === 'answered') {
            description = `${channelName} — Answered ✓`;
          } else if (finalStatus === 'no-answer' || finalStatus === 'no_answer' || finalStatus === 'noanswer') {
            description = `${channelName} — No Answer`;
          } else if (finalStatus === 'busy') {
            description = `${channelName} — Busy`;
          } else if (finalStatus === 'failed' || finalStatus === 'error') {
            description = `${channelName} — Failed`;
          } else if (finalStatus === 'voicemail') {
            description = `${channelName} — Voicemail`;
          } else if (finalStatus === 'sent' || finalStatus === 'initiated' || finalStatus === 'ringing') {
            description = `${channelName} (initiated, result unknown)`;
          } else if (finalStatus === 'completed') {
            description = `${channelName} — Completed`;
          } else {
            description = `${channelName} (result pending)`;
          }
        } else if (channel === 'whatsapp' || channel === 'wa') {
          // WhatsApp specific
          if (messageBody) {
            description = `${channelName}: ${messageBody.substring(0, 80)}${messageBody.length > 80 ? '...' : ''}`;
          } else if (status === 'sent' || direction === 'outbound' || direction === 'out') {
            description = `${channelName} template sent`;
          } else if (status === 'delivered') {
            description = `${channelName} delivered`;
          } else if (status === 'read') {
            description = `${channelName} read`;
          } else if (direction === 'inbound' || direction === 'in') {
            description = `${channelName} received`;
          } else {
            description = `${channelName} — ${status || 'message'}`;
          }
        } else if (channel === 'email') {
          if (messageBody) {
            description = `${channelName}: ${messageBody.substring(0, 80)}${messageBody.length > 80 ? '...' : ''}`;
          } else if (direction === 'outbound' || direction === 'out') {
            description = `${channelName} sent`;
          } else {
            description = `${channelName} received`;
          }
        } else {
          // Generic fallback
          description = messageBody
            ? messageBody.substring(0, 100) + (messageBody.length > 100 ? '...' : '')
            : `${channelName} — ${status || direction || 'communication'}`;
        }

        // Determine type for icon
        const type = channel === 'whatsapp' || channel === 'wa'
          ? (direction === 'outbound' || direction === 'out' ? 'whatsapp_sent' : 'whatsapp_received')
          : channel === 'email'
            ? (direction === 'outbound' || direction === 'out' ? 'email_sent' : 'email_received')
            : channel === 'ai_call' || channel === 'call'
              ? 'call_completed'
              : `${channel}_${direction}`;

        // Note: For calls, we computed finalStatus earlier in the if block
        // For other channels, callStatus is null
        // For calls, determine badge color based on finalStatus
        let callStatus: string | null = null;
        if (channel === 'ai_call' || channel === 'call') {
          // Re-compute finalStatus for callStatus (or we could pass it through)
          const payload = comm.payload || comm.metadata || {};
          const endedReason = payload.endedReason || payload.reason || '';
          const hasTranscript = !!payload.transcript;
          const hasRecordingForBadge = !!(payload.recordingUrl || payload.recording_url || payload.stereoRecordingUrl);

          let fs = status;

          if (['customer-did-not-answer', 'no-answer', 'silence-timed-out', 'Silence Timed Out', 'failed'].includes(endedReason)) {
            fs = 'no-answer';
          } else if (['busy', 'customer-busy'].includes(endedReason)) fs = 'busy';
          else if (endedReason === 'voicemail') fs = 'voicemail';
          else if (status === 'sent' && (hasTranscript || hasRecordingForBadge)) {
            fs = 'answer';
          }

          // Only show badge for final outcomes
          if (fs === 'answer' || fs === 'answered' || fs === 'completed') {
            callStatus = 'answered';
          } else if (fs === 'no-answer' || fs === 'no_answer' || fs === 'noanswer') {
            callStatus = 'no-answer';
          } else if (fs === 'busy') {
            callStatus = 'busy';
          } else if (fs === 'voicemail') {
            callStatus = 'voicemail';
          } else if (fs === 'failed' || fs === 'error') {
            callStatus = 'failed';
          }
          // For 'sent', 'initiated', etc. callStatus remains null = no badge
        }

        return {
          id: comm.id,
          contact_id: comm.contact_id,
          type,
          description,
          created_at: comm.created_at,
          payload: comm.metadata || comm.payload,
          source: 'communication',
          callStatus
        };
      });

      // Merge and sort by date
      const allActivities = [
        ...(activitiesRes.data || []).map((a: any) => ({ ...a, source: 'activity' })),
        ...commsAsActivities
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      // Fetch contact created_at for Lead Created entry
      const { data: contactData } = await supabase
        .from('contacts')
        .select('created_at')
        .eq('id', id)
        .single();

      // Add "Lead Created" as the earliest event
      if (contactData?.created_at) {
        allActivities.push({
          id: 'lead-created',
          contact_id: id,
          type: 'contact_created',
          description: 'Lead Created',
          created_at: contactData.created_at,
          payload: null,
          source: 'system',
          callStatus: null
        });
        // Re-sort to ensure Lead Created is in correct chronological position
        allActivities.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      }

      return allActivities;
    },
    enabled: !!id,
  });

  const { data: members = [] } = useQuery({
    queryKey: ['agency-members', contact?.agency_id],
    queryFn: async () => {
      if (!contact?.agency_id) return [];
      const { data: memberships } = await supabase.from('memberships').select('user_id').eq('agency_id', contact.agency_id).eq('active', true);
      if (!memberships) return [];
      const userIds = memberships.map(m => m.user_id);
      const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', userIds);
      return profiles || [];
    },
    enabled: !!contact?.agency_id,
  });

  const { data: selections = [] } = useQuery({
    queryKey: ['contact-selections', id],
    queryFn: async () => {
      if (deals.length === 0) return [];
      const dealIds = deals.map(d => d.id);
      const { data: batches } = await supabase.from('selection_batches').select('*').in('deal_id', dealIds).order('created_at', { ascending: false });
      if (!batches || batches.length === 0) return [];
      const batchIds = batches.map(b => b.id);
      const { data: items } = await supabase.from('selection_items').select('*').in('selection_id', batchIds).order('rank', { ascending: true });
      const itemsBySelection: Record<string, any[]> = {};
      (items || []).forEach(item => {
        if (!itemsBySelection[item.selection_id]) itemsBySelection[item.selection_id] = [];
        itemsBySelection[item.selection_id].push(item);
      });
      return batches.map(batch => ({ ...batch, items: itemsBySelection[batch.id] || [] }));
    },
    enabled: deals.length > 0,
  });

  const updateOwnerMutation = useMutation({
    mutationFn: async (newOwnerId: string) => {
      const { error } = await supabase.from('contacts').update({ owner: newOwnerId } as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact', id] });
      toast.success('Owner updated');
    },
  });

  const generateSelectionMutation = useMutation({
    mutationFn: async (dealId: string) => {
      const { data, error } = await supabase.functions.invoke('generate-selection', {
        body: { deal_id: dealId }
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.message || 'Failed to generate');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-selections', id] });
      toast.success('Подборка успешно сгенерирована');
    },
    onError: (error: any) => {
      toast.error('Ошибка генерации: ' + error.message);
    }
  });

  const { data: upcomingAction } = useQuery({
    queryKey: ['workflow-run', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('workflow_runs')
        .select('*')
        .eq('contact_id', id)
        .eq('status', 'pending')
        .gt('next_run_at', new Date().toISOString())
        .order('next_run_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!id,
  });

  if (contactLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>;
  if (!contact) return <div className="p-8 text-center text-muted-foreground">Contact not found</div>;

  return (
    <div className="min-h-screen bg-background">
      {/* Notion-style Header */}
      <div className="max-w-5xl mx-auto px-6 md:px-8 pt-10 pb-6">
        <div
          onClick={() => navigate('/contacts')}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Contacts
        </div>

        <div className="group relative">
          {/* Cover/Icon Area */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 md:h-20 md:w-20 rounded-md border border-border/50">
                <AvatarImage src={contact.avatar_url} />
                <AvatarFallback className="text-xl bg-orange-50 text-orange-600 rounded-md">
                  {contact.first_name?.[0]}{contact.last_name?.[0]}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                  {contact.first_name} {contact.last_name}
                </h1>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  {contact.primary_email && (
                    <div className="flex items-center gap-1.5 hover:text-foreground transition-colors copy-trigger cursor-pointer" onClick={() => {
                      navigator.clipboard.writeText(contact.primary_email);
                      toast.success("Email copied");
                    }}>
                      <Mail className="h-3.5 w-3.5" />
                      {contact.primary_email}
                    </div>
                  )}
                  {contact.primary_phone && (
                    <div className="flex items-center gap-1.5 hover:text-foreground transition-colors copy-trigger cursor-pointer" onClick={() => {
                      navigator.clipboard.writeText(contact.primary_phone);
                      toast.success("Phone copied");
                    }}>
                      <Phone className="h-3.5 w-3.5" />
                      {contact.primary_phone}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-8 gap-2">
                <MessageSquare className="h-3.5 w-3.5" />
                Chat
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Properties Bar */}
          <div className="flex items-center gap-6 mt-8 pb-4 border-b border-border overflow-x-auto text-sm">
            <div className="flex flex-col gap-1 min-w-[120px]">
              <span className="text-xs text-muted-foreground">Status</span>
              <Badge variant="secondary" className="w-fit rounded-sm px-2 font-normal bg-muted text-foreground">
                {contact.current_status?.replace('_', ' ') || 'New'}
              </Badge>
            </div>

            <div className="flex flex-col gap-1 min-w-[160px]">
              <span className="text-xs text-muted-foreground">Owner</span>
              <Select
                value={(contact as any).owner || ''}
                onValueChange={(value) => updateOwnerMutation.mutate(value)}
              >
                <SelectTrigger className="h-7 border-none bg-transparent p-0 -ml-1 focus:ring-0 shadow-none text-sm w-fit gap-1 hover:bg-muted/50 rounded px-1">
                  <SelectValue placeholder="No owner" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((member) => (
                    <SelectItem key={member.id} value={member.id}>{member.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1 min-w-[160px]">
              <span className="text-xs text-muted-foreground">Group</span>
              <Select
                value={(contact as any).group_id || 'no-group'}
                onValueChange={(value) => setGroupMutation.mutate(value)}
              >
                <SelectTrigger className="h-7 border-none bg-transparent p-0 -ml-1 focus:ring-0 shadow-none text-sm w-fit gap-1 hover:bg-muted/50 rounded px-1">
                  <SelectValue placeholder="No Group" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="no-group">No Group</SelectItem>
                  {availableGroups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: group.color }} />
                        {group.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {profile?.score !== undefined && (
              <div className="flex flex-col gap-1 min-w-[100px]">
                <span className="text-xs text-muted-foreground">Score</span>
                <span className="font-medium">{profile.score}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-6 md:px-8">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="bg-transparent border-b border-border w-full justify-start h-auto p-0 mb-8 rounded-none gap-6">
            <TabsTrigger
              value="overview"
              className="bg-transparent border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none px-0 py-2.5 font-normal text-muted-foreground data-[state=active]:text-foreground"
            >
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="chat"
              className="bg-transparent border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none px-0 py-2.5 font-normal text-muted-foreground data-[state=active]:text-foreground"
            >
              Chat
            </TabsTrigger>
            <TabsTrigger
              value="deals"
              className="bg-transparent border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none px-0 py-2.5 font-normal text-muted-foreground data-[state=active]:text-foreground"
            >
              Deals <span className="ml-2 text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">{deals.length}</span>
            </TabsTrigger>
            <TabsTrigger
              value="ai-actions"
              className="bg-transparent border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none px-0 py-2.5 font-normal text-muted-foreground data-[state=active]:text-foreground"
            >
              AI Actions
            </TabsTrigger>
            <TabsTrigger
              value="selections"
              className="bg-transparent border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none px-0 py-2.5 font-normal text-muted-foreground data-[state=active]:text-foreground"
            >
              Selections <span className="ml-2 text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">{selections.length}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="animate-in fade-in-50 duration-300">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
              {/* Left: Summary & Details */}
              <div className="lg:col-span-2 space-y-10">

                {/* AI Summary */}
                {profile?.summary ? (
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                      <Sparkles className="h-3.5 w-3.5" />
                      AI Analysis
                    </h3>
                    <div className="p-4 bg-muted/20 border-l-2 border-primary/20 text-sm leading-relaxed text-foreground/90 rounded-r-sm">
                      {profile.summary}
                    </div>
                  </div>
                ) : (
                  <div className="bg-muted/20 border border-dashed border-border rounded-lg p-6 text-center">
                    <p className="text-sm text-muted-foreground">No AI summary generated yet.</p>
                  </div>
                )}

                {/* Details Table */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-muted-foreground pb-2 border-b border-border">Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-12">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Nationality</span>
                      <span>{profile?.nationality || '—'}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Residence</span>
                      <span>{profile?.residence_country || '—'}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Language</span>
                      <span>{profile?.language_primary || '—'}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Job Title</span>
                      <span>{profile?.job_title || '—'}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Budget</span>
                      <span>{profile?.budget_max ? `€${profile.budget_max.toLocaleString()}` : '—'}</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Right: Activity History Timeline */}
              <div className="space-y-6">
                {upcomingAction && (
                  <div className="mb-2 p-4 bg-primary/5 border border-primary/20 rounded-lg flex items-start gap-3">
                    <div className="p-2 bg-primary/10 rounded-full text-foreground">
                      <Sparkles className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-foreground">Next Scheduled Action</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        AI will check condition at{' '}
                        <span className="font-medium text-foreground">
                          {new Date(upcomingAction.next_run_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {' '}on {new Date(upcomingAction.next_run_at).toLocaleDateString()}
                      </p>
                      <Badge variant="outline" className="mt-2 text-[10px] py-0 h-5 border-primary/20 text-primary bg-primary/5">
                        {upcomingAction.current_node_id || 'Scheduled'}
                      </Badge>
                    </div>
                  </div>
                )}

                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">History</h3>

                <div className="space-y-6 pl-2">
                  {activitiesLoading ? (
                    <div className="text-sm text-muted-foreground">Loading history...</div>
                  ) : activities.length > 0 ? (
                    activities.map((activity) => {
                      const Icon = activity.type === 'contact_created' ? Plus :
                        activity.type === 'lead_updated' ? Plus :
                          activity.type === 'call_completed' ? PhoneCall :
                            activity.type === 'email_opened' ? Eye :
                              activity.type === 'email_sent' ? Send :
                                activity.type === 'email_received' ? Mail :
                                  activity.type === 'whatsapp_sent' ? Send :
                                    activity.type === 'whatsapp_received' ? MessageSquare :
                                      activity.type === 'client_replied' ? MessageSquare : Clock;

                      const hasRecording = activity.type.includes('call') && (
                        (activity.payload as any)?.recording_url ||
                        (activity.payload as any)?.recordingUrl ||
                        (activity.payload as any)?.stereo_recording_url ||
                        (activity.payload as any)?.stereoRecordingUrl
                      );

                      return (
                        <div key={activity.id} className="relative flex gap-4 group">
                          {/* Icon Line */}
                          <div className="flex flex-col items-center">
                            <div className="h-6 w-6 rounded-full bg-muted/30 flex items-center justify-center shrink-0">
                              <Icon className="h-3 w-3 text-muted-foreground" />
                            </div>
                            {/* Connector Line (only if not last - tough in map without index, but visual hack: full height) */}
                            <div className="w-px bg-border/40 h-full mt-1 group-last:hidden"></div>
                          </div>

                          <div className="pb-6 space-y-1 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-medium text-foreground/90">
                                {activity.description || activity.type.replace(/_/g, ' ')}
                              </p>

                              {/* Status badge for calls - Minimalist text only or icon */}
                              {activity.type === 'call_completed' && activity.callStatus && (
                                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${activity.callStatus === 'answered' ? 'bg-green-500/10 text-green-700' :
                                  activity.callStatus === 'no-answer' ? 'bg-red-500/10 text-red-600' :
                                    activity.callStatus === 'busy' ? 'bg-orange-500/10 text-orange-700' :
                                      'bg-gray-100 text-gray-600'
                                  }`}>
                                  {activity.callStatus === 'answered' ? 'Answered' :
                                    activity.callStatus === 'no-answer' ? 'No Answer' :
                                      activity.callStatus === 'busy' ? 'Busy' :
                                        activity.callStatus === 'voicemail' ? 'Voicemail' :
                                          activity.callStatus}
                                </span>
                              )}
                            </div>

                            <p className="text-xs text-muted-foreground/80">
                              {new Date(activity.created_at).toLocaleDateString()} • {new Date(activity.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>

                            {hasRecording && (
                              <AudioPlayer src={
                                (activity.payload as any)?.recording_url ||
                                (activity.payload as any)?.recordingUrl ||
                                (activity.payload as any)?.stereo_recording_url ||
                                (activity.payload as any)?.stereoRecordingUrl
                              } />
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-sm text-muted-foreground italic">No recent activity</div>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="chat" className="animate-in fade-in-50 duration-300">
            <ChatHistory contactId={id || ''} agencyId={contact?.agency_id} />
          </TabsContent>

          <TabsContent value="deals" className="animate-in fade-in-50 duration-300">
            <div className="grid grid-cols-1 gap-6 w-full">
              {deals.length > 0 ? deals.map((deal) => {
                // Preferences are now directly in the deal object (merged schema)
                return (
                  <DealCard
                    key={deal.id}
                    deal={deal}
                    preferences={deal}
                    members={members}
                    onEdit={() => setEditingDeal({ deal, prefs: deal })}
                  />
                );
              }) : (
                <div className="col-span-full text-center py-10 border border-dashed border-border rounded-lg text-muted-foreground text-sm">
                  No deals created yet.
                </div>
              )}
            </div>
            {editingDeal && (
              <DealEditDialog
                open={!!editingDeal}
                onOpenChange={(open) => !open && setEditingDeal(null)}
                deal={editingDeal.deal}
                preferences={editingDeal.prefs}
                contactId={id || ''}
              />
            )}
          </TabsContent>

          <TabsContent value="ai-actions" className="animate-in fade-in-50 duration-300">
            <AIActionsTab contactId={id || ''} dealIds={deals.map(d => d.id)} />
          </TabsContent>

          <TabsContent value="selections" className="animate-in fade-in-50 duration-300">
            <div className="flex items-center justify-between mb-4">
              {/* Nurture Panel - Notion Style */}
              {deals.length > 0 && (
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400 uppercase tracking-wide">Nurture</span>
                    <button
                      onClick={async () => {
                        const deal = deals[0];
                        const newValue = !deal.nurture_enabled;
                        await supabase.from('deals').update({ nurture_enabled: newValue }).eq('id', deal.id);
                        queryClient.invalidateQueries({ queryKey: ['deals', id] });
                        toast.success(newValue ? 'Nurturing enabled' : 'Nurturing disabled');
                      }}
                      className={`relative w-8 h-4 rounded-full transition-colors ${deals[0]?.nurture_enabled ? 'bg-green-500' : 'bg-slate-200'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${deals[0]?.nurture_enabled ? 'translate-x-4' : ''}`} />
                    </button>
                  </div>
                  {deals[0]?.nurture_enabled && (
                    <>
                      <Separator orientation="vertical" className="h-4" />
                      <div className="flex items-center gap-1.5 text-slate-500">
                        <Mail className="h-3 w-3" />
                        <span>Email</span>
                      </div>
                      <Separator orientation="vertical" className="h-4" />
                      <div className="flex items-center gap-1.5 text-slate-500">
                        <Calendar className="h-3 w-3" />
                        <span>
                          {deals[0]?.nurture_day ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][deals[0].nurture_day] : 'Wed'}
                          {deals[0]?.nurture_time ? ` ${deals[0].nurture_time.slice(0, 5)}` : ' 16:00'}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              )}
              {deals.length > 0 && (
                <Button
                  variant="outline"
                  onClick={() => generateSelectionMutation.mutate(deals[0].id)}
                  disabled={generateSelectionMutation.isPending}
                  size="sm"
                  className="gap-2 h-8 text-xs font-medium border-dashed border-border hover:border-solid hover:bg-muted/50 transition-all"
                >
                  {generateSelectionMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 text-orange-500" />}
                  Generate Selection
                </Button>
              )}
            </div>
            {/* Simplified Selections View - Notion Style */}
            {selections.length > 0 ? selections.map((selection: any) => (
              <div key={selection.id} className="mb-10 group/selection">
                <div className="flex items-center gap-3 mb-4 border-b border-border/40 pb-2">
                  <h3 className="text-sm font-semibold text-foreground/80">Selection {new Date(selection.created_at).toLocaleDateString()}</h3>
                  <Badge variant="secondary" className="text-[10px] h-5 px-2 font-normal bg-muted/60 text-muted-foreground">{selection.status}</Badge>
                  <div className="ml-auto flex items-center gap-2">
                    {selection.status !== 'sent' && (
                      <>
                        <button
                          onClick={() => {
                            // Send via email
                            fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-nurture`, {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
                              },
                              body: JSON.stringify({ batch_id: selection.id, channel: 'email' })
                            }).then(res => res.json()).then(data => {
                              if (data.error) {
                                toast.error(data.error);
                              } else {
                                toast.success('Selection sent via Email!');
                                queryClient.invalidateQueries({ queryKey: ['contact-selections', id] });
                              }
                            }).catch(err => toast.error(err.message));
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                        >
                          <Mail className="w-3.5 h-3.5" />
                          Send Email
                        </button>
                        <button
                          disabled
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-muted text-muted-foreground rounded-md cursor-not-allowed opacity-50"
                          title="Coming soon"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          WhatsApp
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {selection.items?.map((item: any) => {
                    const prop = item.property_snapshot || {};
                    return (
                      <Link
                        key={item.id}
                        to={`/properties/${prop.id}`}
                        className="group block border border-border/40 hover:border-border rounded-lg overflow-hidden bg-card hover:shadow-sm transition-all duration-200"
                      >
                        <div className="aspect-[4/3] bg-muted relative overflow-hidden">
                          {prop.pictures?.[0] ? (
                            <img
                              src={prop.pictures[0]}
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                              alt={prop.name}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted-foreground bg-muted/50">
                              <Building className="h-6 w-6 opacity-20" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2 pointer-events-none">
                            <span className="text-[10px] font-medium text-white bg-black/50 px-1.5 py-0.5 rounded backdrop-blur-sm">View Details</span>
                          </div>
                        </div>
                        <div className="p-2.5">
                          <p className="text-xs font-semibold truncate text-foreground/90 transition-colors">{prop.name || 'Untitled Property'}</p>
                          <p className="text-[10px] text-muted-foreground truncate mt-0.5">{prop.address || 'No address'}</p>
                          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/30">
                            <span className="text-xs font-medium text-foreground/80">€{prop.price?.toLocaleString()}</span>
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground ml-auto">
                              <Bed className="h-3 w-3" />
                              <span>{prop.bedrooms || 0}</span>
                            </div>
                          </div>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )) : (
              <div className="text-center py-12 border border-dashed border-border rounded-lg bg-muted/5">
                <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center mx-auto mb-3">
                  <Sparkles className="h-5 w-5 text-muted-foreground/50" />
                </div>
                <p className="text-sm text-muted-foreground">No selections generated yet.</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Generate a selection to see recommendations here.</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ContactDetail;
