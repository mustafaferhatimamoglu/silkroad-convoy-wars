"""
Unit Tests for Caravan & Trade Route Engine
"""
import pytest
from src.gameplay.caravan import CaravanVehicle, TradeRouteManager

def test_caravan_loading():
    camel = CaravanVehicle(vehicle_type="Camel", max_capacity=20)
    success, _ = camel.load_goods("Silk Fabric", count=15, weight_per_unit=1)
    assert success is True
    assert camel.capacity_used == 15
    # Kapasite aşımı testi
    failed, msg = camel.load_goods("Iron Ore", count=10, weight_per_unit=1)
    assert failed is False
    assert "Kapasite aşıldı" in msg

def test_trade_profit_calculation():
    res = TradeRouteManager.calculate_trade_profit("Jangan", "Hotan", 100000)
    assert res["gross_return"] == 350000
    assert res["net_profit"] == 250000
    assert res["thief_risk"] == 0.75

def test_invalid_trade_route():
    with pytest.raises(ValueError):
        TradeRouteManager.calculate_trade_profit("Jangan", "Tokyo", 50000)
