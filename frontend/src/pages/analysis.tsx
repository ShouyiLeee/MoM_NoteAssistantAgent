import { useState, useRef, useEffect } from "react";
import Head from "next/head";
import Layout, { useAppToast } from "@/components/layout/Layout";
import { analyzeInterviews } from "@/lib/api";
import { useRequireAuth } from "@/hooks/useRequireAuth";

interface Message {
  role: "user" | "ai";
  content: string;
  chunks?: number;
}

const SUGGESTIONS = [
  "Why do I keep failing coding interviews?",
  "What is my weakest interview stage?",
  "Which companies rejected me and why?",
  "How has my performance improved over time?",
  "What skills should I focus on next?",
];

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm ${
          isUser
            ? "bg-blue-600 text-white rounded-br-sm"
            : "bg-white border border-gray-200 text-gray-800 rounded-bl-sm shadow-sm"
        }`}
      >
        <p className="whitespace-pre-wrap">{msg.content}</p>
        {msg.chunks !== undefined && !isUser && (
          <p className="text-xs text-gray-400 mt-1">{msg.chunks} context chunks used</p>
        )}
      </div>
    </div>
  );
}

function ChatInterface() {
  const { toast } = useAppToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async (query: string) => {
    const q = query.trim();
    if (!q || loading) return;

    setMessages((prev) => [...prev, { role: "user", content: q }]);
    setInput("");
    setLoading(true);

    try {
      const res = await analyzeInterviews(q);
      setMessages((prev) => [
        ...prev,
        { role: "ai", content: res.answer, chunks: res.context_chunks_used },
      ]);
    } catch (e: unknown) {
      const detail =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "Analysis failed. Check that the backend is running.";
      toast(detail, "error");
      setMessages((prev) => [
        ...prev,
        { role: "ai", content: `Error: ${detail}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)]">
      {/* Chat area */}
      <div className="flex-1 overflow-y-auto space-y-4 p-4 card bg-gray-50 mb-4">
        {messages.length === 0 && (
          <div className="text-center pt-12 text-gray-400">
            <p className="text-4xl mb-3">🔍</p>
            <p className="font-medium">Ask anything about your interview performance</p>
            <p className="text-sm mt-1">The AI will analyze your history and provide insights.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="px-3 py-1.5 bg-white border border-gray-200 rounded-full text-xs text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} />
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input
          type="text"
          className="input flex-1"
          placeholder="Ask about your interview performance..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage(input)}
          disabled={loading}
        />
        <button
          className="btn-primary px-5"
          onClick={() => sendMessage(input)}
          disabled={loading || !input.trim()}
        >
          Send
        </button>
      </div>
    </div>
  );
}

export default function AnalysisPage() {
  useRequireAuth();
  return (
    <>
      <Head>
        <title>AI Analysis — Interview Note Agent</title>
      </Head>
      <Layout title="AI Analysis">
        <ChatInterface />
      </Layout>
    </>
  );
}
