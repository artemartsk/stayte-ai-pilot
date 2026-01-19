import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, Plus, GripVertical, Clock, MessageSquare, Phone } from 'lucide-react';
import {
  TimeWindowInput,
  WhatsAppInput,
  CallInput,
  type TimeWindow,
  type WhatsAppConfig,
  type CallConfig
} from './workflow/StepConfiguration';

export type WorkflowStep = {
  order: number;
  action: 'send_whatsapp' | 'call' | 'send_email' | 'wait' | 'create_task';
  delay_minutes: number;
  condition?: string;
  timeWindows?: TimeWindow[];
  config?: WhatsAppConfig | CallConfig;
};

type WorkflowStepEditorProps = {
  steps: WorkflowStep[];
  onChange: (steps: WorkflowStep[]) => void;
};

export const WorkflowStepEditor = ({ steps, onChange }: WorkflowStepEditorProps) => {
  const addStep = () => {
    const newStep: WorkflowStep = {
      order: steps.length + 1,
      action: 'send_whatsapp',
      delay_minutes: 0,
    };
    onChange([...steps, newStep]);
  };

  const removeStep = (index: number) => {
    const newSteps = steps.filter((_, i) => i !== index);
    // Reorder steps
    const reorderedSteps = newSteps.map((step, i) => ({ ...step, order: i + 1 }));
    onChange(reorderedSteps);
  };

  const updateStep = (index: number, field: keyof WorkflowStep, value: any) => {
    const newSteps = [...steps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    onChange(newSteps);
  };

  const updateStepConfig = (index: number, config: any) => {
    const newSteps = [...steps];
    newSteps[index] = { ...newSteps[index], config };
    onChange(newSteps);
  };

  const moveStep = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === steps.length - 1)
    ) {
      return;
    }

    const newSteps = [...steps];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newSteps[index], newSteps[targetIndex]] = [newSteps[targetIndex], newSteps[index]];

    // Update order numbers
    const reorderedSteps = newSteps.map((step, i) => ({ ...step, order: i + 1 }));
    onChange(reorderedSteps);
  };

  const getStepIcon = (action: string) => {
    switch (action) {
      case 'send_whatsapp': return <MessageSquare className="h-4 w-4" />;
      case 'call': return <Phone className="h-4 w-4" />;
      case 'wait': return <Clock className="h-4 w-4" />;
      default: return <GripVertical className="h-4 w-4" />;
    }
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-6 pt-2 snap-x">
      {steps.map((step, index) => (
        <Card key={index} className="min-w-[350px] w-[350px] shrink-0 snap-center border-l-4 border-l-primary/20 flex flex-col">
          <CardHeader className="pb-3 bg-muted/5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="p-2 bg-background rounded-md border shadow-sm">
                  {getStepIcon(step.action)}
                </div>
                <span>Step {step.order}</span>
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => moveStep(index, 'up')}
                  disabled={index === 0}
                >
                  ←
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => moveStep(index, 'down')}
                  disabled={index === steps.length - 1}
                >
                  →
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => removeStep(index)}
                  disabled={steps.length === 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 pt-6 flex-1 overflow-y-auto max-h-[70vh]">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor={`action-${index}`}>Action</Label>
                <Select
                  value={step.action}
                  onValueChange={(value) => updateStep(index, 'action', value)}
                >
                  <SelectTrigger id={`action-${index}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="send_whatsapp">Send WhatsApp</SelectItem>
                    <SelectItem value="call">Call</SelectItem>
                    <SelectItem value="send_email">Send Email</SelectItem>
                    <SelectItem value="wait">Wait</SelectItem>
                    <SelectItem value="create_task">Create Task</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`delay-${index}`}>Delay (minutes)</Label>
                <Input
                  id={`delay-${index}`}
                  type="number"
                  min="0"
                  value={step.delay_minutes}
                  onChange={(e) => updateStep(index, 'delay_minutes', parseInt(e.target.value) || 0)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={`condition-${index}`}>Condition (optional)</Label>
                <Select
                  value={step.condition || 'none'}
                  onValueChange={(value) => updateStep(index, 'condition', value === 'none' ? undefined : value)}
                >
                  <SelectTrigger id={`condition-${index}`}>
                    <SelectValue placeholder="No condition" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No condition</SelectItem>
                    <SelectItem value="no_reply">No reply</SelectItem>
                    <SelectItem value="replied">Replied</SelectItem>
                    <SelectItem value="interested">Interested</SelectItem>
                    <SelectItem value="not_interested">Not interested</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <TimeWindowInput
                value={step.timeWindows}
                onChange={(val) => updateStep(index, 'timeWindows', val)}
              />
            </div>

            {step.action === 'send_whatsapp' && (
              <WhatsAppInput
                value={step.config as WhatsAppConfig}
                onChange={(val) => updateStepConfig(index, val)}
              />
            )}

            {step.action === 'call' && (
              <CallInput
                value={step.config as CallConfig}
                onChange={(val) => updateStepConfig(index, val)}
              />
            )}
          </CardContent>
        </Card>
      ))}

      <div className="min-w-[350px] w-[350px] shrink-0 flex items-center justify-center">
        <Button onClick={addStep} variant="outline" className="h-full w-full border-dashed flex flex-col gap-2 hover:bg-muted/50">
          <Plus className="h-8 w-8" />
          <span>Add Next Step</span>
        </Button>
      </div>
    </div>
  );
};
