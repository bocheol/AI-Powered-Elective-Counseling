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
    const { messages, studentId, studentName } = await req.json();

    const lastMessage = messages[messages.length - 1].content;

    // 1. Get embedding for the user's query
    const embedModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
    const embedResult = await embedModel.embedContent(lastMessage);
    const queryEmbedding = embedResult.embedding.values.slice(0, 768);

    // 2. Query Supabase for relevant context
    const { data: contextData, error } = await supabase.rpc('match_documents', {
      query_embedding: queryEmbedding,
      match_count: 50
    });

    if (error) {
      console.error("Supabase RPC Error:", error);
      throw error;
    }

    const contextText = contextData?.map((doc: any) => doc.content).join('\n\n') || "No relevant context found.";

    // 3. Build prompt for Gemini 3.5 Flash
    const systemInstruction = `
당신은 '상당고등학교' 학생들의 선택과목 상담을 돕는 전문적이고 친절한 AI 교사입니다.
대화 상대의 이름은 '${studentName}'입니다.
반드시 아래에 제공된 [참고 문서] 내용을 기반으로만 답변하세요.
만약 문서에 없는 내용이나 알 수 없는 내용을 묻는다면, "제공된 문서에 관련 정보가 없어 답변드리기 어렵습니다."라고 솔직하게 답변하세요. 지어내면 절대 안 됩니다. (할루시네이션 방지 규칙)
어려운 교육 용어는 고등학생이 이해하기 쉽게 풀어서 설명하고, 격려하는 따뜻한 톤을 유지하세요.

[참고 문서 시작]
${contextText}
[참고 문서 끝]
`;

    const model = genAI.getGenerativeModel({ 
      model: 'gemini-3.5-flash',
      systemInstruction: systemInstruction 
    });

    // history formatting
    let history = messages.slice(0, -1).map((msg: any) => ({
      role: msg.role === 'model' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    // Gemini API는 첫 번째 메시지가 반드시 'user'여야 하므로, 초기 인사말이 맨 앞에 있다면 제거
    if (history.length > 0 && history[0].role === 'model') {
      history.shift();
    }

    const chat = model.startChat({
      history: history,
    });

    const result = await chat.sendMessage(lastMessage);
    const responseText = result.response.text();

    // 4. Save to DB asynchronously (fire and forget)
    supabase.from('chat_logs').insert([
      { student_id: studentId, student_name: studentName, role: 'user', content: lastMessage },
      { student_id: studentId, student_name: studentName, role: 'model', content: responseText }
    ]).then(({error}) => {
      if (error) console.error("Error saving chat log:", error);
    });

    return NextResponse.json({ text: responseText });

  } catch (error: any) {
    console.error('Chat API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
