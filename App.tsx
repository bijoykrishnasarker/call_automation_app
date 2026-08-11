import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { CRM } from './components/CRM';
import { Pipeline } from './components/Pipeline';
import { Workflows } from './components/Workflows';
import { AICenter } from './components/AICenter';
import { Calendar } from './components/Calendar';
import { Reviews } from './components/Reviews';
import { Settings } from './components/Settings';
import { Conversations } from './components/Conversations';
import { Campaigns } from './components/Campaigns';
import { Contact, NavigationItem, ContactStatus, PipelineStage, Deal, Message, Pipeline as PipelineType, Notification, CRMActionRequest } from './types';
import { Bell, Search, UserCircle, Moon, Sun, CheckCircle, AlertCircle, Info, X, LayoutDashboard, Users, KanbanSquare, CalendarDays, GitBranch, Bot, Star, Inbox, Megaphone } from 'lucide-react';

// Mock Data
const INITIAL_CONTACTS: Contact[] = [
  { 
    id: '1', 
    firstName: 'Alice', 
    lastName: 'Johnson', 
    email: 'alice@example.com', 
    phone: '(555) 123-4567', 
    status: ContactStatus.NewLead, 
    tags: ['Website Lead', 'Plumbing'], 
    lastActivity: '2 hours ago', 
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
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
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago 
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
    createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), // 20 days ago
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
      createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
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
      createdAt: new Date(Date.now() - 30 * 60 * 1000), // 30 mins ago
      source: 'TikTok',
      notes: [],
      tasks: []
  }
];

const MOCK_MESSAGES: Message[] = [
    { id: 'm1', contactId: '1', text: 'Hi, I have a leaking pipe under my sink. Can you help?', createdAt: new Date(Date.now() - 86400000), direction: 'inbound', channel: 'sms', read: true },
    { id: 'm2', contactId: '1', text: 'Hi Alice, absolutely! We can send someone out today. Are you free around 2 PM?', createdAt: new Date(Date.now() - 86300000), direction: 'outbound', channel: 'sms', read: true },
    { id: 'm3', contactId: '1', text: 'Yes, 2 PM works great. Thanks!', createdAt: new Date(Date.now() - 86200000), direction: 'inbound', channel: 'sms', read: true },
    { id: 'm4', contactId: '3', text: 'Do you offer teeth whitening specials?', createdAt: new Date(Date.now() - 100000), direction: 'inbound', channel: 'facebook', read: false },
    { id: 'm5', contactId: '2', text: 'Here is the quote for the HVAC units.', createdAt: new Date(Date.now() - 2000000), direction: 'outbound', channel: 'email', read: true },
    { id: 'm6', contactId: '4', text: 'Love the results on your last post! 😍 How much for a full detail?', createdAt: new Date(Date.now() - 50000), direction: 'inbound', channel: 'instagram', read: false },
    { id: 'm7', contactId: '3', text: 'I can send you our pricing guide.', createdAt: new Date(Date.now() - 5000), direction: 'outbound', channel: 'facebook', read: true },
    { id: 'm8', contactId: '4', text: 'Saw your TikTok about the pipe repair! Do you do emergency calls on weekends?', createdAt: new Date(Date.now() - 2000), direction: 'inbound', channel: 'tiktok', read: false },
];

const MOCK_PIPELINES: PipelineType[] = [
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

const MOCK_DEALS: Deal[] = [
  { id: 'd1', contactId: '1', title: 'Leaky Faucet', value: 250, stageId: '1' },
  { id: 'd2', contactId: '2', title: 'HVAC Maintenance', value: 1200, stageId: '3' },
  { id: 'd3', contactId: '3', title: 'Whitening Consult', value: 450, stageId: '2' },
  { id: 'd4', contactId: '2', title: 'Spring Tune-up', value: 150, stageId: '5' }, // Renewal pipeline
];

const INITIAL_NOTIFICATIONS: Notification[] = [
    { id: 'n1', title: 'Task Due', message: 'Confirm insurance for Carol White', time: '10m ago', read: false, type: 'alert', linkTo: 'crm', entityId: '3', subTab: 'tasks' },
    { id: 'n2', title: 'New Review', message: 'Sarah Miller left a 5-star review!', time: '2h ago', read: false, type: 'success', linkTo: 'reviews' },
    { id: 'n3', title: 'Missed Call', message: 'Alice Johnson called 3 times.', time: '4h ago', read: true, type: 'info', linkTo: 'crm', entityId: '1', subTab: 'activity' }
];

export default function App() {
  const [activeTab, setActiveTab] = useState<NavigationItem>('dashboard');
  const [darkMode, setDarkMode] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>(INITIAL_CONTACTS);
  
  // Notification State
  const [notifications, setNotifications] = useState<Notification[]>(INITIAL_NOTIFICATIONS);
  const [showNotifications, setShowNotifications] = useState(false);
  
  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  
  const [crmAction, setCrmAction] = useState<CRMActionRequest | undefined>(undefined);
  
  const notificationRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search Logic
  useEffect(() => {
    if (!searchQuery.trim()) {
        setSearchResults([]);
        setShowSearchDropdown(false);
        return;
    }

    const query = searchQuery.toLowerCase();
    const results = [];

    // Nav Items
    const navItems: {id: NavigationItem, label: string, icon: any}[] = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'conversations', label: 'Inbox', icon: Inbox },
        { id: 'crm', label: 'Contacts', icon: Users },
        { id: 'pipelines', label: 'Pipelines', icon: KanbanSquare },
        { id: 'calendar', label: 'Calendar', icon: CalendarDays },
        { id: 'campaigns', label: 'Campaigns', icon: Megaphone },
        { id: 'reviews', label: 'Reviews', icon: Star },
        { id: 'workflows', label: 'Workflows', icon: GitBranch },
        { id: 'ai-center', label: 'AI Center', icon: Bot },
        { id: 'settings', label: 'Settings', icon: Settings as any }, // Settings icon type workaround if needed, usually fine
    ];

    navItems.forEach(item => {
        if (item.label.toLowerCase().includes(query)) {
            results.push({ type: 'nav', ...item });
        }
    });

    // Contacts
    contacts.forEach(c => {
        const fullName = `${c.firstName} ${c.lastName}`.toLowerCase();
        if (fullName.includes(query) || c.email.toLowerCase().includes(query)) {
            results.push({ type: 'contact', ...c });
        }
    });

    setSearchResults(results.slice(0, 8)); // Limit results
    setShowSearchDropdown(true);
  }, [searchQuery, contacts]);

  const handleSearchResultClick = (result: any) => {
    if (result.type === 'nav') {
        setActiveTab(result.id);
    } else if (result.type === 'contact') {
        setActiveTab('crm');
        // Small timeout to ensure tab switch renders first
        setTimeout(() => {
             setCrmAction({
                contactId: result.id,
                tab: 'activity',
                timestamp: Date.now()
            });
        }, 10);
    }
    setShowSearchDropdown(false);
    setSearchQuery('');
  };

  const handleAddContact = (newContact: Contact) => {
    setContacts(prev => [newContact, ...prev]);
  };

  const handleUpdateContact = (updatedContact: Contact) => {
    setContacts(prev => prev.map(c => c.id === updatedContact.id ? updatedContact : c));
  };

  const handleNotificationClick = (notification: Notification) => {
      // Mark as read
      setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, read: true } : n));
      setShowNotifications(false);

      // Navigate to the correct tab
      if (notification.linkTo) {
          setActiveTab(notification.linkTo);
      }

      // If it requires a deep link action (like opening a specific contact)
      if (notification.linkTo === 'crm' && notification.entityId) {
          setCrmAction({
              contactId: notification.entityId,
              tab: notification.subTab || 'activity',
              timestamp: Date.now()
          });
      }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard contacts={contacts} />;
      case 'conversations': return <Conversations contacts={contacts} initialMessages={MOCK_MESSAGES} />;
      case 'crm': return <CRM contacts={contacts} onAddContact={handleAddContact} onUpdateContact={handleUpdateContact} actionRequest={crmAction} />;
      case 'pipelines': return <Pipeline />;
      case 'workflows': return <Workflows />;
      case 'ai-center': return <AICenter />;
      case 'calendar': return <Calendar />;
      case 'reviews': return <Reviews />;
      case 'campaigns': return <Campaigns />;
      case 'settings': return <Settings />;
      default: return <Dashboard contacts={contacts} />;
    }
  };

  return (
    <div className={`flex h-screen font-sans transition-colors duration-300 ${darkMode ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      {/* Sidebar */}
      <Sidebar activeTab={activeTab} onNavigate={setActiveTab} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-50 dark:bg-slate-950 transition-colors">
        {/* Top Header */}
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 flex-shrink-0 z-10 transition-colors">
           <div className="flex items-center gap-4 flex-1">
             <h1 className="text-lg font-bold text-slate-700 dark:text-slate-200 capitalize">{activeTab.replace('-', ' ')}</h1>
             
             {/* Global Search Bar */}
             <div className="hidden md:flex relative max-w-md w-full ml-8" ref={searchRef}>
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
               <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                      if (e.key === 'Enter' && searchResults.length > 0) {
                          handleSearchResultClick(searchResults[0]);
                      }
                  }}
                  placeholder="Global Search (Commands, Contacts, Actions)..." 
                  className="w-full pl-9 pr-4 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-lime-500 transition-all placeholder-slate-400 dark:placeholder-slate-500"
               />
               {/* Search Dropdown Results */}
               {showSearchDropdown && searchResults.length > 0 && (
                   <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden z-50 animate-pop-in">
                       {searchResults.map((result, idx) => (
                           <button
                               key={idx}
                               onClick={() => handleSearchResultClick(result)}
                               className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 last:border-0 transition-colors group"
                           >
                               {result.type === 'nav' ? (
                                   <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 group-hover:text-lime-600 group-hover:bg-lime-50 dark:group-hover:bg-lime-900/20 transition-colors">
                                       <result.icon className="w-4 h-4" />
                                   </div>
                               ) : (
                                   <div className="w-8 h-8 rounded-full bg-lime-100 dark:bg-lime-900/30 text-lime-700 dark:text-lime-400 flex items-center justify-center font-bold text-xs border border-lime-200 dark:border-lime-800">
                                       {result.firstName[0]}
                                   </div>
                               )}
                               <div>
                                   <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                       {result.type === 'nav' ? result.label : `${result.firstName} ${result.lastName}`}
                                   </p>
                                   <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                       {result.type === 'nav' ? 'Navigate' : 'Contact'}
                                   </p>
                               </div>
                           </button>
                       ))}
                   </div>
               )}
             </div>
           </div>
           
           <div className="flex items-center gap-4">
              <button 
                onClick={() => setDarkMode(!darkMode)}
                className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
              >
                {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              
              {/* Interactive Notifications */}
              <div className="relative" ref={notificationRef}>
                  <button 
                    onClick={() => setShowNotifications(!showNotifications)}
                    className={`relative p-2 rounded-full transition-colors ${showNotifications ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                  >
                    <Bell className="w-5 h-5" />
                    {unreadCount > 0 && (
                        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-slate-900 animate-pulse"></span>
                    )}
                  </button>

                  {/* Dropdown */}
                  {showNotifications && (
                      <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 animate-fade-in origin-top-right overflow-hidden">
                          <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950">
                              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">Notifications</h3>
                              <span className="text-xs text-slate-500 dark:text-slate-400">{unreadCount} unread</span>
                          </div>
                          <div className="max-h-80 overflow-y-auto">
                              {notifications.length === 0 ? (
                                  <div className="p-8 text-center text-slate-500 text-sm">No new notifications.</div>
                              ) : (
                                  notifications.map(n => (
                                      <div 
                                        key={n.id} 
                                        onClick={() => handleNotificationClick(n)}
                                        className={`p-3 border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors flex gap-3 ${!n.read ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''}`}
                                      >
                                          <div className={`mt-1 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center 
                                              ${n.type === 'alert' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 
                                                n.type === 'success' ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' : 
                                                'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                                              {n.type === 'alert' ? <AlertCircle className="w-4 h-4"/> : 
                                               n.type === 'success' ? <CheckCircle className="w-4 h-4"/> : 
                                               <Info className="w-4 h-4"/>}
                                          </div>
                                          <div className="flex-1">
                                              <p className={`text-sm ${!n.read ? 'font-bold text-slate-800 dark:text-slate-100' : 'font-medium text-slate-600 dark:text-slate-300'}`}>{n.title}</p>
                                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{n.message}</p>
                                              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">{n.time}</p>
                                          </div>
                                          {!n.read && <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>}
                                      </div>
                                  ))
                              )}
                          </div>
                      </div>
                  )}
              </div>

              <div className="h-8 w-px bg-slate-200 dark:bg-slate-700"></div>
              <div className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 p-1.5 rounded-lg transition-colors">
                 <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300">
                    <UserCircle className="w-6 h-6" />
                 </div>
                 <div className="hidden md:block text-left">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Dr. Smith</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">Pro Plan</p>
                 </div>
              </div>
           </div>
        </header>

        {/* Scrollable Page Content */}
        <main className="flex-1 overflow-y-auto p-6 relative">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}