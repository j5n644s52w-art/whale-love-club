export default async function handler(req, res) {

  if (req.method !== 'POST') {

    return res.status(405).json({
      success: false,
      message: 'Method not allowed'
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
      message: 'Server configuration missing'
    });

  }


  try {

    const {
      idToken,
      fileId,
      fileIds
    } = req.body || {};


    if (!idToken) {

      return res.status(400).json({
        success: false,
        message: 'Missing idToken'
      });

    }


    const hasBatch =
      Array.isArray(fileIds) &&
      fileIds.length > 0;


    if (
      !fileId &&
      !hasBatch
    ) {

      return res.status(400).json({
        success: false,
        message: 'Missing fileId / fileIds'
      });

    }


    if (
      hasBatch &&
      fileIds.length > 6
    ) {

      return res.status(400).json({
        success: false,
        message: '最多一次讀取 6 張照片'
      });

    }


    const lineData =
      await verifyLineToken(
        idToken,
        channelId
      );


    const payload =
      hasBatch

        ? {
            action: 'getPrivatePhotos',
            secret: appsScriptSecret,
            lineUserId: lineData.sub,
            fileIds: fileIds
          }

        : {
            action: 'getPrivatePhoto',
            secret: appsScriptSecret,
            lineUserId: lineData.sub,
            fileId: fileId
          };


    const result =
      await callAppsScript(
        appsScriptUrl,
        payload
      );


    return res
      .status(200)
      .json(result);


  } catch (error) {

    console.error(error);


    return res
      .status(500)
      .json({
        success: false,
        message:
          error.message ||
          'Photo load failed'
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
