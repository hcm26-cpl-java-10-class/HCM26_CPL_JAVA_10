import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Bot, Send, X, Sparkles, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { chatbotApi, type ChatMessage } from '@/api/features/chatbot.api';

const STORAGE_KEY = 'system_ai_chat_history';

const QUICK_SUGGESTIONS = [
    'Cách nộp sản phẩm (Artifact) cho Milestone?',
    'Làm sao để xem điểm thi và gửi phúc khảo?',
    'Hướng dẫn tạo Sprint và quản lý Backlog?',
];

export const SystemChatbotWidget: React.FC = () => {
    const location = useLocation();
    const [isOpen, setIsOpen] = useState(false);
    const [showBubble, setShowBubble] = useState(true);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const [messages, setMessages] = useState<ChatMessage[]>(() => {
        try {
            const saved = sessionStorage.getItem(STORAGE_KEY);
            if (saved) return JSON.parse(saved);
        } catch {
            // ignore
        }
        return [
            {
                id: 'welcome',
                role: 'assistant',
                content:
                    'Xin chào! Tôi là trợ lý AI của hệ thống. Tôi có thể giúp gì cho bạn về Khóa học, Thi cử hay Quản lý Dự án?',
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
        ];
    });


    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
        if (isOpen) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isOpen]);

    const handleSend = async (textToSend?: string) => {
        const content = (textToSend ?? input).trim();
        if (!content || isLoading) return;

        const userMsg: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            content,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };

        const updatedMessages = [...messages, userMsg];
        setMessages(updatedMessages);
        if (!textToSend) setInput('');
        setIsLoading(true);

        try {
            const historyPayload = updatedMessages
                .filter((m) => m.id !== 'welcome')
                .slice(-6)
                .map(({ role, content }) => ({ role, content }));

            const res = await chatbotApi.ask({
                message: content,
                currentPath: location.pathname,
                history: historyPayload,
            });

            const botMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: res.reply,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            };
            setMessages((prev) => [...prev, botMsg]);
        } catch {
            setMessages((prev) => [
                ...prev,
                {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: 'Hệ thống đang bận hoặc mất kết nối. Vui lòng thử lại sau ít phút.',
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleClearHistory = () => {
        sessionStorage.removeItem(STORAGE_KEY);
        setMessages([
            {
                id: 'welcome',
                role: 'assistant',
                content: 'Lịch sử trò chuyện đã được làm mới. Bạn cần hỗ trợ gì về hệ thống?',
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
        ]);
    };

    const hiddenPaths = ['/login', '/register', '/forgot-password', '/reset-password', '/oauth2'];
    if (hiddenPaths.some((path) => location.pathname.startsWith(path))) {
        return null;
    }

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
            {/* KHUNG CỬA SỔ CHAT KHI MỞ */}
            {isOpen && (
                <div className="mb-3 flex h-[520px] w-[380px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b bg-blue-700 px-4 py-3 text-white shadow-xl">
                        <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-foreground/15">
                                <Sparkles className="h-4 w-4" />
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold leading-none">Trợ lý Hệ thống AI</h3>
                                <p className="mt-1 text-[11px] opacity-80">Chỉ hỗ trợ nghiệp vụ nền tảng</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-white hover:bg-primary-foreground/15"
                                onClick={handleClearHistory}
                                title="Xóa cuộc trò chuyện"
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-white hover:bg-primary-foreground/15"
                                onClick={() => setIsOpen(false)}
                                title="Thu gọn"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    {/* Danh sách tin nhắn */}
                    <div className="flex-1 space-y-3 overflow-y-auto p-4">
                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                            >
                                <div
                                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap leading-relaxed ${
                                        msg.role === 'user'
                                            ? 'rounded-br-sm bg-blue-700 text-white'
                                            : 'rounded-bl-sm bg-muted text-foreground'
                                    }`}
                                >
                                    {msg.content}
                                </div>
                                <span className="mt-1 px-1 text-[10px] text-muted-foreground">{msg.timestamp}</span>
                            </div>
                        ))}

                        {/* Gợi ý nhanh khi mới bắt đầu */}
                        {messages.length === 1 && !isLoading && (
                            <div className="pt-2 space-y-1.5">
                                <p className="text-xs font-medium text-muted-foreground">Gợi ý câu hỏi:</p>
                                {QUICK_SUGGESTIONS.map((q, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        onClick={() => handleSend(q)}
                                        className="block w-full rounded-xl border border-border bg-card px-3 py-2 text-left text-xs text-foreground transition hover:bg-accent"
                                    >
                                        {q}
                                    </button>
                                ))}
                            </div>
                        )}

                        {isLoading && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <div className="flex items-center gap-1.5 rounded-2xl bg-muted px-3.5 py-2.5">
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    <span>Đang xử lý...</span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Ô nhập câu hỏi */}
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            handleSend();
                        }}
                        className="flex items-center gap-2 border-t bg-background p-3"
                    >
                        <Input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Hỏi về khóa học, bài thi, dự án..."
                            className="flex-1 rounded-full text-sm"
                            disabled={isLoading}
                        />
                        <Button
                            type="submit"
                            size="icon"
                            className="h-9 w-9 shrink-0 rounded-full bg-blue-700 text-white"
                            disabled={!input.trim() || isLoading}
                        >
                            <Send className="h-4 w-4" />
                        </Button>
                    </form>
                </div>
            )}

            {/* NÚT FLOATING ICON + BONG BÓNG NHẮC NHỞ (GIỐNG HÌNH 2) */}
            {!isOpen && (
                <div className="flex items-center gap-3">
                    {showBubble && (
                        <div className="relative flex items-center rounded-full bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg">
                            <span>Bạn cần hỗ trợ gì?</span>
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowBubble(false);
                                }}
                                className="absolute -right-1.5 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-neutral-700 text-white hover:bg-neutral-900"
                                aria-label="Đóng thông báo"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={() => {
                            setIsOpen(true);
                            setShowBubble(false);
                        }}
                        className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-xl transition-transform hover:scale-105 active:scale-95"
                        aria-label="Mở trợ lý AI"
                    >
                        <Bot className="h-7 w-7" />
                    </button>
                </div>
            )}
        </div>
    );
};