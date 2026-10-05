module.exports =
async function handler(req, res) {

  res.setHeader(
    'Cache-Control',
    'no-store'
  );


  /* API 存活測試 */

  if (req.method === 'GET') {

    return res.status(200).json({
      success: true,
      service:
        'Whale Love Club Member API',
      message:
        'API is running'
    });
  }


  if (req.method !== 'POST') {

    return res.status(405).json({
      success: false,
      message:
        'Method not allowed'
    });
  }


  try {

    const { idToken } =
      req.body || {};


    if (!idToken) {

      return res.status(400).json({
        success: false,
        message:
          'ID token is required'
      });
    }


    const channelId =
      process.env.LINE_CHANNEL_ID;

    const appsScriptUrl =
      process.env.APPS_SCRIPT_URL;

    const appsScriptSecret =
      process.env.APPS_SCRIPT_SECRET;


    if (
      !channelId ||
      !appsScriptUrl ||
      !appsScriptSecret
    ) {

      return res.status(500).json({
        success: false,
        message:
          'Server configuration is incomplete'
      });
    }


    /* =========================
       1. 向 LINE 驗證 ID Token
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

  console.error(
    'LINE verification failed:',
    lineData
  );

  return res.status(401).json({
    success: false,
    message:
      lineData.error_description ||
      lineData.error ||
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
       2. 向 Apps Script 取得會員資料
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

              action:
                'getMember',

              secret:
                appsScriptSecret,

              lineUserId:
                lineData.sub

            }),

          redirect:
            'follow'
        }
      );


    const text =
      await appsResponse.text();


    let memberData;


    try {

      memberData =
        JSON.parse(text);

    } catch (error) {

      return res.status(502).json({
        success: false,
        message:
          'Invalid Apps Script response'
      });
    }


    if (!memberData.success) {

      return res.status(404).json(
        memberData
      );
    }


    /* =========================
       3. 回傳會員資料
       ========================= */

    return res.status(200).json({

      success: true,

      member:
        memberData.member

    });


  } catch (error) {

    console.error(
      'Member API error:',
      error
    );


    return res.status(500).json({
      success: false,
      message:
        'Server error'
    });
  }
};
