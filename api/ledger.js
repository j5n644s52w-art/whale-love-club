export default async function handler(req, res) {

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed'
    });
  }

  const channelId = process.env.LINE_CHANNEL_ID;
  const appsScriptUrl = process.env.APPS_SCRIPT_URL;
  const appsScriptSecret = process.env.APPS_SCRIPT_SECRET;

  if (
    !channelId ||
    !appsScriptUrl ||
    !appsScriptSecret
  ) {
    return res.status(500).json({
      success: false,
      message: 'Server configuration missing'
    });
  }


  try {

    // ==========================
    // GET：讀取記帳紀錄
    // ==========================

    if (req.method === 'GET') {

      const {
        idToken,
        year,
        month
      } = req.query;


      if (!idToken) {
        return res.status(400).json({
          success: false,
          message: 'Missing idToken'
        });
      }


      const lineData =
        await verifyLineToken(
          idToken,
          channelId
        );


      const result =
        await callAppsScript(
          appsScriptUrl,
          {
            action: 'getLedger',
            secret: appsScriptSecret,
            lineUserId: lineData.sub,
            year: year || '',
            month: month || ''
          }
        );


      return res.status(200).json(result);
    }



    // ==========================
    // POST：新增記帳紀錄
    // ==========================

    const {
      idToken,
      entry
    } = req.body || {};


    if (!idToken) {
      return res.status(400).json({
        success: false,
        message: 'Missing idToken'
      });
    }


    if (!entry) {
      return res.status(400).json({
        success: false,
        message: 'Missing entry'
      });
    }


    const lineData =
      await verifyLineToken(
        idToken,
        channelId
      );


    const result =
      await callAppsScript(
        appsScriptUrl,
        {
          action: 'addLedger',
          secret: appsScriptSecret,
          lineUserId: lineData.sub,
          entry: entry
        }
      );


    return res.status(200).json(result);


  } catch (error) {

    console.error(error);

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        'Internal server error'
    });

  }
}



/* ==========================
   LINE ID Token 驗證
   ========================== */

async function verifyLineToken(
  idToken,
  channelId
) {

  const params =
    new URLSearchParams();

  params.append(
    'id_token',
    idToken
  );

  params.append(
    'client_id',
    channelId
  );


  const response =
    await fetch(
      'https://api.line.me/oauth2/v2.1/verify',
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/x-www-form-urlencoded'
        },

        body:
          params.toString()
      }
    );


  const data =
    await response.json();


  if (!response.ok) {

    throw new Error(
      data.error_description ||
      'LINE verification failed'
    );

  }


  if (
    String(data.aud) !==
    String(channelId)
  ) {

    throw new Error(
      'Invalid LINE audience'
    );

  }


  return data;
}



/* ==========================
   Apps Script 呼叫
   ========================== */

async function callAppsScript(
  url,
  payload
) {

  const response =
    await fetch(
      url,
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json'
        },

        body:
          JSON.stringify(payload)
      }
    );


  const text =
    await response.text();


  let data;


  try {

    data =
      JSON.parse(text);

  } catch {

    throw new Error(
      'Invalid Apps Script response'
    );

  }


  return data;
}
