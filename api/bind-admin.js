const crypto = require('crypto');


function safeCompare(a, b) {

  const aBuffer =
    Buffer.from(String(a || ''));

  const bBuffer =
    Buffer.from(String(b || ''));

  if (
    aBuffer.length !==
    bBuffer.length
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
    aBuffer,
    bBuffer
  );
}


module.exports =
async function handler(req, res) {

  res.setHeader(
    'Cache-Control',
    'no-store'
  );


  // 用瀏覽器測試 API 是否存在
  if (req.method === 'GET') {

    return res.status(200).json({
      success: true,
      service:
        'Whale Love Club Admin Binding API',
      message: 'API is running'
    });
  }


  if (req.method !== 'POST') {

    return res.status(405).json({
      success: false,
      message: 'Method not allowed'
    });
  }


  try {

    const {
      idToken,
      bindCode
    } = req.body || {};


    if (!idToken) {
      return res.status(400).json({
        success: false,
        message: 'ID token is required'
      });
    }


    if (!bindCode) {
      return res.status(400).json({
        success: false,
        message: 'Admin bind code is required'
      });
    }


    const channelId =
      process.env.LINE_CHANNEL_ID;

    const expectedBindCode =
      process.env.ADMIN_BIND_CODE;

    const appsScriptUrl =
      process.env.APPS_SCRIPT_URL;

    const appsScriptSecret =
      process.env.APPS_SCRIPT_SECRET;


    if (
      !channelId ||
      !expectedBindCode ||
      !appsScriptUrl ||
      !appsScriptSecret
    ) {

      return res.status(500).json({
        success: false,
        message:
          'Server configuration is incomplete'
      });
    }


    // 驗證管理員一次性綁定碼
    if (
      !safeCompare(
        bindCode,
        expectedBindCode
      )
    ) {

      return res.status(403).json({
        success: false,
        message:
          'Invalid admin bind code'
      });
    }


    /* =========================
       向 LINE 驗證 ID Token
       ========================= */

    const form =
      new URLSearchParams();

    form.append(
      'id_token',
      idToken
    );

    form.append(
      'client_id',
      channelId
    );


    const lineResponse =
      await fetch(
        'https://api.line.me/oauth2/v2.1/verify',
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/x-www-form-urlencoded'
          },

          body:
            form.toString()
        }
      );


    const lineData =
      await lineResponse.json();


    if (!lineResponse.ok) {

      return res.status(401).json({
        success: false,
        message:
          'LINE verification failed'
      });
    }


    if (
      String(lineData.aud) !==
      String(channelId)
    ) {

      return res.status(401).json({
        success: false,
        message:
          'Invalid LINE channel'
      });
    }


    /* =========================
       Vercel → Apps Script
       ========================= */

    const appsResponse =
      await fetch(
        appsScriptUrl,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json'
          },

          body:
            JSON.stringify({
              action: 'bindAdmin',

              secret:
                appsScriptSecret,

              lineUserId:
                lineData.sub,

              displayName:
                lineData.name || ''
            }),

          redirect: 'follow'
        }
      );


    const responseText =
      await appsResponse.text();


    let appsData;

    try {
      appsData =
        JSON.parse(responseText);
    } catch (error) {

      return res.status(502).json({
        success: false,
        message:
          'Invalid Apps Script response'
      });
    }


    if (!appsData.success) {

      return res.status(400).json({
        success: false,
        message:
          appsData.message ||
          'Admin binding failed'
      });
    }


    return res.status(200).json({

      success: true,

      status:
        appsData.status,

      memberNo:
        'ADMIN001',

      role:
        'ADMIN',

      message:
        appsData.message
    });


  } catch (error) {

    console.error(
      'Admin binding error:',
      error
    );

    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};
