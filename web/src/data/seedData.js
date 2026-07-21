export const seedProducts = [
  {
    id: 1, name: "Linen Midi Dress", sku: "LMD-001", category: "Dresses",
    quantity: 24, price: 3200, status: "verified", daysUnmoved: 62,
    sales: [{ month: "Jan", qty: 3 }, { month: "Feb", qty: 1 }, { month: "Mar", qty: 0 }],
    isDeadStock: true, stuckValue: 76800, missingDetails: [], image: null,
    sizes: ["XS","S","M","L"], colors: ["Ivory", "Sage"]
  },
  {
    id: 2, name: "Cotton Cargo Pants", sku: "CCP-044", category: "Bottoms",
    quantity: null, price: 1850, status: "draft", daysUnmoved: 14,
    sales: [{ month: "Jan", qty: 8 }, { month: "Feb", qty: 6 }, { month: "Mar", qty: 9 }],
    isDeadStock: false, stuckValue: 0, missingDetails: ["quantity", "size"],
    sizes: [], colors: ["Khaki"]
  },
  {
    id: 3, name: "Silk Wrap Blouse", sku: null, category: "Tops",
    quantity: 18, price: null, status: "unverified", daysUnmoved: 90,
    sales: [{ month: "Jan", qty: 0 }, { month: "Feb", qty: 0 }, { month: "Mar", qty: 0 }],
    isDeadStock: true, stuckValue: null, missingDetails: ["price", "sku"],
    sizes: ["S","M","L","XL"], colors: ["Blush", "Champagne", "Black"]
  },
  {
    id: 4, name: "Denim Jacket Oversized", sku: "DJO-019", category: "Outerwear",
    quantity: 7, price: 4500, status: "verified", daysUnmoved: 5,
    sales: [{ month: "Jan", qty: 12 }, { month: "Feb", qty: 15 }, { month: "Mar", qty: 11 }],
    isDeadStock: false, stuckValue: 0, missingDetails: [],
    sizes: ["S","M","L","XL","XXL"], colors: ["Indigo", "Light Wash"]
  },
  {
    id: 5, name: "Knit Co-ord Set", sku: "KCS-007", category: "Sets",
    quantity: 31, price: 5200, status: "verified", daysUnmoved: 45,
    sales: [{ month: "Jan", qty: 2 }, { month: "Feb", qty: 1 }, { month: "Mar", qty: 1 }],
    isDeadStock: true, stuckValue: 161200, missingDetails: [],
    sizes: ["XS","S","M","L"], colors: ["Camel", "Cream"]
  },
  {
    id: 6, name: "Pleated Trousers", sku: "PT-033", category: "Bottoms",
    quantity: 12, price: 2800, status: "verified", daysUnmoved: 28,
    sales: [{ month: "Jan", qty: 5 }, { month: "Feb", qty: 4 }, { month: "Mar", qty: 3 }],
    isDeadStock: false, stuckValue: 0, missingDetails: [],
    sizes: ["XS","S","M","L","XL"], colors: ["Black", "Beige", "Navy"]
  },
  {
    id: 7, name: "Embroidered Kurta", sku: null, category: "Ethnic",
    quantity: 8, price: null, status: "draft", daysUnmoved: 120,
    sales: [{ month: "Jan", qty: 0 }, { month: "Feb", qty: 0 }, { month: "Mar", qty: 0 }],
    isDeadStock: true, stuckValue: null, missingDetails: ["price", "sku", "category"],
    sizes: ["S","M","L"], colors: ["Multicolor"]
  },
  {
    id: 8, name: "Lace Bodysuit", sku: "LB-055", category: "Tops",
    quantity: 45, price: 1400, status: "unverified", daysUnmoved: 75,
    sales: [{ month: "Jan", qty: 3 }, { month: "Feb", qty: 2 }, { month: "Mar", qty: 1 }],
    isDeadStock: true, stuckValue: 63000, missingDetails: [],
    sizes: ["XS","S","M","L"], colors: ["White", "Nude", "Black"]
  }
];

export const seedActions = [
  { id: 1, type: "price", label: "Add price to 3 products", priority: "high", productIds: [3, 7] },
  { id: 2, type: "quantity", label: "Verify quantity for Cotton Cargo Pants", priority: "high", productIds: [2] },
  { id: 3, type: "deadstock", label: "Review 4 dead stock candidates", priority: "medium", productIds: [1, 3, 5, 8] },
  { id: 4, type: "detail", label: "Complete SKU for 2 products", priority: "medium", productIds: [3, 7] },
  { id: 5, type: "verify", label: "Verify 2 unverified inventory items", priority: "low", productIds: [3, 8] },
];

export const dashboardStats = {
  inventoryAtRisk: { count: 3, value: 285000 },
  potentialRecovery: { value: 301000, products: 4 },
  deadStockOpportunity: { count: 4, value: 301000 },
  requiresAttention: { count: 5 },
  partnerFollowUp: { count: 1 }
};
