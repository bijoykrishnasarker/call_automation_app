'use client';

import React, { useState } from 'react';
import { Review } from '@/types';
import { Star, ThumbsUp, MoreHorizontal, ExternalLink, Filter, Instagram, Facebook, MapPin, Check, X, Send, Mail, Smartphone, Video, Sparkles, ChevronDown, PenLine, HelpCircle } from 'lucide-react';

const MOCK_REVIEWS: Review[] = [
    { id: '1', author: 'Curtis Jenkins', rating: 5, text: 'Absolutely amazing service! The team was on time and fixed my plumbing issue in under an hour.', source: 'Google', date: '2 days ago', status: 'Replied', reply: 'Thanks Curtis! Glad we could help so quickly. We look forward to serving you again.' },
    { id: '2', author: 'John Doe', rating: 4, text: 'Good experience overall, but scheduling took a bit longer than expected.', source: 'Yelp', date: '5 days ago', status: 'Pending' },
    { id: '3', author: 'Mike Ross', rating: 5, text: 'Best in town. Highly recommend for any HVAC needs.', source: 'Google', date: '1 week ago', status: 'Pending' },
    { id: '4', author: 'Jessica K.', rating: 5, text: 'Love the new aesthetics clinic! Treatment was super relaxing. 📸✨', source: 'Instagram', date: '1 day ago', status: 'Pending' },
    { id: '5', author: 'Emily Blunt', rating: 3, text: 'Okay service, but a bit pricey for what I got.', source: 'Facebook', date: '3 days ago', status: 'Pending' },
    { id: '6', author: 'Tyler Creator', rating: 5, text: 'Saw this on my FYP and had to try. Worth the hype! 🔥', source: 'TikTok', date: '4 hours ago', status: 'Pending' }
];

const initials = (name: string) =>
    name.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();

const sentimentOf = (rating: number) => {
    if (rating >= 4) return { label: 'Positive', className: 'bg-emerald-500/15 text-emerald-400' };
    if (rating === 3) return { label: 'Neutral', className: 'bg-zinc-700 text-zinc-300' };
    return { label: 'Negative', className: 'bg-red-500/15 text-red-400' };
};

const Stars = ({ rating }: { rating: number }) => (
    <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className={`h-4 w-4 ${i < rating ? 'fill-emerald-400 text-emerald-400' : 'text-zinc-700'}`} />
        ))}
    </div>
);

const ReviewCard = ({
    review,
    onReply,
}: {
    review: Review;
    onReply: (id: string, text: string) => void;
}) => {
    const [isGenerating, setIsGenerating] = useState(false);
    const [draft, setDraft] = useState<string | null>(null);
    const [isManual, setIsManual] = useState(false);
    const [manualText, setManualText] = useState('');
    const sentiment = sentimentOf(review.rating);

    const handleGenerateAI = () => {
        setIsManual(false);
        setIsGenerating(true);
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
            case 'Google': return <MapPin className="h-3 w-3" />;
            case 'Facebook': return <Facebook className="h-3 w-3" />;
            case 'Instagram': return <Instagram className="h-3 w-3" />;
            case 'TikTok': return <Video className="h-3 w-3" />;
            default: return <ExternalLink className="h-3 w-3" />;
        }
    };

    return (
        <article className="rounded-xl border border-white/[0.06] bg-[#141416] p-5">
            <div className="mb-3 flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-500/20 text-sm font-bold text-violet-300">
                        {initials(review.author)}
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-white">{review.author}</h4>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-zinc-500">
                            <span className="inline-flex items-center gap-1">{getIcon(review.source)} {review.source}</span>
                            <span>•</span>
                            <span>{review.date}</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Stars rating={review.rating} />
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${sentiment.className}`}>
                        {sentiment.label}
                    </span>
                    <button type="button" className="rounded-full p-1 text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300">
                        <MoreHorizontal className="h-4 w-4" />
                    </button>
                </div>
            </div>

            <p className="mb-4 text-sm leading-relaxed text-zinc-200">
                {review.text}
            </p>

            {review.reply && (
                <div className="mb-4 rounded-lg bg-[#0B0C0E] p-3">
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Your Response</p>
                    <p className="text-sm text-zinc-300">{review.reply}</p>
                </div>
            )}

            {draft && !review.reply && (
                <div className="mb-4 rounded-lg border border-violet-500/20 bg-violet-500/5 p-3 animate-fade-in">
                    <div className="mb-1 flex items-center justify-between">
                        <p className="flex items-center gap-1 text-xs font-bold text-violet-300"><Sparkles className="h-3 w-3" /> AI Suggestion</p>
                        <button type="button" onClick={() => setDraft(null)} className="text-zinc-500 hover:text-zinc-300"><X className="h-3 w-3" /></button>
                    </div>
                    <textarea
                        className="w-full resize-none bg-transparent text-sm text-zinc-200 italic outline-none"
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                    />
                    <div className="mt-2 flex gap-2">
                        <button
                            type="button"
                            onClick={() => { if (draft) onReply(review.id, draft); setDraft(null); }}
                            className="rounded-md bg-violet-500 px-3 py-1 text-xs font-bold text-white hover:bg-violet-400"
                        >
                            Post Reply
                        </button>
                        <button type="button" onClick={() => setDraft(null)} className="rounded-md border border-zinc-700 px-3 py-1 text-xs font-medium text-zinc-400 hover:bg-white/[0.04]">
                            Discard
                        </button>
                    </div>
                </div>
            )}

            {isManual && !review.reply && (
                <div className="mb-4 rounded-lg bg-[#0B0C0E] p-3">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Write Manual Reply</p>
                    <textarea
                        rows={3}
                        value={manualText}
                        onChange={(e) => setManualText(e.target.value)}
                        placeholder="Write your reply..."
                        className="w-full resize-none rounded-lg border border-zinc-800 bg-[#141416] p-2.5 text-sm text-zinc-200 outline-none placeholder:text-zinc-600 focus:ring-2 focus:ring-violet-500/30"
                    />
                    <div className="mt-2 flex gap-2">
                        <button
                            type="button"
                            disabled={!manualText.trim()}
                            onClick={() => { onReply(review.id, manualText.trim()); setIsManual(false); setManualText(''); }}
                            className="rounded-md bg-violet-500 px-3 py-1 text-xs font-bold text-white hover:bg-violet-400 disabled:opacity-50"
                        >
                            Post Reply
                        </button>
                        <button type="button" onClick={() => { setIsManual(false); setManualText(''); }} className="rounded-md border border-zinc-700 px-3 py-1 text-xs font-medium text-zinc-400">
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {!review.reply && !draft && (
                <div className="flex flex-wrap gap-3 border-t border-white/[0.06] pt-4">
                    <button
                        type="button"
                        onClick={handleGenerateAI}
                        disabled={isGenerating}
                        className="inline-flex items-center gap-2 rounded-lg bg-violet-500 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-400 disabled:opacity-70"
                    >
                        {isGenerating ? <Sparkles className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                        {isGenerating ? 'Drafting...' : 'Generate AI Reply'}
                    </button>
                    <button
                        type="button"
                        onClick={() => { setIsManual(true); setDraft(null); }}
                        className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-white/[0.04]"
                    >
                        <PenLine className="h-4 w-4" />
                        Write Manual Reply
                    </button>
                </div>
            )}
        </article>
    );
};

export const Reviews: React.FC = () => {
    const [activeFilter, setActiveFilter] = useState('All');
    const [sortBy, setSortBy] = useState<'recent' | 'high' | 'low'>('recent');
    const [reviews, setReviews] = useState<Review[]>(MOCK_REVIEWS);
    const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
    const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
    const [campaignType, setCampaignType] = useState<'sms' | 'email'>('sms');
    const [sending, setSending] = useState(false);

    const filteredReviews = reviews
        .filter(review => {
            if (activeFilter === 'All') return true;
            if (activeFilter === 'Unanswered') return review.status === 'Pending';
            if (activeFilter === 'Answered') return review.status === 'Replied';
            return review.source === activeFilter;
        })
        .sort((a, b) => {
            if (sortBy === 'high') return b.rating - a.rating;
            if (sortBy === 'low') return a.rating - b.rating;
            return 0;
        });

    const total = reviews.length || 1;
    const positivePct = Math.round((reviews.filter(r => r.rating >= 4).length / total) * 100);
    const neutralPct = Math.round((reviews.filter(r => r.rating === 3).length / total) * 100);
    const negativePct = Math.max(0, 100 - positivePct - neutralPct);
    const avgRating = reviews.length
        ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
        : '0.0';

    const platformCounts = [
        { name: 'Google Business', source: 'Google' as const, icon: MapPin, count: reviews.filter(r => r.source === 'Google').length },
        { name: 'Yelp', source: 'Yelp' as const, icon: ExternalLink, count: reviews.filter(r => r.source === 'Yelp').length },
        { name: 'Facebook', source: 'Facebook' as const, icon: Facebook, count: reviews.filter(r => r.source === 'Facebook').length },
    ];

    const handleReply = (id: string, text: string) => {
        setReviews(prev => prev.map(r => r.id === id ? { ...r, status: 'Replied', reply: text } : r));
    };

    const handleRequestSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setSending(true);
        setTimeout(() => {
            setSending(false);
            setIsRequestModalOpen(false);
            alert('Review request campaign queued successfully!');
        }, 1500);
    };

    return (
        <div className="relative flex h-full flex-col space-y-6">
            <div className="flex flex-shrink-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <p className="mb-1 text-[11px] font-medium text-zinc-500">
                        Reputation <span className="text-zinc-600">›</span> Reviews
                    </p>
                    <h2 className="text-2xl font-bold tracking-tight text-white">Reputation Management</h2>
                    <p className="mt-1 text-sm text-zinc-500">Monitor, analyze, and reply to customer feedback across all channels.</p>
                </div>
                <button
                    type="button"
                    onClick={() => setIsRequestModalOpen(true)}
                    className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-400"
                >
                    <ThumbsUp className="h-4 w-4" /> Request Reviews
                </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-1">
                <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(16rem,1fr)]">
                    <section className="rounded-xl border border-white/[0.06] bg-[#141416] p-5">
                        <div className="mb-5 flex items-start justify-between gap-3">
                            <div>
                                <h3 className="flex items-center gap-2 font-bold text-white">
                                    Global Sentiment
                                    <HelpCircle className="h-3.5 w-3.5 text-zinc-600" />
                                </h3>
                                <p className="mt-1 text-xs text-zinc-500">A breakdown of sentiment across all platforms.</p>
                            </div>
                        </div>
                        <div className="flex flex-col gap-6 md:flex-row md:items-center">
                            <div className="min-w-0 flex-1 space-y-4">
                                {[
                                    { label: 'Positive', pct: positivePct, bar: 'bg-emerald-500' },
                                    { label: 'Neutral', pct: neutralPct, bar: 'bg-zinc-500' },
                                    { label: 'Negative', pct: negativePct, bar: 'bg-red-500' },
                                ].map(row => (
                                    <div key={row.label}>
                                        <div className="mb-1.5 flex items-center justify-between text-xs">
                                            <span className="font-medium text-zinc-400">{row.label}</span>
                                            <span className="font-bold text-white">{row.pct}%</span>
                                        </div>
                                        <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                                            <div className={`h-full rounded-full ${row.bar}`} style={{ width: `${row.pct}%` }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="flex shrink-0 flex-col items-center rounded-xl border border-white/[0.06] bg-[#0B0C0E] px-8 py-5">
                                <p className="text-4xl font-bold text-white">{avgRating}</p>
                                <p className="mt-1 text-xs font-medium text-zinc-500">Average Rating</p>
                                <div className="mt-2"><Stars rating={5} /></div>
                            </div>
                        </div>
                    </section>

                    <section className="rounded-xl border border-white/[0.06] bg-[#141416] p-5">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="font-bold text-white">By Platform</h3>
                            <Filter className="h-4 w-4 text-zinc-500" />
                        </div>
                        <div className="space-y-2">
                            {platformCounts.map(p => {
                                const Icon = p.icon;
                                return (
                                    <button
                                        key={p.name}
                                        type="button"
                                        onClick={() => setActiveFilter(p.source)}
                                        className="flex w-full items-center gap-3 rounded-lg bg-[#0B0C0E] px-3 py-3 text-left hover:bg-white/[0.03]"
                                    >
                                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10 text-violet-300">
                                            <Icon className="h-4 w-4" />
                                        </div>
                                        <span className="flex-1 text-sm font-medium text-zinc-200">{p.name}</span>
                                        <span className="text-xs text-zinc-500">{p.count} reviews</span>
                                    </button>
                                );
                            })}
                        </div>
                    </section>
                </div>

                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <h3 className="text-lg font-bold text-white">Customer Reviews</h3>
                    <div className="flex flex-wrap items-center gap-2">
                        {['All', 'Unanswered', 'Answered'].map(filter => (
                            <button
                                key={filter}
                                type="button"
                                onClick={() => setActiveFilter(filter)}
                                className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                                    activeFilter === filter
                                        ? 'bg-violet-500 text-white'
                                        : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200'
                                }`}
                            >
                                {filter}
                            </button>
                        ))}
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-[#141416] px-3 py-1.5 text-sm font-medium text-zinc-300 hover:bg-white/[0.04]"
                            >
                                Most Recent
                                <ChevronDown className="h-3.5 w-3.5" />
                            </button>
                            {isFilterDropdownOpen && (
                                <div className="absolute right-0 z-20 mt-2 w-48 animate-fade-in rounded-xl border border-white/[0.08] bg-[#141416] p-1 shadow-xl">
                                    <button type="button" onClick={() => { setSortBy('recent'); setIsFilterDropdownOpen(false); }} className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-zinc-200 hover:bg-white/[0.04]">
                                        Newest First {sortBy === 'recent' && <Check className="h-3 w-3 text-violet-400" />}
                                    </button>
                                    <button type="button" onClick={() => { setSortBy('high'); setIsFilterDropdownOpen(false); }} className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-zinc-200 hover:bg-white/[0.04]">
                                        Rating (High to Low) {sortBy === 'high' && <Check className="h-3 w-3 text-violet-400" />}
                                    </button>
                                    <button type="button" onClick={() => { setSortBy('low'); setIsFilterDropdownOpen(false); }} className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-zinc-200 hover:bg-white/[0.04]">
                                        Rating (Low to High) {sortBy === 'low' && <Check className="h-3 w-3 text-violet-400" />}
                                    </button>
                                </div>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
                            className="rounded-lg border border-zinc-800 p-2 text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"
                            aria-label="Filter reviews"
                        >
                            <Filter className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                <div className="space-y-4">
                    {filteredReviews.length > 0 ? (
                        filteredReviews.map(review => (
                            <ReviewCard key={review.id} review={review} onReply={handleReply} />
                        ))
                    ) : (
                        <div className="rounded-xl border border-dashed border-zinc-800 bg-[#141416] py-12 text-center">
                            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800 text-zinc-500">
                                <Filter className="h-6 w-6" />
                            </div>
                            <h3 className="font-medium text-white">No reviews found</h3>
                            <p className="text-sm text-zinc-500">Try adjusting your filters.</p>
                        </div>
                    )}
                </div>
            </div>

            {isRequestModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="request-reviews-title">
                    <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-xl border border-white/[0.08] bg-[#141416] shadow-2xl">
                        <div className="flex items-center justify-between border-b border-white/[0.06] bg-[#111214] p-4">
                            <h3 id="request-reviews-title" className="flex items-center gap-2 font-bold text-white">
                                <ThumbsUp className="h-4 w-4 text-violet-400" /> Request Reviews
                            </h3>
                            <button type="button" onClick={() => setIsRequestModalOpen(false)} aria-label="Close request reviews dialog" className="text-zinc-400 hover:text-zinc-200">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <form onSubmit={handleRequestSubmit} className="p-6">
                            <div className="mb-6 flex gap-4">
                                <button
                                    type="button"
                                    onClick={() => setCampaignType('sms')}
                                    className={`flex flex-1 flex-col items-center gap-2 rounded-lg border-2 p-3 text-sm font-bold transition-all ${campaignType === 'sms' ? 'border-violet-500 bg-violet-500/10 text-violet-300' : 'border-zinc-800 text-zinc-500 hover:border-zinc-700'}`}
                                >
                                    <Smartphone className="h-5 w-5" /> SMS
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCampaignType('email')}
                                    className={`flex flex-1 flex-col items-center gap-2 rounded-lg border-2 p-3 text-sm font-bold transition-all ${campaignType === 'email' ? 'border-violet-500 bg-violet-500/10 text-violet-300' : 'border-zinc-800 text-zinc-500 hover:border-zinc-700'}`}
                                >
                                    <Mail className="h-5 w-5" /> Email
                                </button>
                            </div>

                            <div className="mb-6 space-y-4">
                                <div>
                                    <label htmlFor="review-request-audience" className="mb-1 block text-xs font-bold uppercase text-zinc-500">Audience</label>
                                    <select id="review-request-audience" className="w-full rounded-lg border border-zinc-800 bg-[#0B0C0E] p-2.5 text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-violet-500">
                                        <option>Recent Customers (Last 7 Days)</option>
                                        <option>All Customers</option>
                                        <option>Tag: VIP</option>
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="review-request-message" className="mb-1 block text-xs font-bold uppercase text-zinc-500">Message Preview</label>
                                    <textarea
                                        id="review-request-message"
                                        rows={4}
                                        className="w-full resize-none rounded-lg border border-zinc-800 bg-[#0B0C0E] p-3 text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-violet-500"
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
                                    className="flex-1 rounded-lg border border-zinc-700 py-3 text-sm font-medium text-zinc-300 hover:bg-white/[0.04]"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={sending}
                                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-violet-500 py-3 text-sm font-bold text-white hover:bg-violet-400 disabled:opacity-70"
                                >
                                    {sending ? 'Sending...' : (
                                        <>
                                            <Send className="h-4 w-4" /> Send Campaign
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
