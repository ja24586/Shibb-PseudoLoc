// ============================================================================
// Shibb Pseudolocalizer — main thread (sandboxed Figma plugin environment)
// ============================================================================

// Tracked so the collision-avoidance repositioning logic (section 6c, below)
// knows the panel's actual current on-screen footprint — updated every time
// a "resize" message comes in from the UI's self-measuring resize pattern.
let currentPanelWidthPx = 320;
let currentPanelHeightPx = 380;

// ============================================================================
// Embedded UI markup. This is a verbatim copy of ui.html, inlined directly as a
// string so the plugin needs only two files total for Figma: manifest.json
// (unavoidable — Figma reads it before any code runs) and this file. The
// separate manifest.json "ui" field and Figma's __html__ global are no longer
// used; figma.showUI() is called with this string directly instead, which is
// an officially documented, fully supported alternative — the manifest's "ui"
// field is explicitly optional ("if you choose to have one").
//
// ui.html is kept alongside this file as a human-editable reference copy only
// — Figma never reads it once "ui" is removed from manifest.json. If you edit
// the UI, edit ui.html (proper syntax highlighting, easier to work with), then
// regenerate this block from it before shipping.
// ============================================================================

const UI_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<style>
  /* Light defaults. Figma applies the .figma-dark class to <html>
     automatically based on the user's theme, when the plugin opts in via
     showUI's themeColors option — see the .figma-dark override block
     below. Diagnostic colors (overflow signal orange/blue/magenta, error
     red, the accent blue) deliberately stay the same in both themes —
     those are meaningful signals, not decorative choices, and shouldn't
     shift just because the theme did. */
  :root {
    --bg-primary: #ffffff;
    --text-primary: #1a1a1a;
    --text-secondary: #555555;
    --text-tertiary: #777777;
    --text-muted: #888888;
    --text-body: #444444;
    --border-color: #dddddd;
    --border-subtle: #eeeeee;
    --hover-bg: #f0f0f0;
    --icon-bg: #dddddd;
    --panel-bg: #faf9f7;
    --tooltip-bg: #1a1a1a;
    --tooltip-text: #ffffff;
    --accent: #18a0fb;
    --accent-hover: #0d8ee0;
    --error-color: #d13438;
  }
  .figma-dark {
    --bg-primary: #2b2b2b;
    --text-primary: #f0f0f0;
    --text-secondary: #b3b3b3;
    --text-tertiary: #999999;
    --text-muted: #8a8a8a;
    --text-body: #cccccc;
    --border-color: #444444;
    --border-subtle: #3a3a3a;
    --hover-bg: #3a3a3a;
    --icon-bg: #4a4a4a;
    --panel-bg: #363636;
    --tooltip-bg: #4a4a4a;
    --tooltip-text: #ffffff;
    --accent: #18a0fb;
    --accent-hover: #4db8ff;
    --error-color: #ff6b6e;
  }
  body {
    font-family: Inter, "Helvetica Neue", Arial, sans-serif;
    margin: 0;
    padding: 16px;
    background: var(--bg-primary);
    color: var(--text-primary);
  }
  p {
    font-size: 12px;
    line-height: 1.5;
    color: var(--text-secondary);
    margin: 0 0 12px 0;
  }
  label.checkbox {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--text-primary);
    margin-bottom: 12px;
    cursor: pointer;
  }
  label.checkbox input {
    margin: 0;
  }
  button {
    width: 100%;
    padding: 10px 12px;
    background: var(--accent);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }
  button:hover {
    background: var(--accent-hover);
  }
  button.secondary {
    margin-top: 8px;
    background: transparent;
    color: var(--text-secondary);
    font-weight: 400;
    border: 1px solid var(--border-color);
  }
  button.secondary:hover {
    background: var(--hover-bg);
  }
  button.small {
    width: auto;
    padding: 6px 10px;
    font-size: 12px;
    flex: 1;
  }
  a.footer-link {
    display: block;
    font-size: 11px;
    color: var(--accent);
    text-decoration: none;
    margin-top: 4px;
  }
  a.footer-link:hover {
    text-decoration: underline;
  }
  a.footer-link.tertiary {
    font-size: 13px;
    color: var(--text-secondary);
    text-align: center;
    margin-top: 12px;
  }
  a.footer-link.tertiary:hover {
    color: var(--text-primary);
  }
  .panel-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
  }
  .panel-header img {
    width: 20px;
    height: 20px;
    border-radius: 4px;
    flex-shrink: 0;
  }
  .panel-header .panel-title {
    font-size: 15px;
    font-weight: 700;
    color: var(--text-primary);
  }
  .feedback-block {
    margin-top: 20px;
    padding-top: 14px;
    border-top: 1px solid var(--border-subtle);
  }
  p.support-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--text-muted);
    margin: 0 0 8px 0;
  }
  p.feedback-title {
    font-size: 12px;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0 0 4px 0;
  }
  p.feedback-body {
    font-size: 11px;
    color: var(--text-tertiary);
    line-height: 1.5;
    margin: 0;
  }
  p.feedback-body a {
    color: var(--accent);
    text-decoration: none;
    word-break: break-all;
  }
  p.feedback-body a:hover {
    text-decoration: underline;
  }
  .hidden {
    display: none;
  }
  #notice {
    font-size: 12px;
    color: var(--error-color);
    margin-bottom: 12px;
  }
  .summary-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px solid var(--border-subtle);
    font-size: 12px;
  }
  .summary-row .label-group {
    display: flex;
    align-items: center;
    gap: 5px;
  }
  .summary-row .value {
    font-weight: 600;
  }
  .expandable-row {
    cursor: pointer;
  }
  /* Zero-count rows: neither label nor value bold, 40% alpha, and no
     pointer cursor — nothing happens on click since there's nothing to
     expand. Nonzero: bold, full opacity, clickable. Both classes applied
     via JS based on each row's actual count. */
  .row-zero {
    cursor: default;
  }
  .row-zero .row-label,
  .row-zero .value {
    font-weight: 400;
    opacity: 0.4;
  }
  .row-nonzero .row-label,
  .row-nonzero .value {
    font-weight: 700;
  }
  .chevron {
    color: var(--text-muted);
    transition: transform 300ms ease;
    display: inline-flex;
    flex-shrink: 0;
  }
  .chevron.hidden {
    visibility: hidden; /* reserve the layout space even when a row has no chevron, so labels stay aligned */
  }
  .row-expanded .chevron {
    /* Material's expand/collapse convention: a downward chevron
       (expand_more) rotates 180° to point up when expanded, over ~300ms —
       not a 90° rotation on a right-pointing triangle, which is what this
       was before. */
    transform: rotate(180deg);
  }
  .tooltip-wrapper {
    position: relative;
    display: inline-flex;
  }
  .info-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--icon-bg);
    color: var(--text-secondary);
    font-size: 10px;
    font-weight: 700;
    flex-shrink: 0;
    cursor: default;
  }
  .info-icon:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }
  /* Material 3 plain tooltip: appears on hover/focus, 4dp gap from anchor,
     brief description only — https://m3.material.io/components/tooltips/guidelines */
  .plain-tooltip {
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    margin-top: 4px;
    background: var(--tooltip-bg);
    color: var(--tooltip-text);
    font-size: 11px;
    line-height: 1.4;
    padding: 6px 9px;
    border-radius: 4px;
    width: 210px;
    z-index: 10;
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.1s ease;
    pointer-events: none;
  }
  .plain-tooltip.shown {
    opacity: 1;
    visibility: visible;
  }
  .review-panel {
    display: none;
    background: var(--panel-bg);
    border-radius: 6px;
    padding: 10px;
    margin-top: 4px;
    margin-bottom: 8px;
  }
  .review-panel.expanded {
    display: block;
  }
  .review-panel .review-index {
    font-size: 11px;
    color: var(--text-muted);
    margin-bottom: 4px;
  }
  .review-panel .review-node-name {
    font-size: 12px;
    font-weight: 600;
    margin-bottom: 4px;
  }
  .review-panel .review-message {
    font-size: 11px;
    color: var(--text-body);
    margin-bottom: 4px;
    padding-left: 8px;
    border-left: 2px solid var(--border-color);
  }
  .review-panel .review-message a {
    color: var(--accent);
    text-decoration: none;
    word-break: break-all;
  }
  .review-panel .review-message a:hover {
    text-decoration: underline;
  }
  .review-panel .review-buttons {
    display: flex;
    gap: 6px;
    margin-top: 8px;
  }
</style>
</head>
<body>
  <div id="notice" class="hidden"></div>

  <!-- SETTINGS VIEW -->
  <div id="settingsView" class="hidden">
    <div class="panel-header">
      <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAYAAADimHc4AAAblUlEQVR42u19eVCV1/n/570rO7LKIgKyKRYVRBCEmFGTTmNGs9p00tSa2lrHNGmSiclY00kypkk7TBvrlrZmaZKmTjSZ2Dg2camKIIpIQaMgRhCwyCKLrF7u8vz++T1n3nPf98LFJeY7w5m5A/fe933ezznPWZ7n+TznXIWICOPljhXDeBOMK2BcAeNlXAHjChgv4woYV8B4GVfAuALGy7gCxhUwXsYVMK6A8fLtFNPtFO5yueByuQAAiqJAURTxHRGBiKAoCgwGg/SdXuHr9eTxdwBgMBhgMBi+VWw3U5TbEY52Op0C/Fju0assN7rRaBwzBr17biW275wC3Burvr4ex44dQ3V1NZqamtDT0wO73Q4fHx9EREQgNTUVc+fORV5eHvz8/ETP5MZR/w8AFRUVOH78OM6dO4crV66gr68PRISAgADExMRg+vTpKCgowKxZswQe7uHu2BoaGgS2xsZGCVt4eLjAlp+fL7B5UurNNtotKS6XS/x/6NAhuv/++8nPz48AjPpKTEykV199lXp6eoiIyOFwkNPpJCIip9NJf/3rXykzM9MrWQaDgfLy8mjHjh0Cj8PhEP8fPnyYlixZ4jW2hIQEeuWVV6i7u1sj61aUWzICWITL5cKzzz6LTZs2Sd9PnDgRmZmZiI+Ph9VqRU9PD86fP4/KykrY7XZxXXJyMt555x3cddddYgQtX74cJSUlkry0tDRkZGQgKioKANDa2oozZ87g/Pnz0nVLlizB9u3bERERAbvdjhdeeAEbN26UromMjERWVpaEra6uDpWVlRgeHhbXJSUlYfv27bj77rtv7Ui4FT3f4XCQw+GgpUuXEgAymUxkNBrJ19eXfv/731N7e7vuvVVVVfTQQw8RALJarQSALBYL7d+/n1paWigmJkZ8BoCmTp1Ku3fvpuvXr2tkXb9+nXbv3k1Tp06V7pk2bRrV1dXRsmXLJGw+Pj705ptvUltbmy626upqeuSRRyRsJpOJPvvss1s6Em5aAQxk7dq1AixX8ODBg+I6p9NJdrud7HY7ORwOacr61a9+RQDIbDYTAAoNDaW0tDSpIWfOnElXr16VnquWx+Xq1as0Y8YMSV5QUJDU+FarlQ4cOOAVtl//+tcSDqvVStXV1eK+O6oABnD27FkyGAxkNBrJZDIRAHrjjTdEz1RXyF153HhZWVkEgIxGozSfK4pCFouFzpw5Q0RENpvNI57h4WGBx8fHhxRFIYPBQABIURQhe8OGDWPClp2dLSlh3rx55HK57rwC7HY7ERH98pe/lABGRkZSX18fOZ1OjxV0l/H5558LBXDDsTKXLVsmXeuNvOXLl4terygKKYpCACgiIoJ6e3vHhO2LL74Q2FiJPLpvdirCzVo9Q0NDFBcXJyngJz/5iS44p9OpGeIul4tcLhcNDAxQdHS06K3q0fDpp5+Sy+WSFKBee9Ty+P3+/fvFKGJFAKDHH398zNgGBwcpNjZW1FFRFHryySe97hQjFcPNWj61tbVobm6GoijCsywsLJS8U77eYDDAaDRK1/L/fn5+yMnJEd6soihwOp2wWCyYPXu25Dyxl2o0GoU8tSesKAoyMzMRHBwMl8slOVA3gs3X11dg4+tLS0vhdDphMt1cMOGGFcAga2pqAABGo1F8lpaWpnHvFUVBdXU1Dh48iLa2NhgMBtEI/Dc9PV0TGoiOjkZ0dLTkUCmKguvXr+Po0aMoKSmB3W6XviMihIWFISEhQWpIb7C1trbqYvve974nvW9qakJra6vUFnckGHf58mWpkoqiIDIyUmowm82GRx99FLNmzcKiRYuQnp6OXbt2iV7OJS4uTmoUAIiIiIDFYpF6bU1NDTIzM3HXXXehsLAQc+bMQX19vSbGw36CwWDQYOPGtNls+OEPfyhh27Fjh6Q0AJg0aZI0+oaGhnDlyhVJKXdEAd3d3dJ7q9Uque6KoqC0tBS7du2CwWCA2WxGV1cXXnzxRTgcDinUEBwcrJEfEBAghTkURcG2bdtQW1sLi8UCi8WC6upqbNy4UdNo7vLMZjP8/f2FohRFwbFjx/DJJ58IbN3d3XjxxRfFqNKTxZ9fu3btzoej1d4i9zZ3L7G1tRVmsxkGgwEOhwNGoxF9fX0YHByU5m+z2azpUXpzbEdHB0wmE1wuF4gIJpMJLS0t0qhTy+MGMxqNGnlXrlzRYOvv70d/f79HbCxP7cXfMQVYLBbN2qCeVgBg8uTJsNvtwoV3Op0ICwuDv7+/boXUPc/hcGieOWnSJDgcDnGdw+FAYmKixwbiRnQ6nRp5ethCQkIQGBjoEZu7Uu6oAkJCQqT3NpsNAwMD0sKcm5uLJ554AoqiwOFwICoqCkVFRdLC7WlI9/X1iYrz4rh69WrMmDEDdrsddrsdc+bMwdNPPy2sGS69vb2SLLvdrsE2d+5cLF++XGCLjIxEUVGRGGF62FgBQUFBdy4WxPbvjh07hM3ONvfhw4d1be1z585RaWkpdXV1Sb4Ey1q3bp2w2VlWXFyciP2wXc73lJeXU3l5ufBI+Tv+O2vWLOELsDxPDlRNTQ2VlJSIcIc7tpdfflkKb1gsFmpsbLzpkARuNgxx+vRp4Wmys7Nt2zZdx0nvfnVjPPDAA5I3zBW+ePGidI+eB+ve+J2dnTRhwgTh2DG2zZs33xC2hx9+WFJAUlKSCH2M5lHfFkeM58a0tDQx//LwLy4u1rW1eX1QTxVEBKPRiKGhIZw8eVKiBI1GI+x2O06ePKmhI4kITqdTyONn8cJcVVWFnp4eyaa/UWw2mw3l5eXS9Tk5OTCbzcLSuyPhaO5Fzz33nNQ7wsLCqKenx+t4i8vloi+//FIKHahDEQ888MCYY0GrVq2SQhA8okJCQqirq8srbBya2Ldvn8DGmDgsfbOhCNzo9GO328lms5HT6aT6+nry9fWVhro64jhSPImH8d13362JhnKlzWazCAHz9SM1fnNzMwUGBkpBOLXsV199dUzYFi5cqOElbDabCIm7x5BumwI4YKVXXnvtNWkB9fPzoxMnTmji7eoXg/7zn/+s2/jqz2bPnk0DAwMaLkD94vKDH/xAVx5HWX19famsrMwrbFu2bJGMDLPZTLt37x5xxNwWBagbvrm5md5//31atWoVLViwgDIyMigtLY3MZjOZTCYxCkJDQyVu1r0MDg7S7373O6mCfD+/1BxDfn4+VVVVeZR36dIlevDBByXyxV0eywoJCaF//vOfHhtscHCQ3nzzTcEj8L0+Pj6Unp5OGRkZtGjRIlqzZg198sknwrIbq1XkFSfMTkpDQwNef/117Ny5U2NjaxyM/x9/AYCsrCwsWLAAKSkp8PPzQ29vL86ePYuvvvoKFy9elKKfnorZbIbdbofJZMI999yD/Px8TJo0CUajEa2traioqMC///1v9PX1iWs9FXa4ACAzMxMLFy7UYNu3bx+++eYb6dqRSnR0NH72s59h7dq1CAwM9Jo3HlUBLGjnzp1YtWqVFPsJCgpCYWEhZs6cifDwcAwPD6OpqQknTpzAqVOnRChBz5tVhxr4+ylTpqCwsBDJycmiMWpra3H06FG0tLRISh1NUcHBwZg/fz4yMjIQGhoKm82GxsZGlJWV4fTp015hUysyPz8fc+bMQWxsLIxGI9ra2vDf//4XJSUlGBoaEvdMnToVH330EWbPnu2dEryZdv7xj3+IeZQJ6scff1zY53pl//79NG3aNDEd6L14jg4ICKC3336bBgcHdWV1d3fThg0bhEPlSR5PL6tWraLm5maP69ju3btp8uTJI2JjWbm5uWK90Ctff/013X///VLbBAUF0bFjx7yajjDSgutyuai2tpZ8fHzEAgSAVq9erUuO84sf2t7eTqmpqRI3674gWq1W4TmzJaN+qdeejz/+WGOqui/W69atGxEbz/kNDQ0UExMjeclqywsA5eTkiIVfb7FWY2NHjZUQFRVFbW1t5HQ6R1QCRuv97J2yCZacnEzDw8MjWkRq8rykpES3ktzD1q9fPypB7nK5hLyf/vSnGguH/8/MzBRKHKnSLGv37t0ahbLparFY6Ny5c16Zvi6Xi3p6eigqKkrcyyNxNN4YI4UZLly4IEhtbrC33nprzE7RvffeKzUU2+aBgYFe9RLG5HQ6qa6ujsxms659/+GHH3qNzVM2BtfzwQcfHHM92RQ3m83C3L18+fKIU5FhJLpxz549IkbucDhgMpmwePFiTdTR5XLB4XDA4XBo2CEiwmOPPSaFL/jegoICwVCp3X8OG6utD/4+JSUF2dnZIkzA1lNAQADuvfdeYeW4Y+Mwg3tE89FHH5Ww8eePPPKIbl24nmpjgMMdDz30kOAVDAYDhoaGsGfPnhFpS8NIcR5OCeTKJyYmIjExUSLIOYHWZDLBZDLpEuS5ubkCmFp+Xl6eFOPh75g4MRqNUiNwnGfevHlSiJqtj8jISE1ciLG5k/d8TX5+vsSQcSZ0VlaWbiIA11NtkXFsKTU1FfHx8aKDKoqCw4cPaziOUfcHcA+6cOGC1CsSExNFHJ21bjAYUFNTg7KyMvj7++O+++7TkBmTJk1CWFgYOjo6pEZggtydSNm/fz8aGxsxdepUFBQUSN8pioJp06ZpOktKSoowm00mk8B2+vRpnDx5EiEhIVi8eDGsVqs0ghMTE2G1WmGz2USdwsLCEBsbq0kEaG9vx4EDB2Cz2bBgwQLR2BzMM5vNSEpKQkNDgwgo1tbWSp14VDOUF0J1ng5bP5zvo7YAPvroI/E9AEpLS6Pm5mYpc8zlcgmTVL0gq3kDp9NJw8PDtGTJEmmxfv755zVhkL1794p5m+fsZ599VoNty5Yt0gKbnZ1NXV1dEra+vj6aOHGiNP+npaWJduDwwunTp8V1ACg4OJgOHTok8pN4HXjiiSekNouJiRHmtZ6R4TEcPTQ0JDkYaoJc3fO2bdsGu90Oq9UKq9WK8+fPY+fOnaJXcA9hMlw9AtQEOY+kf/3rXzAajTCbzVAUBRs3btSkigQGBmq4Y/VnfO3mzZvhcrkEeV9RUYG9e/dKXrc6iYCLv7+/tKdAURR8+OGHaGtrg4+PD6xWK65du4a33npLM7UwDi6Dg4MYHBwcOyXpdDo1C4ea0OYH22w24a7zMOzq6vI4rY30GcfvmR7kRuCwBzc436dWgFoWK394eFgYEOzZdnZ2akIm7tODuyymN00mk+AgTCaTwKVWgjvpr8eRe6UAXmw8ZUCwchISEkTjM0c7c+ZMjTy92Iw7CZ+YmCisFn5GeHg4YmNjRyXv1Z/xTpi4uDhR+eHhYdjtdsyYMUO6V4+o15M/bdo0OBwOQeA7HA5kZGRoLBz3LBG9TAyvFODv7y9NOe45QNw7X3vtNeTn58PHxwcTJkzAU089haVLl2rMRHUvVvcqdaPFxcVhy5YtiIuLg5+fH1JTU/Huu+9qsid6eno0DeSen0REKCoqQnZ2tth2tH79esyfP1/aqjQ0NIT+/n5pRPX19Qml8HS2YsUKLFu2DIGBgfD19cV9992HdevWiXp6whEYGCimWq9jQbxY5ObmSgtKQUGBx8WkqalJsxGDr7t69SoFBwdr+Nn33ntPcmT4+v7+frp06ZKGc+XrNm/eLIWcAdDSpUs9ep2NjY3U2dk5orOp9oiDgoJEXdzr2traKpwrvboWFBRIbZaTkzMib2zwNP8DQEZGhtTLLly4gIGBAWkh5eEXFxeHiIgIab7j7+rr63Ht2jXpPgA4c+aMxv9wOp3w9/dHfHw8zGazJrkWgIhmqnttTU2NJvrIz588eTJCQ0MlbGwm1tXVCWeTn9Xb2yulOqoz8yZOnCimRHX+qKIoGBgYEKY712f69OlSm44pL2jhwoXiwQaDAW1tbaiqqpKcJ7VD5j4cGWBxcbHu4nnkyBHNosfOF8tTL5DcSEePHpXyQBVFwcWLF3HhwoUxYdNzlPgafobacePpiJ/pnghQXV0tJR4TERYsWDD2cDQPl+7ubgoLC9ONhN5IvMU96GU0Gqm6ulrY0t4Q5MeOHdNEV3kKYa53NGzsBwwPD9OUKVMkbPw3KyvL6w0Y/Lw1a9aI6UdRFAoODqaOjo4RpyCMJvSVV16RNib4+/tTQ0PDqFFCjjh++umnuvwsv3/44YfF9Z4CVtxYnvhejmBGRkYKanAkJTAZ//bbb4+IbdeuXaNui+LnNDU1iUQAjoa+8MILNxYNVfeSgYEBysjIIADk4+MjFmP27vTi5Kzt+vp6io6O1g1Hqyu6bds2jzF8NfhNmzaNSt4vWbJEPN8dm1rW6dOnacKECWIfmjsfYDAYaOLEiVRXV+cRG3cYu91OCxYskPiAxMREr1Jz4E322zfffEMJCQnSA+bOnUslJSUep4vPP/9csE68t8qdDVMrZu3atXTlyhVdeW1tbfTSSy95lMWZGKyERYsW0alTpzyOzI8//pgiIiJGxMayoqOjaceOHR5HQUVFhUip4bYJDw8XyQOjhdlH5YR5AW5ubsaKFStw8OBBaZWfO3cuMjMzMXHiRNjtdly+fBknT57E2bNnveJdeWElIoSEhCA/Px9Tp05FYGAg+vv7UVdXh9LSUnR2dnpFkDOPqygK8vLyMHPmTERGRsLhcKCxsRHl5eWoq6sbMyecmpqK3NxcxMfHw2KxoL29HdXV1SgrK5NkZGdn4+9//zvS09O94oS9yopQn9nw3nvvYfPmzaisrBzxHnVjJSUlIS8vD4mJifDx8UFXVxfOnTuHkpIS9PX1jSkrAgBycnKQlZWFmJgYkeNfWVmJEydOaK4dDduUKVMENl9fX3R3dwtsvb29klU2UklPT8cvfvELrF69GhaLxfvd9GPZFamey8rLy+lPf/oTrVy5khYvXkwFBQW6eUHvv/8+DQ0N6cpsamqi1atXS3lBetMBy8vLy6PS0lKPGMvKyig/P3/UPCPOC3r33Xc9JgI0NzcLq4anJKPRSOHh4fT973+fFi9eTCtXrqSioiIqLS2VFv2x5AWNOTXR04r+/PPPS3RccHAwVVZWerW4MpU30uJaWFgoFKm38HOlr1+/TvPnzx8xMy4oKIgqKiq8wuaeOBYUFOQxOey2ZsbpnQ9x/fp1stvtVFFRoQkzbN26dVSynRvSU24om5d+fn5UX18/qunL3zU1NVFQUJDH3NBNmzZ5hY3lsYXD5uWsWbPIZrPR8PDwt5sb6mk0PPnkkxLA2NhYGhoaGlN29IEDBzTOGitz+fLlYybIn3rqKd3s6OjoaBocHBxTdvShQ4c02dF79+79buyUVzNnrICVK1dqGkzNHKnnSF5bbDYbxcfHS0rgyn7xxRe6myrc/Q51ox09elR3p/yKFSvGjG14eJgSExMlh/THP/7xLVHATW/U5tOr1FtE8/PzNRkIarLdndBm1kpvp7yPjw9mzpypSQRQE+TqZ/O9M2bMQFhYmCaY547NPRFAD5vZbEZubq5Un+PHj4sg3s3sE77hffbqowrcd8qnpKSIYJWatD548CDa29uRmZmJ9PR0aWe7eqe8mm+IiooSG675M4PBgI6ODhw5ckQEvMLCwiR5QUFBSEhIQGdnp9Soqamputj+85//oK2tDbNmzcL06dM9YuP3zc3NaGlpweTJkyWu4lvfpPfGG29I8W9FUai2tlaaDvr6+oRlwtPBli1bJAuEiOgvf/mLJs6fnZ0tTRMul4vKy8slgnzSpElUVVUlwic8LSxevFizDnC2G8vq7+8XBgBPe7xIq7Ft375dOn0FgNj/cDPT0E1vU3XfWqomuXn4l5aW4siRIzCZTLBYLHA4HNiwYYPgk9XZ1u5cr3qnPPe0d955B21tbSIR4PLly9i6dauUCKC3jdRsNmuwlZSU4PDhwwKb0+nE66+/PiI2d0bvju4Tdvc49XbKd3d3i7nabrfDaDRieHhYZF1wg+lxp3r5NEyQMx9gMplEIoB6KmAc6ow8d3mdnZ262DiTQQ+beoP4zZabPrjVarVK75m4VgNNSkqSOFan04nY2FgEBQWNuhtdr5IsT70oM/Pk7U55dUKXO7aYmBgEBwd7xMbrifspAXdkBISGhmpGBJPcvPhlZ2dj7dq1CAkJgclkwvTp07Ft2zbNFlIm29WNxsOcey8RYc2aNbjnnntgsVhgNpuxZMkSsVOeEwHc5Y2E7aWXXkJoaChMJhPS09O9xqZ3uMi3vgjv3LlTs1N+//79uotTR0cHXbhwQUPC83sOOasXupiYGJGj7+44Xbp0iS5duuQRIx/epw57f/XVVzeE7Te/+Y1kbHiT+XxbF2Ee/tOnTxdDl+fcs2fPak6lcjqdCA8PR3Jyspi/1fmeAPD1119LCy4AtLW1obm5Wep5/H18fLzIz3Q/YOnq1atoaGiQsuX4GTeDTX3Ih/o8om99CuIhmpKSguTkZImkPnTokGY3uieynaeN/v5+sRud51jORCsrK9M9uFtNyrsT5KdOnRKhbnWD3wi2wcFBEerme/Pz86Wsuzu6U959eAYGBlJra6tXGy9YxmeffaY5NVHNcI01FsRJsupTE5nTbmlpGRM23kmjZsr27dt3Z2NB6n1kly9fpoCAACl74rnnnhMUoDfRUD6b0/3cUOZsi4uLRyXIOXrJ+9rczw1lh+yZZ54ZEzZOUONYV3Z2tlcKvO0KUPcA3lFusVhET9mzZ49XMfff/va3UjpHYGAgzZkzRwp+JScnU2trqyYQp8cH5OXlSQ3Gp6YwuWM0GqXd7iNh46wQs9ksRufx48dvSe+/JQpQA3n66ael8x2sViv98Y9/pN7eXt37WlpaxLHFTGgDoA8++IAGBgbEienckKmpqfTll196xHHy5EmRGsjyIiMjqba2VpxFxNgsFgsVFRXRtWvXdGVduXKFnnnmGQ22v/3tb7es8b3eKe9NYI4TXv/whz/g5ZdflrKEExMTMW/ePCQnJ8Pf3x/Xrl1DTU0NiouL0dHRIa4LCwvD1q1bsWzZMmF7//znP8euXbuk52VnZyMnJwdxcXEiY6+yshKlpaWSZ56bm4sPPvgAqampAICioiKsX78eNptNXJOQkIB58+YhJSVFwnb06FG0t7frYvtOnZ6ul8ZSVVVFjz32GAUEBHh1Rn9ERAStWbNGnECl/v0A9jXy8vI0+TueXtOmTaONGzeKNUEtr7q6mn70ox9RYGDgDWO7leWW/4SJunc0NjaiuLgYFRUVuHTpErq6uuBwOES6eHJyMnJyclBYWIjw8HDN/Ww+sllYWVmJ4uJinDlzBv/73/+kX9CIiopCeno65s2bh7lz54oD9dQZHWrZTU1NOHLkiEdsSUlJyM3NRUFBASIiIjT336pyW35DRi8Z1hvFefptlxupuKfffbnV2L6TClBXVu08qR0cuoFfKlLLU99zI/JuNbbvpALGy7cQDR0v4woYV8B4GVfAuALGy7gCxhUwXsYVMK6A8TKugP9T5f8BWCxgubj7tFsAAAAASUVORK5CYII=" alt="" />
      <span class="panel-title">Settings</span>
    </div>
    <label class="checkbox">
      <input type="checkbox" id="rtlToggle" />
      Include RTL edge cases
    </label>
    <label class="checkbox">
      <input type="checkbox" id="verticalToggle" />
      Include vertical glyph edge cases
    </label>
    <label class="checkbox">
      <input type="checkbox" id="alwaysShowSummaryToggle" />
      Always show Summary report
    </label>
    <button id="settingsDone">Done</button>
    <a class="footer-link tertiary" id="settingsCancel" href="#">Cancel</a>
    <div class="feedback-block">
      <p class="support-label">Support</p>
      <p class="feedback-title">I'd love to hear from you!</p>
      <p class="feedback-body">
        Please share questions, feature requests, and feedback at
        <a id="githubLink" href="https://github.com/ja24586/Shibb-PseudoLoc" target="_blank" rel="noopener noreferrer">https://github.com/ja24586/Shibb-PseudoLoc</a>.
      </p>
    </div>
  </div>

  <!-- SUMMARY VIEW -->
  <div id="runView" class="hidden">
    <div class="panel-header">
      <img src="data:image/png;base64,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" alt="" />
      <span class="panel-title">Summary</span>
    </div>
    <div class="summary-row expandable-row" id="rowLoc" data-row="loc">
      <div class="label-group">
        <span class="chevron" id="chevronLoc"><svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg></span>
        <span class="row-label" id="labelLoc">LOC issues found</span>
        <span class="tooltip-wrapper">
          <span class="info-icon" id="locInfoIcon" tabindex="0" role="button" aria-describedby="locInfoText">i</span>
          <span class="plain-tooltip" id="locInfoText" role="tooltip">
            Includes text exceeding its container, and collisions between lines within the container.
          </span>
        </span>
      </div>
      <span class="value" id="locIssuesValue">0</span>
    </div>
    <div class="review-panel" id="panelLoc">
      <div class="review-index"></div>
      <div class="review-node-name"></div>
      <div class="review-messages"></div>
      <div class="review-buttons">
        <span class="tooltip-wrapper">
          <button class="small secondary" data-action="back" data-row="loc">Back</button>
          <span class="plain-tooltip" role="tooltip">Use arrow keys to navigate</span>
        </span>
        <span class="tooltip-wrapper">
          <button class="small secondary" data-action="next" data-row="loc">Next</button>
          <span class="plain-tooltip" role="tooltip">Use arrow keys to navigate</span>
        </span>
      </div>
    </div>

    <div class="summary-row expandable-row" id="rowLockedSkipped" data-row="lockedSkipped">
      <div class="label-group">
        <span class="chevron" id="chevronLockedSkipped"><svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg></span>
        <span class="row-label" id="labelLockedSkipped">Locked / hidden layers skipped</span>
      </div>
      <span class="value" id="skippedLockedValue">0</span>
    </div>
    <div class="review-panel" id="panelLockedSkipped">
      <div class="review-index"></div>
      <div class="review-node-name"></div>
      <div class="review-messages"></div>
      <div class="review-buttons">
        <span class="tooltip-wrapper">
          <button class="small secondary" data-action="back" data-row="lockedSkipped">Back</button>
          <span class="plain-tooltip" role="tooltip">Use arrow keys to navigate</span>
        </span>
        <span class="tooltip-wrapper">
          <button class="small secondary" data-action="next" data-row="lockedSkipped">Next</button>
          <span class="plain-tooltip" role="tooltip">Use arrow keys to navigate</span>
        </span>
      </div>
    </div>

    <div class="summary-row expandable-row" id="rowEmptySkipped" data-row="emptySkipped">
      <div class="label-group">
        <span class="chevron" id="chevronEmptySkipped"><svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg></span>
        <span class="row-label" id="labelEmptySkipped">Excluded / empty layers skipped</span>
      </div>
      <span class="value" id="skippedEmptyValue">0</span>
    </div>
    <div class="review-panel" id="panelEmptySkipped">
      <div class="review-index"></div>
      <div class="review-node-name"></div>
      <div class="review-messages"></div>
      <div class="review-buttons">
        <span class="tooltip-wrapper">
          <button class="small secondary" data-action="back" data-row="emptySkipped">Back</button>
          <span class="plain-tooltip" role="tooltip">Use arrow keys to navigate</span>
        </span>
        <span class="tooltip-wrapper">
          <button class="small secondary" data-action="next" data-row="emptySkipped">Next</button>
          <span class="plain-tooltip" role="tooltip">Use arrow keys to navigate</span>
        </span>
      </div>
    </div>

    <div class="summary-row expandable-row" id="rowErrors" data-row="errors">
      <div class="label-group">
        <span class="chevron" id="chevronErrors"><svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg></span>
        <span class="row-label" id="labelErrors">Errors</span>
        <span class="tooltip-wrapper">
          <span class="info-icon" id="errorsInfoIcon" tabindex="0" role="button" aria-describedby="errorsInfoText">i</span>
          <span class="plain-tooltip" id="errorsInfoText" role="tooltip">
            Problems that prevented a string from being tested, or fonts that couldn't load and were substituted.
          </span>
        </span>
      </div>
      <span class="value" id="errorsValue">0</span>
    </div>
    <div class="review-panel" id="panelErrors">
      <div class="review-index"></div>
      <div class="review-node-name"></div>
      <div class="review-messages"></div>
      <div class="review-buttons">
        <span class="tooltip-wrapper">
          <button class="small secondary" data-action="back" data-row="errors">Back</button>
          <span class="plain-tooltip" role="tooltip">Use arrow keys to navigate</span>
        </span>
        <span class="tooltip-wrapper">
          <button class="small secondary" data-action="next" data-row="errors">Next</button>
          <span class="plain-tooltip" role="tooltip">Use arrow keys to navigate</span>
        </span>
      </div>
    </div>

    <button id="exportSummary" class="secondary hidden" style="margin-top: 12px;">Export</button>
    <button id="runDone" style="margin-top: 8px;">Done</button>
  </div>

  <script>
    // Reads a CSS custom property's current computed value — used where JS
    // needs an actual color string (inline styles, not CSS classes), so
    // those values track whichever theme is currently active instead of
    // being frozen to whatever was hardcoded at write time.
    function cssVar(name) {
      return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    }

    const notice = document.getElementById("notice");
    const settingsView = document.getElementById("settingsView");
    const runView = document.getElementById("runView");

    // Enter closes whichever view is active. The original Enter-to-run
    // behavior no longer applies now that Run is invoked directly from the
    // Figma menu/hotkey with no button click in the loop at all — this
    // panel only ever appears for Settings or for reviewing the Summary.
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      if (!settingsView.classList.contains("hidden")) {
        document.getElementById("settingsDone").click();
      } else if (!runView.classList.contains("hidden")) {
        document.getElementById("runDone").click();
      }
    });

    // ------------------------------------------------------------------
    // Settings view — autosave on every change, no Save button needed.
    // ------------------------------------------------------------------
    function wireSettingsAutosave() {
      const ids = ["rtlToggle", "verticalToggle", "alwaysShowSummaryToggle"];
      ids.forEach((id) => {
        document.getElementById(id).addEventListener("change", () => {
          parent.postMessage(
            {
              pluginMessage: {
                type: "settingsChanged",
                includeRTL: document.getElementById("rtlToggle").checked,
                verticalEdgeCase: document.getElementById("verticalToggle").checked,
                alwaysShowSummary: document.getElementById("alwaysShowSummaryToggle").checked
              }
            },
            "*"
          );
        });
      });
    }
    wireSettingsAutosave();

    document.getElementById("settingsDone").onclick = () => {
      parent.postMessage({ pluginMessage: { type: "close" } }, "*");
    };
    document.getElementById("settingsCancel").onclick = (e) => {
      e.preventDefault(); // it's an <a> for tertiary styling, not real navigation
      parent.postMessage({ pluginMessage: { type: "close" } }, "*");
    };

    // ------------------------------------------------------------------
    // Info tooltips — Material 3 plain tooltip behavior: hover or focus to
    // show, no click-to-toggle. Hides ~1.5s after leaving the target region
    // (per M3 guidelines), immediately if a DIFFERENT tooltip is triggered.
    // https://m3.material.io/components/tooltips/guidelines
    // ------------------------------------------------------------------
    let tooltipHideTimer = null;

    function hideAllTooltips() {
      document.querySelectorAll(".plain-tooltip.shown").forEach((el) => {
        el.classList.remove("shown");
        // Reset to default centered position so the next show() recomputes
        // fresh rather than reusing a stale clamped offset from last time.
        el.style.left = "";
        el.style.transform = "";
      });
    }

    // The default CSS centers the tooltip under its anchor via left: 50% +
    // translateX(-50%). That overflows the panel for anchors near either
    // edge (Back button near the left edge, in particular) — this measures
    // the tooltip's natural centered position after it's shown, and if it
    // would extend past the panel bounds, overrides with an explicit
    // pixel-based left offset (relative to the tooltip-wrapper, since the
    // tooltip is absolutely positioned against that, not the page) that
    // keeps the whole tooltip on-screen.
    function clampTooltipToPanel(wrapper, tooltip) {
      const wrapperRect = wrapper.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();
      const panelWidth = document.documentElement.clientWidth;
      const margin = 8;

      let desiredLeft = tooltipRect.left;
      let clampedLeft = desiredLeft;
      if (clampedLeft < margin) clampedLeft = margin;
      if (clampedLeft + tooltipRect.width > panelWidth - margin) {
        clampedLeft = panelWidth - tooltipRect.width - margin;
      }

      if (clampedLeft !== desiredLeft) {
        tooltip.style.left = (clampedLeft - wrapperRect.left) + "px";
        tooltip.style.transform = "none";
      }
    }

    function wireTooltipEls(icon, tooltip) {
      const wrapper = icon.closest(".tooltip-wrapper");

      const show = () => {
        if (tooltipHideTimer) clearTimeout(tooltipHideTimer);
        hideAllTooltips(); // triggering a new tooltip closes any other open one
        tooltip.classList.add("shown");
        clampTooltipToPanel(wrapper, tooltip);
      };
      const scheduleHide = () => {
        if (tooltipHideTimer) clearTimeout(tooltipHideTimer);
        tooltipHideTimer = setTimeout(() => {
          tooltip.classList.remove("shown");
          tooltip.style.left = "";
          tooltip.style.transform = "";
        }, 1500);
      };

      icon.addEventListener("mouseenter", show);
      icon.addEventListener("focus", show);
      icon.addEventListener("mouseleave", scheduleHide);
      icon.addEventListener("blur", scheduleHide);
    }

    function wireTooltip(iconId, tooltipId) {
      wireTooltipEls(document.getElementById(iconId), document.getElementById(tooltipId));
    }
    wireTooltip("locInfoIcon", "locInfoText");
    wireTooltip("errorsInfoIcon", "errorsInfoText");
    // Back/Next tooltips wired per-row further down, once each row's
    // buttons exist and are looked up generically.

    // ------------------------------------------------------------------
    // Generic accordion + review system, shared across all four summary
    // rows (LOC issues, locked/hidden skipped, empty skipped, errors).
    // Only one row expanded at a time — expanding a row collapses whatever
    // else was open. Rows with a zero count get no chevron and aren't
    // clickable at all.
    // ------------------------------------------------------------------
    const ROW_CONFIG = {
      loc: { rowId: "rowLoc", panelId: "panelLoc", valueId: "locIssuesValue", labelId: "labelLoc", chevronId: "chevronLoc" },
      lockedSkipped: { rowId: "rowLockedSkipped", panelId: "panelLockedSkipped", valueId: "skippedLockedValue", labelId: "labelLockedSkipped", chevronId: "chevronLockedSkipped" },
      emptySkipped: { rowId: "rowEmptySkipped", panelId: "panelEmptySkipped", valueId: "skippedEmptyValue", labelId: "labelEmptySkipped", chevronId: "chevronEmptySkipped" },
      errors: { rowId: "rowErrors", panelId: "panelErrors", valueId: "errorsValue", labelId: "labelErrors", chevronId: "chevronErrors" }
    };

    let logsByRow = { loc: [], lockedSkipped: [], emptySkipped: [], errors: [] };
    let reviewIndexByRow = { loc: 0, lockedSkipped: 0, emptySkipped: 0, errors: 0 };
    let expandedRow = null;

    function renderReviewStep(rowKey) {
      const cfg = ROW_CONFIG[rowKey];
      const log = logsByRow[rowKey];
      if (log.length === 0) return;
      const idx = reviewIndexByRow[rowKey];
      const item = log[idx];
      const panel = document.getElementById(cfg.panelId);
      panel.querySelector(".review-index").textContent = "Item " + (idx + 1) + " of " + log.length;
      panel.querySelector(".review-node-name").textContent = item.nodeName;
      const msgContainer = panel.querySelector(".review-messages");
      msgContainer.innerHTML = "";
      item.messages.forEach((m) => {
        const div = document.createElement("div");
        div.className = "review-message";
        div.style.borderLeftColor = m.color;
        if (m.link) {
          const span = document.createElement("span");
          span.textContent = m.text + " ";
          div.appendChild(span);
          const a = document.createElement("a");
          a.href = m.link;
          a.target = "_blank";
          a.rel = "noopener noreferrer";
          a.textContent = m.link;
          div.appendChild(a);
        } else {
          div.textContent = m.text;
        }
        msgContainer.appendChild(div);
      });
      // Message-sending intentionally NOT here — see sendSelectNodeForRow().
      // On first expand, the resize message needs to reach the main thread
      // BEFORE selectNode, so collision-avoidance has real final dimensions.
    }

    function sendSelectNodeForRow(rowKey) {
      const log = logsByRow[rowKey];
      const idx = reviewIndexByRow[rowKey];
      if (!log[idx]) return;
      parent.postMessage({ pluginMessage: { type: "selectNode", nodeId: log[idx].nodeId } }, "*");
    }

    function reviewNextForRow(rowKey) {
      const log = logsByRow[rowKey];
      reviewIndexByRow[rowKey] = Math.min(reviewIndexByRow[rowKey] + 1, log.length - 1);
      renderReviewStep(rowKey);
      sendSelectNodeForRow(rowKey);
    }
    function reviewBackForRow(rowKey) {
      reviewIndexByRow[rowKey] = Math.max(reviewIndexByRow[rowKey] - 1, 0);
      renderReviewStep(rowKey);
      sendSelectNodeForRow(rowKey);
    }

    function collapseRow(rowKey) {
      const cfg = ROW_CONFIG[rowKey];
      document.getElementById(cfg.panelId).classList.remove("expanded");
      document.getElementById(cfg.rowId).classList.remove("row-expanded");
    }

    function expandRow(rowKey) {
      const cfg = ROW_CONFIG[rowKey];
      reviewIndexByRow[rowKey] = 0;
      document.getElementById(cfg.rowId).classList.add("row-expanded");
      document.getElementById(cfg.panelId).classList.add("expanded");
      renderReviewStep(rowKey);

      // requestAnimationFrame matters here, not just style: reading
      // scrollHeight in the same synchronous tick as the class mutations
      // above risks measuring BEFORE the browser has finished reflowing —
      // a real, confirmed source of the panel getting resized too short
      // and needing to scroll. Settings view already did this correctly;
      // this and the run-view init handler below didn't.
      requestAnimationFrame(() => {
        const neededHeight = Math.ceil(document.body.scrollHeight) + 20;
        parent.postMessage(
          { pluginMessage: { type: "resize", width: 320, height: Math.max(neededHeight, 200) } },
          "*"
        );
        // Sent AFTER the resize message on purpose, matching the original
        // first-display sequencing — collision avoidance needs the panel's
        // real final dimensions, not whatever was in place before resizing.
        sendSelectNodeForRow(rowKey);
      });
    }

    function toggleRow(rowKey) {
      if (logsByRow[rowKey].length === 0) return; // nothing to expand for an empty/zero row

      if (expandedRow === rowKey) {
        collapseRow(rowKey);
        expandedRow = null;
        return;
      }
      if (expandedRow) collapseRow(expandedRow);
      expandedRow = rowKey;
      expandRow(rowKey);
    }

    Object.keys(ROW_CONFIG).forEach((rowKey) => {
      const cfg = ROW_CONFIG[rowKey];
      document.getElementById(cfg.rowId).addEventListener("click", (e) => {
        if (e.target.closest(".tooltip-wrapper")) return; // don't toggle when clicking the info icon
        toggleRow(rowKey);
      });

      const backBtn = document.querySelector('button[data-action="back"][data-row="' + rowKey + '"]');
      const nextBtn = document.querySelector('button[data-action="next"][data-row="' + rowKey + '"]');
      backBtn.addEventListener("click", (e) => { e.stopPropagation(); reviewBackForRow(rowKey); });
      nextBtn.addEventListener("click", (e) => { e.stopPropagation(); reviewNextForRow(rowKey); });

      const backTooltip = backBtn.parentElement.querySelector(".plain-tooltip");
      const nextTooltip = nextBtn.parentElement.querySelector(".plain-tooltip");
      wireTooltipEls(backBtn, backTooltip);
      wireTooltipEls(nextBtn, nextTooltip);
    });

    document.addEventListener("keydown", (e) => {
      if (!expandedRow) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        reviewNextForRow(expandedRow);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        reviewBackForRow(expandedRow);
      }
    });

    // ------------------------------------------------------------------
    // Export — generates a plain-text file client-side (Blob + anchor
    // click, since file downloads need a DOM context the main thread
    // doesn't have) listing every finding from the Summary — LOC issues,
    // locked/hidden and excluded/empty skips, and errors — not just
    // errors, which is what this button covered before.
    // ------------------------------------------------------------------
    const EXPORT_SECTION_LABELS = {
      loc: "LOC Issues Found",
      lockedSkipped: "Locked / Hidden Layers Skipped",
      emptySkipped: "Excluded / Empty Layers Skipped",
      errors: "Errors"
    };

    document.getElementById("exportSummary").onclick = () => {
      let text = "Shibb Pseudolocalizer \u2014 Summary\n";
      text += "Generated " + new Date().toISOString() + "\n";
      text += "=".repeat(50) + "\n";

      Object.keys(EXPORT_SECTION_LABELS).forEach((rowKey) => {
        const log = logsByRow[rowKey];
        text += "\n" + EXPORT_SECTION_LABELS[rowKey] + " (" + log.length + ")\n";
        text += "-".repeat(50) + "\n";
        if (log.length === 0) {
          text += "None.\n";
          return;
        }
        log.forEach((item, i) => {
          text += (i + 1) + ". " + item.nodeName + "\n";
          item.messages.forEach((m) => {
            text += "   " + m.text + "\n";
            if (m.link) text += "   Resource: " + m.link + "\n";
          });
          text += "\n";
        });
      });

      const blob = new Blob([text], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "shibb-summary.txt";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };

    document.getElementById("runDone").onclick = () => {
      parent.postMessage({ pluginMessage: { type: "close" } }, "*");
    };

    // ------------------------------------------------------------------
    // Init / Summary routing from the main thread
    // ------------------------------------------------------------------
    window.onmessage = (event) => {
      const msg = event.data.pluginMessage;
      if (!msg) return;

      if (msg.type === "init" && msg.view === "settings") {
        settingsView.classList.remove("hidden");
        if (msg.settings) {
          document.getElementById("rtlToggle").checked = !!msg.settings.includeRTL;
          document.getElementById("verticalToggle").checked = !!msg.settings.verticalEdgeCase;
          document.getElementById("alwaysShowSummaryToggle").checked = !!msg.settings.alwaysShowSummary;
        }
        requestAnimationFrame(() => {
          const neededHeight = Math.ceil(document.body.scrollHeight) + 20;
          parent.postMessage(
            { pluginMessage: { type: "resize", width: 320, height: Math.max(neededHeight, 200) } },
            "*"
          );
        });
        return;
      }

      if (msg.type === "init" && msg.view === "run") {
        runView.classList.remove("hidden");
        const stats = msg.stats || {};

        // Normalize all four sources into the same {nodeId, nodeName,
        // messages: [{color, text, link?}]} shape the generic reviewer
        // expects. LOC issues already arrive in this shape from code.js;
        // the other three get synthesized here. Colors read from the live
        // CSS custom properties (not hardcoded hex) so they track whichever
        // theme is currently active rather than freezing to light-mode
        // values regardless of the figma-dark class.
        const skipColor = cssVar("--text-muted");
        const errorColor = cssVar("--error-color");

        logsByRow.loc = msg.issueLog || [];
        logsByRow.lockedSkipped = (msg.skippedLockedLog || []).map((item) => ({
          nodeId: item.nodeId,
          nodeName: item.nodeName,
          messages: [{ color: skipColor, text: "Skipped \u2014 this layer is locked or hidden." }]
        }));
        logsByRow.emptySkipped = (msg.skippedEmptyLog || []).map((item) => {
          const reasonText = {
            empty: "Skipped \u2014 this text layer has no content.",
            already: "Skipped \u2014 already pseudolocalized; nothing has changed since.",
            excluded: "Skipped \u2014 this text is a date, number, ID, or placeholder with no other content to test."
          }[item.reason] || "Skipped.";
          return {
            nodeId: item.nodeId,
            nodeName: item.nodeName,
            messages: [{ color: skipColor, text: reasonText }]
          };
        });
        logsByRow.errors = (msg.errorLog || []).map((item) => ({
          nodeId: item.nodeId,
          nodeName: item.nodeName,
          messages: [{ color: errorColor, text: item.message, link: item.link || null }]
        }));

        const counts = {
          loc: stats.locIssuesFound || 0,
          lockedSkipped: stats.skippedLocked || 0,
          emptySkipped: stats.skippedEmpty || 0,
          errors: stats.errors || 0
        };

        Object.keys(ROW_CONFIG).forEach((rowKey) => {
          const cfg = ROW_CONFIG[rowKey];
          const count = counts[rowKey];
          document.getElementById(cfg.valueId).textContent = count;

          const rowEl = document.getElementById(cfg.rowId);
          const chevronEl = document.getElementById(cfg.chevronId);
          if (count > 0) {
            rowEl.classList.add("row-nonzero");
            rowEl.classList.remove("row-zero");
            chevronEl.classList.remove("hidden");
          } else {
            rowEl.classList.add("row-zero");
            rowEl.classList.remove("row-nonzero");
            chevronEl.classList.add("hidden");
          }
        });

        const anyFindings = counts.loc > 0 || counts.lockedSkipped > 0 || counts.emptySkipped > 0 || counts.errors > 0;
        if (anyFindings) {
          document.getElementById("exportSummary").classList.remove("hidden");
        }

        // Auto-expand the highest-priority nonzero row: LOC issues first,
        // then errors, then locked/hidden skipped, then empty skipped.
        // toggleRow() already handles the resize+selectNode sequencing
        // (via expandRow()), so reusing it here gets the same collision
        // avoidance a manual click would get, for free.
        const priorityOrder = ["loc", "errors", "lockedSkipped", "emptySkipped"];
        const winningRow = priorityOrder.find((key) => logsByRow[key].length > 0);

        if (winningRow) {
          toggleRow(winningRow);
        } else {
          // Nothing to expand — only reachable via "Always show summary" on
          // a fully clean run, since the toast-vs-panel logic in code.js
          // wouldn't otherwise open the panel at all with everything at
          // zero. Falls back to checking the panel against whatever was
          // already selected when Run was invoked, so it at least doesn't
          // land on top of the user's current work by coincidence.
          requestAnimationFrame(() => {
            const neededHeight = Math.ceil(document.body.scrollHeight) + 20;
            parent.postMessage(
              { pluginMessage: { type: "resize", width: 320, height: Math.max(neededHeight, 200) } },
              "*"
            );
            if (msg.firstSelectedNodeId) {
              parent.postMessage(
                { pluginMessage: { type: "avoidCoveringSelection", nodeId: msg.firstSelectedNodeId } },
                "*"
              );
            }
          });
        }
        return;
      }
    };
  </script>
</body>
</html>
`;

// ----------------------------------------------------------------------------
// 0. Settings persistence. figma.clientStorage is scoped per plugin ID, per
//    user — it persists across every file this user opens on this machine,
//    but does NOT sync across different machines/devices for the same user.
// ----------------------------------------------------------------------------

const SETTINGS_KEY = "shibbSettings";
const DEFAULT_SETTINGS = { includeRTL: false, verticalEdgeCase: false, alwaysShowSummary: false };

async function loadSettings() {
  try {
    const saved = await figma.clientStorage.getAsync(SETTINGS_KEY);
    return saved ? Object.assign({}, DEFAULT_SETTINGS, saved) : DEFAULT_SETTINGS;
  } catch (e) {
    return DEFAULT_SETTINGS; // no saved settings yet, or storage unavailable — defaults apply, not an error
  }
}

// Two commands, declared in manifest.json's "menu": "run" (default, headless
// unless there's something worth showing) and "settings" (always visible,
// checkboxes only, no Run/selection concept at all). figma.command tells us
// which one fired; anything that isn't explicitly "settings" is treated as
// "run", for robustness against invocation paths that might not carry
// command info consistently.
async function main() {
  if (figma.command === "settings") {
    figma.showUI(UI_HTML, { width: 320, height: 300, themeColors: true });
    const settings = await loadSettings();
    figma.ui.postMessage({ type: "init", view: "settings", settings: settings });
    return;
  }

  // "run" — genuinely headless unless the result has something worth a
  // human's attention. UI starts hidden; only figma.ui.show() reveals it.
  figma.showUI(UI_HTML, { width: 320, height: 380, visible: false, themeColors: true });
  const settings = await loadSettings();
  const result = await run(settings.includeRTL, settings.verticalEdgeCase);

  if (result.notice) {
    figma.notify(result.notice);
    figma.closePlugin();
    return;
  }

  function showPanel() {
    figma.ui.show();
    figma.ui.postMessage({
      type: "init",
      view: "run",
      stats: result.stats,
      issueLog: result.issueLog,
      errorLog: result.errorLog,
      skippedLockedLog: result.skippedLockedLog,
      skippedEmptyLog: result.skippedEmptyLog,
      firstSelectedNodeId: result.firstSelectedNodeId
    });
  }

  if (settings.alwaysShowSummary) {
    showPanel();
    return;
  }

  // Compact native toast instead of the panel. Skipped counts (locked/
  // hidden + empty) are combined into one number here for brevity — the
  // full panel still breaks them out separately if someone opens it.
  const skippedTotal = result.stats.skippedLocked + result.stats.skippedEmpty;
  const parts = [];
  if (result.stats.locIssuesFound > 0) parts.push("Issues: " + result.stats.locIssuesFound);
  if (skippedTotal > 0) parts.push("Skipped: " + skippedTotal);
  if (result.stats.errors > 0) parts.push("Errors: " + result.stats.errors);
  const toastMessage = parts.length > 0 ? parts.join(", ") : "No issues found";

  const hasAnythingToReview = result.stats.locIssuesFound > 0 || result.stats.errors > 0 || skippedTotal > 0;

  if (!hasAnythingToReview) {
    figma.notify(toastMessage);
    figma.closePlugin();
    return;
  }

  // A toast with a custom action button is automatically closed the moment
  // the plugin closes (confirmed via Figma's own API changelog) — so the
  // plugin has to stay alive until either Details is clicked or the toast's
  // own timeout elapses. detailsShown + clearing the pending close timer is
  // what prevents the plugin from force-closing out from under someone who
  // DID click Details and is actively reviewing the Summary.
  let detailsShown = false;
  const TOAST_TIMEOUT = 6000;

  figma.notify(toastMessage, {
    timeout: TOAST_TIMEOUT,
    button: {
      text: "Details",
      action: () => {
        detailsShown = true;
        showPanel();
      }
    }
  });

  setTimeout(() => {
    if (!detailsShown) figma.closePlugin();
  }, TOAST_TIMEOUT + 300);
}

main();

// ----------------------------------------------------------------------------
// 1. Homoglyph tables — visually-similar characters drawn from Latin
//    Extended, Greek, and Cyrillic (all covered by core "Noto Sans", so
//    these render as intended rather than tofu). Each letter maps to a
//    small array of candidates; one is picked at random per occurrence so
//    repeated letters in a string don't all get the same substitution.
// ----------------------------------------------------------------------------

const HOMOGLYPHS = {
  a: ["á", "а", "ạ"],           A: ["Á", "А", "Α"],
  b: ["ḃ", "β"],                 B: ["Ḃ", "Β", "В"],
  c: ["ç", "с"],                 C: ["Ç", "Ϲ"],
  d: ["ď", "đ"],                 D: ["Ď", "Đ"],
  e: ["é", "е", "ė"],            E: ["É", "Е", "Ε"],
  f: ["f̃", "ƒ"],                 F: ["F̃", "Ƒ"],
  g: ["ğ", "ġ"],                 G: ["Ğ", "Ġ"],
  h: ["ĥ", "һ"],                 H: ["Ĥ", "Η", "Н"],
  i: ["í", "і", "ı"],            I: ["Í", "І", "Ι"],
  j: ["ĵ", "ј"],                 J: ["Ĵ", "Ј"],
  k: ["ķ", "κ"],                 K: ["Ķ", "Κ", "К"],
  l: ["ĺ", "ł"],                 L: ["Ĺ", "Ł"],
  m: ["ṁ", "m̃"],                 M: ["Μ", "М"],
  n: ["ñ", "ń"],                 N: ["Ń", "Ñ"],
  o: ["ő", "о", "ο", "ω"],       O: ["Ő", "О", "Ο", "Ω"],
  p: ["p̀", "р"],                 P: ["P̀", "Ρ", "Р"],
  q: ["q̃", "ԛ"],                 Q: ["Q̃", "Ǫ"],
  r: ["ř", "ŕ"],                 R: ["Ř", "Ŕ"],
  s: ["š", "ѕ"],                 S: ["Š", "Ѕ"],
  t: ["ť", "ţ"],                 T: ["Ť", "Τ", "Т"],
  u: ["ü", "υ"],                 U: ["Ü", "Ú"],
  v: ["ṽ", "ν"],                 V: ["Ṽ", "Ѵ"],
  w: ["ŵ", "ẃ"],                 W: ["Ŵ", "Ẃ"],
  x: ["x̂", "х"],                 X: ["X̂", "Χ", "Х"],
  y: ["ý", "у", "γ"],            Y: ["Ý", "Υ", "У"],
  z: ["ž", "ᴢ"],                 Z: ["Ž", "Ζ"]
};

const FULLWIDTH_DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

// Padding pools, split by script so the font-assignment pass (section 4)
// can tag each run correctly. These get appended to hit the target
// expansion length.
const PAD_POOL_BASE = [
  // Thai consonants
  "ก","ข","ค","ง","จ","ช","ซ","ฐ","ณ","ด","ต","ถ","ท","ธ","น","บ","ป","ผ","ฝ",
  "พ","ฟ","ภ","ม","ย","ร","ล","ว","ศ","ษ","ส","ห","อ","ฮ",
  // Thai vowels
  "ำ","ะ","า","ิ","ี","ึ","ื","ุ","ู","เ","แ","โ","ใ","ไ",
  // Thai tone marks / combining (stack above/below base — height edge case)
  "่","้","๊","๋","็","์",
  // Cyrillic lower/upper
  "а","б","в","г","д","е","ж","з","и","й","к","л","м","н","о","п","р","с","т",
  "у","ф","х","ц","ч","ш","щ","ъ","ы","ь","э","ю","я",
  "А","Б","В","Г","Д","Е","Ж","З","И","Й","К","Л","М","Н","О","П","Р","С","Т",
  "У","Ф","Х","Ц","Ч","Ш","Щ","Ъ","Ы","Ь","Э","Ю","Я",
  // Vietnamese multi-diacritic stacks (base + tone + modifier)
  "ệ","ẫ","ả","ữ","ỳ","ộ","ẵ","ẳ","ỗ",
  // Fullwidth Latin (double-width edge case)
  "Ｗ","Ｍ","Ｑ","Ｇ",
  // CJK — generic, non-brand Han characters + kana, for glyph density/joining
  "山","水","火","木","金","土","人","大","小","中","日","月","年","光","風",
  "雲","星","花","川","石",
  "あ","い","う","え","お","か","き","く","け","こ",
  "ア","イ","ウ","エ","オ","カ","キ","ク","ケ","コ"
];

// RTL pool — only mixed in when the user enables the RTL toggle. Arabic
// harakat and Hebrew niqqud are combining marks (stack on the base letter),
// and Arabic-Indic digits are included deliberately since numerals inside
// RTL text are a classic bidi edge case.
const PAD_POOL_RTL = [
  // Arabic letters
  "ا","ب","ت","ث","ج","ح","خ","د","ذ","ر","ز","س","ش","ص","ض","ط","ظ","ع","غ",
  "ف","ق","ك","ل","م","ن","ه","و","ي",
  // Arabic harakat (combining diacritics)
  "ً","ٌ","ٍ","َ","ُ","ِ","ّ","ْ",
  // Arabic-Indic digits
  "٠","١","٢","٣","٤","٥","٦","٧","٨","٩",
  // Hebrew letters
  "א","ב","ג","ד","ה","ו","ז","ח","ט","י","כ","ל","מ","נ","ס","ע","פ","צ","ק",
  "ר","ש","ת",
  // Hebrew niqqud (combining diacritics)
  "ָ","ֶ","ִ","ֹ","ֻ","ְ","ּ"
];

// Strong-directional letters ONLY (no combining marks, no digits — those are
// weak/neutral per the Unicode Bidirectional Algorithm and don't establish
// paragraph direction). Per UAX#9 rule P2, a paragraph's base direction is
// set by its first STRONG L/AL/R character — bidi embedding-control
// characters are explicitly excluded from that determination. So actually
// flipping a line's overall direction requires a genuine strong RTL letter
// at the very start, not just an embedding mark buried inside brackets.
const RTL_STRONG_LETTERS = [
  "ا","ب","ت","ث","ج","ح","خ","د","ذ","ر","ز","س","ش","ص","ض","ط","ظ","ع","غ",
  "ف","ق","ك","ل","م","ن","ه","و","ي",
  "א","ב","ג","ד","ה","ו","ז","ח","ט","י","כ","ל","מ","נ","ס","ע","פ","צ","ק",
  "ר","ש","ת"
];

// Vertical edge-case pool — only mixed in when the "vertical edge case
// characters" toggle is on. Unlike PAD_POOL_BASE (which includes Thai/
// Vietnamese characters individually), these are pre-assembled MULTI-MARK
// SEQUENCES — a Thai consonant with a vowel AND a tone mark stacked
// together, a Vietnamese base letter with two combining marks at once —
// since true vertical stress comes from marks compounding on one base
// character, not from isolated marks scattered through padding. Per
// Google's Material Design language categories, Thai and Vietnamese are
// both in the "Tall" script tier (extra line height required); Arabic
// multi-harakat stacks are included as a second tier, only when RTL is
// ALSO enabled, since Arabic script isn't touched at all otherwise.
const PAD_POOL_VERTICAL = [
  // Thai: consonant + vowel + tone mark stacked on one base
  "กี้", "ปั๊", "มื่", "นี๊", "ลั๋", "วุ้", "ทึ่", "หู้",
  // Vietnamese: base + two combining marks at once (already in PAD_POOL_BASE
  // individually; repeated here as the "always include these" priority set)
  "ệ", "ữ", "ẫ", "ộ", "ẵ"
];

const PAD_POOL_VERTICAL_RTL = [
  // Arabic: consonant + shadda (gemination) + a vowel harakat stacked together
  "بّ", "دّ", "سّ", "لّ", "نّ"
];

const SIGNAL_PALETTE = ["#FF1493", "#FF4500", "#39FF14", "#00E5FF", "#FFD700"];
const VERTICAL_OVERFLOW_COLOR = "#FF00E5"; // fixed magenta stroke — visually distinct from the fill-color overflow signal

// ----------------------------------------------------------------------------
// 2. Grapheme-aware length helper (falls back gracefully — Figma's plugin
//    sandbox doesn't always ship full Intl.Segmenter support depending on
//    app version, so this degrades to Array.from() if unavailable).
// ----------------------------------------------------------------------------

function graphemeLength(str) {
  try {
    if (typeof Intl !== "undefined" && Intl.Segmenter) {
      const seg = new Intl.Segmenter(undefined, { granularity: "grapheme" });
      return Array.from(seg.segment(str)).length;
    }
  } catch (e) {
    // fall through to the simpler count below
  }
  return Array.from(str).length;
}

// ----------------------------------------------------------------------------
// 3. Pseudolocalization string transform
//
//    IMPORTANT: every random choice below is driven by a per-node SEEDED
//    generator (mulberry32, seeded from a hash of the node's id + its
//    original text), not raw Math.random(). This was a real bug, not a
//    stylistic choice: unseeded randomness meant the exact pseudolocalized
//    output — and therefore whether a borderline element crossed its
//    overflow threshold — differed on every single run, even against a
//    completely unchanged design. Seeding makes results reproducible: same
//    node, same source text, same output, every time. If the source text
//    changes, the seed changes too (by design), so a stale pseudo-output
//    never lingers after a real content edit.
// ----------------------------------------------------------------------------

function hashStringToSeed(str) {
  // Simple, fast string hash (a common xmur3-style variant) — doesn't need
  // to be cryptographically anything, just needs to spread different
  // strings across the 32-bit seed space reasonably evenly.
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Creates a deterministic RNG (a function behaving like Math.random(),
// returning [0, 1)) seeded from the given string.
function createSeededRng(seedString) {
  const seedFn = hashStringToSeed(seedString);
  return mulberry32(seedFn());
}

function decorateChar(ch, rng) {
  if (HOMOGLYPHS[ch]) {
    const options = HOMOGLYPHS[ch];
    return options[Math.floor(rng() * options.length)];
  }
  if (ch >= "0" && ch <= "9") return FULLWIDTH_DIGITS[Number(ch)];
  return ch; // spaces, punctuation, anything else: left as-is
}

function decorate(str, rng) {
  return Array.from(str).map((ch) => decorateChar(ch, rng)).join("");
}

// Non-localizable content — tokens that must survive pseudolocalization
// untouched, extended beyond just interpolation placeholders. Verified
// against real i18n practice (Google's own translate="no" convention
// explicitly names "brand names, code, and identifiers" as the standard
// exclusion category) and tested against representative strings, including
// one real bug the testing caught: an early version of the hex-color
// pattern was greedy enough to swallow the first 8 characters of a longer
// alphanumeric ID sitting right after a "#" (e.g. a ticket number), because
// #RRGGBBAA-style 8-digit hex and a "#"-prefixed ID are structurally
// identical to a regex with no other context. Fixed with a negative
// lookahead so the hex pattern only matches when nothing longer follows.
//
// Deliberately NOT covered: brand names and proper nouns. Real, commonly-
// cited exclusion category, but a vocabulary judgment ("is this word a
// brand name") rather than a structural pattern — needs a maintained
// glossary/term list, not a regex. Different feature.
//
// Order matters: more specific patterns (GUID, ISO dates, month names)
// must come before more general ones (plain numbers), since regex
// alternation tries each option in order at a given position and the
// first one that matches wins, even if a later, more specific option
// would have matched more of the string.
const NON_LOCALIZABLE_REGEX = new RegExp(
  "(" +
  [
    "\\{\\{[^{}]*\\}\\}",                                      // {{name}}
    "\\$\\{[^{}]*\\}",                                          // ${var}
    "\\{[^{}]*\\}",                                             // {count}
    "%\\d*\\$?[sdfotxX@]",                                      // %s %d %1$s %@
    "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}", // GUID/UUID
    "\\d{4}-\\d{2}-\\d{2}(?:[T ]\\d{2}:\\d{2}(?::\\d{2})?(?:\\.\\d+)?(?:Z|[+-]\\d{2}:?\\d{2})?)?", // ISO 8601
    "(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\\.?\\s+\\d{1,2},?\\s+\\d{2,4}", // "March 15, 2026"
    "\\d{1,2}\\s+(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\\.?,?\\s+\\d{2,4}", // "15 March 2026"
    "\\d{1,2}[/.-]\\d{1,2}[/.-]\\d{2,4}",                       // numeric dates, any common order/separator
    "\\d{1,2}:\\d{2}(?::\\d{2})?\\s?(?:[AaPp][Mm])?",           // times, 12h or 24h
    "https?://[^\\s]+",                                         // URLs
    "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}",          // email addresses
    "[$\u20AC\u00A3\u00A5]\\s?\\d{1,3}(?:[,.\\s]\\d{3})*(?:[.,]\\d+)?", // currency-prefixed numbers
    "\\d{1,3}(?:[,.\\s]\\d{3})*(?:[.,]\\d+)?%",                 // percent-suffixed numbers
    "#[0-9A-Fa-f]{6}(?![0-9A-Fa-f])|#[0-9A-Fa-f]{3}(?![0-9A-Fa-f])", // hex color codes
    "\\b\\d+(?:[.,]\\d+)?\\b"                                   // plain numeric data (must stay last — most general)
  ].join("|") +
  ")",
  "g"
);

function protectedDecorate(line, counter, rng) {
  const parts = line.split(NON_LOCALIZABLE_REGEX);
  counter.count += Math.floor(parts.length / 2); // odd-indexed entries are protected matches
  return parts.map((part, idx) => (idx % 2 === 0 ? decorate(part, rng) : part)).join("");
}

// True if a line consists ENTIRELY of non-localizable content (a date, an
// ID, an email — nothing else) once whitespace is trimmed away. This is a
// stricter question than protectedDecorate answers: that function protects
// non-localizable SUBSTRINGS within an otherwise-normal line ("Total: 15%
// off" still pseudolocalizes "Total:" and "off"); this asks whether a
// whole line has no normal content at all, in which case the line — or,
// checked across every line, the whole node — shouldn't be pseudolocalized
// as a unit at all (no bracket-wrap, no padding), the same way an empty
// text layer already isn't.
function isLineEntirelyExcluded(line) {
  if (line.trim().length === 0) return true; // blank lines don't count against the node either way
  const parts = line.split(NON_LOCALIZABLE_REGEX);
  const remainder = parts.filter((_, idx) => idx % 2 === 0).join("").trim();
  return remainder.length === 0;
}

function isTextEntirelyExcluded(text) {
  return text.split("\n").every(isLineEntirelyExcluded);
}

// Stepped expansion function, banded to match IBM's "Guidelines to design
// global solutions" table (as reproduced by W3C i18n: see
// https://www.w3.org/International/articles/article-text-size.en.html).
// That table expresses expansion as a RATIO of final-to-original length
// (e.g. "200-300%" = translated text ends up 2-3x the source). This
// function is ADDITIVE instead (2.0 means +200% on top of the original,
// i.e. final = 3x), so each band below uses the TOP of IBM's published
// range, converted to additive by subtracting 100%. That intentionally
// biases toward the more aggressive end of real-world expansion — a
// reasonable choice for a stress-testing tool, where over-simulating is
// safer than under-simulating.
//
// IBM's bands, for reference (source chars -> ratio range -> additive top):
//   <=10   : 200-300% ratio -> 200% additive  (used as-is)
//   11-20  : 180-200% ratio -> 100% additive  (used as-is)
//   21-30  : 160-180% ratio ->  80% additive  (used as-is)
//   31-50  : 140-160% ratio ->  60% additive  (used as-is)
//   51-70  : IBM's published "151-170%" breaks the otherwise-monotonic
//            trend (widely believed to be a typo in the original table).
//            We use 40% additive instead, interpolated to preserve a
//            smooth decline between the 31-50 and >70 bands.
//   >70    : 130% ratio -> 30% additive       (used as-is)
//
// Operates on grapheme count, not raw UTF-16 length.
function expansionRatio(len) {
  if (len <= 10) return 2.0;   // +200%
  if (len <= 20) return 1.0;   // +100%
  if (len <= 30) return 0.8;   // +80%
  if (len <= 50) return 0.6;   // +60%
  if (len <= 70) return 0.4;   // +40% (interpolated — see note above)
  return 0.3;                  // +30%
}

function randomPadWord(pool, minLen, maxLen, rng) {
  const len = minLen + Math.floor(rng() * (maxLen - minLen + 1));
  let out = "";
  for (let i = 0; i < len; i++) {
    out += pool[Math.floor(rng() * pool.length)];
  }
  return out;
}

// Builds padding text. includeRTL mixes in Arabic/Hebrew word-chunks
// (~35% of words). verticalEdgeCase mixes in pre-assembled multi-mark
// stacked sequences (~30% of words) — Thai/Vietnamese always available,
// Arabic multi-harakat stacks only when RTL is ALSO enabled. The two
// toggles are independent and compose rather than gating each other.
function buildPadding(targetExtraLength, includeRTL, verticalEdgeCase, rng) {
  let out = "";
  while (graphemeLength(out) < targetExtraLength) {
    if (out.length > 0) out += " ";
    const roll = rng();
    if (verticalEdgeCase && includeRTL && roll < 0.15) {
      out += randomPadWord(PAD_POOL_VERTICAL_RTL, 2, 3, rng);
    } else if (verticalEdgeCase && roll < 0.40) {
      out += randomPadWord(PAD_POOL_VERTICAL, 2, 4, rng);
    } else if (includeRTL && roll < 0.70) {
      out += randomPadWord(PAD_POOL_RTL, 3, 8, rng);
    } else {
      out += randomPadWord(PAD_POOL_BASE, 3, 8, rng);
    }
  }
  return out;
}

function pseudolocalizeLine(line, includeRTL, verticalEdgeCase, counter, rng) {
  if (line.trim().length === 0) return line; // preserve blank lines / pure whitespace
  const decorated = protectedDecorate(line, counter, rng);
  const lineLen = graphemeLength(line);
  const targetExtra = Math.round(lineLen * expansionRatio(lineLen));
  const padding = targetExtra > 0 ? buildPadding(targetExtra, includeRTL, verticalEdgeCase, rng) : "";
  const body = padding ? decorated + " " + padding : decorated;
  // A strong RTL letter must be the line's very first character for the
  // paragraph's base direction to actually flip (see RTL_STRONG_LETTERS
  // comment above) — everything after it, including the bracket and the
  // decorated Latin text, then renders as an embedded LTR island within an
  // overall RTL flow, which mirrors how real RTL-locale UI actually looks
  // (product names, emails, etc. staying LTR inside RTL surroundings).
  const rtlPrefix = includeRTL ? randomPadWord(RTL_STRONG_LETTERS, 3, 6, rng) + " " : "";
  return rtlPrefix + "[" + body + "]";
}

function pseudolocalize(text, includeRTL, verticalEdgeCase, counter, rng) {
  return text.split("\n").map((line) => pseudolocalizeLine(line, includeRTL, verticalEdgeCase, counter, rng)).join("\n");
}

// ----------------------------------------------------------------------------
// 4. Script detection + per-range font assignment.
//    Noto Sans (core) only covers Latin/Greek/Cyrillic. Thai, Arabic,
//    Hebrew, and CJK each need their own Noto family. We tag every
//    character by script, group into contiguous runs, load whatever fonts
//    are actually needed, and apply them per-range so nothing renders as
//    tofu. Failed font loads fall back to Noto Sans (Latin-only rendering
//    for that run) and are counted as an "issue" for the Summary.
// ----------------------------------------------------------------------------

const SCRIPT_FONT = {
  thai: { family: "Noto Sans Thai" },
  arabic: { family: "Noto Sans Arabic" },
  hebrew: { family: "Noto Sans Hebrew" },
  cjk: { family: "Noto Sans JP" },
  latin: { family: "Noto Sans" } // also covers Greek + Cyrillic ranges below
};

// Direct links to each font family's Google Fonts page, for the error log's
// "specific links to relevant resources" requirement when a font fails to
// load — a plain family name isn't actionable, a page to install it from is.
const FONT_DOWNLOAD_LINKS = {
  "Noto Sans": "https://fonts.google.com/noto/specimen/Noto+Sans",
  "Noto Sans Thai": "https://fonts.google.com/noto/specimen/Noto+Sans+Thai",
  "Noto Sans Arabic": "https://fonts.google.com/noto/specimen/Noto+Sans+Arabic",
  "Noto Sans Hebrew": "https://fonts.google.com/noto/specimen/Noto+Sans+Hebrew",
  "Noto Sans JP": "https://fonts.google.com/noto/specimen/Noto+Sans+JP"
};

function detectScript(ch) {
  const cp = ch.codePointAt(0);
  if (cp >= 0x0e00 && cp <= 0x0e7f) return "thai";
  if ((cp >= 0x0600 && cp <= 0x06ff) || (cp >= 0x0750 && cp <= 0x077f) ||
      (cp >= 0xfb50 && cp <= 0xfdff) || (cp >= 0xfe70 && cp <= 0xfeff)) return "arabic";
  if (cp >= 0x0590 && cp <= 0x05ff) return "hebrew";
  if ((cp >= 0x4e00 && cp <= 0x9fff) || (cp >= 0x3040 && cp <= 0x30ff) ||
      (cp >= 0x3400 && cp <= 0x4dbf)) return "cjk";
  return "latin"; // Latin, Latin Extended, Greek, Cyrillic, digits, punctuation
}

function buildScriptRuns(text) {
  const chars = Array.from(text);
  const runs = [];
  let currentScript = null;
  let start = 0;
  let offset = 0;
  for (const ch of chars) {
    const script = detectScript(ch);
    if (currentScript === null) {
      currentScript = script;
      start = offset;
    } else if (script !== currentScript) {
      runs.push({ script: currentScript, start: start, end: offset });
      currentScript = script;
      start = offset;
    }
    offset += ch.length; // ch.length handles any surrogate pairs robustly
  }
  if (currentScript !== null) runs.push({ script: currentScript, start: start, end: offset });
  return runs;
}

// Loads and applies the correct font family per script run. Returns the
// list of font family names that failed to load (empty array if none) —
// used to build specific, linkable entries in the error log rather than
// just an opaque count.
async function applyScriptFonts(node, runs, isBold) {
  const failedFamilies = [];
  const resolved = {};
  const uniqueScripts = Array.from(new Set(runs.map((r) => r.script)));

  for (const script of uniqueScripts) {
    const family = SCRIPT_FONT[script].family;
    let chosen = { family: family, style: "Regular" };
    try {
      await figma.loadFontAsync({ family: family, style: "Regular" });
      if (isBold) {
        try {
          await figma.loadFontAsync({ family: family, style: "Bold" });
          chosen.style = "Bold";
        } catch (e) {
          // Bold not available for this family — Regular already loaded, keep it
        }
      }
    } catch (e) {
      failedFamilies.push(family);
      chosen = { family: "Noto Sans", style: "Regular" }; // fallback (already loaded elsewhere)
    }
    resolved[script] = chosen;
  }

  for (const run of runs) {
    node.setRangeFontName(run.start, run.end, resolved[run.script]);
  }
  return failedFamilies;
}

async function loadAllFontsInNode(node) {
  const fonts = node.getRangeAllFontNames(0, node.characters.length);
  for (const font of fonts) {
    await figma.loadFontAsync(font);
  }
  return fonts;
}

// ----------------------------------------------------------------------------
// 5. Color / contrast helpers for the overflow signal color (unchanged)
// ----------------------------------------------------------------------------

function hexToRgbObj(hex) {
  const clean = hex.replace("#", "");
  return {
    r: parseInt(clean.substring(0, 2), 16) / 255,
    g: parseInt(clean.substring(2, 4), 16) / 255,
    b: parseInt(clean.substring(4, 6), 16) / 255
  };
}

function relLuminance(c) {
  const t = (v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  const R = t(c.r), G = t(c.g), B = t(c.b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function contrastRatio(c1, c2) {
  const L1 = relLuminance(c1);
  const L2 = relLuminance(c2);
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

function getBackgroundColor(node) {
  let current = node.parent;
  while (current && current.type !== "PAGE" && current.type !== "DOCUMENT") {
    if ("fills" in current && Array.isArray(current.fills)) {
      const solid = current.fills.find((f) => f.type === "SOLID" && f.visible !== false);
      if (solid) return solid.color;
    }
    current = current.parent;
  }
  return { r: 1, g: 1, b: 1 }; // default Figma canvas white
}

// ----------------------------------------------------------------------------
// 6. Auto-layout overflow detection.
//    Fixed-size text nodes (textAutoResize: NONE) self-clip — that's what
//    the measurement block in run() catches. Auto-layout / "hug" text nodes
//    (HEIGHT or WIDTH_AND_HEIGHT) are DESIGNED to grow, so a fixed-size-style
//    check doesn't apply to them. Instead, growth is a problem when it
//    escapes a CLIPPING ancestor further up the tree — a fixed-size parent
//    frame, an auto-layout frame with a maxWidth/maxHeight ceiling, a
//    section, etc. Figma exposes exactly this via `clipsContent`: any
//    frame-like node with clipsContent === true visually clips whatever
//    doesn't fit inside its absoluteBoundingBox. Rather than reverse-engineer
//    every sizing-mode combination ourselves, we just ask Figma's own layout
//    engine (which has already reflowed everything live, the moment
//    node.characters was set) whether the text node's rendered box still
//    fits inside every clipping ancestor between it and the page.
// ----------------------------------------------------------------------------

function checkAncestorClipOverflow(node) {
  const nodeBox = node.absoluteBoundingBox;
  const result = { horizontal: false, vertical: false, ancestorName: null };
  if (!nodeBox) return result;

  let current = node.parent;
  while (current && current.type !== "PAGE" && current.type !== "DOCUMENT") {
    if ("clipsContent" in current && current.clipsContent === true) {
      const ancestorBox = current.absoluteBoundingBox;
      if (ancestorBox) {
        const escapesLeft = nodeBox.x < ancestorBox.x - 0.5;
        const escapesRight = nodeBox.x + nodeBox.width > ancestorBox.x + ancestorBox.width + 0.5;
        const escapesTop = nodeBox.y < ancestorBox.y - 0.5;
        const escapesBottom = nodeBox.y + nodeBox.height > ancestorBox.y + ancestorBox.height + 0.5;
        const escapesHorizontally = escapesLeft || escapesRight;
        const escapesVertically = escapesTop || escapesBottom;
        if (escapesHorizontally) result.horizontal = true;
        if (escapesVertically) result.vertical = true;
        if ((escapesHorizontally || escapesVertically) && !result.ancestorName) {
          result.ancestorName = current.name;
        }
      }
    }
    current = current.parent;
  }
  return result;
}

// Vertical diacritic / glyph-ink overflow. absoluteBoundingBox is the
// node's nominal layout box; absoluteRenderBounds is Figma's own accounting
// of the actual rendered ink extent, including anything — diacritics,
// ascenders, descenders — that falls outside that nominal box. Comparing
// the two catches tall marks poking above the first line or dropping below
// the last line.
//
// Known limitation, stated plainly: this catches ink escaping the node's
// OWN outer box. It does NOT catch a diacritic on one interior line visually
// colliding with a descender on the line above it inside a multi-line
// block — Figma's Plugin API doesn't expose per-line bounding boxes, and
// catching that specific case would require rendering to an image and doing
// pixel-level analysis, a meaningfully heavier feature than this check.
function checkVerticalOverflow(node) {
  const nominal = node.absoluteBoundingBox;
  const rendered = node.absoluteRenderBounds;
  if (!nominal || !rendered) return false;

  const overflowsTop = rendered.y < nominal.y - 0.5;
  const overflowsBottom = rendered.y + rendered.height > nominal.y + nominal.height + 0.5;
  return overflowsTop || overflowsBottom;
}

function pickSignalColor(bg) {
  let best = null;
  let bestRatio = 0;
  for (const hex of SIGNAL_PALETTE) {
    const rgb = hexToRgbObj(hex);
    const ratio = contrastRatio(rgb, bg);
    if (ratio > bestRatio) {
      bestRatio = ratio;
      best = rgb;
    }
  }
  return best;
}

// ----------------------------------------------------------------------------
// 5b. Implied-container overflow — a fallback for cases where neither the
//     fixed-box self-check nor the ancestor-clipsContent check applies. Two
//     distinct real patterns land here:
//
//     1. Sibling pattern: a decorative rectangle drawn as a "text field" or
//        "chip," with the actual text sitting on top of it as an unrelated,
//        unclipped sibling — never structurally parented, so Figma's own
//        layout engine has no containment relationship to enforce.
//
//     2. Parent pattern (found via real testing — a status bar clock that
//        overflowed a 54×18 "Time" frame without being flagged): the text's
//        DIRECT PARENT has an explicit, deliberately-set size but isn't
//        clipping — e.g. a plain (non-auto-layout) frame, which always has
//        a manually-set size, or an auto-layout frame with at least one
//        axis NOT set to hug. This is a genuinely different case from the
//        sibling pattern: containment against a parent doesn't need an
//        overlap-ratio threshold the way sibling-matching does, since a
//        child's original box is inherently within its parent's box in any
//        normal, non-overflowing layout — any qualifying parent is treated
//        as an implied container immediately, checked first, before
//        falling back to the sibling search.
//
//     Both are inference, not certainty (Figma itself enforces neither), so
//     both get labeled distinctly from the structural checks rather than
//     presented with the same confidence.
// ----------------------------------------------------------------------------

const CONTAINER_LIKE_TYPES = ["RECTANGLE", "FRAME", "COMPONENT", "INSTANCE", "ELLIPSE"];

// True if a frame-like node has a deliberate, explicit size on at least one
// axis rather than purely hugging its content. Plain (non-auto-layout)
// frames always qualify — there's no "hug" concept without layoutMode, so
// any size they have was manually set. Auto-layout frames only qualify if
// at least one axis isn't set to AUTO (hug).
function frameHasExplicitSize(frame) {
  if (!frame || !("absoluteBoundingBox" in frame)) return false;
  if (!("layoutMode" in frame)) return true; // not auto-layout-capable at all — treat as explicit
  if (frame.layoutMode === "NONE") return true; // plain frame — size is always manually set
  return frame.primaryAxisSizingMode !== "AUTO" || frame.counterAxisSizingMode !== "AUTO";
}

function findImpliedContainer(node, originalBox) {
  if (!originalBox) return null;

  // Priority 1: the direct parent, if it has a deliberate size and isn't
  // structurally clipping (if it WERE clipping, checkAncestorClipOverflow
  // already would have caught this before we ever get here).
  const parent = node.parent;
  if (parent && CONTAINER_LIKE_TYPES.indexOf(parent.type) !== -1 &&
      parent.clipsContent !== true && frameHasExplicitSize(parent)) {
    return parent;
  }

  // Priority 2 (fallback): sibling shapes that geometrically contained the
  // original text by more than 80% overlap — the decorative "text drawn
  // over an unrelated shape" pattern. Only reachable if the parent didn't
  // already qualify above.
  if (!parent || !("children" in parent)) return null;

  const textArea = originalBox.width * originalBox.height;
  if (textArea <= 0) return null;

  let bestCandidate = null;
  let bestRatio = 0;

  for (const sibling of parent.children) {
    if (sibling === node) continue;
    if (CONTAINER_LIKE_TYPES.indexOf(sibling.type) === -1) continue;
    if (sibling.visible === false) continue;
    const sibBox = sibling.absoluteBoundingBox;
    if (!sibBox) continue;

    const overlapLeft = Math.max(originalBox.x, sibBox.x);
    const overlapTop = Math.max(originalBox.y, sibBox.y);
    const overlapRight = Math.min(originalBox.x + originalBox.width, sibBox.x + sibBox.width);
    const overlapBottom = Math.min(originalBox.y + originalBox.height, sibBox.y + sibBox.height);
    if (overlapRight <= overlapLeft || overlapBottom <= overlapTop) continue; // no overlap at all

    const overlapArea = (overlapRight - overlapLeft) * (overlapBottom - overlapTop);
    const overlapRatio = overlapArea / textArea;

    if (overlapRatio > 0.8 && overlapRatio > bestRatio) {
      bestRatio = overlapRatio;
      bestCandidate = sibling;
    }
  }

  return bestCandidate;
}

function checkImpliedContainerOverflow(node, originalBox) {
  const result = { horizontal: false, vertical: false, containerName: null };
  const container = findImpliedContainer(node, originalBox);
  if (!container) return result;

  const newBox = node.absoluteBoundingBox;
  const containerBox = container.absoluteBoundingBox;
  if (!newBox || !containerBox) return result;

  const escapesLeft = newBox.x < containerBox.x - 0.5;
  const escapesRight = newBox.x + newBox.width > containerBox.x + containerBox.width + 0.5;
  const escapesTop = newBox.y < containerBox.y - 0.5;
  const escapesBottom = newBox.y + newBox.height > containerBox.y + containerBox.height + 0.5;

  result.horizontal = escapesLeft || escapesRight;
  result.vertical = escapesTop || escapesBottom;
  if (result.horizontal || result.vertical) result.containerName = container.name;
  return result;
}

// ----------------------------------------------------------------------------
// 6. Main run routine
// ----------------------------------------------------------------------------

function collectTextNodes(nodes) {
  const result = [];
  function walk(node) {
    if (node.type === "TEXT") {
      result.push(node);
    } else if ("children" in node) {
      node.children.forEach(walk);
    }
  }
  nodes.forEach(walk);
  return result;
}

async function run(includeRTL, verticalEdgeCase) {
  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    return { stats: null, issueLog: [], errorLog: [], notice: "Select a text layer or a frame containing text layers." };
  }

  const textNodes = collectTextNodes(selection);

  if (textNodes.length === 0) {
    return { stats: null, issueLog: [], errorLog: [], notice: "No text layers found in the selection." };
  }

  // Simplified to exactly four summary rows. Everything more granular
  // (which axis, structural vs. inferred, which font failed) still gets
  // captured — just in issueLog/errorLog for the expandable review and the
  // log file, rather than as its own top-level stat.
  const stats = {
    processed: 0,
    locIssuesFound: 0,
    skippedLocked: 0,
    skippedEmpty: 0,
    errors: 0
  };
  // Marks a node with the exact pseudolocalized string last written to it,
  // so a later run can tell "this node's current text IS what we last
  // produced" (skip — nothing's changed) apart from "current text differs
  // from what we last produced" (process it — either never pseudolocalized,
  // or the source was edited/reverted since). Storing the actual output
  // string, not a boolean flag, is what makes that second distinction
  // possible.
  const PSEUDOLOC_OUTPUT_KEY = "shibbLastPseudoOutput";

  const issueLog = []; // { nodeId, nodeName, messages: [...] } — one entry per flagged node
  const errorLog = [];  // { nodeId, nodeName, message, link } — for the Export .txt file and the review accordion
  const skippedLockedLog = []; // { nodeId, nodeName } — one entry per locked/hidden layer skipped
  const skippedEmptyLog = [];  // { nodeId, nodeName, reason } — empty layers, already-pseudolocalized layers, and layers that are nothing but a date/number/ID/placeholder

  for (const node of textNodes) {
    try {
      if (node.locked || node.visible === false) {
        stats.skippedLocked++;
        skippedLockedLog.push({ nodeId: node.id, nodeName: node.name });
        continue;
      }
      if (node.characters.length === 0) {
        stats.skippedEmpty++;
        skippedEmptyLog.push({ nodeId: node.id, nodeName: node.name, reason: "empty" });
        continue;
      }

      // Already pseudolocalized: this node's CURRENT text is exactly what
      // this plugin last wrote to it, meaning nothing's changed since —
      // re-processing would double-pseudolocalize (bracket-wrap-within-
      // bracket-wrap) rather than test anything new.
      let lastOutput = "";
      try {
        lastOutput = node.getPluginData(PSEUDOLOC_OUTPUT_KEY);
      } catch (e) {
        // No prior data, or storage unavailable — treat as never pseudolocalized.
      }
      if (lastOutput && lastOutput === node.characters) {
        stats.skippedEmpty++;
        skippedEmptyLog.push({ nodeId: node.id, nodeName: node.name, reason: "already" });
        continue;
      }

      // Nothing but a date, number, technical ID, or placeholder — no real
      // prose for this run to test. Skipped as a whole node (not just the
      // matched substring) so it doesn't get bracket-wrapped and padded
      // around content that was never meant to carry translatable text.
      if (isTextEntirelyExcluded(node.characters)) {
        stats.skippedEmpty++;
        skippedEmptyLog.push({ nodeId: node.id, nodeName: node.name, reason: "excluded" });
        continue;
      }

      const originalFonts = await loadAllFontsInNode(node);
      const isBold = !!(originalFonts[0] && /bold/i.test(originalFonts[0].style));

      // Capture original styling before we touch anything, so we can both
      // measure accurately and re-approximate the source typeface's density
      // on the Noto Sans replacement afterward. x/y matter here too: when
      // textAutoResize switches to WIDTH_AND_HEIGHT below, Figma grows the
      // box from its text-alignment anchor (e.g. center-aligned text grows
      // symmetrically in both directions), which shifts the node's position
      // — not just its size. Restoring width/height alone leaves the node
      // correctly sized but wrongly placed, so position must be restored too.
      const originalStyle = {
        fontSize: node.getRangeFontSize(0, 1),
        letterSpacing: node.getRangeLetterSpacing(0, 1),
        lineHeight: node.getRangeLineHeight(0, 1),
        textAutoResize: node.textAutoResize,
        width: node.width,
        height: node.height,
        x: node.x,
        y: node.y
      };
      const originalBox = node.absoluteBoundingBox; // captured pre-edit, for the implied-container fallback below

      const originalText = node.characters;
      const placeholderCounter = { count: 0 };
      // Seeded by node id + original text — deterministic per node, so
      // re-running against an unchanged design reproduces the same output
      // and the same overflow verdicts. Changes automatically if the source
      // text itself is edited.
      const rng = createSeededRng(node.id + "::" + originalText);
      const pseudo = pseudolocalize(originalText, includeRTL, verticalEdgeCase, placeholderCounter, rng);

      // Set the new text while still in the ORIGINAL font. This lets us
      // measure overflow against the real typeface's metrics (kerning,
      // average advance width) rather than Noto Sans's, which may be
      // narrower or wider than whatever ships to production.
      node.characters = pseudo;
      try {
        node.setPluginData(PSEUDOLOC_OUTPUT_KEY, pseudo);
      } catch (e) {
        // Non-fatal — just means a future run won't recognize this node as
        // already-pseudolocalized and will re-process it. Not worth failing over.
      }

      let horizontalOverflow = false;
      let verticalOverflow = false;
      let horizontalDelta = 0;
      let verticalDelta = 0;
      let clipAncestorName = null;
      const isAutoSized = originalStyle.textAutoResize !== "NONE";
      if (!isAutoSized) {
        try {
          node.textAutoResize = "WIDTH_AND_HEIGHT";
          const measuredW = node.width;
          const measuredH = node.height;
          horizontalOverflow = measuredW > originalStyle.width + 0.5;
          verticalOverflow = measuredH > originalStyle.height + 0.5;
          horizontalDelta = Math.round(measuredW - originalStyle.width);
          verticalDelta = Math.round(measuredH - originalStyle.height);
        } finally {
          node.textAutoResize = "NONE";
          node.resizeWithoutConstraints(originalStyle.width, originalStyle.height);
          node.x = originalStyle.x;
          node.y = originalStyle.y;
        }
      }

      // Now assign the correct Noto family per script range so every
      // injected character actually renders.
      const runs = buildScriptRuns(pseudo);
      const failedFonts = await applyScriptFonts(node, runs, isBold);
      if (failedFonts.length > 0) {
        stats.errors += failedFonts.length;
        for (const family of failedFonts) {
          errorLog.push({
            nodeId: node.id,
            nodeName: node.name,
            message: "Could not load \"" + family + "\" \u2014 those characters fell back to Noto Sans and may render as missing-glyph boxes instead of the intended script.",
            link: FONT_DOWNLOAD_LINKS[family] || null
          });
        }
      }

      // Re-approximate the original typeface's density on the Noto Sans
      // replacement: same size, same tracking, same explicit leading.
      const len = node.characters.length;
      node.setRangeFontSize(0, len, originalStyle.fontSize);
      node.setRangeLetterSpacing(0, len, originalStyle.letterSpacing);
      if (originalStyle.lineHeight.unit !== "AUTO") {
        node.setRangeLineHeight(0, len, originalStyle.lineHeight);
      }

      // Ancestor-clip check runs AFTER font/size/spacing reapplication above,
      // since those edits can themselves shift wrapping and final dimensions
      // — checking any earlier would measure a transitional, not final, state.
      let isImpliedContainer = false;
      if (isAutoSized) {
        const clip = checkAncestorClipOverflow(node);
        horizontalOverflow = clip.horizontal;
        verticalOverflow = clip.vertical;
        clipAncestorName = clip.ancestorName;

        // Fallback: no structural clipping ancestor caught anything — check
        // whether this text was originally sitting inside an unrelated,
        // unclipped decorative shape (the classic "text over a drawn input
        // box" pattern) that it may now be escaping.
        if (!horizontalOverflow && !verticalOverflow) {
          const implied = checkImpliedContainerOverflow(node, originalBox);
          if (implied.horizontal || implied.vertical) {
            horizontalOverflow = implied.horizontal;
            verticalOverflow = implied.vertical;
            clipAncestorName = implied.containerName;
            isImpliedContainer = true;
          }
        }
      }

      stats.processed++;

      // Three genuinely distinct failure modes at the detection level, still
      // disambiguated internally (different messages, different signal
      // colors) — but rolled up into ONE "LOC issues found" count per node
      // for the summary, since a node with both a horizontal and a vertical
      // issue is one problem to review, not two.
      const messages = [];

      if (horizontalOverflow) {
        messages.push({
          color: "#FF6A00",
          text: isImpliedContainer
            ? "Horizontal overflow (inferred) \u2014 escapes the bounds of \"" + clipAncestorName + "\", a container it visually sits inside but isn't structurally clipped by. Consider enabling \"Clip content\" on it, or confirm this text is meant to be unconstrained. Verify visually."
            : isAutoSized
            ? "Horizontal overflow \u2014 escapes " + (clipAncestorName || "a clipping ancestor") + "."
            : "Horizontal overflow \u2014 exceeds container width by " + horizontalDelta + "px."
        });
      }
      if (verticalOverflow) {
        messages.push({
          color: "#0088FF",
          text: isImpliedContainer
            ? "Vertical overflow (inferred) \u2014 escapes the bounds of \"" + clipAncestorName + "\", a container it visually sits inside but isn't structurally clipped by. Consider enabling \"Clip content\" on it, or confirm this text is meant to be unconstrained. Verify visually."
            : isAutoSized
            ? "Vertical overflow \u2014 escapes " + (clipAncestorName || "a clipping ancestor") + "."
            : "Vertical overflow \u2014 exceeds container height by " + verticalDelta + "px."
        });
      }
      if (horizontalOverflow || verticalOverflow) {
        const bg = getBackgroundColor(node);
        const signal = pickSignalColor(bg);
        node.fills = [{ type: "SOLID", color: signal }];
      }

      // Vertical diacritic/ink overflow — always checked, not gated behind
      // any toggle (only the character INCLUSION is optional; detection
      // isn't). Uses a stroke rather than a fill color so it stays visually
      // distinguishable from the box/ancestor overflow signal above, even
      // when both fire on the same node.
      if (checkVerticalOverflow(node)) {
        node.strokes = [{ type: "SOLID", color: hexToRgbObj(VERTICAL_OVERFLOW_COLOR) }];
        node.strokeWeight = 2;
        messages.push({
          color: VERTICAL_OVERFLOW_COLOR,
          text: "Possible line collision \u2014 glyph ink (diacritics/marks) extends beyond this box vertically. Approximation only, since Figma's plugin API doesn't expose per-line bounds \u2014 verify visually."
        });
      }

      if (messages.length > 0) {
        stats.locIssuesFound++;
        issueLog.push({ nodeId: node.id, nodeName: node.name, messages: messages });
      }
    } catch (err) {
      stats.errors++;
      errorLog.push({
        nodeId: node.id,
        nodeName: node.name,
        message: "This layer could not be pseudolocalized. " + (err && err.message ? err.message : String(err)),
        link: null
      });
      console.error("Pseudolocalize error on node:", node.name, err);
    }
  }

  return {
    stats: stats,
    issueLog: issueLog,
    errorLog: errorLog,
    skippedLockedLog: skippedLockedLog,
    skippedEmptyLog: skippedEmptyLog,
    firstSelectedNodeId: selection[0] ? selection[0].id : null,
    notice: null
  };
}

// ----------------------------------------------------------------------------
// 6c. Collision-avoidance repositioning for the review panel. When Back/Next
//     jumps the canvas to a flagged node, the panel itself doesn't move —
//     it can end up sitting directly on top of the exact issue it's
//     describing. This checks for that overlap and nudges the panel just
//     clear of it, choosing whichever of four candidate positions (push
//     right / left / down / up) requires the LEAST movement from the
//     panel's current spot, and does nothing at all if no candidate keeps
//     the panel within the visible viewport (per spec: don't move it rather
//     than push it somewhere worse).
//
//     KNOWN LIMITATION, confirmed via multiple independent Figma forum
//     reports: figma.ui.reposition() silently stops having any effect the
//     first time a user manually drags the panel — no error, it just quietly
//     no-ops from then on. This is a real, currently-unresolved bug in
//     Figma's own plugin API, not something fixable from plugin code. If
//     this feature appears to "stop working" partway through a session,
//     that's almost certainly why.
// ----------------------------------------------------------------------------

function avoidCoveringNode(node) {
  try {
    const nodeBox = node.absoluteBoundingBox;
    if (!nodeBox) return;

    const zoom = figma.viewport.zoom;
    const pos = figma.ui.getPosition(); // throws if no UI is available
    const panelBox = {
      x: pos.canvasSpace.x,
      y: pos.canvasSpace.y,
      width: currentPanelWidthPx / zoom,
      height: currentPanelHeightPx / zoom
    };

    const overlaps = !(
      panelBox.x + panelBox.width < nodeBox.x ||
      panelBox.x > nodeBox.x + nodeBox.width ||
      panelBox.y + panelBox.height < nodeBox.y ||
      panelBox.y > nodeBox.y + nodeBox.height
    );
    if (!overlaps) return; // nothing to do — most common case

    const viewBounds = figma.viewport.bounds; // {x, y, width, height} in canvas space
    const margin = 16 / zoom; // ~16px visual gap between panel and node, in canvas units

    const candidates = [
      { x: nodeBox.x + nodeBox.width + margin, y: panelBox.y }, // push right
      { x: nodeBox.x - panelBox.width - margin, y: panelBox.y }, // push left
      { x: panelBox.x, y: nodeBox.y + nodeBox.height + margin }, // push down
      { x: panelBox.x, y: nodeBox.y - panelBox.height - margin }  // push up
    ];

    const valid = candidates.filter((c) => {
      return (
        c.x + panelBox.width > viewBounds.x &&
        c.x < viewBounds.x + viewBounds.width &&
        c.y + panelBox.height > viewBounds.y &&
        c.y < viewBounds.y + viewBounds.height
      );
    });

    if (valid.length === 0) return; // impossible to clear the node without leaving the visible area — leave the panel alone, per spec

    let best = valid[0];
    let bestDist = Math.hypot(best.x - panelBox.x, best.y - panelBox.y);
    for (const c of valid) {
      const dist = Math.hypot(c.x - panelBox.x, c.y - panelBox.y);
      if (dist < bestDist) {
        bestDist = dist;
        best = c;
      }
    }

    figma.ui.reposition(best.x, best.y);
  } catch (e) {
    // getPosition()/reposition() can throw, or silently no-op per the known
    // Figma bug described above — fail silently either way rather than
    // break the review flow over a cosmetic positioning nicety.
  }
}

figma.ui.onmessage = (msg) => {
  if (msg.type === "settingsChanged") {
    const settings = {
      includeRTL: !!msg.includeRTL,
      verticalEdgeCase: !!msg.verticalEdgeCase,
      alwaysShowSummary: !!msg.alwaysShowSummary
    };
    figma.clientStorage.setAsync(SETTINGS_KEY, settings).catch(() => {
      // Non-fatal — the checkbox state just won't persist this time.
    });
  } else if (msg.type === "selectNode") {
    // Next/Back in the issue review — jump canvas selection + viewport to
    // the flagged node. getNodeByIdAsync (not the sync getNodeById) is
    // required under "documentAccess": "dynamic-page".
    figma.getNodeByIdAsync(msg.nodeId).then((node) => {
      if (node && "type" in node) {
        figma.currentPage.selection = [node];
        figma.viewport.scrollAndZoomIntoView([node]);
        avoidCoveringNode(node);
      }
    }).catch(() => {
      // Node may have been deleted/modified since the run — non-fatal, just don't jump.
    });
  } else if (msg.type === "avoidCoveringSelection") {
    // First-display obstruction check. Deliberately does NOT change
    // figma.currentPage.selection or call scrollAndZoomIntoView — this
    // runs before any row is expanded, so there's no specific flagged
    // issue to jump to yet. It just checks the panel against whatever the
    // user already had selected when they invoked Run, so the panel at
    // least doesn't land on top of their current work by coincidence.
    figma.getNodeByIdAsync(msg.nodeId).then((node) => {
      if (node && "type" in node) {
        avoidCoveringNode(node);
      }
    }).catch(() => {
      // Node may have been deleted since the run started — non-fatal, just skip positioning.
    });
  } else if (msg.type === "close") {
    figma.closePlugin();
  } else if (msg.type === "resize") {
    currentPanelWidthPx = msg.width;
    currentPanelHeightPx = msg.height;
    figma.ui.resize(msg.width, msg.height);
  }
};
