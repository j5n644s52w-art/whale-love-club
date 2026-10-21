/* =========================================================
   Whale Love Club - Global Theme Controller
   File: /theme.js

   Current storage:
   localStorage -> wlc-site-theme

   Later, this can be connected to:
   Settings sheet -> SITE_THEME
   ========================================================= */

(function () {

  const STORAGE_KEY =
    'wlc-site-theme';

  const DEFAULT_THEME =
    'black-gold';

  const ALLOWED_THEMES = [
    'black-gold',
    'cute-pastel'
  ];


  function normalizeTheme(value) {

    const theme =
      String(
        value || ''
      ).trim();

    if (
      ALLOWED_THEMES.includes(
        theme
      )
    ) {
      return theme;
    }

    return DEFAULT_THEME;

  }


  function applyTheme(theme) {

    const value =
      normalizeTheme(theme);

    document.documentElement
      .setAttribute(
        'data-theme',
        value
      );

    return value;

  }


  function getSavedTheme() {

    try {

      return normalizeTheme(
        localStorage.getItem(
          STORAGE_KEY
        )
      );

    } catch (error) {

      return DEFAULT_THEME;

    }

  }


  function saveTheme(theme) {

    const value =
      normalizeTheme(theme);

    try {

      localStorage.setItem(
        STORAGE_KEY,
        value
      );

    } catch (error) {}

    applyTheme(value);

    window.dispatchEvent(
      new CustomEvent(
        'wlc-theme-change',
        {
          detail: {
            theme: value
          }
        }
      )
    );

    return value;

  }


  function cycleTheme() {

    const current =
      getSavedTheme();

    const next =
      current ===
      'black-gold'
        ? 'cute-pastel'
        : 'black-gold';

    return saveTheme(next);

  }


  // 頁面一載入就先套用主題
  applyTheme(
    getSavedTheme()
  );


  // 提供給其他頁面使用
  window.WLCTheme = {

    getTheme:
      getSavedTheme,

    setTheme:
      saveTheme,

    applyTheme:
      applyTheme,

    cycleTheme:
      cycleTheme,

    allowedThemes:
      [...ALLOWED_THEMES]

  };

})();
