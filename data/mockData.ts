import { Contact, ContactStatus, Message, Pipeline, Deal, Notification } from '@/types';

export const INITIAL_CONTACTS: Contact[] = [
    {
        id: '1',
        firstName: 'Alice',
        lastName: 'Johnson',
        email: 'alice@example.com',
        phone: '(555) 123-4567',
        status: ContactStatus.NewLead,
        tags: ['Website Lead', 'Plumbing'],
        lastActivity: '2 hours ago',
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        source: 'Google Ads',
        address: '123 Maple Ave',
        city: 'Springfield',
        state: 'IL',
        zip: '62704',
        tasks: [
            { id: 't1', title: 'Send preliminary quote', dueDate: new Date(new Date().setDate(new Date().getDate() + 1)), completed: false }
        ],
        notes: [
            { id: '1', text: 'Submitted "Emergency Plumbing" form.', createdAt: '2023-10-25 14:00', type: 'note' },
            { id: '2', text: 'AI tried calling, no answer. Left voicemail.', createdAt: '2023-10-25 14:05', type: 'call-log' },
            { id: '3', text: 'Sent follow-up email regarding consultation.', createdAt: '2023-10-25 14:30', type: 'email' }
        ]
    },
    {
        id: '2',
        firstName: 'Bob',
        lastName: 'Smith',
        email: 'bob@example.com',
        phone: '(555) 987-6543',
        status: ContactStatus.Booked,
        company: 'Smith Realty',
        tags: ['VIP', 'HVAC'],
        lastActivity: '1 day ago',
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        source: 'Referral',
        address: '4500 Commerce Blvd',
        city: 'Chicago',
        state: 'IL',
        tasks: [],
        notes: [
            { id: '1', text: 'Booked HVAC maintenance for Thursday.', createdAt: '2023-10-24 09:30', type: 'ai-summary' },
            { id: '2', text: 'Requested quote for 3 properties via email.', createdAt: '2023-10-24 09:35', type: 'email' }
        ]
    },
    {
        id: '3',
        firstName: 'Carol',
        lastName: 'White',
        email: 'carol@gmail.com',
        phone: '(555) 555-5555',
        status: ContactStatus.Contacted,
        tags: ['Dental'],
        lastActivity: '5 mins ago',
        createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
        source: 'Facebook',
        tasks: [
            { id: 't2', title: 'Confirm insurance details', dueDate: new Date(), completed: false }
        ],
        notes: [
            { id: '1', text: 'Asked about teeth whitening prices.', createdAt: '2023-10-26 10:00', type: 'sms' },
            { id: '2', text: 'AI sent price list PDF.', createdAt: '2023-10-26 10:01', type: 'ai-summary' }
        ]
    },
    {
        id: '4',
        firstName: 'David',
        lastName: 'Brown',
        email: 'david.b@social.com',
        phone: '(555) 777-8888',
        status: ContactStatus.NewLead,
        tags: ['Instagram'],
        lastActivity: '10 mins ago',
        createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
        source: 'Instagram',
        notes: [],
        tasks: []
    },
    {
        id: '5',
        firstName: 'Emily',
        lastName: 'Clark',
        email: 'emily.c@tiktok.com',
        phone: '(555) 999-0000',
        status: ContactStatus.NewLead,
        tags: ['TikTok', 'Influencer'],
        lastActivity: '1 hour ago',
        createdAt: new Date(Date.now() - 30 * 60 * 1000),
        source: 'TikTok',
        notes: [],
        tasks: []
    }
];

export const MOCK_MESSAGES: Message[] = [
    { id: 'm1', contactId: '1', text: 'Hi, I have a leaking pipe under my sink. Can you help?', createdAt: new Date(Date.now() - 86400000), direction: 'inbound', channel: 'sms', read: true },
    { id: 'm2', contactId: '1', text: 'Hi Alice, absolutely! We can send someone out today. Are you free around 2 PM?', createdAt: new Date(Date.now() - 86300000), direction: 'outbound', channel: 'sms', read: true },
    { id: 'm3', contactId: '1', text: 'Yes, 2 PM works great. Thanks!', createdAt: new Date(Date.now() - 86200000), direction: 'inbound', channel: 'sms', read: true },
    { id: 'm4', contactId: '3', text: 'Do you offer teeth whitening specials?', createdAt: new Date(Date.now() - 100000), direction: 'inbound', channel: 'facebook', read: false },
    { id: 'm5', contactId: '2', text: 'Here is the quote for the HVAC units.', createdAt: new Date(Date.now() - 2000000), direction: 'outbound', channel: 'email', read: true },
    { id: 'm6', contactId: '4', text: 'Love the results on your last post! 😍 How much for a full detail?', createdAt: new Date(Date.now() - 50000), direction: 'inbound', channel: 'instagram', read: false },
    { id: 'm7', contactId: '3', text: 'I can send you our pricing guide.', createdAt: new Date(Date.now() - 5000), direction: 'outbound', channel: 'facebook', read: true },
    { id: 'm8', contactId: '4', text: 'Saw your TikTok about the pipe repair! Do you do emergency calls on weekends?', createdAt: new Date(Date.now() - 2000), direction: 'inbound', channel: 'tiktok', read: false },
];

export const MOCK_PIPELINES: Pipeline[] = [
    {
        id: 'p1',
        name: 'Sales Pipeline (Main)',
        stages: [
            { id: '1', name: 'New Leads', color: 'bg-blue-500' },
            { id: '2', name: 'Contacted', color: 'bg-orange-500' },
            { id: '3', name: 'Appointment Set', color: 'bg-lime-500', hasAutomation: true },
            { id: '4', name: 'Won/Closed', color: 'bg-green-600', hasAutomation: true },
        ]
    },
    {
        id: 'p2',
        name: 'Renewal / Upsell',
        stages: [
            { id: '5', name: 'Up for Renewal', color: 'bg-purple-500', hasAutomation: true },
            { id: '6', name: 'Outreach', color: 'bg-indigo-500' },
            { id: '7', name: 'Renewed', color: 'bg-emerald-600' },
        ]
    }
];

export const MOCK_DEALS: Deal[] = [
    { id: 'd1', contactId: '1', title: 'Leaky Faucet', value: 250, stageId: '1' },
    { id: 'd2', contactId: '2', title: 'HVAC Maintenance', value: 1200, stageId: '3' },
    { id: 'd3', contactId: '3', title: 'Whitening Consult', value: 450, stageId: '2' },
    { id: 'd4', contactId: '2', title: 'Spring Tune-up', value: 150, stageId: '5' },
];

export const INITIAL_NOTIFICATIONS: Notification[] = [
    { id: 'n1', title: 'Task Due', message: 'Confirm insurance for Carol White', time: '10m ago', read: false, type: 'alert', linkTo: 'crm', entityId: '3', subTab: 'tasks' },
    { id: 'n2', title: 'New Review', message: 'Sarah Miller left a 5-star review!', time: '2h ago', read: false, type: 'success', linkTo: 'reviews' },
    { id: 'n3', title: 'Missed Call', message: 'Alice Johnson called 3 times.', time: '4h ago', read: true, type: 'info', linkTo: 'crm', entityId: '1', subTab: 'activity' }
];
