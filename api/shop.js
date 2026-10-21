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
      action,
      itemId,
      item,
      benefitId
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


    const normalizedAction =
      String(
        action || 'getItems'
      )
        .trim();


    let payload;


    if (
      normalizedAction === 'getItems'
    ) {

      payload = {
        action:
          'getShopItems',

        secret:
          appsScriptSecret,

        lineUserId:
          lineData.sub
      };

    } else if (
      normalizedAction === 'redeem'
    ) {

      if (!itemId) {

        return res.status(400).json({
          success: false,
          message: 'Missing itemId'
        });

      }


      payload = {
        action:
          'redeemShopItem',

        secret:
          appsScriptSecret,

        lineUserId:
          lineData.sub,

        itemId:
          itemId
      };

    } else if (
      normalizedAction === 'createItem'
    ) {

      if (!item) {

        return res.status(400).json({
          success: false,
          message: 'Missing item'
        });

      }


      payload = {
        action:
          'createShopItem',

        secret:
          appsScriptSecret,

        lineUserId:
          lineData.sub,

        item:
          item
      };

    } else if (
      normalizedAction === 'getBenefits'
    ) {

      payload = {
        action:
          'getBenefits',

        secret:
          appsScriptSecret,

        lineUserId:
          lineData.sub
      };

    } else if (
      normalizedAction === 'useBenefit'
    ) {

      if (!benefitId) {

        return res.status(400).json({
          success: false,
          message: 'Missing benefitId'
        });

      }


      payload = {
        action:
          'useBenefit',

        secret:
          appsScriptSecret,

        lineUserId:
          lineData.sub,

        benefitId:
          benefitId
      };

    } else {

      return res.status(400).json({
        success: false,
        message:
          'Unknown shop action: ' +
          normalizedAction
      });

    }


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
          'Shop request failed'
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


  if (!data.sub) {

    throw new Error(
      'LINE user ID missing'
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
          JSON.stringify(
            payload
          )
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
