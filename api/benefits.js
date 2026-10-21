export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed'
    });
  }

  const channelId = process.env.LINE_CHANNEL_ID;
  const appsScriptUrl = process.env.APPS_SCRIPT_URL;
  const appsScriptSecret = process.env.APPS_SCRIPT_SECRET;

  if (!channelId || !appsScriptUrl || !appsScriptSecret) {
    return res.status(500).json({
      success: false,
      message: 'Server configuration missing'
    });
  }

  try {
    const body = req.body || {};
    const idToken = body.idToken;
    const action = body.action || 'getBenefits';
    const benefitId = body.benefitId || '';

    if (!idToken) {
      return res.status(400).json({
        success: false,
        message: 'Missing idToken'
      });
    }

    const lineData = await verifyLineToken(idToken, channelId);

    let payload;

    if (action === 'getBenefits') {
      payload = {
        action: 'getBenefits',
        secret: appsScriptSecret,
        lineUserId: lineData.sub
      };
    } else if (action === 'useBenefit') {
      if (!benefitId) {
        return res.status(400).json({
          success: false,
          message: 'Missing benefitId'
        });
      }

      payload = {
        action: 'useBenefit',
        secret: appsScriptSecret,
        lineUserId: lineData.sub,
        benefitId: benefitId
      };
    } else {
      return res.status(400).json({
        success: false,
        message: 'Unknown benefits action: ' + action
      });
    }

    const result = await callAppsScript(appsScriptUrl, payload);

    return res.status(200).json(result);
  } catch (error) {
    console.error('Benefits API error:', error);

    return res.status(500).json({
      success: false,
      message: error && error.message
        ? error.message
        : 'Benefits request failed'
    });
  }
}

async function verifyLineToken(idToken, channelId) {
  const params = new URLSearchParams();

  params.append('id_token', idToken);
  params.append('client_id', channelId);

  const response = await fetch(
    'https://api.line.me/oauth2/v2.1/verify',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error_description || 'LINE verification failed'
    );
  }

  if (String(data.aud) !== String(channelId)) {
    throw new Error('Invalid LINE audience');
  }

  if (!data.sub) {
    throw new Error('LINE user ID missing');
  }

  return data;
}

async function callAppsScript(url, payload) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const responseText = await response.text();

  try {
    return JSON.parse(responseText);
  } catch (error) {
    console.error('Apps Script raw response:', responseText);
    throw new Error('Invalid Apps Script response');
  }
}
