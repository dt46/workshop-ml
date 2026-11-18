import { useState } from "react";
import { Bot, Camera } from "lucide-react";
import { ChatPage } from "./pages/ChatPage";
import { FacePage } from "./pages/FacePage";

type Tab = "chat" | "face";

export default function App() {
  const [tab, setTab] = useState<Tab>("chat");

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center gap-4">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-lg">
          🤖
        </div>
        <div>
          <h1 className="text-base font-bold text-white leading-tight">Workshop Machine Learning</h1>
          <p className="text-xs text-gray-400">Chat Assistant &amp; Face Recognition</p>
        </div>

        <nav className="ml-auto flex gap-1 bg-gray-800 p-1 rounded-xl">
          {([
            ["chat",  "Chat AI",          Bot],
            ["face",  "Face Recognition", Camera],
          ] as [Tab, string, React.ElementType][]).map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                tab === key
                  ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </nav>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-hidden">
        {tab === "chat"  && <ChatPage />}
        {tab === "face"  && <FacePage />}
      </main>
    </div>
  );
}
