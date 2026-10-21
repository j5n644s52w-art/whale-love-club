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
      auth: 'LINE access token / ID token',
      message: 'API is running'
    });

  }


  /* =========================================
     只允許 POST
     ========================================= */

  if (req.method !== 'POST') {

    return res.status(405).json({
      success: false,
      message: 'Method not allowed'
    });

  }


  try {

    const {
      accessToken,
      idToken,
      token
    } = req.body || {};


    if (!accessToken && !idToken) {

      return res.status(400).json({
        success: false,
        status: 'NO_LINE_TOKEN',
        message: 'LINE login token is required'
      });

    }


    if (!token) {

      return res.status(400).json({
        success: false,
        status: 'MISSING_TOKEN',
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
        message:
          'Server configuration is incomplete'
      });

    }



    /* =========================================
       1. LINE 身分驗證
       優先使用 Access Token
       ========================================= */

    let lineUserId = '';


    if (accessToken) {

      /*
       * 1A. 驗證 Access Token
       */
      const verifyUrl =
        'https://api.line.me/oauth2/v2.1/verify' +
        '?access_token=' +
        encodeURIComponent(
          accessToken
        );


      const verifyResponse =
        await fetch(
          verifyUrl,
          {
            method: 'GET'
          }
        );


      const verifyData =
        await verifyResponse.json();


      if (!verifyResponse.ok) {

        console.error(
          'LINE access token verification failed:',
          verifyData
        );


        return res.status(401).json({
          success: false,
          status: 'LINE_AUTH_ERROR',
          message:
            verifyData.error_description ||
            verifyData.error ||
            'LINE access token verification failed'
        });

      }


      /*
       * 確認 Access Token 屬於目前 Published Channel
       */
      if (
        String(
          verifyData.client_id
        ) !==
        String(
          channelId
        )
      ) {

        return res.status(401).json({
          success: false,
          status: 'INVALID_LINE_CHANNEL',
          message:
            'Invalid LINE channel'
        });

      }


      if (
        Number(
          verifyData.expires_in || 0
        ) <= 0
      ) {

        return res.status(401).json({
          success: false,
          status: 'LINE_TOKEN_EXPIRED',
          message:
            'LINE access token expired'
        });

      }


      /*
       * 1B. 從 LINE 官方取得 User ID
       */
      const profileResponse =
        await fetch(
          'https://api.line.me/v2/profile',
          {
            method: 'GET',

            headers: {
              Authorization:
                'Bearer ' +
                accessToken
            }
          }
        );


      const profileData =
        await profileResponse.json();


      if (
        !profileResponse.ok ||
        !profileData.userId
      ) {

        console.error(
          'LINE profile request failed:',
          profileData
        );


        return res.status(401).json({
          success: false,
          status: 'LINE_PROFILE_ERROR',
          message:
            profileData.message ||
            'Unable to get LINE profile'
        });

      }


      lineUserId =
        String(
          profileData.userId
        ).trim();

    } else {

      /*
       * 備援：
       * 如果前端沒有 Access Token，
       * 才使用原本 ID Token 驗證。
       */
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
          'LINE ID token verification failed:',
          lineData
        );


        return res.status(401).json({
          success: false,
          status: 'LINE_AUTH_ERROR',
          message:
            lineData.error_description ||
            lineData.error ||
            'LINE ID token verification failed'
        });

      }


      if (
        String(
          lineData.aud
        ) !==
        String(
          channelId
        )
      ) {

        return res.status(401).json({
          success: false,
          status: 'INVALID_LINE_CHANNEL',
          message:
            'Invalid LINE channel'
        });

      }


      if (!lineData.sub) {

        return res.status(401).json({
          success: false,
          status: 'LINE_USER_ID_MISSING',
          message:
            'LINE user ID missing'
        });

      }


      lineUserId =
        String(
          lineData.sub
        ).trim();

    }



    /* =========================================
       2. 呼叫 Apps Script
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
                lineUserId

            }),

          redirect:
            'follow'
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
       3. Apps Script 拒絕
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
       4. 啟用成功
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
      message:
        error.message ||
        'Server error'
    });

  }

};
