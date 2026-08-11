'use client';

import React, { useState, useRef, MouseEvent, useEffect } from 'react';
import { Deal, Pipeline as PipelineType } from '@/types';
import { useApp } from '@/contexts/AppContext';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { MoreHorizontal, GripVertical, Plus, Settings, Trash2, Check, Layout, ChevronDown, Zap, BarChart3, DollarSign, X, Briefcase, Headphones, Users, PenTool } from 'lucide-react';

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
            { name: 'Offer Sent', color: 'bg-lime-500' },
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
    const [newStageName, setNewStageName] = useState('');
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
        if (!newDeal.title || !newDeal.contactId || !newDeal.stageId) return;
        const value = parseFloat(newDeal.value) || 0;
        const created = await addDeal({
            contactId: newDeal.contactId,
            title: newDeal.title,
            value,
            stageId: newDeal.stageId,
        });
        if (created) {
            setIsAddDealModalOpen(false);
            setNewDeal({ title: '', value: '', contactId: '', stageId: '' });
            showToast(`Deal "${created.title}" added to pipeline.`);
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
        if (!newStageName.trim() || !activePipelineId) return;
        const colors = ['bg-blue-500', 'bg-orange-500', 'bg-lime-500', 'bg-purple-500', 'bg-pink-500', 'bg-indigo-500'];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        const created = await addStage(activePipelineId, { name: newStageName.trim(), color: randomColor });
        if (created) setNewStageName('');
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
                <div className="flex flex-col items-center gap-3 text-slate-500 dark:text-slate-400">
                    <div className="w-8 h-8 border-2 border-lime-500 border-t-transparent rounded-full animate-spin" />
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

    if (!pipelines.length) {
        return (
            <div className="h-full flex flex-col relative overflow-hidden">
                <div className="h-full flex flex-col items-center justify-center gap-4 text-slate-600 dark:text-slate-300">
                    <p className="text-sm font-medium">No pipelines yet</p>
                    <button
                        onClick={handleOpenCreatePipeline}
                        className="px-4 py-2 bg-lime-600 text-white rounded-lg text-sm font-medium hover:bg-lime-700 transition-colors"
                    >
                        Create your first pipeline
                    </button>
                </div>
                {/* Create Pipeline Modal - same as below, so "Create your first pipeline" can open it */}
                {isCreatePipelineModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
                        <div className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden modal-content flex flex-col max-h-[90vh] animate-pop-in">
                            <div className="flex justify-between items-center p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                                <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                    <Layout className="w-4 h-4 text-lime-600" /> Create New Pipeline
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
                                                    className={`w-full text-left p-3 rounded-lg border transition-all active:scale-95 ${selectedTemplateId === template.id ? 'bg-white dark:bg-slate-800 border-lime-500 ring-1 ring-lime-500 shadow-sm' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-lime-300 dark:hover:border-lime-700'}`}
                                                >
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <Icon className={`w-4 h-4 ${selectedTemplateId === template.id ? 'text-lime-600' : 'text-slate-400'}`} />
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
                                                className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-lime-500 focus:outline-none transition-shadow"
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
                                                            <div className="flex items-center gap-1 text-[10px] font-bold text-lime-600 bg-lime-50 dark:bg-lime-900/20 px-2 py-0.5 rounded">
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
                                <button type="submit" form="create-pipeline-form-empty" className="px-4 py-2 bg-lime-600 text-white rounded-lg text-sm font-bold hover:bg-lime-700 transition-colors shadow-sm active:scale-95">
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
        <div className="flex min-h-[70dvh] flex-col overflow-hidden relative lg:h-[calc(100dvh-10rem)]">
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
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div className="relative">
                    <div
                        className="flex items-center gap-2 cursor-pointer group select-none"
                        onClick={() => setShowPipelineSelector(!showPipelineSelector)}
                    >
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 group-hover:text-lime-600 transition-colors">
                            {activePipeline.name}
                            <ChevronDown className={`w-5 h-5 text-slate-400 group-hover:text-lime-600 transition-all duration-300 ${showPipelineSelector ? 'rotate-180' : ''}`} />
                        </h2>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2 animate-fade-in">
                        <BarChart3 className="w-3 h-3" />
                        {activeDeals.length} Active Deals • Value: ${activeDeals.reduce((sum, d) => sum + d.value, 0).toLocaleString()}
                    </p>

                    {/* Pipeline Dropdown */}
                    {showPipelineSelector && (
                        <div className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 animate-pop-in p-1 origin-top-left">
                            <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase px-3 py-2">Select Pipeline</div>
                            {pipelines.map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => { setActivePipelineId(p.id); setShowPipelineSelector(false); }}
                                    className={`w-full text-left px-3 py-2 text-sm rounded-lg flex justify-between items-center mb-0.5 transition-colors
                                ${activePipelineId === p.id
                                            ? 'bg-lime-50 dark:bg-lime-900/20 text-lime-700 dark:text-lime-400 font-medium'
                                            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                                >
                                    {p.name}
                                    {activePipelineId === p.id && <Check className="w-3 h-3" />}
                                </button>
                            ))}
                            <div className="h-px bg-slate-100 dark:bg-slate-800 my-1"></div>
                            <button
                                onClick={handleOpenCreatePipeline}
                                className="w-full text-left px-3 py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-lime-600 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg flex items-center gap-2 transition-colors"
                            >
                                <Plus className="w-3 h-3" /> Create New Pipeline
                            </button>
                        </div>
                    )}
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={() => setIsEditMode(!isEditMode)}
                        className={`px-4 py-2 border rounded-lg text-sm font-medium transition-all active:scale-95 flex items-center gap-2
                ${isEditMode
                                ? 'bg-slate-800 text-white border-slate-800 dark:bg-slate-200 dark:text-slate-900'
                                : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                    >
                        {isEditMode ? <Check className="w-4 h-4" /> : <Settings className="w-4 h-4" />}
                        {isEditMode ? 'Done Editing' : 'Edit Stages'}
                    </button>
                    <button
                        onClick={() => setIsAddDealModalOpen(true)}
                        className="px-4 py-2 bg-lime-600 text-white rounded-lg text-sm font-medium hover:bg-lime-700 transition-all active:scale-95 flex items-center gap-2 shadow-sm hover:shadow-md"
                    >
                        <Plus className="w-4 h-4" /> Add Deal
                    </button>
                </div>
            </div>

            {isCompactLayout ? (
                <div className="surface-scroll flex-1 overflow-y-auto pb-4 pr-1 space-y-4">
                    {activeStages.map(stage => {
                        const stageDeals = activeDeals.filter(d => d.stageId === stage.id);
                        return (
                            <section key={stage.id} className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-900/40">
                                <div className={`flex items-center justify-between gap-3 border-b border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 ${stage.hasAutomation ? 'border-t-2 border-t-lime-500' : ''}`}>
                                    <div className="flex min-w-0 items-center gap-2">
                                        <div className={`h-3 w-3 shrink-0 rounded-full ${stage.color}`} />
                                        {isEditMode ? (
                                            <input
                                                type="text"
                                                value={stage.name}
                                                onChange={(e) => handleStageNameChange(stage.id, e.target.value)}
                                                className="w-full rounded border border-slate-300 bg-slate-50 px-2 py-1 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-lime-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                            />
                                        ) : (
                                            <>
                                                <h3 className="truncate text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200">{stage.name}</h3>
                                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-mono text-slate-500 dark:bg-slate-800 dark:text-slate-400">{stageDeals.length}</span>
                                            </>
                                        )}
                                    </div>

                                    {isEditMode ? (
                                        <div className="flex items-center gap-1">
                                            <button onClick={() => toggleAutomation(stage.id)} className={`rounded p-1.5 ${stage.hasAutomation ? 'bg-lime-50 text-lime-600 dark:bg-lime-900/20' : 'text-slate-400'}`} title="Toggle Automation Trigger">
                                                <Zap className="h-4 w-4" />
                                            </button>
                                            <button onClick={() => handleDeleteStage(stage.id)} className="rounded p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" title="Delete Stage">
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    ) : (
                                        stage.hasAutomation && <Zap className="h-4 w-4 text-lime-500" />
                                    )}
                                </div>

                                <div className="space-y-3 p-3">
                                    {stageDeals.length === 0 ? (
                                        <div className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">No deals in this stage.</div>
                                    ) : (
                                        stageDeals.map((deal) => {
                                            const contact = getContact(deal.contactId);
                                            return (
                                                <div key={deal.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                                                    <div className="mb-2 flex items-start justify-between gap-3">
                                                        <div>
                                                            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{deal.title}</p>
                                                            <h4 className="mt-1 font-semibold text-slate-800 dark:text-slate-100">{contact?.firstName} {contact?.lastName}</h4>
                                                        </div>
                                                        <span className="text-sm font-medium text-slate-900 dark:text-slate-200">${deal.value.toLocaleString()}</span>
                                                    </div>
                                                    <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">{contact?.company || 'Direct Lead'}</p>
                                                    <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                                                        Move stage
                                                        <select
                                                            value={deal.stageId}
                                                            onChange={(e) => void moveDealToStage(deal.id, e.target.value)}
                                                            className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-lime-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
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
                                className="mb-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-lime-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                onKeyDown={(e) => e.key === 'Enter' && handleAddStage()}
                            />
                            <button
                                onClick={handleAddStage}
                                disabled={!newStageName.trim()}
                                className="w-full rounded-lg bg-slate-200 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-lime-600 hover:text-white disabled:opacity-50 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-lime-600"
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
                            className="w-80 flex flex-col bg-slate-100/50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 transition-all"
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, stage.id)}
                        >
                            {/* Stage Header */}
                            <div className={`p-3 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900 rounded-t-xl group ${stage.hasAutomation ? 'border-t-2 border-t-lime-500' : ''}`}>
                                <div className="flex items-center gap-2 flex-1">
                                    <div className={`w-3 h-3 rounded-full flex-shrink-0 ${stage.color} animate-bounce-sm`}></div>

                                    {isEditMode ? (
                                        <input
                                            type="text"
                                            value={stage.name}
                                            onChange={(e) => handleStageNameChange(stage.id, e.target.value)}
                                            className="text-sm font-semibold text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 w-full focus:ring-2 focus:ring-lime-500 focus:outline-none"
                                        />
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-semibold text-slate-700 dark:text-slate-200 text-sm uppercase tracking-wide truncate max-w-[150px]">{stage.name}</h3>
                                            <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs px-2 py-0.5 rounded-full font-mono transition-transform hover:scale-110">
                                                {activeDeals.filter(d => d.stageId === stage.id).length}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {isEditMode ? (
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => toggleAutomation(stage.id)}
                                            className={`p-1.5 rounded transition-colors ${stage.hasAutomation ? 'text-lime-600 bg-lime-50 dark:bg-lime-900/20' : 'text-slate-300 hover:text-slate-500'}`}
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
                                        <div className="text-lime-500" title="Triggers Automation">
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
                                            className={`deal-card bg-white dark:bg-slate-900 p-3 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 transition-all group duration-200
                        ${isEditMode ? 'opacity-70 pointer-events-none' : 'hover:shadow-lg hover:-translate-y-1 cursor-grab active:cursor-grabbing hover:border-lime-500 dark:hover:border-lime-500'}`}
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{deal.title}</span>
                                                {!isEditMode && <GripVertical className="w-4 h-4 text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />}
                                            </div>
                                            <h4 className="font-semibold text-slate-800 dark:text-slate-100 mb-1">{contact?.firstName} {contact?.lastName}</h4>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">{contact?.company || 'Direct Lead'}</p>
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm font-medium text-slate-900 dark:text-slate-200">${deal.value.toLocaleString()}</span>
                                                <div className="flex -space-x-2">
                                                    <div className="w-6 h-6 rounded-full bg-lime-100 dark:bg-lime-900/30 border border-white dark:border-slate-800 flex items-center justify-center text-[10px] text-lime-700 dark:text-lime-400">
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
                                className="w-full mb-3 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-lime-500 focus:outline-none"
                                onKeyDown={(e) => e.key === 'Enter' && handleAddStage()}
                            />
                            <button
                                onClick={handleAddStage}
                                disabled={!newStageName.trim()}
                                className="w-full py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-lime-600 hover:text-white dark:hover:bg-lime-600 dark:hover:text-white transition-colors disabled:opacity-50 disabled:hover:bg-slate-200 disabled:hover:text-slate-700 active:scale-95"
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

            {/* Add Deal Modal */}
            {isAddDealModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden modal-content animate-pop-in">
                        <div className="flex justify-between items-center p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                            <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                <DollarSign className="w-4 h-4 text-lime-600" /> New Deal
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
                                        className="text-xs text-lime-600 hover:text-lime-700 font-medium transition-colors"
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
                                                    className="flex-1 p-1.5 text-xs border rounded dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 focus:outline-none focus:border-lime-500"
                                                    placeholder="Title"
                                                />
                                                <input
                                                    type="number"
                                                    value={t.value}
                                                    onChange={(e) => updateDealTemplate(t.id, { value: parseFloat(e.target.value) || 0 })}
                                                    className="w-16 p-1.5 text-xs border rounded dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 focus:outline-none focus:border-lime-500"
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
                                            className="w-full py-1.5 text-xs border border-dashed border-slate-300 dark:border-slate-600 text-slate-500 hover:text-lime-600 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
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
                                                className="text-left px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs hover:border-lime-500 dark:hover:border-lime-500 hover:bg-lime-50 dark:hover:bg-lime-900/10 transition-colors group"
                                            >
                                                <div className="font-semibold text-slate-700 dark:text-slate-200 group-hover:text-lime-700 dark:group-hover:text-lime-400 truncate">{t.name || 'Untitled'}</div>
                                                <div className="text-slate-500 dark:text-slate-400 group-hover:text-lime-600/70 dark:group-hover:text-lime-400/70">${t.value}</div>
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
                                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-lime-500 focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Value ($)</label>
                                <input
                                    type="number"
                                    placeholder="0.00"
                                    value={newDeal.value}
                                    onChange={e => setNewDeal({ ...newDeal, value: e.target.value })}
                                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-lime-500 focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Contact</label>
                                <select
                                    required
                                    value={newDeal.contactId}
                                    onChange={e => setNewDeal({ ...newDeal, contactId: e.target.value })}
                                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-lime-500 focus:outline-none"
                                >
                                    <option value="">Select a contact...</option>
                                    {contacts.map(contact => (
                                        <option key={contact.id} value={contact.id}>
                                            {contact.firstName} {contact.lastName} ({contact.email})
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
                                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-lime-500 focus:outline-none"
                                >
                                    <option value="">Select a stage...</option>
                                    {activeStages.map(stage => (
                                        <option key={stage.id} value={stage.id}>
                                            {stage.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsAddDealModalOpen(false)}
                                    className="flex-1 py-2.5 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors active:scale-95"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-2.5 bg-lime-600 text-white rounded-lg text-sm font-bold hover:bg-lime-700 transition-colors shadow-sm active:scale-95"
                                >
                                    Add Deal
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
                                <Layout className="w-4 h-4 text-lime-600" /> Create New Pipeline
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
                                                className={`w-full text-left p-3 rounded-lg border transition-all active:scale-95 ${selectedTemplateId === template.id ? 'bg-white dark:bg-slate-800 border-lime-500 ring-1 ring-lime-500 shadow-sm' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-lime-300 dark:hover:border-lime-700'}`}
                                            >
                                                <div className="flex items-center gap-2 mb-1">
                                                    <Icon className={`w-4 h-4 ${selectedTemplateId === template.id ? 'text-lime-600' : 'text-slate-400'}`} />
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
                                            className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-lime-500 focus:outline-none transition-shadow"
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
                                                        <div className="flex items-center gap-1 text-[10px] font-bold text-lime-600 bg-lime-50 dark:bg-lime-900/20 px-2 py-0.5 rounded">
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
                                className="px-4 py-2 bg-lime-600 text-white rounded-lg text-sm font-bold hover:bg-lime-700 transition-colors shadow-sm active:scale-95"
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
