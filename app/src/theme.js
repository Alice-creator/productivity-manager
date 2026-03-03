// Central theme — change colors here to retheme the whole app
export const T = {
  // Backgrounds
  bg:           '#0B0D13',  // page background — deep navy
  surface:      '#131620',  // cards, panels, dropdowns
  elevated:     '#1A1E2B',  // inputs, hover states, raised elements
  overlay:      'rgba(0,0,0,0.55)', // modal/login overlay

  // Borders
  border:       '#1E2230',  // subtle borders
  borderStrong: '#2A2F40',  // visible borders (card edges)

  // Text
  text:         '#E2E4EA',  // primary text
  textSub:      '#7B819A',  // secondary text
  textDim:      '#4A4F63',  // muted labels
  textFaint:    '#2E3244',  // very dim (icons, hour labels)
  textOnLight:  '#374151',  // text on light backgrounds (e.g. Google button)
  buttonText:   '#FFFFFF',  // white text on accent buttons

  // Accents
  accent:       '#6B8AFF',  // blue accent
  accentSoft:   'rgba(107,138,255,0.15)', // accent background tint
  success:      '#34D399',  // green
  successSoft:  'rgba(52,211,153,0.1)',   // green background tint
  successBorder:'rgba(52,211,153,0.25)',  // green border tint
  streak:       '#2EFF46',  // bright green (activity streak)
  warning:      '#F59E0B',  // amber
  warningSoft:  'rgba(245,158,11,0.1)',   // amber background tint
  warningBorder:'rgba(245,158,11,0.25)',  // amber border tint
  purple:       '#A78BFA',  // purple accent
  danger:       '#F87171',  // red text
  dangerBorder: '#2D1520',  // red border bg

  // Default task (no category assigned)
  taskBg:       '#1a2540',  // task card background
  taskBorder:   '#5580cc',  // task card border
  taskText:     '#7aaeff',  // task card text

  // Shadows
  shadow:       '0 4px 12px rgba(0,0,0,0.15)',  // light elevation
  shadowHeavy:  '0 8px 30px rgba(0,0,0,0.6)',   // dropdown menus
}

// Preset color palette for category picker
export const PRESET_COLORS = ['#7C8AFF', '#5BA4F5', '#34D399', '#FBBF4E', '#F87171', '#F472B6', '#A78BFA', '#2DD4BF']
