"""
Silkroad V2 - Caravan & Trade Route Engine
Jangan <-> Donwhang <-> Hotan ticaret hatları, kervan araçları ve hırsız pusu sistemi.
"""
class CaravanVehicle:
    def __init__(self, vehicle_type="Camel", max_capacity=50, max_hp=5000, speed=10):
        self.vehicle_type = vehicle_type
        self.max_capacity = max_capacity
        self.capacity_used = 0
        self.current_hp = max_hp
        self.max_hp = max_hp
        self.speed = speed
        self.cargo = {}

    def load_goods(self, good_name, count, weight_per_unit=1):
        total_weight = count * weight_per_unit
        if self.capacity_used + total_weight > self.max_capacity:
            return False, "Kapasite aşıldı!"
        self.cargo[good_name] = self.cargo.get(good_name, 0) + count
        self.capacity_used += total_weight
        return True, "Yük yüklendi."

class TradeRouteManager:
    ROUTES = {
        ("Jangan", "Donwhang"): {"base_distance": 1200, "profit_mult": 1.5, "thief_risk": 0.3},
        ("Donwhang", "Hotan"): {"base_distance": 2500, "profit_mult": 2.2, "thief_risk": 0.5},
        ("Jangan", "Hotan"): {"base_distance": 3700, "profit_mult": 3.5, "thief_risk": 0.75}
    }

    @classmethod
    def calculate_trade_profit(cls, start_city, dest_city, invested_gold):
        key = (start_city, dest_city)
        reverse_key = (dest_city, start_city)
        route = cls.ROUTES.get(key) or cls.ROUTES.get(reverse_key)
        if not route:
            raise ValueError("Böyle bir ticaret rotası bulunmamaktadır!")
        gross = int(invested_gold * route["profit_mult"])
        net_profit = gross - invested_gold
        return {
            "start": start_city,
            "destination": dest_city,
            "invested": invested_gold,
            "gross_return": gross,
            "net_profit": net_profit,
            "thief_risk": route["thief_risk"]
        }
