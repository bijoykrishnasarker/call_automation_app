'use client';

import React, { useState } from 'react';
import { Review } from '@/types';
import { Star, MessageCircle, ThumbsUp, MoreHorizontal, ExternalLink, Filter, Instagram, Facebook, MapPin, Check, X, Send, Mail, Smartphone, Video, Bot, Sparkles } from 'lucide-react';

const MOCK_REVIEWS: Review[] = [
    { id: '1', author: 'Sarah Miller', rating: 5, text: 'Absolutely amazing service! The team was on time and fixed my plumbing issue in under an hour.', source: 'Google', date: '2 days ago', status: 'Replied', reply: 'Thanks Sarah! Glad we could help.' },
    { id: '2', author: 'John Doe', rating: 4, text: 'Good experience overall, but scheduling took a bit longer than expected.', source: 'Yelp', date: '5 days ago', status: 'Pending' },
    { id: '3', author: 'Mike Ross', rating: 5, text: 'Best in town. Highly recommend for any HVAC needs.', source: 'Google', date: '1 week ago', status: 'Pending' },
    { id: '4', author: 'Jessica K.', rating: 5, text: 'Love the new aesthetics clinic! Treatment was super relaxing. 📸✨', source: 'Instagram', date: '1 day ago', status: 'Pending' },
    { id: '5', author: 'Emily Blunt', rating: 3, text: 'Okay service, but a bit pricey for what I got.', source: 'Facebook', date: '3 days ago', status: 'Pending' },
    { id: '6', author: 'Tyler Creator', rating: 5, text: 'Saw this on my FYP and had to try. Worth the hype! 🔥', source: 'TikTok', date: '4 hours ago', status: 'Pending' }
];

const ReviewCard = ({ review }: { review: Review }) => {
    const [isGenerating, setIsGenerating] = useState(false);
    const [draft, setDraft] = useState<string | null>(null);

    const handleGenerateAI = () => {
        setIsGenerating(true);
        // Simulate AI delay
        setTimeout(() => {
            if (review.rating >= 4) {
                setDraft(`Hi ${review.author.split(' ')[0]}, thank you so much for the kind words! We're thrilled to hear you had a great experience. We look forward to serving you again!`);
            } else {
                setDraft(`Hi ${review.author.split(' ')[0]}, thank you for your feedback. We're sorry to hear about your experience and would love to make it right. Please contact us directly so we can resolve this.`);
            }
            setIsGenerating(false);
        }, 1200);
    };

    const getIcon = (source: string) => {
        switch (source) {
            case 'Google': return <MapPin className="w-3 h-3" />;
            case 'Facebook': return <Facebook className="w-3 h-3" />;
            case 'Instagram': return <Instagram className="w-3 h-3" />;
            case 'TikTok': return <Video className="w-3 h-3" />;
            default: return <ExternalLink className="w-3 h-3" />;
        }
    };

    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm transition-all hover:shadow-md">
            <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        {review.author[0]}
                    </div>
                    <div>
                        <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm">{review.author}</h4>
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                            <span className="flex items-center gap-1">{getIcon(review.source)} {review.source}</span>
                            <span>•</span>
                            <span>{review.date}</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    {review.status === 'Pending' && (
                        <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">Needs Reply</span>
                    )}
                    <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 ml-2 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
                        <MoreHorizontal className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <div className="flex items-center gap-1 mb-3">
                {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className={`w-4 h-4 ${i < review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-slate-200 dark:text-slate-700'}`} />
                ))}
            </div>

            <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed mb-4">
                "{review.text}"
            </p>

            {review.reply && (
                <div className="bg-slate-50 dark:bg-slate-800/50 border-l-2 border-lime-500 p-3 rounded-r-lg mb-4">
                    <p className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Your Reply</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300 italic">{review.reply}</p>
                </div>
            )}

            {draft && !review.reply && (
                <div className="bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-800/50 p-3 rounded-lg mb-4 animate-fade-in">
                    <div className="flex justify-between items-center mb-1">
                        <p className="text-xs font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1"><Sparkles className="w-3 h-3" /> AI Suggestion</p>
                        <button onClick={() => setDraft(null)} className="text-slate-400 hover:text-slate-600"><X className="w-3 h-3" /></button>
                    </div>
                    <textarea
                        className="w-full bg-transparent text-sm text-slate-700 dark:text-slate-300 italic resize-none focus:outline-none"
                        value={draft}
                        readOnly
                    />
                    <div className="flex gap-2 mt-2">
                        <button className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-md shadow-sm transition-colors">Post Reply</button>
                        <button className="px-3 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-xs font-medium rounded-md hover:bg-slate-50 dark:hover:bg-slate-700">Edit</button>
                    </div>
                </div>
            )}

            {!review.reply && !draft && (
                <div className="flex gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <button className="flex-1 flex items-center justify-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 py-2 rounded-lg transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-600">
                        <MessageCircle className="w-4 h-4" />
                        Reply
                    </button>
                    <button
                        onClick={handleGenerateAI}
                        disabled={isGenerating}
                        className="flex-1 flex items-center justify-center gap-2 text-sm font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 py-2 rounded-lg transition-colors"
                    >
                        {isGenerating ? <Sparkles className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
                        {isGenerating ? 'Drafting...' : 'AI Assist'}
                    </button>
                </div>
            )}

            {review.reply && (
                <div className="flex gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <button className="flex-1 flex items-center justify-center gap-2 text-sm font-medium text-lime-700 dark:text-lime-500 bg-lime-50 dark:bg-lime-900/20 hover:bg-lime-100 dark:hover:bg-lime-900/30 py-2 rounded-lg transition-colors">
                        Edit Reply
                    </button>
                </div>
            )}
        </div>
    );
};

export const Reviews: React.FC = () => {
    const [activeFilter, setActiveFilter] = useState('All');
    const [reviews, setReviews] = useState<Review[]>(MOCK_REVIEWS);
    const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
    const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
    const [campaignType, setCampaignType] = useState<'sms' | 'email'>('sms');
    const [sending, setSending] = useState(false);

    // Filter Logic
    const filteredReviews = reviews.filter(review => {
        if (activeFilter === 'All') return true;
        if (activeFilter === 'Unanswered') return review.status === 'Pending';
        return review.source === activeFilter;
    });

    const handleRequestSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setSending(true);
        // Simulate API call
        setTimeout(() => {
            setSending(false);
            setIsRequestModalOpen(false);
            alert("Review request campaign queued successfully!");
        }, 1500);
    };

    return (
        <div className="space-y-6 relative h-full flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-center flex-shrink-0">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Reputation Management</h2>
                    <div className="flex items-center gap-2 mt-1">
                        <p className="text-slate-500 dark:text-slate-400 text-sm">Monitor and respond to customer reviews.</p>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-lime-100 dark:bg-lime-900/30 text-[10px] font-bold text-lime-700 dark:text-lime-400 border border-lime-200 dark:border-lime-800">
                            <Bot className="w-3 h-3" /> Auto-Pilot ON
                        </span>
                    </div>
                </div>
                <div className="flex gap-2 relative">
                    <button
                        onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
                        className={`px-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 ${isFilterDropdownOpen ? 'ring-2 ring-lime-500' : ''}`}
                    >
                        <Filter className="w-4 h-4" /> Filter
                    </button>

                    {isFilterDropdownOpen && (
                        <div className="absolute top-12 right-0 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl rounded-xl z-20 animate-fade-in p-1">
                            <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase px-3 py-2">View</div>
                            <button onClick={() => { setActiveFilter('All'); setIsFilterDropdownOpen(false); }} className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg flex justify-between items-center">
                                All Reviews {activeFilter === 'All' && <Check className="w-3 h-3 text-lime-600" />}
                            </button>
                            <button onClick={() => { setActiveFilter('Unanswered'); setIsFilterDropdownOpen(false); }} className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg flex justify-between items-center">
                                Unanswered {activeFilter === 'Unanswered' && <Check className="w-3 h-3 text-lime-600" />}
                            </button>
                            <div className="h-px bg-slate-100 dark:bg-slate-800 my-1"></div>
                            <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase px-3 py-2">Sort By</div>
                            <button className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg">Newest First</button>
                            <button className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg">Rating (High to Low)</button>
                            <button className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg">Rating (Low to High)</button>
                        </div>
                    )}

                    <button
                        onClick={() => setIsRequestModalOpen(true)}
                        className="px-4 py-2 bg-lime-600 text-white rounded-lg text-sm font-medium hover:bg-lime-700 transition-colors flex items-center gap-2 shadow-sm"
                    >
                        <ThumbsUp className="w-4 h-4" /> Request Reviews
                    </button>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="flex-1 overflow-y-auto pr-1">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4 transition-colors">
                        <div className="p-4 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400">
                            <Star className="w-8 h-8 fill-current" />
                        </div>
                        <div>
                            <h3 className="text-3xl font-bold text-slate-800 dark:text-slate-100">4.8</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Average Rating</p>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4 transition-colors">
                        <div className="p-4 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                            <MessageCircle className="w-8 h-8" />
                        </div>
                        <div>
                            <h3 className="text-3xl font-bold text-slate-800 dark:text-slate-100">{reviews.length}</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Total Reviews</p>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4 transition-colors">
                        <div className="p-4 rounded-full bg-lime-100 dark:bg-lime-900/30 text-lime-600 dark:text-lime-400">
                            <ThumbsUp className="w-8 h-8" />
                        </div>
                        <div>
                            <h3 className="text-3xl font-bold text-slate-800 dark:text-slate-100">12</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">New This Month</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-4">
                        {/* Pill Filters */}
                        <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2">
                            {['All', 'Google', 'Facebook', 'Instagram', 'TikTok', 'Unanswered'].map(filter => (
                                <button
                                    key={filter}
                                    onClick={() => setActiveFilter(filter)}
                                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap
                                ${activeFilter === filter
                                            ? 'bg-slate-800 text-white dark:bg-white dark:text-slate-900 shadow-md'
                                            : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                                >
                                    {filter}
                                </button>
                            ))}
                        </div>

                        {/* Reviews List */}
                        {filteredReviews.length > 0 ? (
                            filteredReviews.map(review => (
                                <ReviewCard key={review.id} review={review} />
                            ))
                        ) : (
                            <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                                <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
                                    <Filter className="w-6 h-6" />
                                </div>
                                <h3 className="text-slate-800 dark:text-slate-100 font-medium">No reviews found</h3>
                                <p className="text-slate-500 dark:text-slate-400 text-sm">Try adjusting your filters.</p>
                            </div>
                        )}
                    </div>

                    <div className="space-y-6">
                        <div className="bg-gradient-to-br from-lime-600 to-emerald-600 rounded-xl p-6 text-white shadow-lg relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-10 transform translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform">
                                <ThumbsUp className="w-32 h-32" />
                            </div>
                            <h3 className="font-bold text-lg mb-2 relative z-10">Get More Reviews</h3>
                            <p className="text-lime-100 text-sm mb-6 relative z-10 leading-relaxed">Launch a new automated campaign to recent customers and boost your rating.</p>
                            <button
                                onClick={() => setIsRequestModalOpen(true)}
                                className="w-full bg-white text-lime-700 font-bold py-3 rounded-lg shadow-sm hover:bg-lime-50 transition-colors relative z-10"
                            >
                                Launch Campaign
                            </button>
                        </div>

                        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm transition-colors">
                            <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-4">Sentiment Analysis</h3>
                            <div className="space-y-4">
                                <div>
                                    <div className="flex justify-between text-xs mb-1.5">
                                        <span className="text-slate-600 dark:text-slate-400 font-medium">Positive</span>
                                        <span className="text-slate-800 dark:text-slate-200 font-bold">85%</span>
                                    </div>
                                    <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                        <div className="h-full bg-green-500 w-[85%] rounded-full"></div>
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between text-xs mb-1.5">
                                        <span className="text-slate-600 dark:text-slate-400 font-medium">Neutral</span>
                                        <span className="text-slate-800 dark:text-slate-200 font-bold">10%</span>
                                    </div>
                                    <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                        <div className="h-full bg-yellow-400 w-[10%] rounded-full"></div>
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between text-xs mb-1.5">
                                        <span className="text-slate-600 dark:text-slate-400 font-medium">Negative</span>
                                        <span className="text-slate-800 dark:text-slate-200 font-bold">5%</span>
                                    </div>
                                    <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                        <div className="h-full bg-red-500 w-[5%] rounded-full"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Request Reviews Modal */}
            {isRequestModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="request-reviews-title">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden transform transition-all scale-100 max-h-[90dvh] overflow-y-auto">
                        <div className="flex justify-between items-center p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                            <h3 id="request-reviews-title" className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                <ThumbsUp className="w-4 h-4 text-lime-600" /> Request Reviews
                            </h3>
                            <button onClick={() => setIsRequestModalOpen(false)} aria-label="Close request reviews dialog" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleRequestSubmit} className="p-6">
                            <div className="flex gap-4 mb-6">
                                <button
                                    type="button"
                                    onClick={() => setCampaignType('sms')}
                                    className={`flex-1 p-3 rounded-lg border-2 text-sm font-bold flex flex-col items-center gap-2 transition-all ${campaignType === 'sms' ? 'border-lime-500 bg-lime-50 dark:bg-lime-900/20 text-lime-700 dark:text-lime-400' : 'border-slate-200 dark:border-slate-700 hover:border-lime-200 dark:hover:border-slate-600 text-slate-500 dark:text-slate-400'}`}
                                >
                                    <Smartphone className="w-5 h-5" /> SMS
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCampaignType('email')}
                                    className={`flex-1 p-3 rounded-lg border-2 text-sm font-bold flex flex-col items-center gap-2 transition-all ${campaignType === 'email' ? 'border-lime-500 bg-lime-50 dark:bg-lime-900/20 text-lime-700 dark:text-lime-400' : 'border-slate-200 dark:border-slate-700 hover:border-lime-200 dark:hover:border-slate-600 text-slate-500 dark:text-slate-400'}`}
                                >
                                    <Mail className="w-5 h-5" /> Email
                                </button>
                            </div>

                            <div className="space-y-4 mb-6">
                                <div>
                                    <label htmlFor="review-request-audience" className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Audience</label>
                                    <select id="review-request-audience" className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-lime-500 focus:outline-none">
                                        <option>Recent Customers (Last 7 Days)</option>
                                        <option>All Customers</option>
                                        <option>Tag: VIP</option>
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="review-request-message" className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Message Preview</label>
                                    <textarea
                                        id="review-request-message"
                                        rows={4}
                                        className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-lime-500 focus:outline-none resize-none"
                                        defaultValue={campaignType === 'sms'
                                            ? "Hi {first_name}, thanks for visiting us! Would you mind taking 30 seconds to leave us a review? Link: leadops.review/link"
                                            : "Subject: How was your experience?\n\nHi {first_name},\n\nThank you for choosing us. We strive for 5-star service. Could you leave us a quick review?\n\nBest,\nLeadOps Team"}
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsRequestModalOpen(false)}
                                    className="flex-1 py-3 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={sending}
                                    className="flex-1 py-3 bg-lime-600 text-white rounded-lg text-sm font-bold hover:bg-lime-700 transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-70"
                                >
                                    {sending ? 'Sending...' : (
                                        <>
                                            <Send className="w-4 h-4" /> Send Campaign
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
