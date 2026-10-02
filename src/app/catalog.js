export const rooms = [
  { id: "bedroom", title: "Bedroom & Closet", tile: "Bedroom", image: "wardrobe 24.webp" },
  { id: "kitchen", title: "Kitchen & Dining", tile: "Kitchen", image: "dishpack1.webp" },
  { id: "living-room", title: "Living Room & Media", tile: "Living Room", image: "64 flat panel tv box.webp" },
  { id: "home-office", title: "Home Office", tile: "Office", image: "file storage box with lid.webp" },
  { id: "garage", title: "Garage & Storage", tile: "Garage", image: "mighty box with handles.webp" },
  { id: "whole-home", title: "Whole Home / General Packing", tile: "Whole Home", image: "xlarge.webp" },
  { id: "nursery", title: "Kids / Nursery", tile: "Nursery", image: "bicycle crib box.webp" },
];

const baseBoxes = [
  { id: "small", name: "Small Box", image: "small.webp", price: 3, type: "standard", purpose: "Books & Heavy Items", detail: "16 × 12 × 12 in · 1.5 cu. ft.", rooms: ["bedroom", "kitchen", "home-office", "nursery", "garage", "whole-home"] },
  { id: "snap-open-small", name: "Snap-Open Small 1.5", image: "snap open auto small 1.5.webp", price: 3.5, type: "standard", purpose: "Quick-assembly small packing", detail: "1.5 cu. ft.", rooms: ["home-office", "whole-home"] },
  { id: "medium", name: "Medium Box", image: "medium.webp", price: 4, type: "standard", purpose: "Everyday Packing", detail: "18 × 18 × 16 in · 3.0 cu. ft.", rooms: ["bedroom", "kitchen", "living-room", "home-office", "nursery", "garage", "whole-home"] },
  { id: "large", name: "Large Box", image: "large.webp", price: 6, type: "standard", purpose: "Clothes & Household Items", detail: "24 × 18 × 18 in · 4.5 cu. ft.", rooms: ["bedroom", "kitchen", "living-room", "nursery", "garage", "whole-home"] },
  { id: "xlarge", name: "X-Large Box", image: "xlarge.webp", price: 9.5, type: "standard", purpose: "Bedding & Bulky Items", detail: "24 × 18 × 24 in · 6.0 cu. ft.", rooms: ["bedroom", "living-room", "nursery", "garage", "whole-home"] },
  { id: "wardrobe-20", name: "Wardrobe 20\"", image: "wardrobe 20.webp", price: 12, type: "wardrobe", purpose: "Hanging clothes", detail: "20-inch wardrobe carton", rooms: ["bedroom"] },
  { id: "wardrobe-24", name: "Wardrobe 24\"", image: "wardrobe 24.webp", price: 14, type: "wardrobe", purpose: "Hanging clothes", detail: "24-inch wardrobe carton", rooms: ["bedroom"] },
  { id: "laydown-wardrobe", name: "Laydown Wardrobe", image: "laydown wardrobe.webp", price: 10, type: "wardrobe", purpose: "Clothing & linens", detail: "Lay-down wardrobe carton", rooms: ["bedroom"] },
  { id: "tv-46", name: "46\" TV Box", image: "46in flat panel tv box.webp", price: 13, type: "electronics", purpose: "Flat-panel televisions", detail: "For screens up to 46 inches", rooms: ["living-room"] },
  { id: "tv-56", name: "56\" TV Box", image: "56 flat panel tv box.webp", price: 15, type: "electronics", purpose: "Flat-panel televisions", detail: "For screens up to 56 inches", rooms: ["living-room"] },
  { id: "tv-64", name: "64\" TV Box", image: "64 flat panel tv box.webp", price: 17, type: "electronics", purpose: "Flat-panel televisions", detail: "For screens up to 64 inches", rooms: ["living-room"] },
  { id: "tv-70", name: "70\" TV Box", image: "70 flat panel tv box.webp", price: 20, type: "electronics", purpose: "Flat-panel televisions", detail: "For screens up to 70 inches", rooms: ["living-room"] },
  { id: "electronic-double-wall", name: "Electronic Box Double Wall", image: "electronic box double wall.webp", price: 15, type: "electronics", purpose: "Heavy or valuable electronics", detail: "Double wall · 24 × 18 × 18 in", rooms: ["living-room", "home-office"] },
  { id: "electronix-double-wall", name: "Electronix Box Double Wall", image: "electronix box double wall.webp", price: 20, type: "electronics", purpose: "TVs, monitors & electronics", detail: "Double wall · 42 × 12 × 24 in", rooms: ["living-room", "home-office"] },
  { id: "computer-microwave", name: "Computer / Microwave Box", image: "computer microwave box.webp", price: 13, type: "electronics", purpose: "Computers & microwaves", detail: "Reinforced protection", rooms: ["kitchen", "home-office"] },
  { id: "dish-pack", name: "Dish Pack", image: "dishpack1.webp", price: 9, type: "dish", purpose: "Dishes & glassware", detail: "18 × 18 × 28 in · double wall", rooms: ["kitchen"] },
  { id: "dish-pack-double", name: "Dish Pack Double Wall", image: "dish pack double.webp", price: 12, type: "dish", purpose: "Fragile dishes & kitchenware", detail: "Double-wall protection", rooms: ["kitchen"] },
  { id: "dish-glass-ez", name: "Dish / Glass EZ Pack", image: "dish glass ez pack.webp", price: 18, type: "dish", purpose: "Dishes & glasses", detail: "Protective dividers included", rooms: ["kitchen"] },
  { id: "dish-pack-combo", name: "Dish Pack Combo", image: "dishpack-combo.webp", price: 20, type: "dish", purpose: "Kitchen dishes & glassware", detail: "Combination packing set", rooms: ["kitchen"] },
  { id: "dish-pack-combo-2", name: "Dish Pack Combo 2", image: "dish pack combo 2.webp", price: 25, type: "dish", purpose: "Kitchen dishes & glassware", detail: "Combination packing set", rooms: ["kitchen"] },
  { id: "mirror-small", name: "Small Mirror Box", image: "small mirror 24x4x26.webp", price: 8.5, type: "mirror", purpose: "Mirrors, pictures & artwork", detail: "24 × 4 × 26 in", rooms: ["bedroom", "living-room"] },
  { id: "mirror-medium", name: "Medium Mirror Box", image: "Medium Mirror 37x4x27.webp", price: 9.5, type: "mirror", purpose: "Mirrors, pictures & artwork", detail: "37 × 4 × 27 in", rooms: ["bedroom", "living-room"] },
  { id: "mirror-large", name: "Large Mirror Box", image: "large mirror 48x4x32.webp", price: 11.5, type: "mirror", purpose: "Mirrors, pictures & artwork", detail: "48 × 4 × 32 in", rooms: ["bedroom", "living-room"] },
  { id: "bicycle-crib", name: "Bicycle / Crib Box", image: "bicycle crib box.webp", price: 28, type: "specialty", purpose: "Bicycles & cribs", detail: "Large specialty carton", rooms: ["nursery", "garage"] },
  { id: "lamp-base", name: "Lamp Base Box", image: "lamp base box.webp", price: 12, type: "specialty", purpose: "Lamp bases & tall decor", detail: "Protective specialty carton", rooms: ["living-room"] },
  { id: "mighty-box", name: "Mighty Box with Handles", image: "mighty box with handles.webp", price: 12, type: "specialty", purpose: "Heavy & valuable items", detail: "Double wall · carry handles", rooms: ["home-office", "garage", "whole-home"] },
  { id: "file-storage", name: "File Storage Box with Lid", image: "file storage box with lid.webp", price: 8, type: "storage", purpose: "Files & documents", detail: "Lid included · 33 L", rooms: ["home-office", "garage"] },
];

const packPricing = {
  small: { 10: 18, 20: 35, 30: 55, 50: 90 },
  medium: { 10: 38, 20: 75, 30: 110, 50: 190 },
  large: { 10: 42, 20: 85, 30: 126, 50: 215 },
};
const packVariants = ["small", "medium", "large"].flatMap((id) => {
  const box = baseBoxes.find((item) => item.id === id);
  return Object.entries(packPricing[id]).map(([count, price]) => ({
    ...box,
    id: `${id}-${count}`,
    baseId: box.id,
    price,
    packQty: Number(count),
    badge: `×${count}`,
  }));
});

export const boxProducts = [...baseBoxes, ...packVariants];
export const productsById = Object.fromEntries(boxProducts.map((product) => [product.id, product]));

// Room collections follow the packing lists supplied for this store.
// Pack sizes belong to the same room collection as their individual carton.
export const roomProductIds = {
  bedroom: ["small", "medium", "large", "xlarge", "wardrobe-20", "wardrobe-24", "laydown-wardrobe", "mirror-small", "mirror-medium", "mirror-large"],
  kitchen: ["small", "medium", "large", "dish-pack", "dish-pack-double", "dish-glass-ez", "dish-pack-combo", "dish-pack-combo-2", "computer-microwave"],
  "living-room": ["medium", "large", "xlarge", "tv-46", "tv-56", "tv-64", "tv-70", "electronic-double-wall", "lamp-base", "mirror-small", "mirror-medium", "mirror-large"],
  "home-office": ["small", "snap-open-small", "medium", "file-storage", "computer-microwave", "electronic-double-wall", "mighty-box"],
  nursery: ["small", "medium", "large", "xlarge", "bicycle-crib"],
  garage: ["small", "medium", "large", "xlarge", "mighty-box", "bicycle-crib", "file-storage"],
  "whole-home": ["small", "snap-open-small", "medium", "large", "xlarge", "mighty-box"],
};

export function getRoomProducts(roomId) {
  if (!roomId || roomId === "all") return boxProducts;
  const ids = new Set(roomProductIds[roomId] || []);
  return boxProducts.filter((product) => ids.has(product.baseId || product.id));
}

const homeBoxCategories = [
  { id: "small", title: "Small Boxes", productIds: ["small", "snap-open-small"] },
  { id: "medium", title: "Medium Boxes", productIds: ["medium"] },
  { id: "large", title: "Large Boxes", productIds: ["large"] },
  { id: "xlarge", title: "X-Large Boxes", productIds: ["xlarge"] },
  { id: "wardrobe", title: "Wardrobe & Clothing Boxes", type: "wardrobe" },
  { id: "electronics", title: "TV & Electronics Boxes", type: "electronics" },
  { id: "dish", title: "Dish & Glass Boxes", type: "dish" },
  { id: "mirror", title: "Mirror & Picture Boxes", type: "mirror" },
  { id: "specialty", title: "Specialty Moving Boxes", type: "specialty" },
  { id: "storage", title: "File & Storage Boxes", type: "storage" },
];

export function getHomeBoxSections(roomId) {
  const roomProducts = getRoomProducts(roomId);
  return homeBoxCategories.map((category) => ({
    ...category,
    products: roomProducts.filter((product) => category.productIds
      ? category.productIds.includes(product.baseId || product.id)
      : product.type === category.type),
  })).filter((category) => category.products.length > 0);
}

export const supplies = [
  { id: "bubble-wrap", name: "Bubble Wrap (5 metres)", image: "/images/bubble-wrap-5m-500x625.jpg.webp", price: 12, type: "supply", purpose: "Cushion fragile belongings", detail: "5 metre roll" },
  { id: "packing-tape", name: "Packing Tape", image: "/images/sellotape-1-500x625.jpg.webp", price: 5, type: "supply", purpose: "Seal boxes securely", detail: "Heavy-duty clear tape" },
  { id: "fragile-tape", name: "Fragile Tape", image: "/images/fragile-tape-1-500x625.jpg.webp", price: 15, type: "supply", purpose: "Mark delicate boxes clearly", detail: "2 rolls" },
  { id: "cutter-knife", name: "Cutter Knife", image: "/images/cutter-knife2.jpg", price: 10, type: "supply", purpose: "Open and cut packing material", detail: "Retractable blade" },
  { id: "marker-pen", name: "Marker Pen", image: "/images/marker-pen-500x625.jpg.webp", price: 5, type: "supply", purpose: "Label boxes by room", detail: "Permanent marker" },
  { id: "mattress-cover", name: "Mattress Cover (King Size)", image: "/images/matthress-cover-plastic-x1-1-500x625.jpg.webp", price: 12, type: "supply", purpose: "Protect your mattress in transit", detail: "King size" },
  { id: "sofa-cover", name: "Sofa Cover", image: "/images/sofa-cover-500x625.jpg.webp", price: 18, type: "supply", purpose: "Keep upholstery clean during the move", detail: "Stretch-fit cover" },
  { id: "tape-dispenser", name: "Tape Dispenser", image: "/images/tape-dispenser-2-500x625.jpg.webp", price: 15.95, type: "supply", purpose: "Apply packing tape quickly", detail: "Heavy-duty dispenser" },
];

export const types = [
  { id: "standard", title: "Standard Moving Boxes", blurb: "Small — Books & Heavy Items · Medium — Everyday Packing · Large — Clothes & Household Items · X-Large — Bedding & Bulky Items", productIds: boxProducts.filter((product) => product.type === "standard").map((product) => product.id) },
  { id: "wardrobe", title: "Wardrobe & Clothing Boxes", blurb: "Keep clothes ready to hang and easy to unpack.", productIds: boxProducts.filter((product) => product.type === "wardrobe").map((product) => product.id) },
  { id: "electronics", title: "TV & Electronics Boxes", blurb: "Specialty protection for screens, computers and electronics.", productIds: boxProducts.filter((product) => product.type === "electronics").map((product) => product.id) },
  { id: "dish", title: "Dish & Glass Boxes", blurb: "Purpose-built cartons for dishes and delicate glassware.", productIds: boxProducts.filter((product) => product.type === "dish").map((product) => product.id) },
  { id: "mirror", title: "Mirror & Picture Boxes", blurb: "Three sizes for mirrors, pictures and framed artwork.", productIds: boxProducts.filter((product) => product.type === "mirror").map((product) => product.id) },
  { id: "specialty", title: "Specialty Moving Boxes", blurb: "Bicycle, crib, lamp and heavy-duty cartons.", productIds: boxProducts.filter((product) => product.type === "specialty").map((product) => product.id) },
  { id: "storage", title: "File & Storage Boxes", blurb: "Lidded storage for files and documents.", productIds: boxProducts.filter((product) => product.type === "storage").map((product) => product.id) },
];

export const kits = [
  { id: "kit-studio", name: "Studio Moving Kit", image: "/kits/studio.webp", badge: "STUDIO", boxCount: 17, price: 95, contents: [["Small", 4], ["Medium", 6], ["Large", 4], ["X-Large", 1], ["Wardrobe 20\"", 1], ["Dish Pack", 1]] },
  { id: "kit-1-bedroom", name: "1 Bedroom Moving Kit", image: "/kits/1-bedroom.webp", badge: "1 BEDROOM", boxCount: 24, price: 125, contents: [["Small", 6], ["Medium", 8], ["Large", 5], ["X-Large", 2], ["Wardrobe 20\"", 2], ["Dish Pack", 1]] },
  { id: "kit-2-bedroom", name: "2 Bedroom Moving Kit", image: "/kits/2-bedroom.webp", badge: "2 BEDROOMS", boxCount: 40, price: 175, contents: [["Small", 10], ["Medium", 12], ["Large", 8], ["X-Large", 4], ["Wardrobe 20\"", 4], ["Dish Pack", 2]] },
  { id: "kit-3-bedroom", name: "3 Bedroom Moving Kit", image: "/kits/3-bedroom.webp", badge: "3 BEDROOMS", boxCount: 60, price: 265, contents: [["Small", 15], ["Medium", 18], ["Large", 12], ["X-Large", 6], ["Wardrobe 20\"", 6], ["Dish Pack", 3]] },
  { id: "kit-4-bedroom", name: "4 Bedroom Moving Kit", image: "/kits/4-bedroom.webp", badge: "4 BEDROOMS", boxCount: 80, price: 415, contents: [["Small", 20], ["Medium", 24], ["Large", 16], ["X-Large", 8], ["Wardrobe 20\"", 8], ["Dish Pack", 4]] },
  { id: "kit-5-bedroom", name: "5 Bedroom Moving Kit", image: "/kits/5-bedroom.webp", badge: "5 BEDROOMS", boxCount: 100, price: 515, contents: [["Small", 25], ["Medium", 30], ["Large", 20], ["X-Large", 10], ["Wardrobe 20\"", 10], ["Dish Pack", 5]] },
];

export const kitAddonGroups = [
  { title: "Extra clothing storage", options: ["laydown-wardrobe"] },
  { title: "TV", options: ["tv-46", "tv-56", "tv-64", "tv-70"] },
  { title: "Mirrors & artwork", options: ["mirror-small", "mirror-medium", "mirror-large"] },
  { title: "Computer or microwave", options: ["computer-microwave"] },
  { title: "Extra dishes & glasses", options: ["dish-glass-ez"] },
  { title: "Bicycle or crib", options: ["bicycle-crib"] },
  { title: "Lamp", options: ["lamp-base"] },
  { title: "Files / documents", options: ["file-storage"] },
  { title: "Heavy / valuable items", options: ["mighty-box", "electronic-double-wall", "electronix-double-wall"] },
].map((group) => ({ ...group, products: group.options.map((id) => productsById[id]) }));
