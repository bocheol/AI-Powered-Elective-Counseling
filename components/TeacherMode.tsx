import { useState, useRef, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { ChevronRight, ChevronDown, User, Users, FolderOpen, Folder } from 'lucide-react';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

type Student = {
  id: string;
  name: string;
  lastChat: string;
};

type ChatLog = {
  id: string;
  student_id: string;
  student_name: string;
  role: 'user' | 'model';
  content: string;
  created_at: string;
};

type ClassGroup = {
  classId: string;
  students: Student[];
};

type GradeGroup = {
  gradeId: string;
  classes: Record<string, ClassGroup>;
};

export default function TeacherMode({ onBack }: { onBack: () => void }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  
  const [studentTree, setStudentTree] = useState<Record<string, GradeGroup>>({});
  const [expandedGrades, setExpandedGrades] = useState<Record<string, boolean>>({});
  const [expandedClasses, setExpandedClasses] = useState<Record<string, boolean>>({});
  
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentChats, setStudentChats] = useState<ChatLog[]>([]);
  const [isLoadingChats, setIsLoadingChats] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isAuthenticated) {
      fetchStudents();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [studentChats]);

  const fetchStudents = async () => {
    // Supabase에서 대화 내역 전체를 시간 역순으로 가져옴
    const { data, error } = await supabase
      .from('chat_logs')
      .select('student_id, student_name, created_at')
      .order('created_at', { ascending: false });

    if (data) {
      const uniqueMap = new Map<string, Student>();
      data.forEach(d => {
        // 가장 최근 시간의 데이터 1건만 Map에 저장 (order가 역순이므로 처음 만나는게 최신)
        if (!uniqueMap.has(d.student_id)) {
           uniqueMap.set(d.student_id, {
             id: d.student_id,
             name: d.student_name,
             lastChat: new Date(d.created_at).toLocaleString()
           });
        }
      });
      
      const tree: Record<string, GradeGroup> = {};
      
      Array.from(uniqueMap.values()).forEach(student => {
         const idStr = student.id.trim();
         let grade = "기타";
         let cls = "기타";
         
         // 5자리 학번 (예: 10101 -> 1학년 01반 01번)
         if (idStr.length === 5 && !isNaN(Number(idStr))) {
            grade = idStr.substring(0, 1);
            cls = idStr.substring(1, 3);
         }
         
         if (!tree[grade]) tree[grade] = { gradeId: grade, classes: {} };
         if (!tree[grade].classes[cls]) tree[grade].classes[cls] = { classId: cls, students: [] };
         
         tree[grade].classes[cls].students.push(student);
      });
      
      // 번호순 정렬
      Object.values(tree).forEach(g => {
         Object.values(g.classes).forEach(c => {
             c.students.sort((a, b) => a.id.localeCompare(b.id));
         });
      });
      
      setStudentTree(tree);
      
      // 모든 학년을 기본적으로 펼침
      const defaultGrades: Record<string, boolean> = {};
      Object.keys(tree).forEach(k => defaultGrades[k] = true);
      setExpandedGrades(defaultGrades);
    }
  };

  const [teacherGrade, setTeacherGrade] = useState<string | null>(null);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const pw = parseInt(password, 10);
    // 1학년 부장 및 담임: 2709310 ~ 2709319
    if (!isNaN(pw) && (pw >= 2709310 && pw <= 2709319)) {
      setTeacherGrade('1');
      setIsAuthenticated(true);
    // 2학년 부장 및 담임: 2709320 ~ 2709329
    } else if (!isNaN(pw) && (pw >= 2709320 && pw <= 2709329)) {
      setTeacherGrade('2');
      setIsAuthenticated(true);
    } else {
      alert('접근 권한이 없는 내선번호입니다.');
    }
  };

  const loadStudentChats = async (student: Student) => {
    setSelectedStudent(student);
    setIsLoadingChats(true);
    const { data, error } = await supabase
      .from('chat_logs')
      .select('*')
      .eq('student_id', student.id)
      .order('created_at', { ascending: true });
      
    if (data) {
      setStudentChats(data as ChatLog[]);
    }
    setIsLoadingChats(false);
  };

  const toggleGrade = (grade: string) => {
    setExpandedGrades(prev => ({...prev, [grade]: !prev[grade]}));
  };
  
  const toggleClass = (gradeClass: string) => {
    setExpandedClasses(prev => ({...prev, [gradeClass]: !prev[gradeClass]}));
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-3xl shadow-xl p-8 transform transition-all">
          <button onClick={onBack} className="text-gray-500 hover:text-gray-800 dark:hover:text-white mb-6 flex items-center text-sm font-medium transition-colors">
            &larr; 돌아가기
          </button>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">선생님 관리 모드</h2>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <input 
                type="password" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="비밀번호 입력 (내선번호: 2709+내선 3자리)"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
              />
            </div>
            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl transition-colors shadow-md mt-4">
              로그인
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 학년 정렬 (1, 2, 3, 기타)
  const sortedGrades = Object.keys(studentTree).sort((a, b) => {
    if (a === '기타') return 1;
    if (b === '기타') return -1;
    return a.localeCompare(b);
  }).filter(grade => grade === teacherGrade);

  return (
    <div className="h-screen bg-gray-50 dark:bg-gray-900 flex flex-col md:flex-row overflow-hidden">
      {/* Sidebar - Student Tree */}
      <div className="w-full md:w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col h-1/3 md:h-screen shrink-0 relative z-10 shadow-sm">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between shrink-0 bg-white dark:bg-gray-800">
          <h2 className="font-bold text-lg text-gray-800 dark:text-gray-200">학생 명단</h2>
          <button onClick={onBack} className="text-sm text-gray-500 hover:text-blue-600 font-medium transition-colors">홈으로</button>
        </div>
        
        <div className="overflow-y-auto flex-1 p-3 space-y-2">
          {sortedGrades.map(grade => (
            <div key={grade} className="mb-2">
              <button 
                onClick={() => toggleGrade(grade)}
                className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 font-bold transition-colors"
              >
                {expandedGrades[grade] ? <ChevronDown size={18} className="text-gray-400" /> : <ChevronRight size={18} className="text-gray-400" />}
                <FolderOpen size={18} className="text-blue-500" />
                {grade === '기타' ? grade : `${grade}학년`}
              </button>
              
              {expandedGrades[grade] && (
                <div className="ml-5 mt-1 border-l-2 border-gray-100 dark:border-gray-700 pl-2 space-y-1">
                  {Object.keys(studentTree[grade].classes).sort().map(cls => {
                    const gradeClassKey = `${grade}-${cls}`;
                    const isClassExpanded = expandedClasses[gradeClassKey];
                    return (
                      <div key={cls}>
                        <button 
                          onClick={() => toggleClass(gradeClassKey)}
                          className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium transition-colors text-sm"
                        >
                          {isClassExpanded ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
                          <Users size={16} className="text-indigo-400" />
                          {grade === '기타' ? cls : `${parseInt(cls)}반`}
                          <span className="ml-auto text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full text-gray-500">
                            {studentTree[grade].classes[cls].students.length}명
                          </span>
                        </button>

                        {isClassExpanded && (
                          <div className="ml-5 mt-1 space-y-1">
                            {studentTree[grade].classes[cls].students.map(student => (
                              <button 
                                key={student.id}
                                onClick={() => loadStudentChats(student)}
                                className={`w-full text-left p-2 rounded-lg flex items-center gap-2 transition-colors text-sm ${
                                  selectedStudent?.id === student.id 
                                    ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-semibold' 
                                    : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
                                }`}
                              >
                                <User size={14} className={selectedStudent?.id === student.id ? "text-blue-500" : "text-gray-400"} />
                                <span className="truncate">{student.name} ({student.id})</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
          {sortedGrades.length === 0 && (
             <div className="text-center p-8 text-gray-400 text-sm">학생 상담 데이터가 없습니다.</div>
          )}
        </div>
      </div>

      {/* Main Content - Chat Logs */}
      <div className="flex-1 flex flex-col h-2/3 md:h-screen bg-gray-50 dark:bg-gray-900">
        {!selectedStudent ? (
          <div className="h-full flex items-center justify-center text-gray-400 dark:text-gray-500 p-8 text-center">
            <div>
               <Users size={48} className="mx-auto mb-4 opacity-20" />
               <p>좌측 명단에서 학생을 선택하면<br/>해당 학생의 전체 상담 기록을 확인할 수 있습니다.</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col h-full relative">
            <div className="bg-white dark:bg-gray-800 p-4 border-b border-gray-200 dark:border-gray-700 shrink-0 shadow-sm z-10 flex justify-between items-center">
              <div>
                 <h2 className="text-xl font-bold text-gray-900 dark:text-white">{selectedStudent.name} 학생 상담 기록</h2>
                 <p className="text-sm text-gray-500">학번: {selectedStudent.id} • 최근 상담: {selectedStudent.lastChat}</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
              {isLoadingChats ? (
                <div className="h-full flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : studentChats.length === 0 ? (
                <div className="text-center text-gray-400 mt-10">대화 기록이 없습니다.</div>
              ) : (
                studentChats.map((msg, idx) => {
                  const isUser = msg.role === 'user';
                  // 이전 메시지와 날짜가 다르면 날짜 구분선 표시
                  const currentMsgDate = new Date(msg.created_at).toLocaleDateString();
                  const prevMsgDate = idx > 0 ? new Date(studentChats[idx - 1].created_at).toLocaleDateString() : null;
                  const showDateDivider = currentMsgDate !== prevMsgDate;

                  return (
                    <div key={msg.id || idx}>
                      {showDateDivider && (
                        <div className="flex justify-center my-6">
                          <span className="bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs px-4 py-1.5 rounded-full font-medium shadow-sm">
                            {currentMsgDate}
                          </span>
                        </div>
                      )}
                      <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mt-4`}>
                        <div className="flex flex-col max-w-[85%]">
                           <div className={`text-xs mb-1 mx-1 flex gap-2 ${isUser ? 'justify-end' : 'justify-start'} text-gray-500`}>
                             <span>{isUser ? selectedStudent.name : 'AI 상담교사'}</span>
                             <span>{new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                           </div>
                           <div className={`px-5 py-3 shadow-sm rounded-2xl ${
                             isUser 
                               ? 'bg-blue-600 text-white rounded-br-none' 
                               : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-bl-none border border-gray-100 dark:border-gray-700 prose dark:prose-invert prose-sm max-w-full'
                           }`}>
                             {isUser ? (
                               <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                             ) : (
                               <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                                 {msg.content}
                               </ReactMarkdown>
                             )}
                           </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
