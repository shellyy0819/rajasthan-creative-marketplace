// Inline <script> bodies for the root layout's <head>. They live outside the 'use client' components on purpose:
// a server component importing a constant from a client module receives a client reference, not the string.
export const THEME_KEY = 'theme';
export const SPLASH_KEY = 'splash-seen';

/** Applies the saved light/dark choice before first paint; with no saved choice CSS follows the OS setting. */
export const themeInitScript = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

/** A visitor who already saw the phone splash this browser session never gets the overlay again. */
export const splashInitScript = `(function(){try{if(sessionStorage.getItem("${SPLASH_KEY}"))document.documentElement.setAttribute("data-splash","seen")}catch(e){}})()`;
