module.exports = async function handler(req, res) {

  res.setHeader(
    'Cache-Control',
    'no-store'
  );


  /* =========================================
     GET：確認 API 是否部署成功
     ========================================= */

  if (req.method === 'GET') {

    return res.status(200).json({
      success: true,
      service: 'Whale Love Club Member Activation API',
      message: 'API is running'
    });

  }


  /* =========================================
     只允許 POST 執行啟用
     ========================================= */

  if (req.method !== 'POST') {

    return res.status(405).json({
      success: false,
      message: 'Method not allowed'
    });

  }


  try {

    const {
      idToken,
      token
    } = req.body || {};


    if (!idToken) {

      return res.status(400).json({
        success: false,
        message: 'ID token is required'
      });

    }


    if (!token) {

      return res.status(400).json({
        success: false,
        message: 'NFC token is required'
      });

    }



    /* =========================================
       Server Environment
       ========================================= */

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
        message: 'Server configuration is incomplete'
      });

    }



    /* =========================================
       1. 向 LINE 官方驗證 ID Token
       ========================================= */

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

        status: 'LINE_AUTH_ERROR',

        message:
          lineData.error_description ||
          lineData.error ||
          'LINE verification failed'
      });

    }



    /* =========================================
       2. 確認 Token 是我們 MINI App 的
       ========================================= */

    if (
      String(lineData.aud) !==
      String(channelId)
    ) {

      return res.status(401).json({
        success: false,
        status: 'INVALID_LINE_CHANNEL',
        message: 'Invalid LINE channel'
      });

    }



    /* =========================================
       3. 呼叫 Apps Script
       ========================================= */

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
                'activateMemberCard',

              secret:
                appsScriptSecret,

              token:
                token,

              lineUserId:
                lineData.sub

            }),

          redirect: 'follow'
        }
      );



    const responseText =
      await appsResponse.text();


    let appsData;


    try {

      appsData =
        JSON.parse(
          responseText
        );

    } catch (error) {

      console.error(
        'Apps Script response:',
        responseText
      );

      return res.status(502).json({
        success: false,
        message:
          'Invalid Apps Script response'
      });

    }



    /* =========================================
       4. Apps Script 拒絕
       ========================================= */

    if (!appsData.success) {

      return res.status(400).json({

        success: false,

        status:
          appsData.status ||
          'ACTIVATION_FAILED',

        message:
          appsData.message ||
          'Membership activation failed'

      });

    }



    /* =========================================
       5. 啟用成功
       ========================================= */

    return res.status(200).json({

      success: true,

      status:
        appsData.status,

      memberNo:
        appsData.memberNo,

      message:
        appsData.message

    });


  } catch (error) {

    console.error(
      'Member activation error:',
      error
    );


    return res.status(500).json({
      success: false,
      message: 'Server error'
    });

  }

};
