import { useEffect, useRef, useState } from "react";
import { Send, X } from "lucide-react";
import { useAuth } from "../../auth/useAuth";
import { useLanguage } from "../../i18n/useLanguage";
import { magicAssistantTranslations } from "../../i18n/translations";
import { getAssistantAnswer, getSuggestedQuestions } from "../../assistant/assistantEngine";
import magicIcon from "../../assets/magic.svg";

interface ChatMessage {
  role: "assistant" | "user";
  text: string;
}

// Global floating "app assistant" trigger, mounted once (see RequireAuth) so it floats over every
// authenticated screen. Answers come from a local, offline knowledge base (assistantEngine.ts /
// knowledgeBase.ts) rather than a real AI API - see that module's own comment for why - filtered
// by the connected user's role so it only guides them toward features/resources they actually
// have access to, and gives a role-restricted notice (not the real instructions) when the best
// match is for a feature outside their role.
const MagicAssistant = () => {
  const { authPayload } = useAuth();
  const role = authPayload?.role ?? "";
  const [language] = useLanguage();
  const t = magicAssistantTranslations[language];
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", text: t.welcomeMessage },
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages, isOpen]);

  const suggestions = getSuggestedQuestions(role, 5);

  const askAssistant = (question: string) => {
    const trimmed = question.trim();
    if (!trimmed) return;
    const { text } = getAssistantAnswer(trimmed, role, language, t.fallbackReply);
    setMessages((prev) => [
      ...prev,
      { role: "user", text: trimmed },
      { role: "assistant", text },
    ]);
  };

  const handleSend = () => {
    askAssistant(input);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {isOpen && (
        <div className="w-80 sm:w-96 h-112 max-h-[70vh] rounded-2xl p-0.5 bg-linear-to-br from-sky-400 via-indigo-500 to-purple-600 shadow-2xl shadow-purple-500/30">
          <div className="w-full h-full bg-base-100 rounded-[calc(1rem-2px)] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-base-300 bg-linear-to-r from-sky-500/10 to-purple-500/10">
              <div className="flex items-center gap-2">
                <img src={magicIcon} alt="" className="w-5 h-5" />
                <div>
                  <p className="font-semibold leading-tight">{t.panelTitle}</p>
                  <p className="text-xs opacity-60 leading-tight">{t.panelSubtitle}</p>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-xs btn-circle"
                onClick={() => setIsOpen(false)}
                aria-label={t.closeBtn}
                title={t.closeBtn}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`chat ${message.role === "user" ? "chat-end" : "chat-start"}`}
                >
                  <div
                    className={`chat-bubble whitespace-pre-line ${
                      message.role === "user" ? "chat-bubble-primary" : ""
                    }`}
                  >
                    {message.text}
                  </div>
                </div>
              ))}
              {messages.length <= 1 && suggestions.length > 0 && (
                <div className="pt-1">
                  <p className="text-xs opacity-60 mb-2">{t.suggestionsTitle}</p>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map((entry) => (
                      <button
                        key={entry.id}
                        type="button"
                        className="btn btn-xs btn-outline rounded-full normal-case"
                        onClick={() => askAssistant(entry.question[language])}
                      >
                        {entry.question[language]}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
            <div className="flex items-center gap-2 px-3 py-3 border-t border-base-300">
              <input
                type="text"
                className="input input-bordered input-sm flex-1"
                placeholder={t.inputPlaceholder}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <button
                type="button"
                className="btn btn-primary btn-sm btn-circle"
                onClick={handleSend}
                aria-label={t.sendBtn}
                title={t.sendBtn}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
      <button
        type="button"
        className="group relative btn btn-circle btn-lg border border-sky-300/40 bg-sky-400/20 backdrop-blur-md shadow-lg shadow-sky-500/20 transition-all duration-300 ease-out hover:bg-sky-400/30 hover:scale-110 hover:shadow-xl hover:shadow-sky-400/40"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={t.buttonLabel}
        title={t.buttonLabel}
      >
        <span className="absolute inset-0 rounded-full bg-sky-400/40 opacity-0 group-hover:opacity-100 group-hover:animate-ping" />
        <img
          src={magicIcon}
          alt=""
          className="relative w-7 h-7 transition-transform duration-300 ease-out group-hover:rotate-12 group-hover:scale-110"
        />
      </button>
    </div>
  );
};

export default MagicAssistant;
