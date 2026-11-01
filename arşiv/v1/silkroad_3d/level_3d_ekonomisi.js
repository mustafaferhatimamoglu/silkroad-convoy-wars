// level_3d_ekonomisi.js

// Para birimlerinin değerlerini tutar
const currencyValues = {
  Simya: 10,
  Zerk: 5
};

// Mağaza içindeki öğeleri ve fiyatlarını tutar
const marketItems = {
  item1: 100,
  item2: 50,
  item3: 200
};

// Ekonomik sistemi temsil eden sınıf
class EconomicalSystem {
  constructor(currencyType) {
    this.currencyType = currencyType;
    this.resources = {
      currency: 0,
      items: {}
    };
  }

  calculateCost(item) {
    return marketItems[item] * currencyValues[this.currencyType];
  }

  updateCurrency(amount) {
    this.resources.currency += amount;
  }

  buyItem(item, amount) {
    const cost = this.calculateCost(item) * amount;
    if (this.resources.currency >= cost) {
      this.resources.currency -= cost;
      if (!this.resources.items[item]) {
        this.resources.items[item] = 0;
      }
      this.resources.items[item] += amount;
      return true;
    }
    return false;
  }

  sellItem(item, amount) {
    const price = marketItems[item] * currencyValues[this.currencyType] * amount;
    if (this.resources.items[item] >= amount) {
      this.resources.items[item] -= amount;
      this.resources.currency += price;
      return true;
    }
    return false;
  }

  getCurrency() {
    return this.resources.currency;
  }
}

// Mağaza sınıfı
class Marketplace {
  constructor() {
    this.items = {};
  }

  addItem(item, price) {
    this.items[item] = price;
    return true;
  }

  removeItem(item) {
    delete this.items[item];
    return true;
  }

  getItemPrice(item) {
    return this.items[item];
  }

  listItems() {
    return this.items;
  }
}

// Satıcılar arasında ticari işlemi yöneten sınıf
class TradeHandler {
  constructor() {
    this.traders = [];
  }

  addTrader(trader) {
    this.traders.push(trader);
    return true;
  }

  removeTrader(trader) {
    const index = this.traders.indexOf(trader);
    if (index !== -1) {
      this.traders.splice(index, 1);
      return true;
    }
    return false;
  }

  handleTrade(trader1, trader2, item, amount) {
    if (trader1.buyItem(item, amount)) {
      trader2.sellItem(item, amount);
      return true;
    }
    return false;
  }
}

// Para biriminin değerini hesaplar
function calculateCurrencyValue(currencyType) {
  return currencyValues[currencyType];
}

// Mağaza içindeki öğenin fiyatı günceller
function updateMarketPrices(item, price) {
  if (marketItems[item]) {
    marketItems[item] = price;
    return true;
  }
  return false;
}

// Satıcılar arasındaki ticari işlemi işler
function processTrade(trader1, trader2, item, amount) {
  return TradeHandler.handleTrade(trader1, trader2, item, amount);
}