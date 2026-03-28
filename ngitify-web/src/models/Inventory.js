export class Inventory {
    constructor({ 
      id = '', 
      itemName = '', 
      category = '', 
      quantity = 0, 
      reorderThreshold = 10, 
      unit = 'pcs', 
      lastUpdated = new Date().toISOString() 
    } = {}) {
      this.id = id;
      this.itemName = itemName;
      this.category = category; // 'Consumables', 'Instruments', 'Medication'
      this.quantity = quantity;
      this.reorderThreshold = reorderThreshold;
      this.unit = unit;
      this.lastUpdated = lastUpdated;
    }
  
    needsReorder() {
      return this.quantity <= this.reorderThreshold;
    }
  }