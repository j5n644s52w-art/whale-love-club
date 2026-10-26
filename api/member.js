module.exports =
async function handler(req, res) {

  res.setHeader(
    'Cache-Control',
    'no-store'
  );


  /* =========================================
     API 存活測試
     ========================================= */

  if (req.method === 'GET') {

    return res.status(200).json({

      success: true,

      service:
        'Whale Love Club Member + Discover API',

      version:
        '2.0-discover',

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

    const {
      idToken,
      operation,
      itemId
    } =
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


    /* =========================================
       1. 向 LINE 驗證 ID Token
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

          method:
            'POST',


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


    if (!lineData.sub) {

      return res.status(401).json({

        success: false,

        message:
          'LINE user ID missing'

      });

    }


    const lineUserId =
      String(
        lineData.sub
      ).trim();


    /* =========================================
       2. 判斷要呼叫哪個 Apps Script Action
       ========================================= */

    let action =
      'getMember';


    const payload = {

      secret:
        appsScriptSecret,

      lineUserId:
        lineUserId

    };


    /*
     * 沒有 operation：
     * 維持原本會員首頁使用方式
     */
    if (
      !operation ||
      operation === 'member'
    ) {

      action =
        'getMember';

    }


    /*
     * Discover 活動清單
     */
    else if (
      operation === 'discoverList'
    ) {

      action =
        'getDiscoverItems';

    }


    /*
     * 加入 / 移除「想去」
     */
    else if (
      operation === 'discoverToggle'
    ) {

      if (!itemId) {

        return res.status(400).json({

          success: false,

          message:
            'Item ID is required'

        });

      }


      action =
        'toggleDateIdea';


      payload.itemId =
        String(
          itemId
        ).trim();

    }


    /*
     * 自己目前的想去清單
     */
    else if (
      operation === 'dateIdeas'
    ) {

      action =
        'getDateIdeas';

    }


    else {

      return res.status(400).json({

        success: false,

        message:
          'Invalid operation: ' +
          operation

      });

    }


    payload.action =
      action;


    /* =========================================
       3. 呼叫 Apps Script
       ========================================= */

    const appsData =
      await callAppsScript(

        appsScriptUrl,

        payload

      );


    if (
      !appsData ||
      !appsData.success
    ) {

      return res
        .status(400)
        .json(

          appsData || {

            success: false,

            message:
              'Apps Script request failed'

          }

        );

    }


    /* =========================================
       4. 原本 MEMBER 格式保持相容
       ========================================= */

    if (
      action === 'getMember'
    ) {

      return res.status(200).json({

        success: true,

        member:
          appsData.member

      });

    }


    /* =========================================
       5. Discover 直接回傳 Apps Script 結果
       ========================================= */

    return res
      .status(200)
      .json(
        appsData
      );


  } catch (error) {

    console.error(

      'Member / Discover API error:',

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



/* =========================================
   呼叫 Apps Script
   ========================================= */

async function callAppsScript(
  url,
  payload
) {

  const response =
    await fetch(

      url,

      {

        method:
          'POST',


        headers: {

          'Content-Type':
            'application/json'

        },


        body:
          JSON.stringify(
            payload
          ),


        redirect:
          'follow'

      }

    );


  const text =
    await response.text();


  let data;


  try {

    data =
      JSON.parse(
        text
      );

  } catch (error) {

    console.error(
      'Apps Script response:',
      text
    );


    throw new Error(
      'Invalid Apps Script response'
    );

  }


  return data;

}
