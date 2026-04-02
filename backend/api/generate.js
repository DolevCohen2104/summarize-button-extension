export default async function handler(req, res) {
  // הגדרות CORS - מתיר לתוסף פנייה לשרת ה-Vercel
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*'); 
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // טיפול יציב בבקשות Preflight (OPTIONS) מול הדפדפן
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // אישור בקשות POST בלבד מטעמי אבטחה
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed. מחייב פניית POST.' });
  }

  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ success: false, error: 'לא התקבלו נתונים (Prompt) לאנליזה מהפרונטאנד.' });
  }

  try {
    console.log('----------------------------------------------------');
    console.log(`[INFO] Incoming request to generate summary. Prompt length: ${prompt.length} characters.`);
    
    // ---- קריאה חסויה ל-API החיצוני ----
    // המפתח והכתובת האמיתיים נמשכים ממשתני סביבה כדי לא לחשוף אותם בתוכן התוסף שמופץ למפקדים
    // הכתובת החיצונית פה היא של השירות בו אתם משתמשים בפועל.
    const EXTERNAL_API_URL = process.env.API_URL || 'https://api.external.service/...';
    const API_KEY = process.env.API_KEY || ''; 
    
    console.log(`[INFO] Connecting to external API: ${EXTERNAL_API_URL}`);
    if (!API_KEY) {
      console.warn('[WARNING] API_KEY environment variable is completely empty! The request will probably fail.');
    } else {
      console.log(`[INFO] API_KEY is loaded (starts with: ${API_KEY.substring(0, 5)}...)`);
    }

    // במידה וזה API סטנדרטי (Gemini/OpenAI) מבנה הבקשה יהיה סטנדרטי עם שליחת המפתח בכותרת
    const llmResponse = await fetch(EXTERNAL_API_URL, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({ 
        model: "gemini-2.5-flash",
        messages: [
           { 
    role: "system", 
    content: `תפקיד:
אתה מפקד פלוגה (מ"פ) מנוסה בבה"ד 1. המטרה שלך היא לקחת נתוני סימולציות של צוער ולכתוב למפקד הצוות שלו נקודות קצרות וחותכות לשיחת חתך. המטרה היא לתת ערך מעבר לנתונים היבשים - לתרגם את המספרים לתובנות על אופי הפיקוד שלו.

מנוע תובנות - חובה ליישם:
אסור לך רק לציין את הציון. חובה עליך לזהות דפוסים מתוך שילוב של מספר מדדים. הסק מסקנות לגבי סגנון הפיקוד של הצוער. הנה כמה דוגמאות לאופן שבו עליך לחשוב:

אם "משימתיות" גבוה אבל "אנושיות" ו"שמירה על שיח מכבד" נמוכים = הצוער הוא "בולדוזר", דורס את האנשים בדרך להשלמת המשימה.

אם "הצבת גבולות" נמוך ו"כושר שכנוע" נמוך = הצוער מחפש להיות "חבר" של החיילים, חושש מעימותים וקורס מול התנגדות או סרבנות.

אם הציונים בתרחישי שטח/מבצעיים (כמו שבוע שטח) גבוהים משמעותית מתרחישי שגרה/ת"ש (כמו סגירת שבת) = מתפקד מעולה כלוחם, אבל חלש בניהול שגרת משמעת וטיפול בפרט.

רצף של ביצועים עוקבים באותו תרחיש בהפרשי זמן קצרים (דקות) עם ציונים נמוכים = פועל מתוך תסכול, הולך "ראש בקיר" ולא עוצר להפיק לקחים.

סגנון כתיבה:
חובה לכתוב בסגנון "תכלס" צבאי: בלי שפה גבוהה מדי, בלי מילים כמו "מערכתי", "הפגין", או "אלמנטים". נסח הכל בנקודות קצרות (Bullet points), שברי משפטים. דמיין שאתה רושם פתק על פנקס לפני השיחה.

מבנה חובה:

🎯 השורה התחתונה:
משפט אחד, חד וישיר שמסכם את תמונת המצב הפיקודית שעולה מהצלבת הנתונים (למשל: "מצוין בשטח, אבל הולך לאיבוד ומוותר כשיש מולו חייל סרבן בשגרה").

🟢 לשימור:
ציין 1-2 חוזקות בשורה אחת קצרה לכל אחת. (מקסימום 10 מילים לבולט).

🔴 לשיפור:
ציין 2-3 נקודות חולשה שנובעות מהצלבת הנתונים (מנוע התובנות). אל תכתוב את המספרים! תאר את ההתנהגות.
(לדוגמה: "מאבד סמכותיות מול התנגדות - מתקשה להציב גבולות כשחייל מתווכח איתו על יציאות"). מקסימום 10 מילים לבולט.

🗣️ מה לשאול אותו בשיחה:
1-2 שאלות פתוחות שהמפקד צריך לשאול את הצוער כדי להציף את שורש הבעיה. שאלות קצרות בלבד הקשורות לתרחיש שבו התקשה. (מקסימום 10 מילים לבולט).

איסור מוחלט: אסור לכתוב פסקאות. אסור פשוט לדווח מה הציון שהתקבל. חובה להשתמש במקסימום 10 מילים לכל בולט.`
},
            { role: "user", content: prompt } 
        ]
    }) 
});

    if (!llmResponse.ok) {
       const errorData = await llmResponse.text();
       console.error(`[ERROR] External API rejected the request. Status Code: ${llmResponse.status}`);
       console.error(`[ERROR] External API Error Body:`, errorData);
       throw new Error(`שגיאת שרת ה-LLM החיצוני אירעה במשיכה מהענן: ${llmResponse.status} ${errorData}`);
    }

    const data = await llmResponse.json();
    console.log('[INFO] Response safely parsed into JSON. Extracting summary text...');
    
    // שליפת הטקסט המסוכם בהתאם למבנה ה-JSON של הספק איתו עובדים (Gemini/GPT/וכו').
    // Chat Completions format uses data.choices[0].message.content
    const summary = data.choices?.[0]?.message?.content || data.candidates?.[0]?.content?.parts?.[0]?.text || data.summary || data.text || 'התקבלה תשובה תקינה אך ריקה מהמודל.';

    return res.status(200).json({ success: true, data: summary });
    
  } catch (error) {
    console.error('[FATAL ERROR] Vercel API Handler threw an exception:');
    console.error(error.stack || error);
    return res.status(500).json({ 
      success: false, 
      error: `שגיאה פנימית בביצוע הבקשה אל ה-LLM מחוץ לרשת: ${error.message}` 
    });
  }
}
