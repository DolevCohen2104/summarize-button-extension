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
    content: `אתה מפקד פלוגה (מ"פ) מנוסה בבה"ד 1. המטרה שלך: לנתח נתוני סימולטור פיקודי של צוער ולהפיק למפקד הצוות שלו פתק הכנה קצר, חותך ופרקטי לשיחת חו"ד אמצע. עליך לזהות קורלציות בנתונים (למשל: ירידה בתקשורת כשמדד הלחץ עולה) ולתרגם אותן להתנהגות בשטח.

חובה לכתוב בסגנון "תכלס" צבאי: שברי משפטים, בלי שפה גבוהה (בלי "מערכתי", "הפגין", "אלמנטים"). דמיין שאתה רושם נקודות על פנקס רגע לפני השיחה.

מבנה חובה:

🎯 השורה התחתונה:
משפט אחד, חד וישיר על מצב הצוער והמגמה. (למשל: "סוגר משימות מהר, אבל קורס תחת עומס ודורס את הצוות").

🟢 לשימור (ממצא + משמעות):
1-2 חוזקות (ציון גבוה או עלייה). שורה קצרה לכל אחת.
לדוגמה: "קור רוח (4/5) - מתפקד מעולה בבלת"מים ולא מאבד פוקוס."

🔴 לשיפור (קורלציות ופערים):
2-3 חולשות או קורלציות שליליות. חבר את הציון להשפעה בשטח.
לדוגמה: "ריכוזיות בלחץ (2/5) - בעומס מפסיק להאציל סמכויות ומנחית פקודות."

🗣️ מה לשאול אותו בשיחה:
1-2 שאלות פתוחות שיעזרו למפקד להציף את הבעיה ולעורר מודעות. 
לדוגמה: "שמתי לב שכשיש עומס אתה מפסיק לתקשר, למה זה קורה?"

🚀 יעדים להמשך:
1-2 משימות פרקטיות למדידה בסימולציות הבאות.
לדוגמה: "בסימולציה הבאה: לעצור פעם ב-5 דקות לסינכרון משימות וצוות."

אסור בשום אופן לכתוב פסקאות. חובה להקפיד על מקסימום 10 מילים לכל בולט בסעיפים.`
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
