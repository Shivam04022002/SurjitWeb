// Categorical slots, assigned per entity and never by rank, so a series keeps
// its colour whatever else is on screen. Validated as a set for colour-vision
// deficiency on a white surface; the lighter two sit below 3:1 contrast, which
// is why every chart that uses them also prints the values beside the colour.
export const SERIES = {
  blue: '#2a78d6',
  orange: '#eb6834',
  aqua: '#1baf7a',
  yellow: '#eda100'
}

export const nf = new Intl.NumberFormat('en-IN')
