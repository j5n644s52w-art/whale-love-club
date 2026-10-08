export default async function handler(req, res) {

  /* =========================================
     只接受 GET / POST
     ========================================= */

  if (
    req.method !== 'GET' &&
    req.method !== 'POST'
  ) {

    return res.status(405).json({
      success: false,
      message: 'Method not allowed'
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
      message: 'Server configuration missing'
    });

  }


  try {

    /* =========================================
       GET：讀取回憶
       ========================================= */

    if (req.method === 'GET') {

      const {
        idToken,
        memoryId
      } = req.query || {};


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


      let payload;


      /* 讀取單一回憶 */
      if (memoryId) {

        payload = {

          action:
            'getMemoryDetail',

          secret:
            appsScriptSecret,

          lineUserId:
            lineData.sub,

          memoryId:
            memoryId

        };

      }

      /* 讀取回憶列表 */
      else {

        payload = {

          action:
            'getMemories',

          secret:
            appsScriptSecret,

          lineUserId:
            lineData.sub

        };

      }


      const result =
        await callAppsScript(
          appsScriptUrl,
          payload
        );


      return res
        .status(200)
        .json(result);

    }



    /* =========================================
       POST
       ========================================= */

    const {
      idToken,
      action,
      memory,
      memoryId,
      fileId
    } = req.body || {};


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



    /* =========================================
       POST：設定回憶封面
       ========================================= */

    if (
      action === 'setMemoryCover'
    ) {

      if (!memoryId) {

        return res.status(400).json({
          success: false,
          message: 'Missing memoryId'
        });

      }


      if (!fileId) {

        return res.status(400).json({
          success: false,
          message: 'Missing fileId'
        });

      }


      const result =
        await callAppsScript(
          appsScriptUrl,
          {

            action:
              'setMemoryCover',

            secret:
              appsScriptSecret,

            lineUserId:
              lineData.sub,

            memoryId:
              memoryId,

            fileId:
              fileId

          }
        );


      return res
        .status(200)
        .json(result);

    }



    /* =========================================
       POST：建立新回憶
       ========================================= */

    if (
      !action ||
      action === 'createMemory'
    ) {

      if (!memory) {

        return res.status(400).json({
          success: false,
          message: 'Missing memory'
        });

      }


      const result =
        await callAppsScript(
          appsScriptUrl,
          {

            action:
              'createMemory',

            secret:
              appsScriptSecret,

            lineUserId:
              lineData.sub,

            memory:
              memory

          }
        );


      return res
        .status(200)
        .json(result);

    }



    /* =========================================
       不認識的 POST Action
       ========================================= */

    return res.status(400).json({
      success: false,
      message: 'Unknown memory action'
    });


  } catch (error) {

    console.error(error);


    return res
      .status(500)
      .json({

        success: false,

        message:
          error.message ||
          'Internal server error'

      });

  }

}



/* =========================================
   LINE ID Token 驗證
   ========================================= */

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
