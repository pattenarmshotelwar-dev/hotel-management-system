export interface ChecklistItem {
  id: string
  label: string
  isPremium?: boolean
}

export interface ChecklistCategory {
  id: string
  title: string
  iconName: string
  description: string
  items: ChecklistItem[]
}

export const ROOM_CLEANING_CHECKLIST: ChecklistCategory[] = [
  {
    id: 'bedding',
    title: 'Bedroom & Sleeping Area',
    iconName: 'Bed',
    description: 'Bed linen freshness, mattress protection, and room presentation',
    items: [
      { id: 'mattress_check', label: 'Mattress inspected & clean' },
      { id: 'mattress_protector', label: 'Fresh mattress protector fitted' },
      { id: 'pillows_protectors', label: 'Pillows & pillow protectors fresh & plumped' },
      { id: 'duvet_cover', label: 'Duvet & fresh duvet cover fitted smoothly' },
      { id: 'bed_sheets', label: 'Fresh crisp bed sheets fitted without creases' },
      { id: 'blankets_throws', label: 'Clean blankets / throws neatly folded at foot of bed' },
      { id: 'extra_pillows', label: 'Extra pillows checked in wardrobe/closet' },
      { id: 'bedside_tables', label: 'Bedside tables dusted & sanitized' },
      { id: 'bedside_lamps', label: 'Bedside lamps wiped & bulbs working' },
      { id: 'alarm_usb', label: 'Alarm clock / bedside USB charger tested' },
      { id: 'curtains', label: 'Curtains / blackout curtains hung properly & working' },
    ],
  },
  {
    id: 'bathroom_consumables',
    title: 'Bathroom Consumables & Towels',
    iconName: 'Sparkles',
    description: 'Linen replenishment and consumable stock',
    items: [
      { id: 'bath_towels', label: 'Fresh Bath towels folded / hung (2 per double room)' },
      { id: 'hand_towels', label: 'Fresh Hand towels placed neatly' },
      { id: 'face_cloths', label: 'Fresh Face cloths folded' },
      { id: 'bath_mat', label: 'Clean Bath mat placed outside shower/bath' },
      { id: 'toilet_paper', label: 'Toilet paper rolls stocked (at least 1 full + 1 spare with fold)' },
      { id: 'facial_tissues', label: 'Facial tissues box replenished' },
      { id: 'bin_liners', label: 'Fresh bin liners fitted in sanitary & bathroom bins' },
      { id: 'drinking_glasses', label: 'Sanitized disposable cups / drinking glasses' },
      { id: 'drinking_water', label: 'Complimentary drinking water bottle' },
    ],
  },
  {
    id: 'toiletries',
    title: 'Toiletries & Personal Care',
    iconName: 'Package',
    description: 'Individual guest personal care kits and refillable dispensers',
    items: [
      { id: 'shampoo', label: 'Shampoo (refilled dispenser or fresh bottle)' },
      { id: 'conditioner', label: 'Conditioner (refilled dispenser or fresh bottle)' },
      { id: 'body_wash', label: 'Body wash / shower gel stocked' },
      { id: 'hand_body_lotion', label: 'Hand & body lotion stocked' },
      { id: 'hand_soap', label: 'Hand soap placed at wash basin' },
      { id: 'facial_soap', label: 'Facial soap supplied' },
      { id: 'shower_cap', label: 'Shower cap in vanity presentation' },
      { id: 'vanity_kit', label: 'Vanity kit (cotton buds & cotton pads)' },
      { id: 'dental_kit', label: 'Dental kit (toothbrush & toothpaste)' },
      { id: 'shaving_kit', label: 'Shaving kit available' },
      { id: 'comb', label: 'Guest comb' },
      { id: 'sewing_kit', label: 'Sewing / repair kit' },
      { id: 'sanitary_bags', label: 'Sanitary disposal bags stocked in dispenser' },
      { id: 'tissues_pack', label: 'Individual tissue packet' },
    ],
  },
  {
    id: 'bathroom_equipment',
    title: 'Bathroom Fixtures & Sanitisation',
    iconName: 'Bath',
    description: 'Deep sanitized fixtures, clean tiles, and working equipment',
    items: [
      { id: 'toilet_bowl', label: 'Toilet bowl, seat & hinge sanitized and bleached' },
      { id: 'toilet_brush', label: 'Toilet brush clean in sanitized holder' },
      { id: 'toilet_roll_holder', label: 'Toilet-roll holder polished & spotless' },
      { id: 'shower_screen', label: 'Shower glass screen / curtain wiped free of watermarks' },
      { id: 'dispensers_clean', label: 'Wall dispensers wiped clean and pumps primed' },
      { id: 'mirror_clean', label: 'Mirror & shaving mirror polished smear-free' },
      { id: 'clothes_hooks', label: 'Clothes hooks secure & dust-free' },
      { id: 'hairdryer_bath', label: 'Hairdryer clean with cord neatly wound' },
      { id: 'bathrobes', label: 'Luxury Bathrobes hung (premium amenity)', isPremium: true },
      { id: 'slippers', label: 'Wrapped Slippers placed (premium amenity)', isPremium: true },
      { id: 'bath_salts', label: 'Aromatherapy bath salts stocked', isPremium: true },
    ],
  },
  {
    id: 'refreshments',
    title: 'Hospitality Tray & Refreshments',
    iconName: 'Coffee',
    description: 'Hot beverage station, kettle, and room service literature',
    items: [
      { id: 'kettle_descaled', label: 'Kettle emptied, clean inside & outside, cord tidy' },
      { id: 'tea_bags', label: 'English breakfast tea bags stocked (4+)' },
      { id: 'coffee_sachets', label: 'Coffee sachets stocked (4+)' },
      { id: 'decaf_coffee', label: 'Decaffeinated coffee sachets (2+)' },
      { id: 'sugar_sweeteners', label: 'White & brown sugar sticks, sweeteners' },
      { id: 'milk_creamer', label: 'UHT milk pots / fresh creamer pods' },
      { id: 'cups_mugs', label: 'Clean ceramic cups/mugs and teaspoons' },
      { id: 'water_glasses', label: 'Clean water glasses inverted or coaster-placed' },
      { id: 'mini_fridge', label: 'Mini fridge clean, cold, and odour-free' },
      { id: 'welcome_booklet', label: 'Patten Arms hotel info & Wi-Fi card in holder' },
      { id: 'room_service_menu', label: 'Room service menu clean & up to date' },
      { id: 'dnd_sign', label: 'Do Not Disturb door hanger on inside door handle' },
    ],
  },
  {
    id: 'room_equipment',
    title: 'Room Furniture & Inventory',
    iconName: 'Armchair',
    description: 'Wardrobe essentials, waste disposal, and iron station',
    items: [
      { id: 'iron_ironing_board', label: 'Iron clean with water drained & ironing board folded' },
      { id: 'coat_hangers', label: 'Coat hangers arranged uniformly in wardrobe (min 6)' },
      { id: 'luggage_rack', label: 'Luggage rack clean & accessible' },
      { id: 'safe_check', label: 'Electronic safe open, empty & reset for guest' },
      { id: 'waste_bins', label: 'All room waste bins emptied and wiped' },
      { id: 'laundry_bag', label: 'Guest laundry bag & slip in wardrobe' },
      { id: 'notepad_pen', label: 'Branded notepad & working pen on desk' },
      { id: 'surfaces_vacuumed', label: 'Carpet vacuumed edge-to-edge / hard floor mopped' },
    ],
  },
  {
    id: 'technology',
    title: 'Technology & Electrical Check',
    iconName: 'Tv',
    description: 'Confirm all electronics are in working order for the next guest',
    items: [
      { id: 'tv_test', label: 'Television turned on, working & remote control sanitized' },
      { id: 'wifi_check', label: 'Wi-Fi connectivity verified in room' },
      { id: 'telephone_test', label: 'Room telephone dial tone checked' },
      { id: 'usb_ports', label: 'Wall USB charging ports & socket switches tested' },
    ],
  },
]

export const HOUSEKEEPING_CART_CHEMICALS = [
  { name: 'Multi-purpose cleaner', usage: 'All hard surfaces, desk, tables, sills' },
  { name: 'Glass & window cleaner', usage: 'Smear-free mirrors, glass shower screens, windows' },
  { name: 'Bathroom cleaner', usage: 'Bathtubs, shower trays, basins, tile walls' },
  { name: 'Toilet cleaner & bleach', usage: 'Toilet bowls, rim sanitisation & descaling' },
  { name: 'Disinfectant / Sanitiser', usage: 'High-touch points (switches, handles, remotes, taps)' },
  { name: 'Hard floor cleaner', usage: 'Mopping tiled and hard floor corridors & bathrooms' },
  { name: 'Carpet cleaner & spot remover', usage: 'Spot-treating carpet stains, rugs & upholstery' },
  { name: 'Furniture & wood polish', usage: 'Headboards, desks, wardrobes & timber finishes' },
  { name: 'Stainless-steel cleaner', usage: 'Taps, shower fittings, lift doors, handles' },
  { name: 'Descaler / limescale remover', usage: 'Kettle descaling, shower heads & tap aerators' },
  { name: 'Degreaser', usage: 'Tough grease, extractor areas, heavy marks' },
  { name: 'Mould & mildew cleaner', usage: 'Silicone sealants, tile grouting in wet rooms' },
  { name: 'Air freshener / odour eliminator', usage: 'Final room spray leaving clean hotel fragrance' },
]
