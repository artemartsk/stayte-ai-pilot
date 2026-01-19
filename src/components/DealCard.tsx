import React from 'react';
import {
  Sparkles, Clock, BrainCircuit,
  MapPin, Home, ListChecks, ThumbsUp, Pencil, User as UserIcon,
  BedDouble, Bath, Ruler, CheckCircle2,
  Target, Calendar as CalendarIcon, ArrowRight, Zap
} from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { Separator } from './ui/separator';
import { Database } from '../integrations/supabase/types';

type Deal = Database['public']['Tables']['deals']['Row'];
type DealPreferences = Database['public']['Tables']['deal_preference_profiles']['Row'];

interface DealCardProps {
  deal: Deal;
  preferences?: DealPreferences;
  members?: { id: string; full_name: string | null }[];
  onEdit?: () => void;
}

export const DealCard = ({ deal, preferences, members = [], onEdit }: DealCardProps) => {
  const agentName = deal.primary_agent_id
    ? members.find(m => m.id === deal.primary_agent_id)?.full_name || 'Unknown Agent'
    : 'Unassigned';

  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '—';
    return `€${value.toLocaleString()}`;
  };

  const MinimalBadge = ({ children }: { children: React.ReactNode }) => (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-secondary/50 text-secondary-foreground border border-transparent">
      {children}
    </span>
  );

  const SectionHeader = ({ icon: Icon, title }: { icon: any, title: string }) => (
    <div className="flex items-center gap-2 mb-3 text-muted-foreground">
      <Icon className="h-4 w-4" />
      <h3 className="text-xs font-semibold uppercase tracking-wider">{title}</h3>
    </div>
  );

  return (
    <div className="group w-full bg-background border border-border/40 rounded-xl p-6 hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-all duration-300">

      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-8">
        <div className="space-y-3">
          <div className="flex items-center gap-2.5">
            <Badge variant="outline" className="rounded-md font-normal text-muted-foreground border-border/60">Buy</Badge>
            <StatusBadge status={deal.status} />
            {deal.ai_hot && (
              <Badge variant="secondary" className="rounded-md bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-100/50 flex items-center gap-1 font-normal">
                <Sparkles className="h-3 w-3" /> Hot Lead
              </Badge>
            )}
            {deal.nurture_enabled && (
              <Badge variant="secondary" className="rounded-md bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-100/50 flex items-center gap-1 font-normal">
                <Zap className="h-3 w-3" /> Nurturing On
              </Badge>
            )}
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 group/title">
              <MapPin className="h-5 w-5 text-muted-foreground/70" />
              <h2 className="text-xl font-semibold tracking-tight text-foreground">
                {preferences?.city || "General Inquiry"} {preferences?.area && <span className="text-muted-foreground font-normal">• {preferences.area}</span>}
              </h2>
              {onEdit && (
                <button onClick={onEdit} className="opacity-0 group-hover/title:opacity-100 transition-opacity p-1 hover:bg-muted rounded text-muted-foreground">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-3 text-xs text-muted-foreground pl-7">
              <span>{new Date(deal.created_at).toLocaleDateString()}</span>
              <span className="text-border/60">•</span>
              <span className="font-mono opacity-60">#{deal.id.slice(0, 6)}</span>
              <span className="text-border/60">•</span>
              <div className="flex items-center gap-1.5">
                <UserIcon className="h-3 w-3" />
                {agentName}
              </div>
            </div>
          </div>
        </div>

        {/* Minimal Budget Display */}
        <div className="text-right">
          <div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider mb-1">Budget Range</div>
          <div className="text-xl font-medium tracking-tight text-foreground">
            {formatCurrency(preferences?.budget || deal.budget_min)} <span className="text-muted-foreground font-light mx-1">–</span> {formatCurrency(preferences?.max_budget || deal.budget_max)}
          </div>
        </div>
      </div>

      <Separator className="mb-8 opacity-40" />

      {/* 3-COLUMN CONTENT */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-10">

        {/* COLUMN 1: AI */}
        <div className="space-y-5">
          <SectionHeader icon={BrainCircuit} title="AI Analysis" />

          <div className="space-y-4">
            <div className="p-3 bg-muted/20 rounded-lg border border-border/30">
              <div className="flex justify-between items-end mb-2">
                <span className="text-xs font-medium text-muted-foreground">Fit Score</span>
                <span className="text-sm font-semibold">{deal.ai_hot_score || 0}<span className="text-muted-foreground font-normal text-xs">/100</span></span>
              </div>
              <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-foreground rounded-full" style={{ width: `${deal.ai_hot_score || 0}%` }} />
              </div>
            </div>

            {deal.ai_summary ? (
              <div className="relative pl-3 border-l-2 border-primary/20">
                <p className="text-sm leading-relaxed text-foreground/80 italic">
                  {deal.ai_summary}
                </p>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground italic">Awaiting AI analysis...</span>
            )}

            {deal.ai_hot && (
              <div className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Why Hot:</span> High budget, urgent timeline.
              </div>
            )}
          </div>
        </div>

        {/* COLUMN 2: REQUIREMENTS */}
        <div className="space-y-5">
          <SectionHeader icon={ListChecks} title="Requirements" />

          <div className="space-y-5">
            <div>
              <div className="text-[10px] text-muted-foreground font-medium mb-2">PROPERTY TYPE</div>
              <div className="flex flex-wrap gap-2">
                {getLocationBadges(preferences)}
                {getPropertyTypeBadges(preferences)}
              </div>
            </div>

            {(deal.must_haves?.length || 0) > 0 && (
              <div>
                <div className="text-[10px] text-emerald-600/80 font-medium mb-2 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> MUST HAVES
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {deal.must_haves?.map((m, i) => (
                    <MinimalBadge key={i}>{m}</MinimalBadge>
                  ))}
                </div>
              </div>
            )}

            {(deal.nice_to_haves?.length || 0) > 0 && (
              <div>
                <div className="text-[10px] text-amber-600/80 font-medium mb-2 flex items-center gap-1">
                  <ThumbsUp className="h-3 w-3" /> NICE TO HAVES
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {deal.nice_to_haves?.map((n, i) => (
                    <span key={i} className="inline-flex items-center px-1.5 py-0.5 text-[11px] text-muted-foreground bg-transparent border border-border/60 rounded">
                      {n}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* COLUMN 3: SPECS & FEATURES */}
        <div className="space-y-5">
          <SectionHeader icon={Home} title="Specifications" />

          <div className="grid grid-cols-2 gap-3 mb-5">
            <SpecItem label="Bedrooms" value={preferences?.bedrooms} icon={BedDouble} />
            <SpecItem label="Bathrooms" value={preferences?.bathrooms} icon={Bath} />
            <SpecItem label="Size" value={preferences?.size_sq_m ? `${preferences.size_sq_m}m²` : null} icon={Ruler} />
            <SpecItem label="Timeline" value={preferences?.timeline ? (preferences.timeline as string).replace('_', ' ') : null} icon={Clock} />
          </div>

          <div>
            <div className="text-[10px] text-muted-foreground font-medium mb-2">FEATURES</div>
            <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-sm text-foreground/80">
              {getFeatureList(preferences).map((f, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <div className="h-1 w-1 rounded-full bg-foreground/40" />
                  {f}
                </div>
              ))}
              {getFeatureList(preferences).length === 0 && <span className="text-muted-foreground">-</span>}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

// --- Helpers ---

const StatusBadge = ({ status }: { status: string | null }) => {
  const colors: Record<string, string> = {
    new: "bg-blue-50 text-blue-700 border-blue-100",
    qualified: "bg-green-50 text-green-700 border-green-100",
    hot: "bg-amber-50 text-amber-700 border-amber-100",
    lost: "bg-gray-50 text-gray-600 border-gray-100"
  };
  const colorClass = colors[status || 'new'] || "bg-gray-50 text-gray-700 border-gray-100";

  return (
    <Badge variant="secondary" className={`${colorClass} font-normal border rounded-md capitalize`}>
      {(status || 'new').replace('_', ' ')}
    </Badge>
  )
}

const SpecItem = ({ label, value, icon: Icon }: { label: string, value: any, icon: any }) => (
  <div className="flex flex-col p-2.5 rounded border border-border/30 bg-muted/5">
    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-1">
      <Icon className="h-3 w-3" /> {label}
    </div>
    <div className="font-medium text-sm text-foreground/90 pl-4.5">
      {value || <span className="text-muted-foreground/50">-</span>}
    </div>
  </div>
)

const getLocationBadges = (prefs?: DealPreferences) => {
  const locs = [];
  if (prefs?.city) locs.push(prefs.city);
  if (prefs?.area && !locs.includes(prefs.area)) locs.push(prefs.area);
  return locs.length ? locs.map((l, i) => <span key={i} className="px-1.5 py-0.5 bg-muted rounded text-[11px] font-medium">{l}</span>) : null;
}

const getPropertyTypeBadges = (prefs?: DealPreferences) => {
  const types = [];
  if (prefs?.type_villa) types.push('Villa');
  if (prefs?.type_apartment) types.push('Apartment');
  if (prefs?.subtype_penthouse) types.push('Penthouse');
  return types.length ? types.map((t, i) => <span key={i} className="px-1.5 py-0.5 border border-border rounded text-[11px] text-muted-foreground">{t}</span>) : null;
}

const getFeatureList = (prefs?: DealPreferences) => {
  const list = [];
  if (prefs?.feature_pool) list.push('Pool');
  if (prefs?.feature_sea_view) list.push('Sea View');
  if (prefs?.feature_garage) list.push('Garage');
  if (prefs?.feature_garden) list.push('Garden');
  if (prefs?.feature_gym) list.push('Gym');
  return list;
}
