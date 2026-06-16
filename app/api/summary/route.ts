import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { studentName } = await req.json();

    // Fetch chat history for this student
    const { data: logs, error } = await supabase
      .from('chat_logs')
      .select('*')
      .eq('student_name', studentName)
      .order('created_at', { ascending: true });

    if (error) throw error;

    if (!logs || logs.length === 0) {
      return NextResponse.json({ summary: "해당 학생의 대화 내역이 없습니다." });
    }

    const conversation = logs.map(log => `${log.role === 'user' ? '학생' : 'AI'}: ${log.content}`).join('\n\n');

    const prompt = `
다음은 상당고등학교 학생 '${studentName}'과 AI 상담사의 진로 및 선택과목 상담 대화 내용입니다.
선생님이 학생을 지도할 때 한눈에 파악할 수 있도록 다음 형식에 맞춰 개조식으로 요약해주세요.
반드시 마크다운 글머리기호(-)를 사용하여 작성하세요.

- 주요 관심 분야 및 진로 희망
- 선호하는 교과목 성향 (예: 수학/과학 선호, 문과 성향 등)
- AI가 추천한 주요 선택과목
- 선생님을 위한 특별 지도 유의사항 및 조언

[대화 내용]
${conversation}
`;

    const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });
    const result = await model.generateContent(prompt);
    
    return NextResponse.json({ summary: result.response.text() });

  } catch (error: any) {
    console.error('Summary API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
