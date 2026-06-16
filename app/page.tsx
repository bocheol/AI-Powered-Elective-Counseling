'use client';

import { useState } from 'react';
import StudentMode from '@/components/StudentMode';
import TeacherMode from '@/components/TeacherMode';

export default function Home() {
  const [mode, setMode] = useState<'home' | 'student' | 'teacher'>('home');

  if (mode === 'student') return <StudentMode onBack={() => setMode('home')} />;
  if (mode === 'teacher') return <TeacherMode onBack={() => setMode('home')} />;

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 p-4 transition-colors duration-300">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-3xl shadow-xl overflow-hidden transform transition-all hover:scale-105 duration-300">
        <div className="p-8 text-center">
          {/* Logo Placeholder */}
          <div className="w-24 h-24 mx-auto bg-blue-100 rounded-full flex items-center justify-center mb-6 overflow-hidden border-4 border-white shadow-sm">
            <span className="text-2xl font-black text-blue-800">[상당고]</span>
          </div>
          
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-2 tracking-tight">선택과목 상담 AI</h1>
          <p className="text-gray-500 dark:text-gray-400 mb-8 text-sm">상당고등학교 맞춤형 진로 설계 지원</p>

          <div className="space-y-4">
            <button
              onClick={() => setMode('student')}
              className="w-full relative overflow-hidden group bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-2xl transition-all shadow-md hover:shadow-lg"
            >
              <div className="absolute top-0 right-0 -mr-4 -mt-4 w-16 h-16 rounded-full bg-white opacity-10 group-hover:scale-150 transition-transform duration-500"></div>
              학생 상담 시작하기
            </button>
            <button
              onClick={() => setMode('teacher')}
              className="w-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-semibold py-4 px-6 rounded-2xl transition-all shadow-sm"
            >
              선생님 관리 모드
            </button>
          </div>
        </div>
      </div>
      
      <div className="mt-12 text-center text-xs text-gray-400">
        Powered by Gemini & Supabase
      </div>
    </main>
  );
}
