export const COLORS = {
  SKY: '#72D7EE',
  TREE: '#005108',
  FOG: '#005108',
  ROAD: {
    LIGHT: {
      road: '#6B6B6B',
      grass: '#10AA10',
      rumble: '#555555',
      lane: '#CCCCCC'
    },
    DARK: { road: '#696969', grass: '#009A00', rumble: '#BBBBBB' },
    START: { road: 'white', grass: 'white', rumble: 'white' },
    FINISH: { road: 'black', grass: 'black', rumble: 'black' }
  }
} as const

export type RoadColor = typeof COLORS['ROAD'][keyof typeof COLORS['ROAD']]
