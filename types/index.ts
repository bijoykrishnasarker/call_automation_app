export type NavigationItem = 'dashboard' | 'crm' | 'pipelines' | 'conversations' | 'calendar' | 'campaigns' | 'workflows' | 'reviews' | 'ai-center' | 'settings';

export enum ContactStatus {
  NewLead = 'New Lead',
  Contacted = 'Contacted',
  Booked = 'Booked',
  Won = 'Won',
  Lost = 'Lost'
}

export interface Note {
  id: string;
  text: string;
  createdAt: string;
  type: 'note' | 'ai-summary' | 'call-log' | 'email' | 'sms';
}

export interface Task {
  id: string;
  title: string;
  dueDate: Date;
  completed: boolean;
}

export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  tags: string[];
  status: ContactStatus;
  company?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  lastActivity: string;
  createdAt?: Date; // Added for dashboard filtering
  notes: Note[];
  tasks: Task[];
  source: string;
}

export interface PipelineStage {
  id: string;
  name: string;
  color: string;
  hasAutomation?: boolean; // New: visual indicator for stage automations
}

export interface Pipeline {
  id: string;
  name: string;
  stages: PipelineStage[];
}

export interface Deal {
  id: string;
  contactId: string;
  title: string;
  value: number;
  stageId: string;
}

export interface WorkflowNode {
  id: string;
  type: 'trigger' | 'action' | 'condition' | 'delay';
  subType?: 'sms' | 'email' | 'call' | 'review' | 'pipeline' | 'tag' | 'form' | 'tiktok' | 'stage_change'; // Added tiktok and stage_change
  label: string;
  icon?: string;
  x: number;
  y: number;
  config?: any;
}

export interface WorkflowConnection {
  id: string;
  from: string;
  to: string;
}

export interface Workflow {
  id: string;
  name: string;
  isActive: boolean;
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];
}

export interface Review {
  id: string;
  author: string;
  rating: number;
  text: string;
  source: 'Google' | 'Facebook' | 'Yelp' | 'Instagram' | 'TikTok';
  date: string;
  status: 'Replied' | 'Pending';
  reply?: string;
}

export interface Appointment {
  id: string;
  title: string;
  contactId: string;
  contactName: string;
  start: Date;
  end: Date;
  type: 'Consultation' | 'Service' | 'Checkup';
  status: 'Confirmed' | 'Pending' | 'Completed';
}

export interface Message {
  id: string;
  contactId: string;
  text: string;
  createdAt: Date;
  direction: 'inbound' | 'outbound';
  channel: 'sms' | 'email' | 'facebook' | 'instagram' | 'whatsapp' | 'tiktok' | 'call';
  read: boolean;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  type: 'alert' | 'info' | 'success';
  linkTo: NavigationItem;
  entityId?: string; // Contact ID, etc.
  subTab?: 'activity' | 'info' | 'tasks'; // Specific tab inside CRM detail
}

export interface CRMActionRequest {
  contactId: string;
  tab: 'activity' | 'info' | 'tasks';
  timestamp: number;
}

// Campaign Types
export type CampaignChannel = 'email' | 'sms' | 'push' | 'social';

export interface CampaignStats {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
}

export interface Campaign {
  id: string;
  name: string;
  status: 'Draft' | 'Scheduled' | 'Sending' | 'Completed';
  channels: CampaignChannel[];
  audienceTags: string[];
  scheduledDate?: Date;
  stats: CampaignStats;
}

// AI Specific Types
export interface AIVoiceConfig {
  enabled: boolean;
  name: string;
  voiceId: string;
  speed: number;
  businessHoursOnly: boolean;
  forwardingNumber: string;
}

export interface AIReviewConfig {
  enabled: boolean;
  autoReply5Star: boolean;
  autoReply4Star: boolean;
  delayHours: number;
}

export interface AIChatConfig {
  enabled: boolean;
  tone: 'Professional' | 'Friendly' | 'Funny' | 'Empathetic';
  knowledgeBaseFiles: string[];
}