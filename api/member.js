module.exports = async function handler(req, res) {

  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    return res.status(200).json({
      success: true,
      service: 'Whale Love Club Member API',
      discover: true,
      viewLearning: true,
      message: 'API is running'
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed'
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
        message: 'LINE ID token is required'
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

    /*
     * 驗證 LINE ID token。
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
          body: form.toString()
        }
      );

    const lineData =
      await lineResponse.json();

    if (!lineResponse.ok) {
      return res.status(401).json({
        success: false,
        message:
          lineData.error_description ||
          lineData.error ||
          'LINE ID token verification failed'
      });
    }

    if (
      String(lineData.aud) !==
      String(channelId)
    ) {
      return res.status(401).json({
        success: false,
        message: 'Invalid LINE channel'
      });
    }

    if (!lineData.sub) {
      return res.status(401).json({
        success: false,
        message: 'LINE user ID missing'
      });
    }

    const lineUserId =
      String(
        lineData.sub
      ).trim();

    const op =
      String(
        operation || ''
      ).trim();

    /*
     * 沿用同一支 member.js，
     * 不新增第 13 個 Vercel API function。
     */
    let action = 'getMember';

    if (op === 'discoverList') {
      action = 'getDiscoverItems';
    }

    if (op === 'discoverToggle') {
      action = 'toggleDateIdea';
    }

    if (op === 'dateIdeas') {
      action = 'getDateIdeas';
    }

    if (op === 'discoverView') {
      action = 'recordDiscoverView';
    }

    const discoverItemActions =
      new Set([
        'toggleDateIdea',
        'recordDiscoverView'
      ]);

    if (
      discoverItemActions.has(action) &&
      !String(itemId || '').trim()
    ) {
      return res.status(400).json({
        success: false,
        message: 'Item ID is required'
      });
    }

    const payload = {
      action,
      secret:
        appsScriptSecret,
      lineUserId
    };

    if (
      discoverItemActions.has(action)
    ) {
      payload.itemId =
        String(
          itemId
        ).trim();
    }

    const appsData =
      await callAppsScriptJson(
        appsScriptUrl,
        payload
      );

    if (
      !appsData ||
      typeof appsData !== 'object'
    ) {
      return res.status(502).json({
        success: false,
        message:
          'Invalid Apps Script response'
      });
    }

    return res
      .status(
        appsData.success
          ? 200
          : 400
      )
      .json(
        appsData
      );

  } catch (error) {
    console.error(
      'Member API error:',
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
   Apps Script JSON 呼叫
   手動追蹤 ContentService Redirect
   ========================================= */

async function callAppsScriptJson(
  initialUrl,
  payload
) {

  let currentUrl =
    initialUrl;

  let method =
    'POST';

  let body =
    JSON.stringify(
      payload
    );

  let headers = {
    'Content-Type':
      'application/json'
  };

  const maxRedirects = 6;

  for (
    let i = 0;
    i <= maxRedirects;
    i++
  ) {

    const response =
      await fetch(
        currentUrl,
        {
          method,
          headers,
          body:
            method === 'GET'
              ? undefined
              : body,
          redirect: 'manual',
          cache: 'no-store'
        }
      );

    if (
      response.status === 301 ||
      response.status === 302 ||
      response.status === 303 ||
      response.status === 307 ||
      response.status === 308
    ) {
      const location =
        response.headers.get(
          'location'
        );

      if (!location) {
        throw new Error(
          'Apps Script redirect is missing Location header'
        );
      }

      currentUrl =
        new URL(
          location,
          currentUrl
        ).toString();

      if (
        response.status === 301 ||
        response.status === 302 ||
        response.status === 303
      ) {
        method =
          'GET';

        body =
          undefined;

        headers =
          {};
      }

      continue;
    }

    const text =
      await response.text();

    try {
      return JSON.parse(
        text
      );

    } catch (_) {
      console.error(
        'Apps Script non-JSON response:',
        {
          status:
            response.status,
          preview:
            text.slice(
              0,
              300
            )
        }
      );

      throw new Error(
        'Invalid Apps Script response'
      );
    }
  }

  throw new Error(
    'Too many Apps Script redirects'
  );
}
