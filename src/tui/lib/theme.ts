export const NAME = 'Wakaru';
export const TAGLINE = 'Japanese sentence and word miner for Anki';

// Credit to folke for the color scheme
// https://github.com/folke/tokyonight.nvim/blob/main/lua/tokyonight/colors/storm.lua
// TODO: make a theme selector (later)
export const colorscheme = {
  bg: '#1a1b26',
  bgDark: '#16161e',
  bgSecondary: '#0c0e14',
  bgHighlight: '#292e42',
  blue: '#7aa2f7',
  blue0: '#3d59a1',
  blue1: '#2ac3de',
  blue2: '#0db9d7',
  blue5: '#89ddff',
  blue6: '#b4f9f8',
  blue7: '#394b70',
  comment: '#565f89',
  cyan: '#7dcfff',
  dark3: '#545c7e',
  dark5: '#737aa2',
  fg: '#c0caf5',
  fgDark: '#a9b1d6',
  green: '#9ece6a',
  green1: '#73daca',
  green2: '#41a6b5',
  magenta: '#bb9af7',
  magenta2: '#ff007c',
  orange: '#ff9e64',
  purple: '#9d7cd8',
  red: '#f7768e',
  red1: '#db4b4b',
  teal: '#1abc9c',
  yellow: '#e0af68',
  terminalBlack: '#414868',

  // Extended palette
  primary: '#bb9af7',
  muted: '#565f89',
  danger: '#f7768e',
  warning: '#e0af68',
  info: '#7aa2f7',
  gutter: '#3b4261',
  text: '#c0caf5',
} as const;
