// Dosya: kervan_ticareti_3d.js

class Transaction {
    constructor(item, quantity, price) {
        this.item = item;
        this.quantity = quantity;
        this.price = price;
    }
}

class Merchant {
    constructor(name, inventory) {
        this.name = name;
        this.inventory = inventory;
    }
}

class Buyer {
    constructor(name, wallet) {
        this.name = name;
        this.wallet = wallet;
    }
}

class Item {
    constructor(name, price) {
        this.name = name;
        this.price = price;
    }
}

class Inventory {
    constructor() {
        this.items = [];
    }

    addItem(item, quantity) {
        this.items.push({ item, quantity });
    }

    removeItem(item, quantity) {
        const index = this.items.findIndex(i => i.item === item);
        if (index !== -1) {
            this.items[index].quantity -= quantity;
            if (this.items[index].quantity === 0) {
                this.items.splice(index, 1);
            }
        }
    }
}

class Wallet {
    constructor(balance) {
        this.balance = balance;
    }

    deposit(amount) {
        this.balance += amount;
    }

    withdraw(amount) {
        if (this.balance >= amount) {
            this.balance -= amount;
            return true;
        }
        return false;
    }
}

class MarketPlace {
    constructor(merchants) {
        this.merchants = merchants;
    }

    getMerchants() {
        return this.merchants;
    }
}

class TradeLog {
    constructor(transactions) {
        this.transactions = transactions;
    }

    logTransaction(transaction) {
        this.transactions.push(transaction);
    }
}

class TicaretManager {
    constructor(merchants, buyers, items, inventoryList, walletList, marketPlaceList, tradeLogList) {
        this.merchants = merchants;
        this.buyers = buyers;
        this.items = items;
        this.inventoryList = inventoryList;
        this.walletList = walletList;
        this.marketPlaceList = marketPlaceList;
        this.tradeLogList = tradeLogList;
        this.currentTransaction = null;
        this.currentMerchant = null;
        this.currentBuyer = null;
        this.currentItem = null;
        this.currentInventory = null;
        this.currentWallet = null;
        this.currentMarketPlace = null;
        this.currentTradeLog = null;
    }

    initializeTicaret() {
        this.currentMerchant = this.merchants[0];
        this.currentBuyer = this.buyers[0];
        this.currentItem = this.items[0];
        this.currentInventory = this.inventoryList[0];
        this.currentWallet = this.walletList[0];
        this.currentMarketPlace = this.marketPlaceList[0];
        this.currentTradeLog = this.tradeLogList[0];
    }

    updateTicaret() {
        // Update logic for the trade interface
    }

    handleTransaction() {
        if (this.currentMerchant.inventory.removeItem(this.currentItem, 1) && this.currentBuyer.wallet.withdraw(this.currentItem.price)) {
            this.currentMerchant.wallet.deposit(this.currentItem.price);
            this.currentTradeLog.logTransaction(new Transaction(this.currentItem, 1, this.currentItem.price));
        }
    }

    handleBuy() {
        this.handleTransaction();
    }

    handleSell() {
        this.handleTransaction();
    }

    updateInventory() {
        // Update the inventory display
    }

    updateWallet() {
        // Update the wallet display
    }
}

// Initialize the game
const kervanTicaret = new TicaretManager(
    [new Merchant("Merchant1", new Inventory())],
    [new Buyer("Buyer1", new Wallet(100))],
    [new Item("Sword", 10)],
    [new Inventory()],
    [new Wallet(100)],
    [new MarketPlace([new Merchant("Merchant1", new Inventory())])],
    [new TradeLog([])]
);

kervanTicaret.initializeTicaret();