module.exports = async function handler(req, res) {

  res.setHeader('Cache-Control', 'no-store');

  // 直接用瀏覽器打開 API 時，用來確認有沒有部署成功
  if (req.method === 'GET') {
    return res.status(200).json({
      success: true,
      service: 'Whale Love Club LINE Verification API',
      message: 'API is running'
    });
  }

  // 真正驗證只接受 POST
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed'
    });
  }

  try {

    const { idToken } = req.body || {};

    if (!idToken) {
      return res.status(400).json({
        success: false,
        message: 'ID token is required'
      });
    }

    const channelId = process.env.LINE_CHANNEL_ID;

    if (!channelId) {
      return res.status(500).json({
        success: false,
        message: 'LINE_CHANNEL_ID is not configured'
      });
    }

    const form = new URLSearchParams();

    form.append('id_token', idToken);
    form.append('client_id', channelId);

    // 交給 LINE 官方驗證 ID Token
    const lineResponse = await fetch(
      'https://api.line.me/oauth2/v2.1/verify',
      {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/x-www-form-urlencoded'
        },
        body: form.toString()
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
        message: 'LINE verification failed'
      });
    }

    // 再確認 Token 確實是發給我們這個 Channel
    if (
      String(lineData.aud) !==
      String(channelId)
    ) {
      return res.status(401).json({
        success: false,
        message: 'Invalid LINE channel'
      });
    }

    // 驗證成功
    return res.status(200).json({
      success: true,

      user: {
        lineUserId: lineData.sub,
        name: lineData.name || ''
      }
    });

  } catch (error) {

    console.error(
      'Verify LINE error:',
      error
    );

    return res.status(500).json({
      success: false,
      message: 'Server error'
    });

  }
};
