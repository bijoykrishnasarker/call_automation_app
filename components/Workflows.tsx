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
    { id: '1', type: 'trigger', label: 'Call Status: Missed', icon: 'zap', x: 100, y: 80, config: { status: 'Missed', direction: 'Inbound' } },
    { id: '2', type: 'action', subType: 'sms', label: 'Send SMS Follow-up', icon: 'message', x: 100, y: 280, config: { message: 'Hi! Sorry we missed your call. How can we help you?' } },
    { id: '3', type: 'action', subType: 'email', label: 'Notify Internal Team', icon: 'mail', x: 100, y: 500, config: { subject: 'Missed Call Alert', message: 'Call back ASAP' } },
];

const INITIAL_CONNECTIONS: WorkflowConnection[] = [
    { id: 'c1', from: '1', to: '2' },
    { id: 'c2', from: '2', to: '3' },
];

const WORKFLOW_TEMPLATES = [
    {
        id: 'missed-call',
        name: 'Missed Call Text Back',
        description: 'Automatically text leads when you miss their call to save the opportunity.',
        icon: Phone,
        nodes: [
            { id: '1', type: 'trigger', label: 'Call Status', icon: 'phone-call', x: 100, y: 100, config: { status: 'Missed', direction: 'Inbound' } },
            { id: '2', type: 'action', subType: 'sms', label: 'Send SMS Follow-up', icon: 'message', x: 100, y: 300, config: { message: 'Hi! Sorry we missed your call. How can we help you?' } },
            { id: '3', type: 'action', subType: 'email', label: 'Notify Internal Team', icon: 'mail', x: 100, y: 500, config: { subject: 'Missed Call Alert', message: 'Call back ASAP' } }
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
    const [workflowName, setWorkflowName] = useState('Welcome & Lead Follow-up');
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
        const maxX = Math.max(...nodes.map(n => n.x + 280));
        const maxY = Math.max(...nodes.map(n => n.y + 120));

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
        setWorkflowName(template.name === 'Missed Call Text Back' ? 'Welcome & Lead Follow-up' : template.name);
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
        if (status === 'error') return 'border-red-500/50 bg-[#141416] text-red-200 ring-1 ring-red-500/40';

        switch (type) {
            case 'trigger':
                return 'border-white/[0.08] bg-[#141416] text-white';
            case 'condition':
                return 'border-white/[0.08] bg-[#141416] text-white';
            case 'delay':
                return 'border-white/[0.08] bg-[#141416] text-white';
            case 'action':
                return 'border-white/[0.08] bg-[#141416] text-white';
            default:
                return 'border-white/[0.08] bg-[#141416] text-white';
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

        const startX = fromNode.x + 140;
        const startY = fromNode.y + 96;
        const endX = toNode.x + 140;
        const endY = toNode.y;

        const dy = Math.abs(endY - startY);
        const controlY = dy * 0.5;

        const path = `M ${startX} ${startY} C ${startX} ${startY + controlY}, ${endX} ${endY - controlY}, ${endX} ${endY}`;
        const midX = (startX + endX) / 2;
        const midY = (startY + endY) / 2;

        return (
            <g key={conn.id} className="group cursor-pointer" onDoubleClick={() => handleDeleteConnection(conn.id)}>
                <path d={path} stroke="transparent" strokeWidth="15" fill="none" />
                <path d={path} stroke="#8b5cf6" strokeWidth="2" fill="none" className="group-hover:stroke-violet-300 transition-colors" />
                <circle cx={midX} cy={midY} r="5" fill="#0B0C0E" stroke="#8b5cf6" strokeWidth="2" />
                <circle cx={endX} cy={endY} r="4" fill="#8b5cf6" className="group-hover:fill-violet-300 transition-colors" />
            </g>
        );
    };

    const renderTempConnection = () => {
        if (interactionMode !== 'connecting' || !activeNodeId) return null;
        const fromNode = nodes.find(n => n.id === activeNodeId);
        if (!fromNode) return null;

        const startX = fromNode.x + 140;
        const startY = fromNode.y + 96;
        const endX = mousePos.x;
        const endY = mousePos.y;

        const path = `M ${startX} ${startY} L ${endX} ${endY}`;

        return <path d={path} stroke="#84cc16" strokeWidth="2" strokeDasharray="5,5" fill="none" pointerEvents="none" />;
    };

    const selectedNode = nodes.find(n => n.id === selectedNodeId);

    return (
        <div className="relative flex h-full min-h-0 flex-col">
            <div className="relative flex min-h-0 flex-1 overflow-hidden rounded-xl border border-[#1F1F23] bg-[#0B0C0E]">

                <div className="pointer-events-none absolute inset-x-4 top-4 z-20 flex items-start justify-between gap-3">
                    <div className="pointer-events-auto flex flex-wrap items-center gap-2">
                        <div className="rounded-full border border-zinc-800 bg-[#141416] px-3 py-1.5 text-sm font-semibold text-white">
                            {workflowName}
                        </div>
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                            Active Workflow
                        </span>
                    </div>
                    <div className="pointer-events-auto flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setIsTemplateModalOpen(true)}
                            className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-[#141416] px-3 py-2 text-sm font-medium text-zinc-200 hover:bg-white/[0.04]"
                        >
                            <LayoutTemplate className="h-4 w-4" /> Templates
                        </button>
                        <button
                            type="button"
                            onClick={() => showToast('Workflow running in test mode...')}
                            className="inline-flex items-center gap-2 rounded-lg bg-violet-500 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-400"
                        >
                            <Play className="h-4 w-4 fill-current" /> Test Run
                        </button>
                        <button
                            type="button"
                            onClick={handlePublish}
                            className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-[#141416] px-3 py-2 text-sm font-medium text-zinc-200 hover:bg-white/[0.04]"
                        >
                            <Save className="h-4 w-4" /> Publish
                        </button>
                    </div>
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
                        className="pointer-events-none absolute inset-0 opacity-40"
                        style={{
                            backgroundImage: 'radial-gradient(#3f3f46 1px, transparent 1px)',
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
                                    className="absolute top-[-5000px] bottom-[-5000px] w-px bg-violet-500/50 z-0 pointer-events-none border-l border-dashed border-violet-500"
                                    style={{ left: `${guideLines.x + 120}px` }} // Center of node width
                                />
                                {/* Horizontal Guide */}
                                <div
                                    className="absolute left-[-5000px] right-[-5000px] h-px bg-violet-500/50 z-0 pointer-events-none border-t border-dashed border-violet-500"
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
                        {nodes.map(node => {
                            const isTrigger = node.type === 'trigger';
                            const isDelay = node.type === 'delay';
                            const preview = node.errorMessage
                                ? node.errorMessage
                                : node.subType === 'stage_change'
                                    ? `Trigger on: ${node.config.pipelineStage || 'Any Stage'}`
                                    : node.subType === 'pipeline'
                                        ? `Move to: ${node.config.stageName || 'Select Stage'}`
                                        : node.subType === 'review'
                                            ? `Platform: ${node.config.platform || 'Google'}`
                                            : node.subType === 'call'
                                                ? (node.config.script || 'Click to configure step parameters')
                                                : (node.subType === 'sms' || node.subType === 'tiktok' || node.subType === 'email')
                                                    ? (node.config.message ? `"${node.config.message}"` : 'Click to configure step parameters')
                                                    : isDelay
                                                        ? `Wait ${node.config.duration || 0} ${node.config.unit || 'mins'}`
                                                        : 'Click to configure step parameters';

                            return (
                            <div
                                key={node.id}
                                data-node-id={node.id}
                                style={{ transform: `translate(${node.x}px, ${node.y}px)` }}
                                className={`absolute z-10 w-[280px] rounded-xl border p-4 shadow-lg pointer-events-auto transition-shadow group
                            ${getNodeColor(node.type, node.subType, node.status)}
                            ${selectedNodeId === node.id ? 'ring-2 ring-violet-500/70' : 'hover:border-white/20'}
                        `}
                            >
                                {node.status === 'error' && (
                                    <div className="absolute -top-3 -right-3 z-20 rounded-full bg-red-500 p-1 text-white shadow-md animate-bounce">
                                        <AlertTriangle className="h-4 w-4" />
                                    </div>
                                )}

                                {node.type !== 'trigger' && (
                                    <div className="absolute -top-3 left-1/2 flex h-3 w-6 -translate-x-1/2 justify-center">
                                        <div className="h-3 w-3 rounded-full border-2 border-[#0B0C0E] bg-violet-500" />
                                    </div>
                                )}

                                <p className={`mb-3 text-[10px] font-bold uppercase tracking-[0.16em] ${isTrigger ? 'text-violet-400' : isDelay ? 'text-zinc-400' : 'text-emerald-400'}`}>
                                    {isTrigger ? 'Trigger' : isDelay ? 'Delay' : 'Action'}
                                </p>
                                <div className="flex items-start gap-3">
                                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${isTrigger ? 'bg-violet-500/15 text-violet-400' : isDelay ? 'bg-zinc-800 text-zinc-300' : 'bg-emerald-500/15 text-emerald-400'}`}>
                                        {getNodeIcon(node.icon)}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate font-semibold text-white">{node.label}</p>
                                        <p className={`mt-1 line-clamp-2 text-xs ${node.errorMessage ? 'font-bold text-red-400' : 'italic text-zinc-500'}`}>
                                            {preview}
                                        </p>
                                    </div>
                                    <GripHorizontal className="h-4 w-4 shrink-0 text-zinc-600 opacity-0 group-hover:opacity-100" />
                                </div>

                                <div
                                    className="absolute -bottom-4 left-0 flex h-6 w-full cursor-crosshair items-center justify-center group/handle"
                                    data-handle="output"
                                    data-node-id={node.id}
                                >
                                    <div className="pointer-events-none flex h-4 w-4 items-center justify-center rounded-full border-2 border-violet-500 bg-[#0B0C0E] transition-transform group-hover/handle:scale-125">
                                        <div className="h-1.5 w-1.5 rounded-full bg-violet-500" />
                                    </div>
                                </div>
                            </div>
                            );
                        })}
                    </div>

                    {/* Canvas Controls */}
                    <div className="absolute left-4 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-1 rounded-lg border border-zinc-800 bg-[#141416] p-1 shadow-lg">
                        <button type="button" onClick={() => setViewport(v => ({ ...v, zoom: Math.min(v.zoom + 0.1, 3) }))} className="rounded p-2 text-zinc-400 hover:bg-white/[0.06] hover:text-white">
                            <ZoomIn className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => setViewport(v => ({ ...v, zoom: Math.max(v.zoom - 0.1, 0.1) }))} className="rounded p-2 text-zinc-400 hover:bg-white/[0.06] hover:text-white">
                            <ZoomOut className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={centerView} className="rounded p-2 text-zinc-400 hover:bg-white/[0.06] hover:text-white" title="Fit to View">
                            <Maximize className="h-4 w-4" />
                        </button>
                    </div>

                    <div className="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 gap-2">
                        <button
                            type="button"
                            onClick={() => handleAddNode({ type: 'action', subType: 'sms', label: 'Send SMS Follow-up', icon: 'message', defaultConfig: { message: '' } })}
                            className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-[#141416] px-3 py-2 text-sm font-medium text-zinc-200 hover:bg-white/[0.04]"
                        >
                            <Plus className="h-4 w-4" /> Add Action
                        </button>
                        <button
                            type="button"
                            onClick={() => handleAddNode({ type: 'delay', label: 'Wait', icon: 'clock', defaultConfig: { duration: '10', unit: 'minutes' } })}
                            className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-[#141416] px-3 py-2 text-sm font-medium text-zinc-200 hover:bg-white/[0.04]"
                        >
                            <Clock className="h-4 w-4" /> Add Delay
                        </button>
                    </div>

                    <div className="pointer-events-none absolute bottom-6 right-6 rounded-full border border-zinc-800 bg-[#141416]/90 px-3 py-1.5 font-mono text-xs text-zinc-500">
                        {Math.round(viewport.zoom * 100)}%
                    </div>
                </div>

                {/* Property Panel */}
                {selectedNode && (
                    <div className="absolute right-0 top-0 bottom-0 z-20 flex w-80 animate-slide-in-right flex-col border-l border-[#1F1F23] bg-[#141416] shadow-2xl">
                        <div className="flex items-center justify-between border-b border-white/[0.06] bg-[#111214] p-4">
                            <h3 className="flex items-center gap-2 font-bold text-white">
                                <Settings className="h-4 w-4" /> Properties
                            </h3>
                            <button type="button" onClick={() => setSelectedNodeId(null)} className="text-zinc-400 hover:text-zinc-200">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="flex-1 p-6 space-y-6 overflow-y-auto">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Step Name</label>
                                <input
                                    type="text"
                                    value={selectedNode.label}
                                    onChange={(e) => setNodes(nodes.map(n => n.id === selectedNode.id ? { ...n, label: e.target.value } : n))}
                                    className="w-full rounded-lg border border-zinc-800 bg-[#0B0C0E] p-2.5 text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-violet-500"
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
                                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-sm resize-none focus:ring-2 focus:ring-violet-500 focus:outline-none"
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
                                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-sm resize-none focus:ring-2 focus:ring-violet-500 focus:outline-none"
                                            placeholder="Enter message content..."
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="border-t border-white/[0.06] bg-[#111214] p-4">
                            <button
                                type="button"
                                onClick={() => handleDeleteNode(selectedNode.id)}
                                className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-500/10 p-3 text-sm font-bold text-red-400 transition-colors hover:bg-red-500/20"
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
                        <div className="flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-[#141416] shadow-xl">
                            <div className="flex items-center justify-between border-b border-white/[0.06] bg-[#111214] p-4">
                                <h3 className="flex items-center gap-2 font-bold text-white">
                                    <LayoutTemplate className="h-4 w-4 text-violet-400" /> Start from Template
                                </h3>
                                <button type="button" onClick={() => setIsTemplateModalOpen(false)} className="text-zinc-400 hover:text-zinc-200">
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
                                {WORKFLOW_TEMPLATES.map(template => {
                                    const Icon = template.icon as React.ElementType;
                                    return (
                                        <button
                                            key={template.id}
                                            onClick={() => handleLoadTemplate(template)}
                                            className="group flex flex-col rounded-xl border border-white/[0.08] bg-[#0B0C0E] p-4 text-left transition-all hover:border-violet-500 hover:ring-1 hover:ring-violet-500"
                                        >
                                            <div className="mb-3 flex items-center gap-3">
                                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/15 text-violet-400 transition-colors group-hover:bg-violet-500 group-hover:text-white">
                                                    <Icon className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-white">{template.name}</h4>
                                                    <span className="text-xs text-zinc-500">{template.nodes.length} Steps</span>
                                                </div>
                                            </div>
                                            <p className="mb-4 flex-1 text-sm text-zinc-400">{template.description}</p>
                                            <div className="flex items-center gap-2 text-xs font-bold text-violet-400 group-hover:underline">
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
                        {toast.type === 'error' ? <AlertCircle className="w-5 h-5" /> : <Zap className="w-5 h-5 text-violet-400 fill-current" />}
                        <span className="font-medium text-sm">{toast.message}</span>
                    </div>
                )}
            </div>
        </div>
    );
};
