
export const nodeColorMap = {
  Category: '#FF6384',     // Pinkish-red
  Condition: '#36A2EB',    // Blue
  ControlMethod: '#4BC0C0', // Teal
  Design: '#9966FF',       // Purple
  Event: '#FF9F40',        // Orange
  Factor: '#FFCD56',       // Yellow
  LayoutType: '#C9CBCF',   // Gray
  LocationType: '#8AC926', // Green
  ObservationMethod: '#FF6B6B', // Coral
  Scale: '#4ECDC4',        // Turquoise
  Subject: '#45B7D1',      // Sky Blue
  Term: '#F7B32D',         // Gold
  Trait: '#6A5ACD',        // Slate Blue
  Variable: '#FF69B4'      // Hot Pink
}

export function getNodeColor(typeName) {
  return nodeColorMap[typeName] || '#666666'
}