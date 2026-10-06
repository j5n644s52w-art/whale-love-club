export default async function handler(req, res) {

  // =========================
  // 健康檢查
  // =========================

  if (req.method === 'GET') {

    return res.status(200).json({
      success: true,
      service: 'Whale Love Club Photo Upload API'
    });
  }


  // =========================
  // 只接受 POST
  // =========================

  if (req.method !== 'POST') {

    return res.status(405).json({
      success: false,
      message: 'Method not allowed'
    });
  }


  try {

    const {
      idToken,
      fileName,
      mimeType,
      base64Data,
      folderType,
      subfolderName
    } = req.body || {};


    if (!idToken) {

      return res.status(400).json({
        success: false,
        message: 'Missing LINE ID token'
      });
    }


    if (!base64Data) {

      return res.status(400).json({
        success: false,
        message: 'Missing photo data'
      });
    }


    // =========================
    // 驗證 LINE ID Token
    // =========================

    const verifyBody =
      new URLSearchParams();

    verifyBody.append(
      'id_token',
      idToken
    );

    verifyBody.append(
      'client_id',
      process.env.LINE_CHANNEL_ID
    );


    const verifyResponse =
      await fetch(
        'https://api.line.me/oauth2/v2.1/verify',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/x-www-form-urlencoded'
          },
          body: verifyBody.toString()
        }
      );


    const verifyData =
      await verifyResponse.json();


    if (
      !verifyResponse.ok ||
      !verifyData.sub
    ) {

      return res.status(401).json({
        success: false,
        message: 'Invalid LINE login'
      });
    }


    const lineUserId =
      verifyData.sub;


    // =========================
    // 送給 Apps Script
    // =========================

    const appScriptResponse =
      await fetch(
        process.env.APPS_SCRIPT_URL,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json'
          },

          body:
            JSON.stringify({

              action:
                'uploadPhoto',

              secret:
                process.env.APPS_SCRIPT_SECRET,

              lineUserId:
                lineUserId,

              fileName:
                fileName ||
                ('WLC_' +
                  Date.now() +
                  '.jpg'),

              mimeType:
                mimeType ||
                'image/jpeg',

              base64Data:
                base64Data,

              folderType:
                folderType ||
                'Memories',

              subfolderName:
                subfolderName || ''

            })
        }
      );


    const data =
      await appScriptResponse.json();


    if (!data.success) {

      return res.status(400).json({
        success: false,
        message:
          data.message ||
          'Photo upload failed'
      });
    }


    return res.status(200).json({
      success: true,

      fileId:
        data.fileId,

      fileName:
        data.fileName,

      folderType:
        data.folderType,

      driveUrl:
        data.driveUrl
    });


  } catch (error) {

    console.error(
      'upload-photo error:',
      error
    );


    return res.status(500).json({
      success: false,
      message:
        error.message ||
        'Upload failed'
    });
  }
}
