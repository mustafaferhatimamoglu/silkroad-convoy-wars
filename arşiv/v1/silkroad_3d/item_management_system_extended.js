class Item {
  constructor(id, name, description, type, quantity, weight, value, equippable, onUse) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.type = type;
    this.quantity = quantity;
    this.weight = weight;
    this.value = value;
    this.equippable = equippable;
    this.onUse = onUse;
  }
}

class Inventory {
  constructor() {
    this.items = [];
  }

  add(item) {
    this.items.push(item);
  }

  remove(id) {
    this.items = this.items.filter(item => item.id !== id);
  }

  use(id) {
    const item = this.get(id);
    if (item && item.onUse) {
      item.onUse();
    }
  }

  get(item) {
    return this.items.find(i => i.id === item.id);
  }

  count(id) {
    return this.items.filter(i => i.id === id).length;
  }
}

class ItemManager {
  constructor() {
    this.items = [];
  }

  create(item) {
    this.items.push(item);
  }

  load(items) {
    this.items = items;
  }

  save(items) {
    return this.items;
  }

  delete(id) {
    this.items = this.items.filter(item => item.id !== id);
  }

  update(item) {
    const index = this.items.findIndex(i => i.id === item.id);
    if (index !== -1) {
      this.items[index] = item;
    }
  }
}

class EquippableItem extends Item {
  constructor(id, name, description, type, quantity, weight, value, equippable, onUse, slot, armorClass, damage, range, durability) {
    super(id, name, description, type, quantity, weight, value, equippable, onUse);
    this.slot = slot;
    this.armorClass = armorClass;
    this.damage = damage;
    this.range = range;
    this.durability = durability;
  }
}

class ConsumableItem extends Item {
  constructor(id, name, description, type, quantity, weight, value, equippable, onUse, effect, duration, frequency, usageCount) {
    super(id, name, description, type, quantity, weight, value, equippable, onUse);
    this.effect = effect;
    this.duration = duration;
    this.frequency = frequency;
    this.usageCount = usageCount;
  }
}

class CurrencyItem extends Item {
  constructor(id, name, description, type, quantity, weight, value, equippable, onUse, amount, currencyType) {
    super(id, name, description, type, quantity, weight, value, equippable, onUse);
    this.amount = amount;
    this.currencyType = currencyType;
  }
}

class StorageManager {
  constructor() {
    this.storage = [];
  }

  add(item) {
    this.storage.push(item);
  }

  remove(id) {
    this.storage = this.storage.filter(item => item.id !== id);
  }

  search(query) {
    return this.storage.filter(item => item.name.toLowerCase().includes(query.toLowerCase()));
  }
}