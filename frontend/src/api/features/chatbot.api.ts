import axiosInstance from '@/api/axios';

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
}

export interface SystemChatRequest {
    message: string;
    currentPath: string;
    history: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface SystemChatResponse {
    reply: string;
    outOfScope: boolean;
}

export const chatbotApi = {
    ask: async (payload: SystemChatRequest): Promise<SystemChatResponse> => {
        const response = await axiosInstance.post<SystemChatResponse>('/chatbot/ask', payload);
        return response.data;
    },
};