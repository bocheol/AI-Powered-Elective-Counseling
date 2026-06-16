import { useState, useRef, useEffect } from 'react';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Download, Menu, Plus, MessageSquare, X } from 'lucide-react';

type Message = { role: 'user' | 'model', content: string };
type Session = {
  id: string;
  title: string;
  updatedAt: number;
  messages: Message[];
};

export default function StudentMode({ onBack }: { onBack: () => void }) {
  const [studentId, setStudentId] = useState('');
  const [studentName, setStudentName] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const startNewSession = () => {
    const newId = Date.now().toString();
    setCurrentSessionId(newId);
    setMessages([{ role: 'model', content: `안녕하세요, ${studentName} 학생! 어떤 선택과목을 고민 중이신가요? 진로나 관심 분야를 편하게 이야기해주세요.` }]);
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  };

  const loadSession = (id: string) => {
    const session = sessions.find(s => s.id === id);
    if (session) {
      setCurrentSessionId(id);
      setMessages(session.messages);
    }
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  };

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId || !studentName || !password) return;

    setIsAuthenticating(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, studentName, password })
      });
      
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || '인증에 실패했습니다.');
        setIsAuthenticating(false);
        return;
      }
    } catch (err) {
      alert('서버와 통신할 수 없습니다.');
      setIsAuthenticating(false);
      return;
    }
    setIsAuthenticating(false);

    const oldChatData = localStorage.getItem(`chat_${studentId}`);
    if (oldChatData) {
      const sessionsData = localStorage.getItem(`sessions_${studentId}`);
      if (!sessionsData) {
        const parsedOld = JSON.parse(oldChatData);
        if (parsedOld.length > 0) {
          const oldSession: Session = {
            id: 'legacy_' + Date.now(),
            title: '이전 대화 내역',
            updatedAt: Date.now(),
            messages: parsedOld
          };
          localStorage.setItem(`sessions_${studentId}`, JSON.stringify([oldSession]));
        }
      }
    }

    const sessionsData = localStorage.getItem(`sessions_${studentId}`);
    if (sessionsData) {
      setSessions(JSON.parse(sessionsData));
    }

    startNewSession();
    setIsLoggedIn(true);
  };

  const downloadChatHistory = async () => {
    const chatElement = document.getElementById('chat-history-container');
    if (!chatElement) return;

    try {
      const htmlToImage = await import('html-to-image');
      
      const dataUrl = await htmlToImage.toPng(chatElement, {
        backgroundColor: document.documentElement.classList.contains('dark') ? '#111827' : '#f9fafb',
        height: chatElement.scrollHeight,
        style: {
          overflow: 'visible',
          maxHeight: 'none'
        }
      });

      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `상담기록_${studentName}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (error) {
      console.error('이미지 저장 중 오류 발생:', error);
      alert('이미지 저장에 실패했습니다. 잠시 후 다시 시도해주세요.');
    }
  };

  const updateSessionState = (updatedMessages: Message[]) => {
    setMessages(updatedMessages);
    setSessions(prev => {
      let newSessions = [...prev];
      const index = newSessions.findIndex(s => s.id === currentSessionId);
      
      let title = "새로운 상담";
      if (index === -1) {
        const userMessage = updatedMessages.find(m => m.role === 'user')?.content;
        if (userMessage) {
           title = userMessage.slice(0, 15) + (userMessage.length > 15 ? '...' : '');
        }
        newSessions.unshift({
          id: currentSessionId,
          title,
          updatedAt: Date.now(),
          messages: updatedMessages
        });
      } else {
        newSessions[index].messages = updatedMessages;
        newSessions[index].updatedAt = Date.now();
        if (newSessions[index].title === "새로운 상담") {
            const userMessage = updatedMessages.find(m => m.role === 'user')?.content;
            if (userMessage) {
               newSessions[index].title = userMessage.slice(0, 15) + (userMessage.length > 15 ? '...' : '');
            }
        }
      }
      localStorage.setItem(`sessions_${studentId}`, JSON.stringify(newSessions));
      return newSessions;
    });
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    
    const userMessage = input.trim();
    setInput('');
    const newMessages = [...messages, { role: 'user' as const, content: userMessage }];
    
    updateSessionState(newMessages);
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: newMessages,
          studentId,
          studentName
        }),
      });

      if (!response.ok) throw new Error('Network response was not ok');

      const data = await response.json();
      const updatedMessages = [...newMessages, { role: 'model' as const, content: data.text }];
      
      updateSessionState(updatedMessages);
    } catch (error) {
      console.error('Error sending message:', error);
      updateSessionState([...newMessages, { role: 'model', content: '오류가 발생했습니다. 잠시 후 다시 시도해주세요.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-3xl shadow-xl p-8 transform transition-all">
          <button onClick={onBack} className="text-gray-500 hover:text-gray-800 dark:hover:text-white mb-6 flex items-center text-sm font-medium transition-colors">
            &larr; 뒤로 가기
          </button>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">학생 상담 로그인</h2>
          <form onSubmit={handleStart} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">학번 (예: 10101)</label>
              <input 
                type="text" 
                required
                value={studentId}
                onChange={e => setStudentId(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
                placeholder="학번을 입력하세요"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">이름</label>
              <input 
                type="text" 
                required
                value={studentName}
                onChange={e => setStudentName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
                placeholder="이름을 입력하세요"
              />
            </div>
            <div>
              <input 
                required
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="비밀번호 설정/입력 (최초 1회 설정)" 
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
              />
            </div>
            <button 
              type="submit" 
              disabled={isAuthenticating}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl transition-colors shadow-md mt-2 disabled:opacity-50"
            >
              {isAuthenticating ? '인증 중...' : '상담 시작하기'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-gray-50 dark:bg-gray-900 overflow-hidden relative">
      
      {/* Sidebar Overlay for mobile */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 md:hidden" 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform fixed inset-y-0 left-0 z-30 md:relative md:translate-x-0 w-72 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col`}>
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="font-bold text-gray-800 dark:text-gray-200">이전 대화 목록</h2>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 transition-colors">
            <X size={20}/>
          </button>
        </div>
        <div className="p-4">
          <button 
            onClick={startNewSession} 
            className="w-full flex items-center justify-center gap-2 bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 p-3 rounded-xl transition-colors font-semibold"
          >
            <Plus size={18} /> 새 대화 시작
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-1">
          {sessions.length === 0 && (
            <div className="text-center text-sm text-gray-500 py-4">아직 이전 대화가 없습니다.</div>
          )}
          {sessions.map(s => (
            <button 
              key={s.id} 
              onClick={() => loadSession(s.id)} 
              className={`w-full text-left p-3 rounded-xl flex items-center gap-3 transition-colors ${
                currentSessionId === s.id 
                  ? 'bg-blue-100 text-blue-700 dark:bg-gray-700 dark:text-white font-medium' 
                  : 'hover:bg-gray-100 text-gray-700 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
            >
              <MessageSquare size={16} className="opacity-70 flex-shrink-0" />
              <div className="truncate text-sm flex-1">{s.title}</div>
            </button>
          ))}
        </div>
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
           <button onClick={onBack} className="w-full text-sm text-gray-500 hover:text-gray-800 dark:hover:text-white font-medium transition-colors">
             &larr; 첫 화면으로 나가기
           </button>
        </div>
      </div>
      
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative w-full">
        <header className="bg-white dark:bg-gray-800 shadow-sm px-4 md:px-6 py-4 flex items-center justify-between z-10 shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <Menu size={20} />
            </button>
            <h2 className="font-bold text-lg dark:text-white hidden sm:block">AI 선택과목 상담</h2>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <div className="text-xs md:text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100 px-3 py-1.5 rounded-full truncate max-w-[150px] md:max-w-none">
              {studentId} {studentName}
            </div>
            <button 
              onClick={downloadChatHistory}
              title="대화 내역 캡처 저장"
              className="p-2 bg-gray-100 hover:bg-blue-100 text-gray-700 hover:text-blue-700 dark:bg-gray-700 dark:hover:bg-blue-900 dark:text-gray-200 dark:hover:text-blue-200 rounded-full transition-colors flex items-center justify-center shrink-0"
            >
              <Download size={18} />
            </button>
          </div>
        </header>

        <div id="chat-history-container" className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-5 py-3 shadow-sm overflow-hidden ${
                msg.role === 'user' 
                  ? 'bg-blue-600 text-white rounded-br-none' 
                  : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-bl-none border border-gray-100 dark:border-gray-700 prose dark:prose-invert max-w-full prose-sm md:prose-base'
              }`}>
                {msg.role === 'user' ? (
                  <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                ) : (
                  <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                    {msg.content}
                  </ReactMarkdown>
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white dark:bg-gray-800 rounded-2xl rounded-bl-none px-5 py-4 shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 shadow-[0_-1px_10px_rgba(0,0,0,0.05)] z-10 shrink-0">
          <div className="max-w-4xl mx-auto flex gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              placeholder="궁금한 점을 자유롭게 물어보세요..."
              className="flex-1 px-5 py-4 rounded-full border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
              disabled={isLoading}
            />
            <button 
              onClick={sendMessage}
              disabled={isLoading || !input.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white p-4 rounded-full transition-colors shadow-md flex-shrink-0"
            >
              전송
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
