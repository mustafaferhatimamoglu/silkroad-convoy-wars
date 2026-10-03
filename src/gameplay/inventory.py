"""
Silkroad V2 - Inventory & Item Engine
"""
class Item:
    def __init__(self, item_id, name, item_type="weapon", plus=0, durability=100, max_stack=1):
        self.item_id = item_id
        self.name = name
        self.item_type = item_type
        self.plus = plus
        self.durability = durability
        self.max_stack = max_stack
        self.count = 1

class Inventory:
    def __init__(self, size=48):
        self.size = size
        self.slots = [None] * size

    def add_item(self, item):
        # Önce mevcut stack'i ara
        if item.max_stack > 1:
            for s in self.slots:
                if s and s.item_id == item.item_id and s.count < s.max_stack:
                    s.count += item.count
                    return True
        # Boş slota ekle
        for idx in range(self.size):
            if self.slots[idx] is None:
                self.slots[idx] = item
                return True
        return False

    def remove_item(self, slot_idx):
        if 0 <= slot_idx < self.size and self.slots[slot_idx] is not None:
            item = self.slots[slot_idx]
            self.slots[slot_idx] = None
            return item
        return None
