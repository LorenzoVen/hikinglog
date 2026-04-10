// Master checklist items — sourced from Checklist.csv
// Grouped by category, used to seed a new trip's checklist

export const CHECKLIST_ITEMS = [
  // Clothing
  { id: 'clothing-socks',    category: 'Clothing', description: 'Extra Socks' },
  { id: 'clothing-tshirt',   category: 'Clothing', description: 'Extra T-shirt' },
  { id: 'clothing-gloves',   category: 'Clothing', description: 'Gloves' },
  { id: 'clothing-hat',      category: 'Clothing', description: 'Hat' },
  { id: 'clothing-gaiter',   category: 'Clothing', description: 'Neck gaiter' },
  { id: 'clothing-quickdry', category: 'Clothing', description: 'Quick-dry layer' },
  { id: 'clothing-rain',     category: 'Clothing', description: 'Rain cover' },
  { id: 'clothing-sunnies',  category: 'Clothing', description: 'Sunglasses' },
  // Food
  { id: 'food-colddrink',    category: 'Food', description: 'Cold Drink' },
  { id: 'food-fruit',        category: 'Food', description: 'Fruit' },
  { id: 'food-lunch',        category: 'Food', description: 'Lunch' },
  { id: 'food-proteinbar',   category: 'Food', description: 'Protein Bar' },
  { id: 'food-snacks',       category: 'Food', description: 'Snacks' },
  { id: 'food-warmdrink',    category: 'Food', description: 'Warm Drink' },
  { id: 'food-water',        category: 'Food', description: 'Water' },
  { id: 'food-purifier',     category: 'Food', description: 'Water Purifier' },
  // Gear
  { id: 'gear-backpack',     category: 'Gear', description: 'Backpack' },
  { id: 'gear-blanket',      category: 'Gear', description: 'Blanket' },
  { id: 'gear-crampons',     category: 'Gear', description: 'Crampons' },
  { id: 'gear-knife',        category: 'Gear', description: 'Knife' },
  { id: 'gear-poles',        category: 'Gear', description: 'Trekking Poles' },
  // Navigation
  { id: 'nav-compass',       category: 'Navigation', description: 'Compass' },
  { id: 'nav-gps',           category: 'Navigation', description: 'GPS' },
  { id: 'nav-map',           category: 'Navigation', description: 'Map' },
  { id: 'nav-watch',         category: 'Navigation', description: 'Watch' },
  // Personal Items
  { id: 'personal-cash',     category: 'Personal Items', description: 'Cash' },
  { id: 'personal-id',       category: 'Personal Items', description: 'ID' },
  // Safety
  { id: 'safety-bivy',       category: 'Safety', description: 'Bivy' },
  { id: 'safety-bugspray',   category: 'Safety', description: 'Bug Spray' },
  { id: 'safety-cables',     category: 'Safety', description: 'Cables' },
  { id: 'safety-firstaid',   category: 'Safety', description: 'First-Aid Kit' },
  { id: 'safety-inhaler',    category: 'Safety', description: 'Inhaler' },
  { id: 'safety-lighter',    category: 'Safety', description: 'Lighter/Matches' },
  { id: 'safety-powerbank',  category: 'Safety', description: 'Power Bank' },
  { id: 'safety-sunscreen',  category: 'Safety', description: 'Sunscreen' },
  { id: 'safety-whistle',    category: 'Safety', description: 'Whistle' },
  { id: 'safety-wipes',      category: 'Safety', description: 'Wipes' },
]

export const CHECKLIST_CATEGORIES = [...new Set(CHECKLIST_ITEMS.map(i => i.category))]
