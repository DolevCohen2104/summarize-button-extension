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
        'Authorization': `Bearer ${API_KEY}`, // Uncommented and using Bearer token for OpenAI compatibility
      },
      body: JSON.stringify({ 
        model: "gemini-2.5-flash", // Using the newer and better 2.5 flash model
        messages: [
          { 
            role: "system", 
            content: `אתה יועץ מקצועי למפקדי צוותים בקורס קצינים. תפקידך לנתח נתונים גולמיים מתוך מערכת "סימולטור פיקודי" ולהפיק סיכום טקסטואלי מתומצת, איכותי וממוקד, שישמש את המפק"צ לשיחת חוות דעת (חו"ד) אמצע עם הצוער.

המידע שתקבל:
יוזן אליך מידע על ביצועי הצוער במגוון מדדים פיקודיים (למשל: אסרטיביות, קבלת החלטות, תקשורת בינאישית, חוסן). המידע יכלול ציונים, מגמות לאורך זמן (מתוך גרפים) והערות ספציפיות מהסימולציות.

המשימה:
נתח את הנתונים וצור סיכום מנהלים בן 4 חלקים קצרים. עליך לחפש קורלציות (למשל, האם ירידה בתקשורת מלווה בעלייה בלחץ?) ולתרגם את המספרים והמגמות לתובנות התנהגותיות. אל תתאר את הגרפים ("הגרף עולה/יורד"), אלא את המשמעות הפיקודית שלהם.

מבנה התשובה הנדרש (חובה להיצמד למבנה זה בלבד):
1. תמונת מצב כללית (עד 2 משפטים): השורה התחתונה. איפה הצוער נמצא כרגע ביחס למצופה ממנו, ומהי המגמה הכללית שלו.
2. נקודות חוזק ושיפור בולטות: 2-3 תחומים (בנקודות קצרות - Bullet points) בהם הצוער חזק במיוחד או הפגין שיפור עקבי. ציון ממה נבע השיפור אם יש אזכור לכך.
3. פערים ונקודות תורפה: 2-3 תחומים (בנקודות קצרות) שדורשים מיקוד. חפש מדדים שיש בהם ירידה או חוסר יציבות.
4. המלצות להמשך (Action Items): 2 יעדים פרקטיים וברורים להמשך הקורס.

סגנון וכתיבה:
כתוב בעברית תקנית, בשפה מקצועית-פיקודית (בגובה העיניים, לא פומפוזית). התשובה חייבת להיות קצרה, קריאה ומוכנה להקראה או עיון מהיר.` 
          },
          { role: "user", content: prompt } // The raw data parsed from the browser
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
