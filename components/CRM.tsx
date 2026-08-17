'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Contact, ContactStatus, Note, Task, CRMActionRequest } from '@/types';
import { Search, Plus, Phone, Mail, MessageSquare, Bot, X, Sparkles, MoreHorizontal, FileText, Smartphone, PenTool, LayoutTemplate, User, MapPin, Building, Globe, Tag, CheckSquare, Square, Calendar, ArrowRight, Save, Upload, Trash2, UserPlus, BadgeCheck, Flame, UserSearch, FileX } from 'lucide-react';
import { generateContactSummary, suggestEmailDraft } from '@/services/geminiService';
import { StatCard } from '@/components/ui/StatCard';
import { FilterTabs } from '@/components/ui/FilterTabs';

interface CRMProps {
  contacts: Contact[];
  contactsLoading?: boolean;
  contactsError?: string | null;
  onClearContactsError?: () => void;
  onAddContact?: (contact: Contact) => void | Promise<Contact | null>;
  onUpdateContact?: (contact: Contact) => void | Promise<void>;
  onDeleteContact?: (contactId: string) => void | Promise<void>;
  actionRequest?: CRMActionRequest; // New Prop for Deep Linking
}

export const CRM: React.FC<CRMProps> = ({ contacts, contactsLoading, contactsError, onClearContactsError, onAddContact, onUpdateContact, onDeleteContact, actionRequest }) => {
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [activeDetailTab, setActiveDetailTab] = useState<'activity' | 'info' | 'tasks'>('activity');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Listen for deep link actions from notifications
  useEffect(() => {
    if (actionRequest) {
      const contact = contacts.find(c => c.id === actionRequest.contactId);
      if (contact) {
        setSelectedContact(contact);
        if (actionRequest.tab) {
          setActiveDetailTab(actionRequest.tab);
        }
      }
    }
  }, [actionRequest, contacts]);

  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newContact, setNewContact] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    company: '',
    status: ContactStatus.NewLead
  });

  // Task Input State
  const [newTaskTitle, setNewTaskTitle] = useState('');

  // Info Edit State
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [editedInfo, setEditedInfo] = useState<Partial<Contact>>({});

  // AI State
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiDraft, setAiDraft] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);

  // Call Log State
  const [showCallLog, setShowCallLog] = useState(false);
  const [callOutcome, setCallOutcome] = useState('Connected');
  const [callDuration, setCallDuration] = useState('');
  const [callNotes, setCallNotes] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [contactPendingDelete, setContactPendingDelete] = useState<Contact | null>(null);
  const [isSavingContact, setIsSavingContact] = useState(false);
  const [isSavingInfo, setIsSavingInfo] = useState(false);
  const [isImportingCsv, setIsImportingCsv] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const openAddContactModal = () => {
    onClearContactsError?.();
    setFormError(null);
    setIsAddModalOpen(true);
  };

  const filteredContacts = contacts.filter(c => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      c.firstName.toLowerCase().includes(q) ||
      c.lastName.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (c.company?.toLowerCase().includes(q) ?? false);
    if (!matchesSearch) return false;
    if (statusFilter === 'all') return true;
    if (statusFilter === 'closed') return c.status === ContactStatus.Won || c.status === ContactStatus.Lost;
    return c.status === statusFilter;
  });

  const statusTabs = [
    { id: 'all', label: 'All', count: contacts.length },
    { id: ContactStatus.NewLead, label: 'New Lead', count: contacts.filter(c => c.status === ContactStatus.NewLead).length },
    { id: ContactStatus.Contacted, label: 'Contacted', count: contacts.filter(c => c.status === ContactStatus.Contacted).length },
    { id: ContactStatus.Booked, label: 'Booked', count: contacts.filter(c => c.status === ContactStatus.Booked).length },
    { id: 'closed', label: 'Closed/Won', count: contacts.filter(c => c.status === ContactStatus.Won || c.status === ContactStatus.Lost).length },
    { id: ContactStatus.Lost, label: 'Lost', count: contacts.filter(c => c.status === ContactStatus.Lost).length },
  ];

  useEffect(() => {
    onClearContactsError?.();
  }, [onClearContactsError]);

  useEffect(() => {
    if (!selectedContact || isEditingInfo) return;
    const latest = contacts.find(c => c.id === selectedContact.id);
    if (latest) setSelectedContact(latest);
  }, [contacts, selectedContact?.id, isEditingInfo]);

  const requestDeleteContact = (contact: Contact, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!onDeleteContact) return;
    setDeleteError(null);
    setContactPendingDelete(contact);
  };

  const confirmDeleteContact = async () => {
    if (!contactPendingDelete || !onDeleteContact) return;
    const id = contactPendingDelete.id;
    setDeletingId(id);
    setDeleteError(null);
    try {
      await Promise.resolve(onDeleteContact(id));
      setContactPendingDelete(null);
      setSelectedContact(prev => (prev?.id === id ? null : prev));
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete contact');
    } finally {
      setDeletingId(null);
    }
  };

  const handleContactClick = (contact: Contact) => {
    setSelectedContact(contact);
    setActiveDetailTab('activity'); // Reset to default tab
    setAiSummary(null);
    setAiDraft(null);
    setShowTemplates(false);
    setShowCallLog(false);
    setIsEditingInfo(false);
  };

  const handleCreateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onAddContact || isSavingContact) return;
    if (!newContact.firstName.trim()) {
      setFormError('First name is required.');
      return;
    }

    setIsSavingContact(true);
    setFormError(null);

    const contact: Contact = {
      id: crypto.randomUUID(),
      firstName: newContact.firstName.trim(),
      lastName: newContact.lastName.trim(),
      email: newContact.email.trim(),
      phone: newContact.phone.trim(),
      company: newContact.company.trim(),
      status: newContact.status,
      tags: ['New'],
      lastActivity: 'Just now',
      source: 'Manual Entry',
      notes: [],
      tasks: []
    };

    try {
      const created = await onAddContact(contact);
      onClearContactsError?.();
      if (!created) {
        setFormError('Could not save this contact. Check the details and try again.');
        return;
      }
      setIsAddModalOpen(false);
      setNewContact({ firstName: '', lastName: '', email: '', phone: '', company: '', status: ContactStatus.NewLead });
      setSelectedContact(created);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save this contact.');
    } finally {
      setIsSavingContact(false);
    }
  };

  const updateContact = async (updates: Partial<Contact>) => {
    if (!selectedContact || !onUpdateContact) return;
    const updated = { ...selectedContact, ...updates };
    setSelectedContact(updated);
    await Promise.resolve(onUpdateContact(updated));
  };

  // --- Import Handlers ---
  const handleImportClick = () => {
    if (!onAddContact) {
      setImportMessage('Sign in to import contacts.');
      return;
    }
    onClearContactsError?.();
    setImportMessage(null);
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !onAddContact) return;

    setIsImportingCsv(true);
    setImportMessage(null);
    onClearContactsError?.();

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const lines = content.split(/\r\n|\n/);
        let startIndex = 0;
        if (lines[0]?.toLowerCase().includes('email') || lines[0]?.toLowerCase().includes('name')) {
          startIndex = 1;
        }

        let count = 0;
        let failed = 0;
        let skipped = 0;
        let lastError = '';

        for (let i = startIndex; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
          if (!cols[0]) {
            skipped++;
            continue;
          }

          const newC: Contact = {
            id: crypto.randomUUID(),
            firstName: cols[0] || 'Unknown',
            lastName: cols[1] || '',
            email: cols[2] || '',
            phone: cols[3] || '',
            company: cols[4] || '',
            tags: cols[5] ? cols[5].split(';').map(t => t.trim()) : ['Imported'],
            status: ContactStatus.NewLead,
            source: 'CSV Import',
            lastActivity: 'Just now',
            notes: [],
            tasks: []
          };

          try {
            const created = await onAddContact(newC);
            if (created) count++;
            else {
              failed++;
              lastError = 'Could not save one or more contacts.';
            }
          } catch (err) {
            failed++;
            lastError = err instanceof Error ? err.message : 'Could not save contact';
          }
        }

        if (count > 0) {
          setImportMessage(`Imported ${count} contact${count === 1 ? '' : 's'} successfully.`);
        } else if (failed > 0) {
          setImportMessage(
            lastError ||
              'Import failed. Finish account setup (onboarding) or refresh the page, then try again.'
          );
        } else {
          setImportMessage(
            skipped > 0
              ? 'No valid rows found. CSV format: First Name, Last Name, Email, Phone, Company'
              : 'CSV file is empty. Use: First Name, Last Name, Email, Phone, Company'
          );
        }
      } finally {
        setIsImportingCsv(false);
      }
    };
    reader.onerror = () => {
      setImportMessage('Could not read the CSV file.');
      setIsImportingCsv(false);
    };
    reader.readAsText(file);
    if (event.target) event.target.value = '';
  };

  // --- Task Handlers ---
  const handleToggleTask = async (taskId: string) => {
    if (!selectedContact) return;
    const tasks = (selectedContact.tasks || []).map(t => t.id === taskId ? { ...t, completed: !t.completed } : t);
    await updateContact({ tasks });
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContact || !newTaskTitle.trim()) return;
    const newTask: Task = {
      id: `task-${Date.now()}`,
      title: newTaskTitle.trim(),
      dueDate: new Date(),
      completed: false
    };
    const updatedTasks = [newTask, ...(selectedContact.tasks || [])];
    await updateContact({ tasks: updatedTasks });
    setNewTaskTitle('');
  };

  // --- Info Handlers ---
  const handleStartEditInfo = () => {
    if (!selectedContact) return;
    setEditedInfo({
      email: selectedContact.email,
      phone: selectedContact.phone,
      company: selectedContact.company,
      address: selectedContact.address,
      city: selectedContact.city,
      state: selectedContact.state,
      zip: selectedContact.zip
    });
    setIsEditingInfo(true);
  };

  const handleSaveInfo = async () => {
    if (!selectedContact || isSavingInfo) return;
    setIsSavingInfo(true);
    setFormError(null);
    try {
      await updateContact(editedInfo);
      setIsEditingInfo(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save contact details.');
    } finally {
      setIsSavingInfo(false);
    }
  };

  // --- AI Handlers ---
  const handleGenerateSummary = async () => {
    if (!selectedContact) return;
    setIsAiLoading(true);
    const summary = await generateContactSummary(selectedContact.notes, `${selectedContact.firstName} ${selectedContact.lastName}`);
    setAiSummary(summary);
    setIsAiLoading(false);
  };

  const handleGenerateDraft = async (context: string) => {
    if (!selectedContact) return;
    setIsAiLoading(true);
    const draft = await suggestEmailDraft(`${selectedContact.firstName}`, context);
    setAiDraft(draft);
    setIsAiLoading(false);
  };

  const handleUseTemplate = (content: string) => {
    setAiDraft(content);
    setShowTemplates(false);
  };

  const handleSaveCallLog = async () => {
    if (!selectedContact) return;
    const details = [
      `Outcome: ${callOutcome}`,
      callDuration.trim() ? `Duration: ${callDuration.trim()}` : null,
      callNotes.trim() || null,
    ].filter(Boolean).join('\n');
    const note: Note = {
      id: crypto.randomUUID(),
      text: details || 'Call logged.',
      createdAt: new Date().toISOString(),
      type: 'call-log',
    };
    await updateContact({
      notes: [...selectedContact.notes, note],
      lastActivity: 'Just now',
    });
    setCallNotes('');
    setCallDuration('');
    setCallOutcome('Connected');
    setShowCallLog(false);
  };

  const templates = [
    { id: '1', label: 'Booking Follow-up', content: `Hi ${selectedContact?.firstName},\n\nJust wanted to follow up on your recent booking inquiry. Do you have any questions I can help answer?\n\nBest,\nLeadOps Team` },
    { id: '2', label: 'Review Request', content: `Hi ${selectedContact?.firstName},\n\nThank you for choosing us! We'd love to hear about your experience. Could you take a moment to leave us a review?\n\nThanks,\nLeadOps Team` },
    { id: '3', label: 'Appointment Reminder', content: `Hi ${selectedContact?.firstName},\n\nThis is a friendly reminder about your upcoming appointment. We look forward to seeing you soon!\n\nRegards,\nLeadOps Team` },
    { id: '4', label: 'Missed Call Text', content: `Hi ${selectedContact?.firstName}, sorry we missed your call! How can we help you today?` }
  ];

  const getTimelineConfig = (type: Note['type']) => {
    switch (type) {
      case 'call-log':
        return {
          icon: Phone,
          iconColor: 'text-blue-600 dark:text-blue-400',
          bg: 'bg-blue-100 dark:bg-blue-900/30',
          border: 'border-blue-200 dark:border-blue-800',
          contentBg: 'bg-blue-50/50 dark:bg-blue-900/10',
          label: 'Call Log'
        };
      case 'email':
        return {
          icon: Mail,
          iconColor: 'text-amber-600 dark:text-amber-400',
          bg: 'bg-amber-100 dark:bg-amber-900/30',
          border: 'border-amber-200 dark:border-amber-800',
          contentBg: 'bg-amber-50/50 dark:bg-amber-900/10',
          label: 'Email'
        };
      case 'sms':
        return {
          icon: Smartphone,
          iconColor: 'text-emerald-600 dark:text-emerald-400',
          bg: 'bg-emerald-100 dark:bg-emerald-900/30',
          border: 'border-emerald-200 dark:border-emerald-800',
          contentBg: 'bg-emerald-50/50 dark:bg-emerald-900/10',
          label: 'SMS'
        };
      case 'ai-summary':
        return {
          icon: Sparkles,
          iconColor: 'text-purple-600 dark:text-purple-400',
          bg: 'bg-purple-100 dark:bg-purple-900/30',
          border: 'border-purple-200 dark:border-purple-800',
          contentBg: 'bg-purple-50/50 dark:bg-purple-900/10',
          label: 'AI Assistant'
        };
      case 'note':
      default:
        return {
          icon: FileText,
          iconColor: 'text-slate-500 dark:text-slate-400',
          bg: 'bg-slate-100 dark:bg-slate-800',
          border: 'border-slate-200 dark:border-slate-700',
          contentBg: 'bg-slate-50 dark:bg-slate-800/50',
          label: 'Note'
        };
    }
  };

  return (
    <div className="relative space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Leads"
          value={contacts.length}
          icon={UserSearch}
          iconClassName="bg-violet-500/10 text-violet-400 ring-1 ring-violet-500/20"
          trend="Live Sync"
          trendLabel="active CRM pipeline"
        />
        <StatCard
          title="New Leads"
          value={contacts.filter(c => c.status === ContactStatus.NewLead).length}
          icon={UserPlus}
          iconClassName="bg-violet-500/10 text-violet-400 ring-1 ring-violet-500/20"
          trend="+12%"
          trendLabel="vs last week"
        />
        <StatCard
          title="Qualified / Booked"
          value={contacts.filter(c => c.status === ContactStatus.Booked || c.status === ContactStatus.Contacted).length}
          icon={BadgeCheck}
          iconClassName="bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20"
          trend="+4%"
          trendLabel="conversion"
        />
        <StatCard
          title="Hot / Won Leads"
          value={contacts.filter(c => c.status === ContactStatus.Won).length}
          icon={Flame}
          iconClassName="bg-orange-500/10 text-orange-400 ring-1 ring-orange-500/20"
          trend="High Intent"
        />
      </div>

      {(contactsError || importMessage) && (
        <div className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-2 text-sm ${
          contactsError || importMessage?.includes('failed') || importMessage?.includes('Could not') || importMessage?.includes('Sign in')
            ? 'border-red-500/30 bg-red-500/10 text-red-400'
            : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
        }`}>
          <p>{contactsError ?? importMessage}</p>
          {(onClearContactsError || importMessage) && (
            <button
              type="button"
              onClick={() => {
                onClearContactsError?.();
                setImportMessage(null);
              }}
              aria-label="Dismiss message"
              className="rounded p-1 hover:bg-white/10"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

    <div className="relative flex min-h-[70dvh] overflow-hidden lg:h-[calc(100dvh-14rem)]">
      {/* Hidden File Input */}
      <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleFileUpload} />

      {contactsLoading ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 app-card">
          <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-zinc-500 text-sm">Loading contacts...</p>
        </div>
      ) : (
      <>
      {/* List View */}
      <div className={`flex min-w-0 flex-1 flex-col overflow-hidden app-card shadow-sm transition-all ${selectedContact ? 'hidden md:flex' : 'flex'}`}>
        <div className="flex flex-col gap-3 border-b border-white/[0.06] bg-[#111214] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 w-4 h-4" />
            <input
              type="text"
              placeholder="Search leads by name, email, or company..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-[#0B0C0E] border border-white/[0.08] rounded-xl text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 placeholder:text-zinc-500 transition-shadow"
            />
          </div>
          <div className="flex flex-wrap gap-2 sm:ml-4 sm:justify-end">
            <button
              onClick={handleImportClick}
              disabled={isImportingCsv}
              className="flex items-center gap-2 px-3 py-2.5 bg-[#141416] border border-white/[0.08] text-zinc-400 hover:bg-white/[0.04] rounded-xl text-sm font-semibold transition-colors active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
              title="Import CSV"
            >
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">{isImportingCsv ? 'Importing…' : 'Import CSV'}</span>
            </button>
            <button
              type="button"
              onClick={openAddContactModal}
              className="flex items-center gap-2 px-4 py-2.5 bg-violet-500 text-white rounded-xl text-sm font-semibold hover:bg-violet-400 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New Lead</span>
            </button>
          </div>
        </div>

        <div className="border-b border-white/[0.06] px-4 py-3">
          <FilterTabs tabs={statusTabs} activeId={statusFilter} onChange={setStatusFilter} />
        </div>

        <div className="surface-scroll flex-1 overflow-y-auto">
          <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
            {filteredContacts.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <div className="mx-auto flex max-w-sm flex-col items-center justify-center gap-2">
                  <FileX className="h-10 w-10 text-zinc-600" />
                  <p className="font-medium text-zinc-200">No leads found</p>
                  <p className="text-sm text-zinc-500">Try adjusting your search query or add a new lead.</p>
                  {contacts.length === 0 && (
                    <button
                      type="button"
                      onClick={openAddContactModal}
                      className="mt-2 inline-flex items-center gap-2 rounded-lg bg-violet-500 px-4 py-2 text-sm font-medium text-white hover:bg-violet-400"
                    >
                      <Plus className="h-4 w-4" />
                      New Lead
                    </button>
                  )}
                </div>
              </div>
            ) : (
              filteredContacts.map((contact) => (
                <div key={contact.id} className="relative px-4 py-4">
                  <button
                    type="button"
                    onClick={() => handleContactClick(contact)}
                    className={`w-full rounded-xl border p-4 text-left transition-colors ${selectedContact?.id === contact.id ? 'border-violet-500/30 bg-violet-500/10' : 'border-white/[0.06] bg-[#141416] hover:border-violet-500/20 hover:bg-white/[0.03]'}`}
                  >
                    <div className="flex items-start justify-between gap-3 pr-8">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-white">{contact.firstName} {contact.lastName}</p>
                        <p className="mt-1 truncate text-sm text-zinc-500">{contact.email}</p>
                        <p className="mt-1 text-sm text-zinc-500">{contact.phone}</p>
                        <p className="mt-2 text-xs text-zinc-500">{contact.company || 'Individual'} · {contact.lastActivity}</p>
                      </div>
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${contact.status === ContactStatus.NewLead ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : contact.status === ContactStatus.Won ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : contact.status === ContactStatus.Lost ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}>
                        {contact.status}
                      </span>
                    </div>
                  </button>
                  {onDeleteContact && (
                    <button
                      type="button"
                      onClick={e => requestDeleteContact(contact, e)}
                      disabled={deletingId === contact.id}
                      className="absolute right-7 top-7 inline-flex rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950/40"
                      aria-label={`Delete ${contact.firstName} ${contact.lastName}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          <table className="hidden w-full text-left text-sm md:table">
            <thead className="bg-[#111214] text-zinc-500 text-xs font-semibold uppercase tracking-wide border-b border-white/[0.06] sticky top-0 z-10">
              <tr>
                <th className="px-6 py-3">Lead Name</th>
                <th className="px-6 py-3 hidden lg:table-cell">Company</th>
                <th className="px-6 py-3 hidden sm:table-cell">Email & Phone</th>
                <th className="px-6 py-3 hidden xl:table-cell">Status</th>
                <th className="px-6 py-3 hidden 2xl:table-cell">Source</th>
                <th className="px-6 py-3 w-14 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {filteredContacts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                      <FileX className="h-10 w-10 text-zinc-600" />
                      <p className="text-zinc-200 font-medium">No leads found</p>
                      <p className="text-zinc-500 text-sm">Try adjusting your search query or add a new lead.</p>
                      {contacts.length === 0 && (
                        <button
                          type="button"
                          onClick={openAddContactModal}
                          className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-violet-500 text-white rounded-lg text-sm font-medium hover:bg-violet-400"
                        >
                          <Plus className="w-4 h-4" />
                          New Lead
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredContacts.map(contact => (
                  <tr
                    key={contact.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleContactClick(contact)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleContactClick(contact);
                      }
                    }}
                    className={`hover:bg-violet-500/5 cursor-pointer transition-colors ${selectedContact?.id === contact.id ? 'bg-violet-500/10' : ''}`}
                  >
                    <td className="px-6 py-4">
                      <div className="font-semibold text-white">{contact.firstName} {contact.lastName}</div>
                    </td>
                    <td className="px-6 py-4 hidden lg:table-cell text-zinc-400 text-sm">
                      {contact.company || '—'}
                    </td>
                    <td className="px-6 py-4 hidden sm:table-cell text-zinc-400 text-sm">
                      <div>{contact.email}</div>
                      <div className="text-xs text-zinc-500">{contact.phone}</div>
                    </td>
                    <td className="px-6 py-4 hidden xl:table-cell">
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium 
                        ${contact.status === ContactStatus.NewLead ? 'bg-blue-500/15 text-blue-300' :
                          contact.status === ContactStatus.Won ? 'bg-emerald-500/15 text-emerald-300' :
                            contact.status === ContactStatus.Lost ? 'bg-red-500/15 text-red-300' :
                              'bg-zinc-800 text-zinc-300'}`}>
                        {contact.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 hidden 2xl:table-cell text-zinc-500 text-sm">
                      {contact.source || 'Direct'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {onDeleteContact && (
                        <button
                          type="button"
                          onClick={e => requestDeleteContact(contact, e)}
                          disabled={deletingId === contact.id}
                          className="inline-flex p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                          title="Delete contact"
                          aria-label={`Delete ${contact.firstName} ${contact.lastName}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Slide-over */}
      {selectedContact && (
        <div className="absolute inset-0 z-20 flex w-full flex-col border-l border-white/[0.06] bg-[#141416] shadow-xl transition-colors animate-slide-in-right md:static md:w-[400px] lg:w-[450px]">
          <div className="p-4 border-b border-white/[0.06] flex justify-between items-start bg-[#111214]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 flex items-center justify-center font-bold text-lg border border-violet-200 dark:border-violet-800 animate-pop-in">
                {selectedContact.firstName[0]}{selectedContact.lastName[0]}
              </div>
              <div>
                <h3 className="font-bold text-slate-800 dark:text-slate-100">{selectedContact.firstName} {selectedContact.lastName}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">{selectedContact.company || 'Individual'}</p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {onDeleteContact && (
                <button
                  type="button"
                  onClick={e => requestDeleteContact(selectedContact, e)}
                  disabled={deletingId === selectedContact.id}
                  className="p-2 hover:bg-red-50 dark:hover:bg-red-950/30 rounded text-slate-400 hover:text-red-600 transition-colors disabled:opacity-50"
                  title="Delete contact"
                  aria-label="Delete contact"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
              <button onClick={() => setSelectedContact(null)} aria-label="Close contact details" className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-500 dark:text-slate-400 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex border-b border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setActiveDetailTab('activity')}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${activeDetailTab === 'activity' ? 'text-violet-600 dark:text-violet-500 border-b-2 border-violet-500 bg-violet-50/50 dark:bg-violet-900/10' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
            >
              Activity
            </button>
            <button
              onClick={() => setActiveDetailTab('info')}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${activeDetailTab === 'info' ? 'text-violet-600 dark:text-violet-500 border-b-2 border-violet-500 bg-violet-50/50 dark:bg-violet-900/10' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
            >
              Info
            </button>
            <button
              onClick={() => setActiveDetailTab('tasks')}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${activeDetailTab === 'tasks' ? 'text-violet-600 dark:text-violet-500 border-b-2 border-violet-500 bg-violet-50/50 dark:bg-violet-900/10' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
            >
              Tasks {selectedContact.tasks?.filter(t => !t.completed).length > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900 text-[10px] font-bold text-violet-700 dark:text-violet-400 animate-pulse">{selectedContact.tasks.filter(t => !t.completed).length}</span>}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* ACTIVITY TAB CONTENT */}
            {activeDetailTab === 'activity' && (
              <>
                {!showCallLog && (
                  <div className="bg-gradient-to-br from-violet-50 to-emerald-50 dark:from-slate-800 dark:to-slate-900 rounded-xl p-4 border border-violet-100 dark:border-slate-700 shadow-sm animate-fade-in">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="w-4 h-4 text-violet-600 dark:text-violet-500" />
                      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">AI Employee Assistant</h4>
                    </div>

                    {!aiSummary && !aiDraft && !isAiLoading && !showTemplates && (
                      <div className="space-y-3">
                        <button
                          onClick={handleGenerateSummary}
                          className="w-full py-3 px-4 bg-violet-600 hover:bg-violet-700 text-white rounded-xl flex items-center justify-center gap-2 shadow-md transition-all font-bold transform active:scale-95 hover:shadow-lg">
                          <Sparkles className="w-5 h-5" />
                          Generate Timeline Summary
                        </button>

                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => handleGenerateDraft('Follow up on booking')}
                            className="p-3 bg-white dark:bg-slate-800 hover:bg-violet-50 dark:hover:bg-slate-700 border border-violet-200 dark:border-slate-600 rounded-lg text-left transition-all active:scale-95 group h-full hover:border-violet-400">
                            <span className="flex items-center gap-1.5 text-xs font-semibold text-violet-700 dark:text-violet-400 group-hover:text-violet-800 dark:group-hover:text-violet-300 mb-1">
                              <PenTool className="w-3 h-3" />
                              Draft Follow-up
                            </span>
                            <span className="block text-[10px] text-slate-500 dark:text-slate-400">Suggest email reply</span>
                          </button>
                          <button
                            onClick={() => setShowTemplates(true)}
                            className="p-3 bg-white dark:bg-slate-800 hover:bg-violet-50 dark:hover:bg-slate-700 border border-violet-200 dark:border-slate-600 rounded-lg text-left transition-all active:scale-95 group h-full hover:border-violet-400">
                            <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 group-hover:text-violet-700 dark:group-hover:text-violet-400 mb-1">
                              <LayoutTemplate className="w-3 h-3" />
                              Use Template
                            </span>
                            <span className="block text-[10px] text-slate-500 dark:text-slate-400">Pre-written responses</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {showTemplates && (
                      <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-violet-200 dark:border-slate-600 shadow-sm animate-pop-in">
                        <div className="flex justify-between items-center mb-2 pb-2 border-b border-slate-100 dark:border-slate-700">
                          <h5 className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                            <LayoutTemplate className="w-3 h-3 text-violet-600 dark:text-violet-500" /> Select Template
                          </h5>
                          <button onClick={() => setShowTemplates(false)} className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">Cancel</button>
                        </div>
                        <div className="space-y-1 max-h-48 overflow-y-auto">
                          {templates.map(t => (
                            <button
                              key={t.id}
                              onClick={() => handleUseTemplate(t.content)}
                              className="w-full text-left px-3 py-2 text-xs text-slate-600 dark:text-slate-300 hover:bg-violet-50 dark:hover:bg-slate-700 hover:text-violet-700 dark:hover:text-violet-400 rounded-md transition-colors truncate border border-transparent hover:border-violet-100 dark:hover:border-slate-600"
                            >
                              {t.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {isAiLoading && (
                      <div className="flex items-center justify-center py-6 text-violet-600 dark:text-violet-400">
                        <Bot className="w-6 h-6 animate-bounce mr-2" />
                        <span className="text-sm font-medium">Thinking...</span>
                      </div>
                    )}

                    {aiSummary && (
                      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-violet-200 dark:border-slate-600 shadow-sm animate-fade-in">
                        <div className="flex items-center gap-2 mb-2 text-violet-700 dark:text-violet-400 font-semibold text-xs uppercase tracking-wider">
                          <Sparkles className="w-3 h-3" />
                          AI Summary
                        </div>
                        <p className="text-sm text-slate-700 dark:text-slate-300 italic leading-relaxed mb-3">"{aiSummary}"</p>
                        <button onClick={() => setAiSummary(null)} className="w-full py-2 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-medium bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-lg transition-colors">Dismiss Summary</button>
                      </div>
                    )}

                    {aiDraft && (
                      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-violet-200 dark:border-slate-600 shadow-sm animate-fade-in">
                        <div className="flex items-center gap-2 mb-2 text-violet-700 dark:text-violet-400 font-semibold text-xs uppercase tracking-wider">
                          <PenTool className="w-3 h-3" />
                          Email Draft
                        </div>
                        <textarea
                          value={aiDraft}
                          onChange={(e) => setAiDraft(e.target.value)}
                          className="w-full mb-4 text-xs font-sans text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-700 leading-relaxed whitespace-pre-wrap h-32 focus:outline-none focus:ring-1 focus:ring-violet-500 resize-none"
                        />
                        <div className="flex gap-2">
                          <button className="flex-1 py-2 bg-violet-600 text-white rounded-lg text-xs font-bold hover:bg-violet-700 transition-colors shadow-sm flex items-center justify-center gap-2 active:scale-95">
                            <Mail className="w-3 h-3" />
                            Send Email
                          </button>
                          <button onClick={() => setShowTemplates(true)} className="px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 font-medium whitespace-nowrap active:scale-95">
                            Change Template
                          </button>
                          <button onClick={() => setAiDraft(null)} className="px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 font-medium active:scale-95">
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Quick Actions */}
                <div className="flex gap-2 justify-center py-2">
                  <button
                    onClick={() => setShowCallLog(!showCallLog)}
                    className={`flex flex-col items-center gap-1 p-2 w-16 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-all active:scale-95 ${showCallLog ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 ring-2 ring-blue-100 dark:ring-blue-900' : ''}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${showCallLog ? 'bg-blue-600 text-white' : 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300'}`}>
                      <Phone className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-medium">Call</span>
                  </button>
                  <button className="flex flex-col items-center gap-1 p-2 w-16 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-all active:scale-95">
                    <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-300 flex items-center justify-center"><MessageSquare className="w-4 h-4" /></div>
                    <span className="text-[10px]">SMS</span>
                  </button>
                  <button className="flex flex-col items-center gap-1 p-2 w-16 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-all active:scale-95">
                    <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300 flex items-center justify-center"><Mail className="w-4 h-4" /></div>
                    <span className="text-[10px]">Email</span>
                  </button>
                </div>

                {/* Call Log Form */}
                {showCallLog && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-100 dark:border-blue-800/50 mb-4 animate-pop-in shadow-sm">
                    <div className="flex justify-between items-center mb-3">
                      <h5 className="text-sm font-bold text-blue-800 dark:text-blue-300 flex items-center gap-2">
                        <Phone className="w-4 h-4" /> Log Call Details
                      </h5>
                      <button onClick={() => setShowCallLog(false)}><X className="w-4 h-4 text-blue-400 dark:text-blue-300 hover:text-blue-600" /></button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-1 block">Outcome</label>
                        <select
                          value={callOutcome}
                          onChange={(e) => setCallOutcome(e.target.value)}
                          className="w-full text-xs border border-blue-200 dark:border-blue-700/50 rounded-lg p-2 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                        >
                          <option>Connected</option>
                          <option>No Answer</option>
                          <option>Left Voicemail</option>
                          <option>Busy</option>
                          <option>Wrong Number</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-1 block">Duration</label>
                        <input
                          type="text"
                          placeholder="e.g. 5m 30s"
                          value={callDuration}
                          onChange={(e) => setCallDuration(e.target.value)}
                          className="w-full text-xs border border-blue-200 dark:border-blue-700/50 rounded-lg p-2 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="mb-3">
                      <label className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-1 block">Notes</label>
                      <textarea
                        placeholder="Discussed requirements..."
                        value={callNotes}
                        onChange={(e) => setCallNotes(e.target.value)}
                        className="w-full text-xs border border-blue-200 dark:border-blue-700/50 rounded-lg p-2 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 h-20 focus:ring-blue-500 focus:border-blue-500 resize-none focus:outline-none"
                      />
                    </div>

                    <div className="flex justify-end gap-2">
                      <button onClick={() => setShowCallLog(false)} className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors active:scale-95">Cancel</button>
                      <button onClick={handleSaveCallLog} className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors active:scale-95">Save Log</button>
                    </div>
                  </div>
                )}

                {/* Timeline */}
                <div className="space-y-6 pt-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Activity History</h4>
                    <button className="text-[10px] text-violet-600 dark:text-violet-500 font-medium hover:underline">View All</button>
                  </div>

                  <div className="relative">
                    {selectedContact.notes.map((note, index) => {
                      const config = getTimelineConfig(note.type);
                      const Icon = config.icon;
                      return (
                        <div key={note.id} className="flex gap-4 relative pb-6 last:pb-0 group animate-fade-in" style={{ animationDelay: `${index * 100}ms` }}>
                          {/* Connector Line */}
                          {index !== selectedContact.notes.length - 1 && (
                            <div className="absolute left-[19px] top-10 bottom-0 w-0.5 bg-slate-200 dark:bg-slate-700 group-last:hidden"></div>
                          )}

                          <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center border-2 z-10 shadow-sm ${config.bg} ${config.border} ${config.iconColor}`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className={`p-4 rounded-xl border ${config.contentBg} ${config.border} relative transition-transform hover:scale-[1.02]`}>
                              {/* Arrow pointing to icon */}
                              <div className={`absolute top-3 -left-1.5 w-3 h-3 border-l border-b ${config.contentBg} ${config.border} transform rotate-45`}></div>

                              <div className="flex justify-between items-start mb-1">
                                <span className={`text-xs font-bold uppercase tracking-wider ${config.iconColor}`}>{config.label}</span>
                                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium bg-white/50 dark:bg-black/20 px-1.5 py-0.5 rounded">{note.createdAt}</span>
                              </div>
                              <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">{note.text}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* INFO TAB CONTENT */}
            {activeDetailTab === 'info' && (
              <div className="space-y-6 animate-fade-in">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">Contact Details</h4>
                  {!isEditingInfo ? (
                    <button onClick={handleStartEditInfo} className="text-xs text-violet-600 dark:text-violet-500 hover:underline">Edit Info</button>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setIsEditingInfo(false)}
                        disabled={isSavingInfo}
                        className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleSaveInfo()}
                        disabled={isSavingInfo}
                        className="text-xs text-violet-600 dark:text-violet-500 font-bold hover:text-violet-700 flex items-center gap-1 active:scale-95 transition-transform disabled:opacity-50"
                      >
                        <Save className="w-3 h-3" /> {isSavingInfo ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                  )}
                </div>

                {isEditingInfo && formError && (
                  <p className="text-sm font-medium text-red-400">{formError}</p>
                )}
                <div className="grid grid-cols-1 gap-4">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800 transition-colors hover:border-slate-300">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1 flex items-center gap-1"><Mail className="w-3 h-3" /> Email</label>
                    {isEditingInfo ? (
                      <input value={editedInfo.email || ''} onChange={e => setEditedInfo({ ...editedInfo, email: e.target.value })} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-sm" />
                    ) : (
                      <div className="text-sm text-slate-700 dark:text-slate-200 font-medium">{selectedContact.email}</div>
                    )}
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800 transition-colors hover:border-slate-300">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1 flex items-center gap-1"><Phone className="w-3 h-3" /> Phone</label>
                    {isEditingInfo ? (
                      <input value={editedInfo.phone || ''} onChange={e => setEditedInfo({ ...editedInfo, phone: e.target.value })} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-sm" />
                    ) : (
                      <div className="text-sm text-slate-700 dark:text-slate-200 font-medium">{selectedContact.phone}</div>
                    )}
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800 transition-colors hover:border-slate-300">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1 flex items-center gap-1"><Building className="w-3 h-3" /> Company</label>
                    {isEditingInfo ? (
                      <input value={editedInfo.company || ''} onChange={e => setEditedInfo({ ...editedInfo, company: e.target.value })} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-sm" />
                    ) : (
                      <div className="text-sm text-slate-700 dark:text-slate-200 font-medium">{selectedContact.company || 'N/A'}</div>
                    )}
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800 transition-colors hover:border-slate-300">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1 flex items-center gap-1"><MapPin className="w-3 h-3" /> Address</label>
                    {isEditingInfo ? (
                      <div className="space-y-2">
                        <input placeholder="Street" value={editedInfo.address || ''} onChange={e => setEditedInfo({ ...editedInfo, address: e.target.value })} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-sm" />
                        <div className="flex gap-2">
                          <input placeholder="City" value={editedInfo.city || ''} onChange={e => setEditedInfo({ ...editedInfo, city: e.target.value })} className="w-1/2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-sm" />
                          <input placeholder="State" value={editedInfo.state || ''} onChange={e => setEditedInfo({ ...editedInfo, state: e.target.value })} className="w-1/4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-sm" />
                          <input placeholder="Zip" value={editedInfo.zip || ''} onChange={e => setEditedInfo({ ...editedInfo, zip: e.target.value })} className="w-1/4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-sm" />
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-slate-700 dark:text-slate-200 font-medium">
                        {selectedContact.address ? (
                          <>
                            {selectedContact.address}<br />
                            {selectedContact.city}, {selectedContact.state} {selectedContact.zip}
                          </>
                        ) : 'No address on file'}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-2 block">Tags</label>
                  <div className="flex flex-wrap gap-2">
                    {selectedContact.tags.map(tag => (
                      <span key={tag} className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1 hover:border-violet-500 cursor-default transition-colors">
                        <Tag className="w-3 h-3" /> {tag}
                      </span>
                    ))}
                    <button className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 border border-transparent hover:border-slate-300 dark:hover:border-slate-600 transition-colors flex items-center gap-1 active:scale-95">
                      <Plus className="w-3 h-3" /> Add
                    </button>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex justify-between text-xs text-slate-400 dark:text-slate-500">
                    <span>Source: <strong className="text-slate-600 dark:text-slate-400">{selectedContact.source}</strong></span>
                    <span>ID: #{selectedContact.id.substring(0, 6)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* TASKS TAB CONTENT */}
            {activeDetailTab === 'tasks' && (
              <div className="space-y-4 animate-fade-in">
                <div className="flex items-center gap-2 mb-2">
                  <CheckSquare className="w-4 h-4 text-violet-600" />
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">Pending Tasks</h4>
                </div>

                <form onSubmit={handleAddTask} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Add a new task..."
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!newTaskTitle.trim()}
                    className="bg-violet-600 hover:bg-violet-700 text-white rounded-lg px-3 py-2 transition-all disabled:opacity-50 active:scale-95"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </form>

                <div className="space-y-2">
                  {(selectedContact.tasks || []).length === 0 && (
                    <div className="text-center py-8 text-slate-400 text-xs italic">
                      No tasks yet. Add one above!
                    </div>
                  )}
                  {(selectedContact.tasks || []).sort((a, b) => Number(a.completed) - Number(b.completed)).map(task => (
                    <div
                      key={task.id}
                      className={`group flex items-center gap-3 p-3 rounded-lg border transition-all duration-300 ${task.completed ? 'bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800 opacity-60' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md hover:-translate-y-0.5'}`}
                    >
                      <button
                        onClick={() => handleToggleTask(task.id)}
                        className={`flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-all ${task.completed ? 'bg-violet-500 border-violet-500 text-white scale-110' : 'border-slate-300 dark:border-slate-600 hover:border-violet-500 text-transparent hover:scale-105'}`}
                      >
                        <CheckSquare className="w-3.5 h-3.5 fill-current" />
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate transition-all ${task.completed ? 'line-through text-slate-500' : 'text-slate-800 dark:text-slate-200'}`}>{task.title}</p>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400">
                          <Calendar className="w-3 h-3" />
                          <span>{task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No Date'}</span>
                        </div>
                      </div>
                      <button className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-opacity active:scale-95">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete contact confirmation */}
      {contactPendingDelete && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-contact-title"
          onClick={() => !deletingId && setContactPendingDelete(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 w-full max-w-md rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-pop-in"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-start p-4 border-b border-slate-100 dark:border-slate-800 bg-red-50/80 dark:bg-red-950/20">
              <div className="flex gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="delete-contact-title" className="font-bold text-slate-800 dark:text-slate-100">
                    Delete contact?
                  </h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {`${contactPendingDelete.firstName} ${contactPendingDelete.lastName}`.trim() || 'This contact'}
                    </span>{' '}
                    will be permanently removed. Related deals and appointments will also be deleted. This cannot be undone.
                  </p>
                  {deleteError && (
                    <p className="mt-2 text-sm font-medium text-red-500">{deleteError}</p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => !deletingId && setContactPendingDelete(null)}
                disabled={!!deletingId}
                className="shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors disabled:opacity-50"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 flex gap-3 justify-end border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
              <button
                type="button"
                onClick={() => setContactPendingDelete(null)}
                disabled={!!deletingId}
                className="px-4 py-2.5 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:scale-95 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmDeleteContact()}
                disabled={deletingId === contactPendingDelete.id}
                className="px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 transition-colors shadow-sm active:scale-95 disabled:opacity-60 inline-flex items-center gap-2"
              >
                {deletingId === contactPendingDelete.id ? (
                  <>
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Deleting…
                  </>
                ) : (
                  'Delete contact'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Contact Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="add-contact-title">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-pop-in max-h-[90dvh] overflow-y-auto">
            <div className="flex justify-between items-center p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
              <h3 id="add-contact-title" className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <User className="w-4 h-4 text-violet-600" /> New Contact
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} aria-label="Close add contact dialog" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateContact} noValidate className="p-6 space-y-4">
              {formError && <p className="text-sm font-medium text-red-500">{formError}</p>}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="new-contact-first-name" className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">First Name</label>
                  <input
                    id="new-contact-first-name"
                    required
                    type="text"
                    value={newContact.firstName}
                    onChange={e => setNewContact({ ...newContact, firstName: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-violet-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="new-contact-last-name" className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Last Name</label>
                  <input
                    id="new-contact-last-name"
                    type="text"
                    value={newContact.lastName}
                    onChange={e => setNewContact({ ...newContact, lastName: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-violet-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="new-contact-email" className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Email</label>
                <input
                  id="new-contact-email"
                  type="text"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={newContact.email}
                  onChange={e => setNewContact({ ...newContact, email: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-violet-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="new-contact-phone" className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Phone</label>
                  <input
                    id="new-contact-phone"
                    type="tel"
                    value={newContact.phone}
                    onChange={e => setNewContact({ ...newContact, phone: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-violet-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="new-contact-company" className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Company</label>
                  <input
                    id="new-contact-company"
                    type="text"
                    value={newContact.company}
                    onChange={e => setNewContact({ ...newContact, company: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-violet-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-2.5 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors active:scale-95"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingContact}
                  className="flex-1 py-2.5 bg-violet-600 text-white rounded-lg text-sm font-bold hover:bg-violet-700 transition-colors shadow-sm active:scale-95 disabled:opacity-60"
                >
                  {isSavingContact ? 'Saving…' : 'Create Contact'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </>
      )}
    </div>
    </div>
  );
};
