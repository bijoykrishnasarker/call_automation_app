'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    Play, Plus, ArrowRight, Mail, Clock, MessageSquare, Zap, Settings,
    Trash2, X, Save, MousePointer2, AlertCircle, Phone, GripHorizontal,
    ZoomIn, ZoomOut, Move, Maximize, MousePointerClick, Star, KanbanSquare, Tags, PhoneCall, LayoutTemplate, Video, AlertTriangle
} from 'lucide-react';
import { WorkflowNode, WorkflowConnection } from '@/types';

// Extended Types for internal use
interface WorkflowNodeState extends WorkflowNode {
    status?: 'idle' | 'running' | 'completed' | 'error';
    errorMessage?: string;
}

interface Viewport {
    x: number;
    y: number;
    zoom: number;
}

const INITIAL_NODES: WorkflowNodeState[] = [
    { id: '1', type: 'trigger', label: 'Form Submitted', icon: 'zap', x: 100, y: 100, config: { source: 'Website Contact', formId: 'emergency-plumbing' } },
    { id: '2', type: 'action', subType: 'sms', label: 'Send SMS', icon: 'message', x: 100, y: 300, config: { template: 'Lead Intro', message: 'Hi {name}, thanks for reaching out!' } },
    { id: '3', type: 'delay', label: 'Wait 10m', icon: 'clock', x: 100, y: 500, config: { duration: '10', unit: 'minutes' } },
    { id: '4', type: 'action', subType: 'call', label: 'AI Call Lead', icon: 'phone', x: 100, y: 700, config: { script: 'Qualify Lead', voice: 'Sarah' } },
];

const INITIAL_CONNECTIONS: WorkflowConnection[] = [
    { id: 'c1', from: '1', to: '2' },
    { id: 'c2', from: '2', to: '3' },
    { id: 'c3', from: '3', to: '4' },
];

const WORKFLOW_TEMPLATES = [
    {
        id: 'missed-call',
        name: 'Missed Call Text Back',
        description: 'Automatically text leads when you miss their call to save the opportunity.',
        icon: Phone,
        nodes: [
            { id: '1', type: 'trigger', label: 'Call Status', icon: 'phone-call', x: 100, y: 100, config: { status: 'Missed', direction: 'Inbound' } },
            { id: '2', type: 'action', subType: 'sms', label: 'SMS Reply', icon: 'message', x: 100, y: 300, config: { message: 'Hi! Sorry we missed your call. How can we help you?' } },
            { id: '3', type: 'action', subType: 'email', label: 'Notify Staff', icon: 'mail', x: 100, y: 500, config: { subject: 'Missed Call Alert', message: 'Call back ASAP' } }
        ],
        connections: [
            { id: 'c1', from: '1', to: '2' },
            { id: 'c2', from: '2', to: '3' }
        ]
    },
    {
        id: 'appointment-reminders',
        name: 'Appointment Reminders',
        description: 'Send confirmation and reminders to reduce no-shows.',
        icon: (props: any) => <Clock className="w-5 h-5 text-purple-600" />,
        nodes: [
            { id: '1', type: 'trigger', label: 'Appt Booked', icon: 'zap', x: 100, y: 100, config: {} },
            { id: '2', type: 'action', subType: 'email', label: 'Confirmation Email', icon: 'mail', x: 100, y: 300, config: { template: 'Confirmation' } },
            { id: '3', type: 'delay', label: 'Wait 24h Before', icon: 'clock', x: 100, y: 500, config: { duration: '24', unit: 'hours before' } },
            { id: '4', type: 'action', subType: 'sms', label: 'SMS Reminder', icon: 'message', x: 100, y: 700, config: { message: 'See you tomorrow at {time}!' } }
        ],
        connections: [
            { id: 'c1', from: '1', to: '2' },
            { id: 'c2', from: '2', to: '3' },
            { id: 'c3', from: '3', to: '4' }
        ]
    },
    {
        id: 'review-request',
        name: 'Review Request Sequence',
        description: 'Ask happy customers for a Google review after a job is won.',
        icon: Star,
        nodes: [
            { id: '1', type: 'trigger', subType: 'stage_change', label: 'Job Won', icon: 'kanban', x: 100, y: 100, config: { pipelineStage: 'Won' } },
            { id: '2', type: 'delay', label: 'Wait 1 Hour', icon: 'clock', x: 100, y: 300, config: { duration: '1', unit: 'hour' } },
            { id: '3', type: 'action', subType: 'sms', label: 'SMS Request', icon: 'message', x: 100, y: 500, config: { message: 'Hi {name}, thanks for choosing us! Could you leave a quick review?' } },
            { id: '4', type: 'delay', label: 'Wait 3 Days', icon: 'clock', x: 100, y: 700, config: { duration: '3', unit: 'days' } },
            { id: '5', type: 'action', subType: 'email', label: 'Email Follow-up', icon: 'mail', x: 100, y: 900, config: { template: 'Review Request Email' } }
        ],
        connections: [
            { id: 'c1', from: '1', to: '2' },
            { id: 'c2', from: '2', to: '3' },
            { id: 'c3', from: '3', to: '4' },
            { id: 'c4', from: '4', to: '5' }
        ]
    },
    {
        id: 'new-lead',
        name: 'New Lead Fast Response',
        description: 'Immediate multi-channel response to new website leads.',
        icon: Zap,
        nodes: [
            { id: '1', type: 'trigger', label: 'New Lead', icon: 'zap', x: 100, y: 100, config: { source: 'Website' } },
            { id: '2', type: 'action', subType: 'sms', label: 'Instant SMS', icon: 'message', x: 300, y: 250, config: { message: 'Hi! We received your inquiry.' } },
            { id: '3', type: 'action', subType: 'email', label: 'Welcome Email', icon: 'mail', x: -100, y: 250, config: { template: 'Welcome' } },
            { id: '4', type: 'delay', label: 'Wait 5 min', icon: 'clock', x: 100, y: 400, config: { duration: '5', unit: 'minutes' } },
            { id: '5', type: 'action', subType: 'call', label: 'AI Call', icon: 'phone-call', x: 100, y: 600, config: { script: 'Connect call to sales' } }
        ],
        connections: [
            { id: 'c1', from: '1', to: '2' },
            { id: 'c2', from: '1', to: '3' },
            { id: 'c3', from: '1', to: '4' },
            { id: 'c4', from: '4', to: '5' }
        ]
    }
];

export const Workflows: React.FC = () => {
    const [nodes, setNodes] = useState<WorkflowNodeState[]>(INITIAL_NODES);
    const [connections, setConnections] = useState<WorkflowConnection[]>(INITIAL_CONNECTIONS);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 });

    // Interaction State
    const [interactionMode, setInteractionMode] = useState<'idle' | 'panning' | 'dragging_node' | 'connecting'>('idle');
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 }); // Mouse screen pos
    const [activeNodeId, setActiveNodeId] = useState<string | null>(null); // Node being dragged or connection source
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 }); // World coordinates for connection line
    const [guideLines, setGuideLines] = useState<{ x: number | null, y: number | null }>({ x: null, y: null });

    // Validation State
    const [validationErrors, setValidationErrors] = useState<string[]>([]);
    const [showValidationModal, setShowValidationModal] = useState(false);

    // Modal & Toast State
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
    const [toast, setToast] = useState<{ message: string, visible: boolean, type: 'success' | 'error' }>({ message: '', visible: false, type: 'success' });

    const containerRef = useRef<HTMLDivElement>(null);

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToast({ message, visible: true, type });
        setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000);
    };

    // --- Validation Logic ---
    const validateWorkflow = (): boolean => {
        const errors: string[] = [];
        const nodeErrors: Record<string, string> = {};

        // 1. Check for Trigger
        const triggers = nodes.filter(n => n.type === 'trigger');
        if (triggers.length === 0) {
            errors.push("Workflow must have at least one Trigger.");
        }

        // 2. Check connectivity & Orphans
        // Build a map of connections
        const connectedTo = new Set(connections.map(c => c.to));
        // const connectedFrom = new Set(connections.map(c => c.from));

        nodes.forEach(node => {
            // Rule: Every non-trigger node must have an input
            if (node.type !== 'trigger' && !connectedTo.has(node.id)) {
                nodeErrors[node.id] = "This node is disconnected.";
                errors.push(`Node "${node.label}" is disconnected.`);
            }

            // Rule: Configuration validation
            if (node.subType === 'sms' && (!node.config?.message || node.config.message.trim() === '')) {
                nodeErrors[node.id] = "Message body is empty.";
                errors.push(`SMS Node "${node.label}" missing message.`);
            }
            if (node.subType === 'email' && (!node.config?.template && !node.config?.message)) {
                nodeErrors[node.id] = "Email template missing.";
                errors.push(`Email Node "${node.label}" missing template/message.`);
            }
            if (node.subType === 'stage_change' && !node.config?.pipelineStage) {
                nodeErrors[node.id] = "Pipeline stage not selected.";
                errors.push(`Trigger "${node.label}" missing stage.`);
            }
        });

        // Update Node States
        setNodes(prev => prev.map(n => ({
            ...n,
            status: nodeErrors[n.id] ? 'error' : 'idle',
            errorMessage: nodeErrors[n.id]
        })));

        setValidationErrors(errors);
        if (errors.length > 0) {
            setShowValidationModal(true);
            return false;
        }
        return true;
    };

    const handlePublish = () => {
        if (validateWorkflow()) {
            showToast('Workflow validated and published successfully!', 'success');
        } else {
            showToast('Validation failed. Please fix errors.', 'error');
        }
    };

    // --- Coordinate Helpers ---
    const screenToWorld = useCallback((screenX: number, screenY: number) => {
        if (!containerRef.current) return { x: 0, y: 0 };
        const rect = containerRef.current.getBoundingClientRect();
        return {
            x: (screenX - rect.left - viewport.x) / viewport.zoom,
            y: (screenY - rect.top - viewport.y) / viewport.zoom
        };
    }, [viewport]);

    // --- Event Handlers ---

    const handleMouseDown = (e: React.MouseEvent) => {
        // 1. Check if clicking a handle (Connection Start)
        const target = e.target as HTMLElement;
        const handleId = target.dataset.handle;

        if (handleId) {
            e.stopPropagation();
            const nodeId = target.dataset.nodeId;
            if (nodeId) {
                setInteractionMode('connecting');
                setActiveNodeId(nodeId);
                const worldPos = screenToWorld(e.clientX, e.clientY);
                setMousePos(worldPos);
            }
            return;
        }

        // 2. Check if clicking a node (Node Drag)
        const nodeElement = target.closest('[data-node-id]') as HTMLElement;
        if (nodeElement) {
            e.stopPropagation();
            const nodeId = nodeElement.dataset.nodeId;
            if (nodeId) {
                setSelectedNodeId(nodeId);
                setInteractionMode('dragging_node');
                setActiveNodeId(nodeId);
                // Store offset from node top-left
                const node = nodes.find(n => n.id === nodeId);
                const worldPos = screenToWorld(e.clientX, e.clientY);
                if (node) {
                    setDragStart({
                        x: worldPos.x - node.x,
                        y: worldPos.y - node.y
                    });
                }
            }
            return;
        }

        // 3. Background Click (Pan or Deselect)
        setInteractionMode('panning');
        setDragStart({ x: e.clientX, y: e.clientY });
        setSelectedNodeId(null);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        const worldPos = screenToWorld(e.clientX, e.clientY);

        if (interactionMode === 'panning') {
            const dx = e.clientX - dragStart.x;
            const dy = e.clientY - dragStart.y;
            setViewport(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
            setDragStart({ x: e.clientX, y: e.clientY });
        } else if (interactionMode === 'dragging_node' && activeNodeId) {
            // Snap to grid (20px)
            const rawX = worldPos.x - dragStart.x;
            const rawY = worldPos.y - dragStart.y;
            const snappedX = Math.round(rawX / 20) * 20;
            const snappedY = Math.round(rawY / 20) * 20;

            // Set guide lines for visual feedback
            setGuideLines({ x: snappedX, y: snappedY });

            setNodes(prev => prev.map(n => n.id === activeNodeId ? { ...n, x: snappedX, y: snappedY } : n));
        } else if (interactionMode === 'connecting') {
            setMousePos(worldPos);
        }
    };

    const handleMouseUp = (e: React.MouseEvent) => {
        if (interactionMode === 'connecting' && activeNodeId) {
            // Check if dropped on another node
            const target = e.target as HTMLElement;
            const targetNodeEl = target.closest('[data-node-id]') as HTMLElement;
            const targetNodeId = targetNodeEl?.dataset.nodeId;

            if (targetNodeId && targetNodeId !== activeNodeId) {
                // Avoid duplicate connections
                const exists = connections.some(c => c.from === activeNodeId && c.to === targetNodeId);
                if (!exists) {
                    setConnections(prev => [...prev, {
                        id: `c-${Date.now()}`,
                        from: activeNodeId,
                        to: targetNodeId
                    }]);
                    // Clear error status if we connect it
                    setNodes(prev => prev.map(n => n.id === targetNodeId ? { ...n, status: 'idle', errorMessage: undefined } : n));
                }
            }
        }

        setInteractionMode('idle');
        setActiveNodeId(null);
        setGuideLines({ x: null, y: null }); // Clear guides
    };

    const handleWheel = (e: React.WheelEvent) => {
        // Zoom logic
        e.stopPropagation();
        const ZOOM_SPEED = 0.001;
        const newZoom = Math.min(Math.max(0.1, viewport.zoom - e.deltaY * ZOOM_SPEED), 3);
        setViewport(prev => ({ ...prev, zoom: newZoom }));
    };

    // --- CRUD Operations ---
    const handleAddNode = (preset: any) => {
        // Add to center of viewport
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const centerX = (rect.width / 2 - viewport.x) / viewport.zoom;
        const centerY = (rect.height / 2 - viewport.y) / viewport.zoom;

        const id = Date.now().toString();

        setNodes([...nodes, {
            id,
            type: preset.type,
            subType: preset.subType,
            label: preset.label,
            icon: preset.icon,
            x: Math.round((centerX - 100) / 20) * 20, // Snap on create
            y: Math.round((centerY - 50) / 20) * 20,
            config: preset.defaultConfig || {}
        }]);
        setSelectedNodeId(id);
    };

    const handleDeleteNode = (id: string) => {
        setNodes(prev => prev.filter(n => n.id !== id));
        setConnections(prev => prev.filter(c => c.from !== id && c.to !== id));
        setSelectedNodeId(null);
    };

    const handleDeleteConnection = (id: string) => {
        setConnections(prev => prev.filter(c => c.id !== id));
    };

    const centerView = () => {
        if (nodes.length === 0 || !containerRef.current) {
            setViewport({ x: 0, y: 0, zoom: 1 });
            return;
        }

        const minX = Math.min(...nodes.map(n => n.x));
        const minY = Math.min(...nodes.map(n => n.y));
        const maxX = Math.max(...nodes.map(n => n.x + 240));
        const maxY = Math.max(...nodes.map(n => n.y + 100));

        const rect = containerRef.current.getBoundingClientRect();
        const padding = 100;

        const contentWidth = maxX - minX + padding * 2;
        const contentHeight = maxY - minY + padding * 2;

        const zoomX = rect.width / contentWidth;
        const zoomY = rect.height / contentHeight;
        const newZoom = Math.min(Math.min(zoomX, zoomY), 1);

        const newX = (rect.width - (contentWidth * newZoom)) / 2 - (minX - padding) * newZoom;
        const newY = (rect.height - (contentHeight * newZoom)) / 2 - (minY - padding) * newZoom;

        setViewport({ x: newX, y: newY, zoom: newZoom });
    };

    const handleLoadTemplate = (template: typeof WORKFLOW_TEMPLATES[0]) => {
        setNodes(template.nodes as WorkflowNodeState[]);
        setConnections(template.connections);
        setIsTemplateModalOpen(false);
        showToast(`Template "${template.name}" loaded.`);
        setValidationErrors([]); // Clear errors
        // Reset viewport to default to ensure visibility of the new nodes
        setViewport({ x: 0, y: 0, zoom: 1 });
    };

    useEffect(() => {
        centerView();
    }, []);

    // --- Rendering Helpers ---
    const getNodeColor = (type: string, subType?: string, status?: string) => {
        if (status === 'error') return 'border-red-500 bg-red-50 dark:bg-red-900/30 text-red-900 dark:text-red-100 ring-2 ring-red-200';

        switch (type) {
            case 'trigger':
                if (subType === 'stage_change') return 'border-orange-500 bg-orange-50 dark:bg-orange-900/40 text-orange-900 dark:text-orange-100';
                return 'border-blue-500 bg-blue-50 dark:bg-blue-900/40 text-blue-900 dark:text-blue-100';
            case 'condition': return 'border-amber-500 bg-amber-50 dark:bg-amber-900/40 text-amber-900 dark:text-amber-100';
            case 'delay': return 'border-slate-500 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100';
            case 'action':
                if (subType === 'pipeline') return 'border-purple-500 bg-purple-50 dark:bg-purple-900/40 text-purple-900 dark:text-purple-100';
                if (subType === 'review') return 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/40 text-yellow-900 dark:text-yellow-100';
                if (subType === 'call') return 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-900 dark:text-indigo-100';
                if (subType === 'tiktok') return 'border-pink-500 bg-pink-50 dark:bg-pink-900/40 text-pink-900 dark:text-pink-100';
                return 'border-lime-500 bg-lime-50 dark:bg-lime-900/40 text-lime-900 dark:text-lime-100';
            default: return 'border-slate-200';
        }
    };

    const getNodeIcon = (iconName?: string) => {
        switch (iconName) {
            case 'zap': return <Zap className="w-4 h-4" />;
            case 'message': return <MessageSquare className="w-4 h-4" />;
            case 'mail': return <Mail className="w-4 h-4" />;
            case 'clock': return <Clock className="w-4 h-4" />;
            case 'phone': return <Phone className="w-4 h-4" />;
            case 'alert': return <AlertCircle className="w-4 h-4" />;
            case 'star': return <Star className="w-4 h-4" />;
            case 'kanban': return <KanbanSquare className="w-4 h-4" />;
            case 'tag': return <Tags className="w-4 h-4" />;
            case 'phone-call': return <PhoneCall className="w-4 h-4" />;
            case 'video': return <Video className="w-4 h-4" />;
            default: return <Settings className="w-4 h-4" />;
        }
    };

    const renderConnection = (conn: WorkflowConnection) => {
        const fromNode = nodes.find(n => n.id === conn.from);
        const toNode = nodes.find(n => n.id === conn.to);
        if (!fromNode || !toNode) return null;

        const startX = fromNode.x + 120;
        const startY = fromNode.y + 80;
        const endX = toNode.x + 120;
        const endY = toNode.y;

        const dy = Math.abs(endY - startY);
        const controlY = dy * 0.5;

        const path = `M ${startX} ${startY} C ${startX} ${startY + controlY}, ${endX} ${endY - controlY}, ${endX} ${endY}`;

        return (
            <g key={conn.id} className="group cursor-pointer" onDoubleClick={() => handleDeleteConnection(conn.id)}>
                <path d={path} stroke="transparent" strokeWidth="15" fill="none" />
                <path d={path} stroke="#94a3b8" strokeWidth="2" fill="none" className="group-hover:stroke-lime-500 transition-colors" />
                <circle cx={endX} cy={endY} r="4" fill="#94a3b8" className="group-hover:fill-lime-500 transition-colors" />
            </g>
        );
    };

    const renderTempConnection = () => {
        if (interactionMode !== 'connecting' || !activeNodeId) return null;
        const fromNode = nodes.find(n => n.id === activeNodeId);
        if (!fromNode) return null;

        const startX = fromNode.x + 120;
        const startY = fromNode.y + 80;
        const endX = mousePos.x;
        const endY = mousePos.y;

        const path = `M ${startX} ${startY} L ${endX} ${endY}`;

        return <path d={path} stroke="#84cc16" strokeWidth="2" strokeDasharray="5,5" fill="none" pointerEvents="none" />;
    };

    const selectedNode = nodes.find(n => n.id === selectedNodeId);

    const TOOLBOX_GROUPS = [
        {
            title: 'Communication',
            items: [
                { type: 'action', subType: 'sms', label: 'Send SMS', icon: 'message', color: 'text-lime-600 bg-lime-50 dark:bg-lime-900/20 border-lime-200' },
                { type: 'action', subType: 'email', label: 'Send Email', icon: 'mail', color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 border-amber-200' },
                { type: 'action', subType: 'call', label: 'AI Call', icon: 'phone-call', color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200' },
                { type: 'action', subType: 'tiktok', label: 'TikTok DM', icon: 'video', color: 'text-pink-600 bg-pink-50 dark:bg-pink-900/20 border-pink-200' },
            ]
        },
        {
            title: 'CRM & Logic',
            items: [
                { type: 'trigger', label: 'Form/Webhook', icon: 'zap', color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 border-blue-200' },
                { type: 'trigger', subType: 'stage_change', label: 'Stage Reached', icon: 'kanban', color: 'text-orange-600 bg-orange-50 dark:bg-orange-900/20 border-orange-200' },
                { type: 'action', subType: 'pipeline', label: 'Update Stage', icon: 'kanban', color: 'text-purple-600 bg-purple-50 dark:bg-purple-900/20 border-purple-200' },
                { type: 'action', subType: 'review', label: 'Ask Review', icon: 'star', color: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200' },
                { type: 'delay', label: 'Wait', icon: 'clock', color: 'text-slate-600 bg-slate-50 dark:bg-slate-800 border-slate-200' },
            ]
        }
    ];

    return (
        <div className="h-full flex flex-col relative">
            {/* Header */}
            <div className="flex justify-between items-center mb-4 flex-shrink-0 px-1">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Workflow Automation</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Drag and drop nodes to build your agency automation.</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setIsTemplateModalOpen(true)}
                        className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:text-lime-600 hover:border-lime-500 transition-colors flex items-center gap-2 shadow-sm"
                    >
                        <LayoutTemplate className="w-4 h-4" /> Templates
                    </button>
                    <button
                        onClick={() => showToast('Workflow running in test mode...')}
                        className="px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 shadow-sm"
                    >
                        <Play className="w-4 h-4 text-green-600" /> Test Run
                    </button>
                    <button
                        onClick={handlePublish}
                        className="px-4 py-2 bg-lime-600 text-white rounded-lg text-sm font-medium hover:bg-lime-700 transition-colors flex items-center gap-2 shadow-sm"
                    >
                        <Save className="w-4 h-4" /> Publish
                    </button>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 relative shadow-inner">

                {/* Sidebar Tools */}
                <div className="w-16 md:w-56 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col z-10 shadow-lg overflow-y-auto">
                    {TOOLBOX_GROUPS.map((group, idx) => (
                        <div key={idx} className="p-3 border-b border-slate-100 dark:border-slate-800 last:border-0">
                            <h3 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 hidden md:block">{group.title}</h3>
                            <div className="space-y-2">
                                {group.items.map((item) => (
                                    <button
                                        key={item.label}
                                        onClick={() => handleAddNode(item)}
                                        className={`w-full flex md:flex-row flex-col items-center gap-2 p-3 rounded-lg border transition-all hover:scale-105 active:scale-95 shadow-sm ${item.color} dark:border-slate-700`}
                                    >
                                        {getNodeIcon(item.icon)}
                                        <span className="text-xs font-bold hidden md:inline">{item.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Main Canvas */}
                <div
                    ref={containerRef}
                    className={`flex-1 relative overflow-hidden ${interactionMode === 'panning' ? 'cursor-grabbing' : 'cursor-grab'}`}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onWheel={handleWheel}
                >
                    {/* Infinite Grid Background */}
                    <div
                        className="absolute inset-0 pointer-events-none opacity-20 dark:opacity-10"
                        style={{
                            backgroundImage: 'radial-gradient(#64748b 1px, transparent 1px)',
                            backgroundSize: `${20 * viewport.zoom}px ${20 * viewport.zoom}px`,
                            backgroundPosition: `${viewport.x}px ${viewport.y}px`
                        }}
                    />

                    {/* Transform Container */}
                    <div
                        style={{
                            transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
                            transformOrigin: '0 0',
                            width: '100%',
                            height: '100%',
                            pointerEvents: 'none'
                        }}
                    >
                        {/* Visual Guide Lines during Drag */}
                        {guideLines.x !== null && guideLines.y !== null && (
                            <g>
                                {/* Vertical Guide */}
                                <div
                                    className="absolute top-[-5000px] bottom-[-5000px] w-px bg-lime-500/50 z-0 pointer-events-none border-l border-dashed border-lime-500"
                                    style={{ left: `${guideLines.x + 120}px` }} // Center of node width
                                />
                                {/* Horizontal Guide */}
                                <div
                                    className="absolute left-[-5000px] right-[-5000px] h-px bg-lime-500/50 z-0 pointer-events-none border-t border-dashed border-lime-500"
                                    style={{ top: `${guideLines.y + 40}px` }} // Center of node height
                                />
                            </g>
                        )}

                        {/* Connections Layer */}
                        <svg className="overflow-visible absolute top-0 left-0 w-full h-full pointer-events-auto">
                            {connections.map(renderConnection)}
                            {renderTempConnection()}
                        </svg>

                        {/* Nodes Layer */}
                        {nodes.map(node => (
                            <div
                                key={node.id}
                                data-node-id={node.id}
                                style={{ transform: `translate(${node.x}px, ${node.y}px)` }}
                                className={`absolute w-60 rounded-xl shadow-sm border-2 p-0 z-10 pointer-events-auto transition-shadow group
                            ${getNodeColor(node.type, node.subType, node.status)}
                            ${selectedNodeId === node.id ? 'ring-2 ring-lime-500 ring-offset-2 dark:ring-offset-slate-900 shadow-xl' : 'hover:shadow-md'}
                        `}
                            >
                                {/* Error Indicator */}
                                {node.status === 'error' && (
                                    <div className="absolute -top-3 -right-3 z-20 bg-red-500 text-white rounded-full p-1 shadow-md animate-bounce">
                                        <AlertTriangle className="w-4 h-4" />
                                    </div>
                                )}

                                {/* Input Handle */}
                                {node.type !== 'trigger' && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-3 flex justify-center">
                                        <div className="w-3 h-3 bg-slate-400 dark:bg-slate-600 rounded-full border-2 border-white dark:border-slate-900" />
                                    </div>
                                )}

                                {/* Header */}
                                <div className="p-3 flex items-center gap-3 border-b border-black/5 dark:border-white/10 select-none">
                                    <div className="p-1.5 bg-white/50 dark:bg-black/20 rounded-lg backdrop-blur-sm">
                                        {getNodeIcon(node.icon)}
                                    </div>
                                    <span className="font-bold text-sm flex-1 truncate">{node.label}</span>
                                    <GripHorizontal className="w-4 h-4 opacity-0 group-hover:opacity-50" />
                                </div>

                                {/* Body Preview */}
                                <div className="p-3 text-xs opacity-80 select-none min-h-[40px]">
                                    {node.errorMessage ? (
                                        <span className="text-red-600 dark:text-red-300 font-bold">{node.errorMessage}</span>
                                    ) : (
                                        <>
                                            {node.subType === 'stage_change' && `Trigger on: ${node.config.pipelineStage || 'Any Stage'}`}
                                            {node.subType === 'pipeline' && `Move to: ${node.config.stageName || 'Select Stage'}`}
                                            {node.subType === 'review' && `Platform: ${node.config.platform || 'Google'}`}
                                            {node.subType === 'call' && `Script: ${node.config.script?.substring(0, 20) || 'None'}...`}
                                            {(node.subType === 'sms' || node.subType === 'tiktok') && (node.config.message || 'Enter message...').substring(0, 30)}
                                            {!node.subType && node.type === 'delay' && `${node.config.duration || 0} ${node.config.unit || 'mins'}`}
                                        </>
                                    )}
                                </div>

                                {/* Output Handle */}
                                <div
                                    className="absolute -bottom-4 left-0 w-full h-6 flex items-center justify-center cursor-crosshair group/handle"
                                    data-handle="output"
                                    data-node-id={node.id}
                                >
                                    <div
                                        className="w-4 h-4 bg-white dark:bg-slate-800 border-2 border-lime-500 rounded-full flex items-center justify-center transition-transform group-hover/handle:scale-125 pointer-events-none"
                                    >
                                        <div className="w-1.5 h-1.5 bg-lime-500 rounded-full" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Canvas Controls */}
                    <div className="absolute bottom-6 left-6 flex flex-col gap-2 bg-white dark:bg-slate-900 p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-lg">
                        <button onClick={() => setViewport(v => ({ ...v, zoom: Math.min(v.zoom + 0.1, 3) }))} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-600 dark:text-slate-300">
                            <ZoomIn className="w-4 h-4" />
                        </button>
                        <button onClick={() => setViewport(v => ({ ...v, zoom: Math.max(v.zoom - 0.1, 0.1) }))} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-600 dark:text-slate-300">
                            <ZoomOut className="w-4 h-4" />
                        </button>
                        <button onClick={centerView} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-600 dark:text-slate-300" title="Fit to View">
                            <Maximize className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="absolute bottom-6 right-6 bg-white/90 dark:bg-slate-900/90 backdrop-blur px-3 py-1.5 rounded-full text-xs font-mono text-slate-500 border border-slate-200 dark:border-slate-800 pointer-events-none">
                        {Math.round(viewport.zoom * 100)}%
                    </div>
                </div>

                {/* Property Panel */}
                {selectedNode && (
                    <div className="w-80 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col shadow-2xl z-20 animate-slide-in-right absolute right-0 top-0 bottom-0">
                        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950">
                            <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                <Settings className="w-4 h-4" /> Properties
                            </h3>
                            <button onClick={() => setSelectedNodeId(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex-1 p-6 space-y-6 overflow-y-auto">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Step Name</label>
                                <input
                                    type="text"
                                    value={selectedNode.label}
                                    onChange={(e) => setNodes(nodes.map(n => n.id === selectedNode.id ? { ...n, label: e.target.value } : n))}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-lime-500 focus:outline-none"
                                />
                            </div>

                            {/* Dynamic Config Based on SubType */}
                            {selectedNode.subType === 'stage_change' && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Trigger Stage</label>
                                    <select
                                        value={selectedNode.config.pipelineStage || ''}
                                        onChange={(e) => setNodes(nodes.map(n => n.id === selectedNode.id ? { ...n, config: { ...n.config, pipelineStage: e.target.value }, status: 'idle', errorMessage: undefined } : n))}
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm"
                                    >
                                        <option value="">Any Stage</option>
                                        <option value="New Lead">New Lead</option>
                                        <option value="Contacted">Contacted</option>
                                        <option value="Appointment Set">Appointment Set</option>
                                        <option value="Won">Won / Closed</option>
                                    </select>
                                    <p className="text-[10px] text-slate-400 mt-2">Workflow starts when a contact moves to this stage.</p>
                                </div>
                            )}

                            {selectedNode.subType === 'pipeline' && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Target Stage</label>
                                    <select
                                        value={selectedNode.config.stageName || ''}
                                        onChange={(e) => setNodes(nodes.map(n => n.id === selectedNode.id ? { ...n, config: { ...n.config, stageName: e.target.value }, status: 'idle', errorMessage: undefined } : n))}
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm"
                                    >
                                        <option value="">Select Stage...</option>
                                        <option value="Lead In">Lead In</option>
                                        <option value="Contacted">Contacted</option>
                                        <option value="Appointment Set">Appointment Set</option>
                                        <option value="Sold/Won">Sold/Won</option>
                                    </select>
                                    <p className="text-[10px] text-slate-400 mt-2">Moves the contact to this stage in the active pipeline.</p>
                                </div>
                            )}

                            {selectedNode.subType === 'review' && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Review Platform</label>
                                    <select
                                        value={selectedNode.config.platform || 'Google'}
                                        onChange={(e) => setNodes(nodes.map(n => n.id === selectedNode.id ? { ...n, config: { ...n.config, platform: e.target.value } } : n))}
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm"
                                    >
                                        <option value="Google">Google</option>
                                        <option value="Facebook">Facebook</option>
                                        <option value="Yelp">Yelp</option>
                                    </select>
                                </div>
                            )}

                            {selectedNode.subType === 'call' && (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Voice Persona</label>
                                        <select className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm">
                                            <option>Sarah (Friendly)</option>
                                            <option>Mike (Professional)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Script/Instructions</label>
                                        <textarea
                                            rows={4}
                                            value={selectedNode.config.script || ''}
                                            onChange={(e) => setNodes(nodes.map(n => n.id === selectedNode.id ? { ...n, config: { ...n.config, script: e.target.value }, status: 'idle', errorMessage: undefined } : n))}
                                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-sm resize-none focus:ring-2 focus:ring-lime-500 focus:outline-none"
                                            placeholder="Instructions for the AI..."
                                        />
                                    </div>
                                </div>
                            )}

                            {(selectedNode.subType === 'sms' || selectedNode.subType === 'email' || selectedNode.subType === 'tiktok') && (
                                <div className="space-y-4">
                                    {selectedNode.subType !== 'tiktok' && (
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Template</label>
                                            <select
                                                value={selectedNode.config.template || ''}
                                                onChange={(e) => setNodes(nodes.map(n => n.id === selectedNode.id ? { ...n, config: { ...n.config, template: e.target.value }, status: 'idle', errorMessage: undefined } : n))}
                                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm"
                                            >
                                                <option value="">Select Template...</option>
                                                <option value="Lead Intro">Lead Intro</option>
                                                <option value="Follow Up 1">Follow Up 1</option>
                                                <option value="Review Request">Review Request</option>
                                            </select>
                                        </div>
                                    )}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Message Body</label>
                                        <textarea
                                            rows={6}
                                            value={selectedNode.config.message || ''}
                                            onChange={(e) => setNodes(nodes.map(n => n.id === selectedNode.id ? { ...n, config: { ...n.config, message: e.target.value }, status: 'idle', errorMessage: undefined } : n))}
                                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-sm resize-none focus:ring-2 focus:ring-lime-500 focus:outline-none"
                                            placeholder="Enter message content..."
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                            <button
                                onClick={() => handleDeleteNode(selectedNode.id)}
                                className="w-full flex items-center justify-center gap-2 p-3 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg text-sm font-bold transition-colors"
                            >
                                <Trash2 className="w-4 h-4" /> Delete Step
                            </button>
                        </div>
                    </div>
                )}

                {/* Validation Errors Modal */}
                {showValidationModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
                        <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-xl shadow-xl border border-red-200 dark:border-red-900/50 overflow-hidden animate-pop-in">
                            <div className="flex justify-between items-center p-4 border-b border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-900/20">
                                <h3 className="font-bold text-red-800 dark:text-red-200 flex items-center gap-2">
                                    <AlertTriangle className="w-5 h-5" /> Validation Errors
                                </h3>
                                <button onClick={() => setShowValidationModal(false)} className="text-red-400 hover:text-red-600 dark:hover:text-red-200">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="p-6">
                                <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">Please fix the following issues before publishing:</p>
                                <ul className="space-y-2">
                                    {validationErrors.map((error, idx) => (
                                        <li key={idx} className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/10 p-2 rounded">
                                            <span className="mt-0.5">•</span> {error}
                                        </li>
                                    ))}
                                </ul>
                                <button
                                    onClick={() => setShowValidationModal(false)}
                                    className="w-full mt-6 py-2 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 transition-colors"
                                >
                                    Okay, I'll fix it
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Template Modal */}
                {isTemplateModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
                        <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[85vh]">
                            <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex justify-between items-center">
                                <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                    <LayoutTemplate className="w-4 h-4 text-lime-600" /> Start from Template
                                </h3>
                                <button onClick={() => setIsTemplateModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
                                {WORKFLOW_TEMPLATES.map(template => {
                                    const Icon = template.icon as React.ElementType;
                                    return (
                                        <button
                                            key={template.id}
                                            onClick={() => handleLoadTemplate(template)}
                                            className="flex flex-col text-left p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-lime-500 hover:ring-1 hover:ring-lime-500 bg-white dark:bg-slate-800 transition-all group"
                                        >
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className="w-10 h-10 rounded-lg bg-lime-50 dark:bg-lime-900/20 text-lime-600 dark:text-lime-400 flex items-center justify-center group-hover:bg-lime-600 group-hover:text-white transition-colors">
                                                    <Icon className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-slate-800 dark:text-slate-100">{template.name}</h4>
                                                    <span className="text-xs text-slate-400 dark:text-slate-500">{template.nodes.length} Steps</span>
                                                </div>
                                            </div>
                                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 flex-1">{template.description}</p>
                                            <div className="flex items-center gap-2 text-xs font-bold text-lime-600 dark:text-lime-400 group-hover:underline">
                                                Use Template <ArrowRight className="w-3 h-3" />
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* Automation Toast */}
                {toast.visible && (
                    <div className={`absolute bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full shadow-xl flex items-center gap-3 animate-fade-in z-50 ${toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-slate-800 text-white'}`}>
                        {toast.type === 'error' ? <AlertCircle className="w-5 h-5" /> : <Zap className="w-5 h-5 text-lime-400 fill-current" />}
                        <span className="font-medium text-sm">{toast.message}</span>
                    </div>
                )}
            </div>
        </div>
    );
};
