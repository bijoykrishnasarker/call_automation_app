'use client';

import React, { useState, useRef, MouseEvent, useEffect } from 'react';
import { Deal, Pipeline as PipelineType } from '@/types';
import { useApp } from '@/contexts/AppContext';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { MoreHorizontal, GripVertical, Plus, Settings, Trash2, Check, Layout, ChevronDown, Zap, DollarSign, X, Briefcase, Headphones, Users, PenTool, Loader2 } from 'lucide-react';
import { formatContactOption } from '@/lib/contacts/format-contact-option';

// Simple particle for confetti
interface Particle {
    id: number;
    x: number;
    y: number;
    color: string;
    rotation: number;
}

const PIPELINE_TEMPLATES = [
    {
        id: 'sales',
        label: 'Sales CRM',
        icon: Briefcase,
        description: 'Track leads from initial contact to closed deal.',
        stages: [
            { name: 'New Lead', color: 'bg-blue-500' },
            { name: 'Qualified', color: 'bg-indigo-500' },
            { name: 'Proposal', color: 'bg-purple-500' },
            { name: 'Negotiation', color: 'bg-orange-500' },
            { name: 'Won', color: 'bg-green-600', hasAutomation: true },
            { name: 'Lost', color: 'bg-red-500' }
        ]
    },
    {
        id: 'service',
        label: 'Service Tickets',
        icon: Headphones,
        description: 'Manage support requests and issue resolution.',
        stages: [
            { name: 'New Ticket', color: 'bg-red-500' },
            { name: 'Triaged', color: 'bg-orange-500' },
            { name: 'In Progress', color: 'bg-blue-500' },
            { name: 'Waiting on Client', color: 'bg-amber-500' },
            { name: 'Resolved', color: 'bg-green-600', hasAutomation: true }
        ]
    },
    {
        id: 'hiring',
        label: 'Recruitment',
        icon: Users,
        description: 'Track candidates through the interview process.',
        stages: [
            { name: 'Applied', color: 'bg-slate-500' },
            { name: 'Screening', color: 'bg-blue-500' },
            { name: 'Interview', color: 'bg-indigo-500' },
            { name: 'Offer Sent', color: 'bg-violet-500' },
            { name: 'Hired', color: 'bg-green-600', hasAutomation: true }
        ]
    },
    {
        id: 'custom',
        label: 'Blank / Custom',
        icon: PenTool,
        description: 'Start from scratch with a basic 3-step workflow.',
        stages: [
            { name: 'To Do', color: 'bg-slate-500' },
            { name: 'Doing', color: 'bg-blue-500' },
            { name: 'Done', color: 'bg-green-600', hasAutomation: true }
        ]
    }
];

export const Pipeline: React.FC = () => {
    const {
        pipelines,
        deals,
        contacts,
        pipelinesLoading,
        pipelinesError,
        addDeal,
        updateDeal,
        createPipeline,
        addStage,
        updateStage,
        deleteStage,
        dealTemplates,
        createDealTemplate,
        updateDealTemplate,
        deleteDealTemplate,
    } = useApp();
    const isCompactLayout = useMediaQuery('(max-width: 1023px)');

    const [activePipelineId, setActivePipelineId] = useState<string>('');
    const [isEditMode, setIsEditMode] = useState(false);
    const [isEditStagesOpen, setIsEditStagesOpen] = useState(false);
    const [newStageName, setNewStageName] = useState('');
    const [stageSaveError, setStageSaveError] = useState<string | null>(null);
    const [isSavingStage, setIsSavingStage] = useState(false);
    const [showPipelineSelector, setShowPipelineSelector] = useState(false);
    const [isEditingTemplates, setIsEditingTemplates] = useState(false);

    // Sync active pipeline when pipelines load or change
    useEffect(() => {
        if (!pipelines.length) {
            setActivePipelineId('');
            return;
        }
        setActivePipelineId(prev => {
            const exists = pipelines.some(p => p.id === prev);
            return exists ? prev : pipelines[0].id;
        });
    }, [pipelines]);

    // Confetti State
    const [confetti, setConfetti] = useState<Particle[]>([]);

    // Add Deal Modal State
    const [isAddDealModalOpen, setIsAddDealModalOpen] = useState(false);
    const [newDeal, setNewDeal] = useState({
        title: '',
        value: '',
        contactId: '',
        stageId: ''
    });
    const [dealFormError, setDealFormError] = useState<string | null>(null);
    const [isSavingDeal, setIsSavingDeal] = useState(false);

    // Create Pipeline Modal State
    const [isCreatePipelineModalOpen, setIsCreatePipelineModalOpen] = useState(false);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('sales');
    const [customPipelineName, setCustomPipelineName] = useState('');

    // Toast Notification State
    const [toast, setToast] = useState<{ message: string, visible: boolean }>({ message: '', visible: false });

    // Scroll Dragging State
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [isDown, setIsDown] = useState(false);
    const [startX, setStartX] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);
    const [isDragging, setIsDragging] = useState(false);

    const activePipeline = pipelines.find(p => p.id === activePipelineId) || pipelines[0];
    const activeStages = activePipeline?.stages ?? [];
    const activeDeals = deals.filter(deal => activeStages.some(stage => stage.id === deal.stageId));

    const getContact = (id: string) => contacts.find(c => c.id === id);

    const showToast = (message: string) => {
        setToast({ message, visible: true });
        setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000);
    };

    const triggerConfetti = () => {
        const colors = ['#84cc16', '#3b82f6', '#f59e0b', '#ec4899', '#a855f7'];
        const particles: Particle[] = [];
        for (let i = 0; i < 50; i++) {
            particles.push({
                id: i,
                x: Math.random() * 100, // percentage
                y: Math.random() * 100, // percentage
                color: colors[Math.floor(Math.random() * colors.length)],
                rotation: Math.random() * 360
            });
        }
        setConfetti(particles);
        setTimeout(() => setConfetti([]), 1000); // Cleanup
    };

    // --- Pipeline Management ---
    const handleOpenCreatePipeline = () => {
        setIsCreatePipelineModalOpen(true);
        setShowPipelineSelector(false);
        setCustomPipelineName('');
        setSelectedTemplateId('sales');
    };

    const handleSavePipeline = async (e: React.FormEvent) => {
        e.preventDefault();
        const template = PIPELINE_TEMPLATES.find(t => t.id === selectedTemplateId);
        if (!template) return;
        const name = customPipelineName.trim() || template.label;
        const created = await createPipeline(name);
        if (!created) return;
        for (const s of template.stages) {
            await addStage(created.id, { name: s.name, color: s.color, hasAutomation: s.hasAutomation });
        }
        setActivePipelineId(created.id);
        setIsCreatePipelineModalOpen(false);
        showToast(`Pipeline "${created.name}" created!`);
    };

    const handleAddDeal = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSavingDeal) return;
        setDealFormError(null);

        const title = newDeal.title.trim();
        if (!title) {
            setDealFormError('Enter a deal title.');
            return;
        }
        if (!newDeal.contactId) {
            setDealFormError('Select a contact from your CRM.');
            return;
        }
        if (!newDeal.stageId) {
            setDealFormError('Select a pipeline stage.');
            return;
        }

        const value = Number.parseFloat(newDeal.value) || 0;
        setIsSavingDeal(true);
        try {
            const created = await addDeal({
                contactId: newDeal.contactId,
                title,
                value,
                stageId: newDeal.stageId,
            });
            if (!created) {
                setDealFormError('Could not add this deal. Try again.');
                return;
            }
            setIsAddDealModalOpen(false);
            setNewDeal({ title: '', value: '', contactId: '', stageId: '' });
            showToast(`Deal "${created.title}" added to pipeline.`);
        } catch (err) {
            setDealFormError(err instanceof Error ? err.message : 'Could not add this deal.');
        } finally {
            setIsSavingDeal(false);
        }
    };

    // --- Scroll Logic ---
    const handleMouseDown = (e: MouseEvent) => {
        if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input') || (e.target as HTMLElement).closest('.modal-content') || (e.target as HTMLElement).closest('.deal-card')) return;
        const slider = scrollContainerRef.current;
        if (!slider) return;
        setIsDown(true);
        slider.classList.add('cursor-grabbing');
        slider.classList.remove('cursor-grab');
        setStartX(e.pageX - slider.offsetLeft);
        setScrollLeft(slider.scrollLeft);
    };

    const handleMouseLeave = () => {
        setIsDown(false);
        setIsDragging(false);
        const slider = scrollContainerRef.current;
        if (slider) {
            slider.classList.remove('cursor-grabbing');
            slider.classList.add('cursor-grab');
        }
    };

    const handleMouseUp = () => {
        setIsDown(false);
        setTimeout(() => setIsDragging(false), 0);
        const slider = scrollContainerRef.current;
        if (slider) {
            slider.classList.remove('cursor-grabbing');
            slider.classList.add('cursor-grab');
        }
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (!isDown) return;
        e.preventDefault();
        setIsDragging(true);
        const slider = scrollContainerRef.current;
        if (!slider) return;
        const x = e.pageX - slider.offsetLeft;
        const walk = (x - startX) * 2;
        slider.scrollLeft = scrollLeft - walk;
    };

    // --- Drag and Drop Logic (Deals) ---
    const handleDragStart = (e: React.DragEvent, dealId: string) => {
        e.dataTransfer.setData('dealId', dealId);
        e.dataTransfer.effectAllowed = 'move';
        // Add visual feedback
        const target = e.target as HTMLElement;
        target.style.opacity = '0.5';
        target.style.transform = 'scale(0.95)';
    };

    const handleDragEnd = (e: React.DragEvent) => {
        const target = e.target as HTMLElement;
        target.style.opacity = '1';
        target.style.transform = 'scale(1)';
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const moveDealToStage = async (dealId: string, stageId: string) => {
        const targetStage = activeStages.find(s => s.id === stageId);
        if (targetStage?.name.includes('Won') || targetStage?.name.includes('Closed')) triggerConfetti();
        if (targetStage?.hasAutomation) showToast(`⚡ Automation Triggered: Moved to ${targetStage.name}`);
        try {
            await updateDeal(dealId, { stageId });
        } catch {
            // error already set in context
        }
    };

    const handleDrop = async (e: React.DragEvent, stageId: string) => {
        e.preventDefault();
        const dealId = e.dataTransfer.getData('dealId');
        if (!dealId) return;
        await moveDealToStage(dealId, stageId);
    };

    const handleStageNameChange = async (id: string, newName: string) => {
        try {
            await updateStage(id, { name: newName });
        } catch {
            // error in context
        }
    };

    const handleDeleteStage = async (id: string) => {
        if (deals.some(d => d.stageId === id)) {
            alert('Please move or delete all deals in this stage before deleting it.');
            return;
        }
        try {
            await deleteStage(id);
        } catch {
            // error in context
        }
    };

    const handleAddStage = async () => {
        if (!newStageName.trim() || !activePipelineId || isSavingStage) return;
        const colors = ['bg-blue-500', 'bg-orange-500', 'bg-violet-500', 'bg-purple-500', 'bg-pink-500', 'bg-indigo-500'];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        setIsSavingStage(true);
        setStageSaveError(null);
        const created = await addStage(activePipelineId, { name: newStageName.trim(), color: randomColor });
        setIsSavingStage(false);
        if (created) {
            setNewStageName('');
            setIsEditMode(true);
        } else {
            setStageSaveError('Could not add this stage. Try again.');
        }
    };

    const toggleAutomation = async (stageId: string) => {
        const stage = activeStages.find(s => s.id === stageId);
        if (!stage) return;
        try {
            await updateStage(stageId, { hasAutomation: !stage.hasAutomation });
        } catch {
            // error in context
        }
    };

    if (pipelinesLoading) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="flex flex-col items-center gap-3 text-zinc-500">
                    <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm font-medium">Loading pipelines…</p>
                </div>
            </div>
        );
    }

    if (pipelinesError) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="text-center text-red-600 dark:text-red-400 text-sm">{pipelinesError}</div>
            </div>
        );
    }

    const hasPipelines = pipelines.length > 0;
    const dealCount = activeDeals.length;
    const dealValue = activeDeals.reduce((sum, d) => sum + d.value, 0);
    const showBoard = hasPipelines && (isEditMode || isEditStagesOpen || activeStages.length > 0);

    const openNewDeal = () => {
        if (!hasPipelines) {
            handleOpenCreatePipeline();
            return;
        }
        setDealFormError(null);
        setNewDeal({
            title: '',
            value: '',
            contactId: contacts[0]?.id ?? '',
            stageId: activeStages[0]?.id ?? '',
        });
        setIsAddDealModalOpen(true);
    };

    const openEditStages = () => {
        if (!hasPipelines) {
            handleOpenCreatePipeline();
            return;
        }
        if (isEditMode || isEditStagesOpen) {
            setIsEditMode(false);
            setIsEditStagesOpen(false);
            return;
        }
        setIsEditMode(true);
        setIsEditStagesOpen(true);
        setStageSaveError(null);
    };

    if (!hasPipelines) {
        return (
            <div className="flex min-h-0 flex-1 flex-col">
                <div className="flex flex-col gap-3 border-b border-white/[0.06] py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="relative flex flex-wrap items-center gap-3">
                        <button
                            type="button"
                            onClick={() => {
                                if (!hasPipelines) handleOpenCreatePipeline();
                                else setShowPipelineSelector((value) => !value);
                            }}
                            className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-[#141416] px-3 py-2 text-sm font-semibold text-white hover:border-zinc-700"
                        >
                            {activePipeline?.name || 'Sales Pipeline'}
                            <ChevronDown className="h-4 w-4 text-zinc-500" />
                        </button>
                        <span className="rounded-md border border-zinc-800 bg-[#141416] px-2.5 py-1 text-xs font-medium text-zinc-400">
                            {dealCount} deals (${dealValue.toLocaleString()})
                        </span>
                        {showPipelineSelector && hasPipelines && (
                            <div className="absolute top-full left-0 z-50 mt-2 w-64 origin-top-left animate-pop-in rounded-xl border border-white/[0.08] bg-[#141416] p-1 shadow-xl">
                                <div className="px-3 py-2 text-xs font-bold uppercase text-zinc-500">Select Pipeline</div>
                                {pipelines.map(p => (
                                    <button
                                        key={p.id}
                                        type="button"
                                        onClick={() => { setActivePipelineId(p.id); setShowPipelineSelector(false); }}
                                        className={`mb-0.5 flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                                            activePipelineId === p.id
                                                ? 'bg-violet-500/10 font-medium text-violet-300'
                                                : 'text-zinc-300 hover:bg-white/[0.04]'
                                        }`}
                                    >
                                        {p.name}
                                        {activePipelineId === p.id && <Check className="h-3 w-3" />}
                                    </button>
                                ))}
                                <div className="my-1 h-px bg-white/[0.06]" />
                                <button
                                    type="button"
                                    onClick={handleOpenCreatePipeline}
                                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-zinc-500 transition-colors hover:bg-white/[0.04] hover:text-violet-400"
                                >
                                    <Plus className="h-3 w-3" /> Create New Pipeline
                                </button>
                            </div>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={openEditStages}
                            className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium ${
                                isEditMode
                                    ? 'border-violet-500/30 bg-violet-500/15 text-violet-300'
                                    : 'border-zinc-800 bg-[#141416] text-zinc-200 hover:bg-white/[0.04]'
                            }`}
                        >
                            {isEditMode ? <Check className="h-4 w-4" /> : <Settings className="h-4 w-4" />}
                            {isEditMode ? 'Done Editing' : 'Edit Stages'}
                        </button>
                        <button
                            type="button"
                            onClick={openNewDeal}
                            className="inline-flex items-center gap-2 rounded-lg bg-violet-500 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-400"
                        >
                            <Plus className="h-4 w-4" />
                            New Deal
                        </button>
                    </div>
                </div>
                <div className="flex-1 bg-[#0B0C0E]" />
                {isCreatePipelineModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
                        <div className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden modal-content flex flex-col max-h-[90vh] animate-pop-in">
                            <div className="flex justify-between items-center p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                                <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                    <Layout className="w-4 h-4 text-violet-600" /> Create New Pipeline
                                </h3>
                                <button onClick={() => setIsCreatePipelineModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="flex-1 flex overflow-hidden">
                                <div className="w-1/3 bg-slate-50 dark:bg-slate-950 border-r border-slate-100 dark:border-slate-800 p-4 overflow-y-auto">
                                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-3">Choose Template</label>
                                    <div className="space-y-2">
                                        {PIPELINE_TEMPLATES.map(template => {
                                            const Icon = template.icon;
                                            return (
                                                <button
                                                    key={template.id}
                                                    type="button"
                                                    onClick={() => setSelectedTemplateId(template.id)}
                                                    className={`w-full text-left p-3 rounded-lg border transition-all active:scale-95 ${selectedTemplateId === template.id ? 'bg-white dark:bg-slate-800 border-violet-500 ring-1 ring-violet-500 shadow-sm' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-violet-300 dark:hover:border-violet-700'}`}
                                                >
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <Icon className={`w-4 h-4 ${selectedTemplateId === template.id ? 'text-violet-600' : 'text-slate-400'}`} />
                                                        <span className={`text-sm font-bold ${selectedTemplateId === template.id ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>{template.label}</span>
                                                    </div>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{template.description}</p>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div className="flex-1 p-6 bg-white dark:bg-slate-900 overflow-y-auto">
                                    <form id="create-pipeline-form-empty" onSubmit={handleSavePipeline}>
                                        <div className="mb-6">
                                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Pipeline Name</label>
                                            <input
                                                type="text"
                                                required
                                                placeholder={PIPELINE_TEMPLATES.find(t => t.id === selectedTemplateId)?.label || 'My Pipeline'}
                                                value={customPipelineName}
                                                onChange={(e) => setCustomPipelineName(e.target.value)}
                                                className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-violet-500 focus:outline-none transition-shadow"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-3">Stages Preview</label>
                                            <div className="space-y-2">
                                                {PIPELINE_TEMPLATES.find(t => t.id === selectedTemplateId)?.stages.map((stage, idx) => (
                                                    <div key={idx} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800">
                                                        <div className={`w-3 h-3 rounded-full ${stage.color}`}></div>
                                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200 flex-1">{stage.name}</span>
                                                        {stage.hasAutomation && (
                                                            <div className="flex items-center gap-1 text-[10px] font-bold text-violet-600 bg-violet-50 dark:bg-violet-900/20 px-2 py-0.5 rounded">
                                                                <Zap className="w-3 h-3" /> Automation
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </form>
                                </div>
                            </div>
                            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex justify-end gap-3">
                                <button type="button" onClick={() => setIsCreatePipelineModalOpen(false)} className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:scale-95">
                                    Cancel
                                </button>
                                <button type="submit" form="create-pipeline-form-empty" className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-bold hover:bg-violet-700 transition-colors shadow-sm active:scale-95">
                                    Create Pipeline
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                {toast.visible && (
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-6 py-3 rounded-full shadow-xl flex items-center gap-3 animate-pop-in z-50">
                        <Zap className="w-5 h-5 text-yellow-400 fill-current" />
                        <span className="font-medium text-sm">{toast.message}</span>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
            {/* Confetti Layer */}
            {confetti.length > 0 && (
                <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
                    {confetti.map((p) => (
                        <div
                            key={p.id}
                            className="absolute w-2 h-2 rounded-full animate-float-up"
                            style={{
                                left: `${p.x}%`,
                                top: `${p.y + 20}%`,
                                backgroundColor: p.color,
                                transform: `rotate(${p.rotation}deg)`
                            }}
                        />
                    ))}
                </div>
            )}

            {/* Header with Pipeline Switcher */}
            <div className="flex flex-col gap-3 border-b border-white/[0.06] py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative flex flex-wrap items-center gap-3">
                    <div
                        className="flex cursor-pointer select-none items-center gap-2 rounded-lg border border-zinc-800 bg-[#141416] px-3 py-2 group"
                        onClick={() => setShowPipelineSelector(!showPipelineSelector)}
                    >
                        <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
                            {activePipeline.name}
                            <ChevronDown className={`h-4 w-4 text-zinc-500 transition-transform ${showPipelineSelector ? 'rotate-180' : ''}`} />
                        </h2>
                    </div>
                    <span className="rounded-md border border-zinc-800 bg-[#141416] px-2.5 py-1 text-xs font-medium text-zinc-400">
                        {dealCount} deals (${dealValue.toLocaleString()})
                    </span>

                    {/* Pipeline Dropdown */}
                    {showPipelineSelector && (
                        <div className="absolute top-full left-0 z-50 mt-2 w-64 origin-top-left animate-pop-in rounded-xl border border-white/[0.08] bg-[#141416] p-1 shadow-xl">
                            <div className="px-3 py-2 text-xs font-bold uppercase text-zinc-500">Select Pipeline</div>
                            {pipelines.map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => { setActivePipelineId(p.id); setShowPipelineSelector(false); }}
                                    className={`mb-0.5 flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors
                                ${activePipelineId === p.id
                                            ? 'bg-violet-500/10 font-medium text-violet-300'
                                            : 'text-zinc-300 hover:bg-white/[0.04]'}`}
                                >
                                    {p.name}
                                    {activePipelineId === p.id && <Check className="h-3 w-3" />}
                                </button>
                            ))}
                            <div className="my-1 h-px bg-white/[0.06]"></div>
                            <button
                                onClick={handleOpenCreatePipeline}
                                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-zinc-500 transition-colors hover:bg-white/[0.04] hover:text-violet-400"
                            >
                                <Plus className="h-3 w-3" /> Create New Pipeline
                            </button>
                        </div>
                    )}
                </div>

                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={openEditStages}
                        className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-all active:scale-95
                ${isEditMode || isEditStagesOpen
                                ? 'border-violet-500/30 bg-violet-500/15 text-violet-300'
                                : 'border-zinc-800 bg-[#141416] text-zinc-200 hover:bg-white/[0.04]'}`}
                    >
                        {isEditMode ? <Check className="h-4 w-4" /> : <Settings className="h-4 w-4" />}
                        {isEditMode ? 'Done Editing' : 'Edit Stages'}
                    </button>
                    <button
                        onClick={openNewDeal}
                        className="inline-flex items-center gap-2 rounded-lg bg-violet-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-violet-400 active:scale-95"
                    >
                        <Plus className="h-4 w-4" /> New Deal
                    </button>
                </div>
            </div>

            {!showBoard ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
                    <p className="text-sm text-zinc-400">This pipeline has no stages yet.</p>
                    <button
                        type="button"
                        onClick={openEditStages}
                        className="inline-flex items-center gap-2 rounded-lg bg-violet-500 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-400"
                    >
                        <Settings className="h-4 w-4" /> Edit Stages
                    </button>
                </div>
            ) : isCompactLayout ? (
                <div className="surface-scroll flex-1 overflow-y-auto pb-4 pr-1 space-y-4">
                    {activeStages.map(stage => {
                        const stageDeals = activeDeals.filter(d => d.stageId === stage.id);
                        return (
                            <section key={stage.id} className="overflow-hidden rounded-xl border border-white/[0.06] bg-[#111214]">
                                <div className={`flex items-center justify-between gap-3 border-b border-white/[0.06] bg-[#141416] p-3 ${stage.hasAutomation ? 'border-t-2 border-t-violet-500' : ''}`}>
                                    <div className="flex min-w-0 items-center gap-2">
                                        <div className={`h-3 w-3 shrink-0 rounded-full ${stage.color}`} />
                                        {isEditMode ? (
                                            <input
                                                type="text"
                                                value={stage.name}
                                                onChange={(e) => handleStageNameChange(stage.id, e.target.value)}
                                                className="w-full rounded border border-zinc-700 bg-[#0B0C0E] px-2 py-1 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                                            />
                                        ) : (
                                            <>
                                                <h3 className="truncate text-sm font-semibold uppercase tracking-wide text-white">{stage.name}</h3>
                                                <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs font-mono text-zinc-400">{stageDeals.length}</span>
                                            </>
                                        )}
                                    </div>

                                    {isEditMode ? (
                                        <div className="flex items-center gap-1">
                                            <button onClick={() => toggleAutomation(stage.id)} className={`rounded p-1.5 ${stage.hasAutomation ? 'bg-violet-50 text-violet-600 dark:bg-violet-900/20' : 'text-slate-400'}`} title="Toggle Automation Trigger">
                                                <Zap className="h-4 w-4" />
                                            </button>
                                            <button onClick={() => handleDeleteStage(stage.id)} className="rounded p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" title="Delete Stage">
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    ) : (
                                        stage.hasAutomation && <Zap className="h-4 w-4 text-violet-500" />
                                    )}
                                </div>

                                <div className="space-y-3 p-3">
                                    {stageDeals.length === 0 ? (
                                        <div className="rounded-lg border border-dashed border-zinc-800 p-4 text-sm text-zinc-500">No deals in this stage.</div>
                                    ) : (
                                        stageDeals.map((deal) => {
                                            const contact = getContact(deal.contactId);
                                            return (
                                                <div key={deal.id} className="rounded-lg border border-white/[0.08] bg-[#141416] p-4 shadow-sm">
                                                    <div className="mb-2 flex items-start justify-between gap-3">
                                                        <div>
                                                            <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">{deal.title}</p>
                                                            <h4 className="mt-1 font-semibold text-white">{contact?.firstName} {contact?.lastName}</h4>
                                                        </div>
                                                        <span className="text-sm font-medium text-zinc-200">${deal.value.toLocaleString()}</span>
                                                    </div>
                                                    <p className="mb-3 text-xs text-zinc-500">{contact?.company || 'Direct Lead'}</p>
                                                    <label className="block text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                                                        Move stage
                                                        <select
                                                            value={deal.stageId}
                                                            onChange={(e) => void moveDealToStage(deal.id, e.target.value)}
                                                            className="mt-1.5 w-full rounded-lg border border-zinc-800 bg-[#0B0C0E] px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
                                                        >
                                                            {activeStages.map((optionStage) => (
                                                                <option key={optionStage.id} value={optionStage.id}>{optionStage.name}</option>
                                                            ))}
                                                        </select>
                                                    </label>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </section>
                        );
                    })}

                    {isEditMode && (
                        <div className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/50">
                            <h3 className="mb-4 text-sm font-semibold text-slate-600 dark:text-slate-300">Add New Stage</h3>
                            <input
                                type="text"
                                placeholder="Stage Name..."
                                value={newStageName}
                                onChange={(e) => setNewStageName(e.target.value)}
                                className="mb-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                onKeyDown={(e) => e.key === 'Enter' && handleAddStage()}
                            />
                            <button
                                onClick={handleAddStage}
                                disabled={!newStageName.trim()}
                                className="w-full rounded-lg bg-slate-200 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-violet-600 hover:text-white disabled:opacity-50 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-violet-600"
                            >
                                Create Stage
                            </button>
                        </div>
                    )}
                </div>
            ) : (
            <div
                ref={scrollContainerRef}
                onMouseDown={handleMouseDown}
                onMouseLeave={handleMouseLeave}
                onMouseUp={handleMouseUp}
                onMouseMove={handleMouseMove}
                className="flex-1 overflow-x-auto overflow-y-hidden pb-4 cursor-grab select-none"
            >
                <div className="flex h-full gap-4 min-w-max px-1">
                    {activeStages.map(stage => (
                        <div
                            key={stage.id}
                            className="w-80 flex flex-col bg-[#111214] rounded-xl border border-white/[0.06] transition-all"
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, stage.id)}
                        >
                            {/* Stage Header */}
                            <div className={`p-3 border-b border-white/[0.06] flex justify-between items-center bg-[#141416] rounded-t-xl group ${stage.hasAutomation ? 'border-t-2 border-t-violet-500' : ''}`}>
                                <div className="flex items-center gap-2 flex-1">
                                    <div className={`w-3 h-3 rounded-full flex-shrink-0 ${stage.color} animate-bounce-sm`}></div>

                                    {isEditMode ? (
                                        <input
                                            type="text"
                                            value={stage.name}
                                            onChange={(e) => handleStageNameChange(stage.id, e.target.value)}
                                            className="text-sm font-semibold text-white bg-[#0B0C0E] border border-zinc-700 rounded px-2 py-1 w-full focus:ring-2 focus:ring-violet-500 focus:outline-none"
                                        />
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-semibold text-white text-sm uppercase tracking-wide truncate max-w-[150px]">{stage.name}</h3>
                                            <span className="bg-zinc-800 text-zinc-400 text-xs px-2 py-0.5 rounded-full font-mono transition-transform hover:scale-110">
                                                {activeDeals.filter(d => d.stageId === stage.id).length}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {isEditMode ? (
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => toggleAutomation(stage.id)}
                                            className={`p-1.5 rounded transition-colors ${stage.hasAutomation ? 'text-violet-600 bg-violet-50 dark:bg-violet-900/20' : 'text-slate-300 hover:text-slate-500'}`}
                                            title="Toggle Automation Trigger"
                                        >
                                            <Zap className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteStage(stage.id)}
                                            className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                            title="Delete Stage"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    stage.hasAutomation && (
                                        <div className="text-violet-500" title="Triggers Automation">
                                            <Zap className="w-3.5 h-3.5 fill-current" />
                                        </div>
                                    )
                                )}
                            </div>

                            {/* Deals List Area */}
                            <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[100px]">
                                {activeDeals.filter(d => d.stageId === stage.id).map(deal => {
                                    const contact = getContact(deal.contactId);
                                    return (
                                        <div
                                            key={deal.id}
                                            draggable={!isEditMode}
                                            onDragStart={(e) => handleDragStart(e, deal.id)}
                                            onDragEnd={handleDragEnd}
                                            className={`deal-card bg-[#141416] p-3 rounded-lg shadow-sm border border-white/[0.08] transition-all group duration-200
                        ${isEditMode ? 'opacity-70 pointer-events-none' : 'hover:shadow-lg hover:-translate-y-1 cursor-grab active:cursor-grabbing hover:border-violet-500'}`}
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{deal.title}</span>
                                                {!isEditMode && <GripVertical className="w-4 h-4 text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity" />}
                                            </div>
                                            <h4 className="font-semibold text-white mb-1">{contact?.firstName} {contact?.lastName}</h4>
                                            <p className="text-xs text-zinc-500 mb-3">{contact?.company || 'Direct Lead'}</p>
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm font-medium text-zinc-200">${deal.value.toLocaleString()}</span>
                                                <div className="flex -space-x-2">
                                                    <div className="w-6 h-6 rounded-full bg-violet-500/20 border border-zinc-800 flex items-center justify-center text-[10px] text-violet-300">
                                                        {contact?.firstName?.[0]}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}

                    {/* Add New Stage Column */}
                    {isEditMode && (
                        <div className="w-80 flex flex-col bg-slate-50 dark:bg-slate-900/50 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 p-4 animate-fade-in">
                            <h3 className="font-semibold text-slate-600 dark:text-slate-300 text-sm mb-4">Add New Stage</h3>
                            <input
                                type="text"
                                placeholder="Stage Name..."
                                value={newStageName}
                                onChange={(e) => setNewStageName(e.target.value)}
                                className="w-full mb-3 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-violet-500 focus:outline-none"
                                onKeyDown={(e) => e.key === 'Enter' && handleAddStage()}
                            />
                            <button
                                onClick={handleAddStage}
                                disabled={!newStageName.trim()}
                                className="w-full py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-violet-600 hover:text-white dark:hover:bg-violet-600 dark:hover:text-white transition-colors disabled:opacity-50 disabled:hover:bg-slate-200 disabled:hover:text-slate-700 active:scale-95"
                            >
                                Create Stage
                            </button>
                        </div>
                    )}

                    {/* Spacer for right padding */}
                    <div className="w-4 flex-shrink-0"></div>
                </div>
            </div>
            )}

            {/* Edit Stages Modal */}
            {isEditStagesOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm animate-fade-in">
                    <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
                        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                            <h3 className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-100">
                                <Settings className="h-4 w-4 text-violet-600" /> Edit Stages
                            </h3>
                            <button
                                type="button"
                                onClick={() => setIsEditStagesOpen(false)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                aria-label="Close edit stages"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="space-y-3 overflow-y-auto p-4">
                            {activeStages.length === 0 && (
                                <p className="text-sm text-slate-500">No stages yet. Add your first stage below.</p>
                            )}
                            {activeStages.map((stage) => (
                                <div key={stage.id} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-950">
                                    <div className={`h-3 w-3 shrink-0 rounded-full ${stage.color}`} />
                                    <input
                                        defaultValue={stage.name}
                                        onBlur={(e) => {
                                            const name = e.target.value.trim();
                                            if (name && name !== stage.name) void handleStageNameChange(stage.id, name);
                                        }}
                                        className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-violet-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => void handleDeleteStage(stage.id)}
                                        className="rounded-md p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                                        aria-label={`Delete ${stage.name}`}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            ))}
                            <div className="flex gap-2 pt-2">
                                <input
                                    type="text"
                                    placeholder="New stage name..."
                                    value={newStageName}
                                    onChange={(e) => setNewStageName(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && void handleAddStage()}
                                    className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-violet-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                />
                                <button
                                    type="button"
                                    onClick={() => void handleAddStage()}
                                    disabled={!newStageName.trim() || isSavingStage}
                                    className="rounded-lg bg-violet-500 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-400 disabled:opacity-50"
                                >
                                    {isSavingStage ? 'Adding…' : 'Add'}
                                </button>
                            </div>
                            {stageSaveError && <p className="text-sm font-medium text-red-500">{stageSaveError}</p>}
                        </div>
                        <div className="flex justify-end border-t border-slate-100 p-4 dark:border-slate-800">
                            <button
                                type="button"
                                onClick={() => setIsEditStagesOpen(false)}
                                className="rounded-lg bg-violet-500 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-400"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Deal Modal */}
            {isAddDealModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden modal-content animate-pop-in">
                        <div className="flex justify-between items-center p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                            <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                <DollarSign className="w-4 h-4 text-violet-600" /> New Deal
                            </h3>
                            <button onClick={() => setIsAddDealModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleAddDeal} className="p-6 space-y-4">
                            {/* Deal Templates */}
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Quick Templates</label>
                                    <button
                                        type="button"
                                        onClick={() => setIsEditingTemplates(!isEditingTemplates)}
                                        className="text-xs text-violet-600 hover:text-violet-700 font-medium transition-colors"
                                    >
                                        {isEditingTemplates ? 'Done' : 'Manage'}
                                    </button>
                                </div>

                                {isEditingTemplates ? (
                                    <div className="space-y-2 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700 max-h-48 overflow-y-auto">
                                        {dealTemplates.map((t) => (
                                            <div key={t.id} className="flex gap-2 items-center">
                                                <input
                                                    type="text"
                                                    value={t.name}
                                                    onChange={(e) => updateDealTemplate(t.id, { name: e.target.value })}
                                                    className="flex-1 p-1.5 text-xs border rounded dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 focus:outline-none focus:border-violet-500"
                                                    placeholder="Title"
                                                />
                                                <input
                                                    type="number"
                                                    value={t.value}
                                                    onChange={(e) => updateDealTemplate(t.id, { value: parseFloat(e.target.value) || 0 })}
                                                    className="w-16 p-1.5 text-xs border rounded dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 focus:outline-none focus:border-violet-500"
                                                    placeholder="Value"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => deleteDealTemplate(t.id)}
                                                    className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ))}
                                        <button
                                            type="button"
                                            onClick={() => createDealTemplate({ name: '', value: 0 })}
                                            className="w-full py-1.5 text-xs border border-dashed border-slate-300 dark:border-slate-600 text-slate-500 hover:text-violet-600 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                        >
                                            + Add Template
                                        </button>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-2">
                                        {dealTemplates.map(t => (
                                            <button
                                                key={t.id}
                                                type="button"
                                                onClick={() => setNewDeal(prev => ({ ...prev, title: t.name, value: t.value }))}
                                                className="text-left px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs hover:border-violet-500 dark:hover:border-violet-500 hover:bg-violet-50 dark:hover:bg-violet-900/10 transition-colors group"
                                            >
                                                <div className="font-semibold text-slate-700 dark:text-slate-200 group-hover:text-violet-700 dark:group-hover:text-violet-400 truncate">{t.name || 'Untitled'}</div>
                                                <div className="text-slate-500 dark:text-slate-400 group-hover:text-violet-600/70 dark:group-hover:text-violet-400/70">${t.value}</div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="h-px bg-slate-100 dark:bg-slate-800 my-2"></div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Deal Title</label>
                                <input
                                    required
                                    type="text"
                                    placeholder="e.g. Roof Replacement"
                                    value={newDeal.title}
                                    onChange={e => setNewDeal({ ...newDeal, title: e.target.value })}
                                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-violet-500 focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Value ($)</label>
                                <input
                                    type="number"
                                    placeholder="0.00"
                                    value={newDeal.value}
                                    onChange={e => setNewDeal({ ...newDeal, value: e.target.value })}
                                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-violet-500 focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Contact</label>
                                <select
                                    required
                                    value={newDeal.contactId}
                                    onChange={e => setNewDeal({ ...newDeal, contactId: e.target.value })}
                                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-violet-500 focus:outline-none"
                                >
                                    <option value="">Select a contact...</option>
                                    {contacts.map(contact => (
                                        <option key={contact.id} value={contact.id}>
                                            {formatContactOption(contact)}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Stage</label>
                                <select
                                    required
                                    value={newDeal.stageId}
                                    onChange={e => setNewDeal({ ...newDeal, stageId: e.target.value })}
                                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-violet-500 focus:outline-none"
                                >
                                    <option value="">Select a stage...</option>
                                    {activeStages.map(stage => (
                                        <option key={stage.id} value={stage.id}>
                                            {stage.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {contacts.length === 0 && (
                                <p className="text-sm text-amber-500">Add a contact in CRM before creating a deal.</p>
                            )}
                            {dealFormError && (
                                <p className="text-sm font-medium text-red-500">{dealFormError}</p>
                            )}

                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => !isSavingDeal && setIsAddDealModalOpen(false)}
                                    disabled={isSavingDeal}
                                    className="flex-1 py-2.5 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors active:scale-95 disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSavingDeal || contacts.length === 0 || activeStages.length === 0}
                                    className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 bg-violet-600 text-white rounded-lg text-sm font-bold hover:bg-violet-700 transition-colors shadow-sm active:scale-95 disabled:opacity-50"
                                >
                                    {isSavingDeal ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                    {isSavingDeal ? 'Adding…' : 'Add Deal'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Create Pipeline Modal */}
            {isCreatePipelineModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden modal-content flex flex-col max-h-[90vh] animate-pop-in">
                        <div className="flex justify-between items-center p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                            <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                <Layout className="w-4 h-4 text-violet-600" /> Create New Pipeline
                            </h3>
                            <button onClick={() => setIsCreatePipelineModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex-1 flex overflow-hidden">
                            {/* Templates Sidebar */}
                            <div className="w-1/3 bg-slate-50 dark:bg-slate-950 border-r border-slate-100 dark:border-slate-800 p-4 overflow-y-auto">
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-3">Choose Template</label>
                                <div className="space-y-2">
                                    {PIPELINE_TEMPLATES.map(template => {
                                        const Icon = template.icon;
                                        return (
                                            <button
                                                key={template.id}
                                                onClick={() => setSelectedTemplateId(template.id)}
                                                className={`w-full text-left p-3 rounded-lg border transition-all active:scale-95 ${selectedTemplateId === template.id ? 'bg-white dark:bg-slate-800 border-violet-500 ring-1 ring-violet-500 shadow-sm' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-violet-300 dark:hover:border-violet-700'}`}
                                            >
                                                <div className="flex items-center gap-2 mb-1">
                                                    <Icon className={`w-4 h-4 ${selectedTemplateId === template.id ? 'text-violet-600' : 'text-slate-400'}`} />
                                                    <span className={`text-sm font-bold ${selectedTemplateId === template.id ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>{template.label}</span>
                                                </div>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{template.description}</p>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Preview Area */}
                            <div className="flex-1 p-6 bg-white dark:bg-slate-900 overflow-y-auto">
                                <form id="create-pipeline-form" onSubmit={handleSavePipeline}>
                                    <div className="mb-6">
                                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Pipeline Name</label>
                                        <input
                                            type="text"
                                            required
                                            placeholder={PIPELINE_TEMPLATES.find(t => t.id === selectedTemplateId)?.label || 'My Pipeline'}
                                            value={customPipelineName}
                                            onChange={(e) => setCustomPipelineName(e.target.value)}
                                            className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-violet-500 focus:outline-none transition-shadow"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-3">Stages Preview</label>
                                        <div className="space-y-2">
                                            {PIPELINE_TEMPLATES.find(t => t.id === selectedTemplateId)?.stages.map((stage, idx) => (
                                                <div key={idx} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800 animate-slide-in-right" style={{ animationDelay: `${idx * 50}ms` }}>
                                                    <div className={`w-3 h-3 rounded-full ${stage.color}`}></div>
                                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200 flex-1">{stage.name}</span>
                                                    {stage.hasAutomation && (
                                                        <div className="flex items-center gap-1 text-[10px] font-bold text-violet-600 bg-violet-50 dark:bg-violet-900/20 px-2 py-0.5 rounded">
                                                            <Zap className="w-3 h-3" /> Automation
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-4 text-center">You can edit stages and add automations after creating.</p>
                                    </div>
                                </form>
                            </div>
                        </div>

                        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex justify-end gap-3">
                            <button
                                onClick={() => setIsCreatePipelineModalOpen(false)}
                                className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:scale-95"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                form="create-pipeline-form"
                                className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-bold hover:bg-violet-700 transition-colors shadow-sm active:scale-95"
                            >
                                Create Pipeline
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Automation Toast */}
            {toast.visible && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-6 py-3 rounded-full shadow-xl flex items-center gap-3 animate-pop-in z-50">
                    <Zap className="w-5 h-5 text-yellow-400 fill-current" />
                    <span className="font-medium text-sm">{toast.message}</span>
                </div>
            )}
        </div>
    );
};
