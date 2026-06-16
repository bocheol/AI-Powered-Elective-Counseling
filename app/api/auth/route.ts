import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { studentId, studentName, password } = await req.json();

    if (!studentId || !studentName || !password) {
      return NextResponse.json({ error: '모든 필드를 입력해주세요.' }, { status: 400 });
    }

    // 1. Check if student exists
    const { data: student, error: fetchError } = await supabase
      .from('students')
      .select('*')
      .eq('student_id', studentId)
      .single();

    // PGRST116 에러는 '결과가 없음(Not found)'을 의미하므로 무시
    if (fetchError && fetchError.code !== 'PGRST116') { 
      throw fetchError;
    }

    if (student) {
      // 2. Student exists, check password
      if (student.password === password) {
        return NextResponse.json({ success: true, message: '로그인 성공' });
      } else {
        return NextResponse.json({ error: '비밀번호가 일치하지 않습니다.' }, { status: 401 });
      }
    } else {
      // 3. New student, auto register
      const { error: insertError } = await supabase
        .from('students')
        .insert([{ 
          student_id: studentId, 
          student_name: studentName, 
          password: password 
        }]);

      if (insertError) throw insertError;

      return NextResponse.json({ success: true, message: '회원가입 및 로그인 성공' });
    }

  } catch (error: any) {
    console.error('Auth API Error:', error);
    return NextResponse.json({ error: error.message || '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
