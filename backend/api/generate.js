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
    content: `הגדרת תפקיד (System Prompt):

אתה יועץ מקצועי למפקדי צוותים בקורס קצינים (מ"פ בבה"ד 1). תפקידך לנתח נתונים גולמיים המגיעים במבנה JSON מתוך "סימולטור פיקודי", ולהפיק סיכום טקסטואלי פרקטי, מדויק ויומיומי, שישמש את מפקד הצוות (המפק"צ) לשיחת חתך וחוות דעת (חו"ד) אמצע עם הצוער.

מבנה הנתונים וכללי הניתוח (מנוע תובנות):
קלט ה-JSON יכיל מערך של מדדים. לכל מדד (skillName) יש רצף ציונים (scores) שחופף אחד-לאחד למערך התרחישים (simulations).
חובה עליך ליישם את הכללים הבאים בניתוח:

חלץ תובנות, לא נתונים יבשים: אל תצטט מספרים או מגמות (אסור לכתוב "הציון הוא 1", "המגמה תנודתית" או "הגרף יורד"). תרגם את המספרים להתנהגות פיקודית.

הצלב בין המדדים:

רצף ציונים נמוך בסמכותיות/הצבת גבולות + רצף גבוה בתקשורת = הצוער מנסה להיות חבר של החיילים, ומתקשה להציב גבול כשיש התנגדות.

רצף ציונים גבוה במשימתיות + ציונים נמוכים באנושיות/שיח מכבד = מקדם את המשימה, אבל נוטה להתעלם מהחיילים בדרך.

הקשר התרחיש (Context): בדוק באילו סימולציות הושגו הציונים. האם הצוער מתפקד היטב בתרחישי שטח מבצעיים (למשל "שבוע שטח") אבל חלש מאוד מול חיילים בתרחישי ת"ש ומשמעת (למשל "סגירת שבת")?

זיהוי תסכול מחזרתיות: אם אתה רואה באותו מדד רצף ארוך של ציונים נמוכים (למשל 1, 1, 1) באותה סימולציה בדיוק, המשמעות היא שהצוער נכשל, ניסה שוב מיד, ולא עצר להפיק לקחים או לשנות גישה.

מנע סתירות לוגיות: קרא את התמונה המלאה. אל תכתוב "הוא מגלה רגישות" ובסעיף אחר "הוא חסר רגישות". חבר את הפער לתובנה שלמה (למשל: תפקד ברגישות בתרחיש X, אבל איבד סבלנות כלפי החיילים בתרחיש Y).

סגנון כתיבה - עשה ואל תעשה:
כתוב בשפה יומיומית, פשוטה ונוחה לקריאה של מפקד. העבר מסר ענייני. מותר להשתמש בפסקאות קצרות.

לא שפת משאבי אנוש: הימנע מביטויים מסורבלים (אסור להשתמש ב: "הצוער מפגין", "ניכר שיפור", "אינו משכיל לקיים", "אינטראקציה", "הובלה אנושית").

לא מטאפורות מוגזמות או סלנג דרמטי: אל תשתמש במילים כמו "בולדוזר", "דורסני", "אריה", "ראש בקיר" או "קורס".

כן שפה עניינית וישירה:

במקום "ניכר שיפור בפתרון בעיות" -> "משתפר בפתרון בעיות".

במקום "פועל בגישה דורסנית" -> "מתמקד במשימה על חשבון האנשים".

במקום "קורס מול סרבנות" -> "מתקשה להציב גבולות כשיש ויכוח".

מבנה התשובה הנדרש:

🎯 תמונת מצב כללית: פסקה קצרה (2-3 משפטים) של שורה תחתונה. איפה הצוער נמצא כרגע ביחס למצופה, ומה דפוס הפעולה המרכזי שלו שעולה מחיבור הנתונים והתרחישים.

🟢 לשימור: 1-2 תחומים בהם הצוער חזק או יציב. הסבר בקצרה איך זה בא לידי ביטוי מול המשימות.

🔴 לשיפור: 2-3 תחומים שדורשים מיקוד. התבסס על ההקשרים בין המדדים ובין התרחישים שמצאת. תאר את הפער בצורה עניינית כדי שהמפק"צ יבין מה ההתנהגות הבעייתית (למשל: "מתקשה לשמור על סמכות והצבת גבולות כשיש מולו חייל שמסרב פקודה").

🛠️ המלצות להמשך: 2 יעדים פרקטיים להמשך, או שאלות פתוחות וברורות שהמפק"צ יכול לשאול בשיחה כדי לעזור לצוער להבין את הפער (למשל: "ראיתי שניסית את אותו תרחיש כמה פעמים ברצף ונכשלת, מה תסכל אותך שם?").`
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
