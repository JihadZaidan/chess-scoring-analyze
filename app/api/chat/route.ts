import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { messages, fen } = await request.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Gemini API key is not configured.' },
        { status: 500 }
      );
    }

    // Format system instruction with FEN context
    const systemInstruction = `You are an expert chess analysis assistant. You are helping the user analyze their games and positions.
The current board position in FEN format is:
${fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'}

Use this FEN to explain tactical ideas, threats, or general chess principles relevant to the current board. If the user asks general chess questions, answer them in a helpful, friendly, and concise manner. Include formatting like bolding or bullet points where appropriate to make the analysis easy to read.`;

    // Map message roles: 'assistant' -> 'model'
    const formattedContents = messages
      .filter((m: any) => m.content && m.content.trim() !== '')
      .map((m: any) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));

    // Call Gemini API
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: formattedContents,
        systemInstruction: {
          parts: [{ text: systemInstruction }]
        },
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Gemini API Error:', errorData);
      return NextResponse.json(
        { error: 'Failed to generate response from Gemini API.' },
        { status: response.status }
      );
    }

    const data = await response.json();
    const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!replyText) {
      return NextResponse.json(
        { error: 'Empty response from Gemini API.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ response: replyText });
  } catch (error) {
    console.error('API Chat Route Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error.' },
      { status: 500 }
    );
  }
}
