export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

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
    const {
      idToken,
      operation,
      itemId
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

    const lineUserId =
      String(lineData.sub || '').trim();

    if (!lineUserId) {
      return res.status(401).json({
        success: false,
        message: 'LINE user ID missing'
      });
    }

    let action = '';
    const payload = {
      secret: appsScriptSecret,
      lineUserId
    };

    if (operation === 'list') {
      action = 'getDiscoverItems';

    } else if (operation === 'toggle') {
      if (!itemId) {
        return res.status(400).json({
          success: false,
          message: 'Missing itemId'
        });
      }

      action = 'toggleDateIdea';
      payload.itemId = String(itemId);

    } else if (operation === 'ideas') {
      action = 'getDateIdeas';

    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid operation'
      });
    }

    payload.action = action;

    const result =
      await callAppsScript(
        appsScriptUrl,
        payload
      );

    return res
      .status(result && result.success ? 200 : 400)
      .json(result);

  } catch (error) {
    console.error(
      'Discover API error:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        'Discover request failed'
    });
  }
}


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
      data.error ||
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

  if (!data.sub) {
    throw new Error(
      'LINE user ID missing'
    );
  }

  return data;
}


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
          JSON.stringify(payload),
        redirect: 'follow'
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
